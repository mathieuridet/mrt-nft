import { ethers } from "hardhat";

async function main() {
  const oldAddr = "0x8Da386F89CF7c876b3b66e56aFde97a96E216041";
  const toAddr  = "0x2098026A19521B9B2623cCD772104e627fB8b700";
  const AMOUNT = "150";

  // Use the owner signer
  const provider = ethers.provider;
  const signer =
    process.env.PRIVATE_KEY
      ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
      : (await ethers.getSigners())[0];

  const me = await signer.getAddress();
  console.log("Signer:", me);

  // Attach to old distributor
  const distributor = await ethers.getContractAt("MerkleDistributor", oldAddr, signer);
  const owner = await distributor.owner();
  if (owner.toLowerCase() !== me.toLowerCase()) {
    throw new Error(`Signer ${me} is not owner. Contract owner is ${owner}`);
  }

  // Find token + balance
  const tokenAddr = await distributor.token();
  const erc20 = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    tokenAddr,
    signer
  );
  const decimals: number = await erc20.decimals();
  const bal = await erc20.balanceOf(oldAddr);

  // Amount: full balance by default, or AMOUNT (human units) if provided
  const amount =
    AMOUNT
      ? ethers.parseUnits(AMOUNT, decimals)
      : bal;

  console.log(`Token: ${tokenAddr}`);
  console.log(`Old distributor: ${oldAddr}`);
  console.log(`New distributor: ${toAddr}`);
  console.log(`Distributor balance: ${ethers.formatUnits(bal, decimals)}`);
  console.log(`Rescuing: ${ethers.formatUnits(amount, decimals)} tokens`);

  if (amount === 0n) throw new Error("Nothing to rescue (amount = 0)");

  const tx = await distributor.rescue(toAddr, amount);
  console.log("Tx sent:", tx.hash);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

  const rcpt = await tx.wait();
  console.log("Mined in block:", rcpt?.blockNumber);

  const toBal = await erc20.balanceOf(toAddr);
  console.log(`New receiver balance: ${ethers.formatUnits(toBal, decimals)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
