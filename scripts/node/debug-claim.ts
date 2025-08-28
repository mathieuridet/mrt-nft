import { ethers } from "hardhat";
import fs from "node:fs";

const DIST = "0x2098026A19521B9B2623cCD772104e627fB8b700"; // distributor
const JSON_PATH = "./frontend/public/claims/first.json";
const ME = "0xE930572eEA58D85aBDA7FF4C53Ff865a2B94306D";  // your wallet

function leaf(i: bigint, addr: string, amt: bigint) {
  return ethers.keccak256(ethers.solidityPacked(
    ["uint256", "address", "uint256"], [i, addr, amt]
  ));
}

async function main() {
  const [signer] = await ethers.getSigners();

  const dist = await ethers.getContractAt("MerkleDistributor", DIST, signer);
  const tokenAddr = await dist.token();
  const rootOnChain = await dist.merkleRoot();

  console.log("Signer:", signer.address);
  console.log("Distributor:", DIST);
  console.log("Token (from distributor.token()):", tokenAddr);
  console.log("Root (on chain):", rootOnChain);

  const json = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  console.log("Root (file):", json.root);

  const entry = json.claims.find((c: any) => c.account.toLowerCase() === ME.toLowerCase());
  if (!entry) { console.log("No entry for connected address"); return; }
  console.log("Entry:", entry);

  // Recompute the leaf used on-chain (must exactly match Solidity encoding)
  const leafHex = leaf(BigInt(entry.index), entry.account, BigInt(entry.amount));
  console.log("Leaf recomputed:", leafHex);

  // Quick static call to see precise revert
  try {
    const ok = await dist.isClaimed(entry.index);
    console.log("isClaimed(index):", ok);

    const bal = await ethers.getContractAt("IERC20", tokenAddr, signer)
      .then(t => t.balanceOf(DIST));
    console.log("Distributor token balance:", ethers.formatUnits(bal, 18));

    // simulate (no state change)
    await dist.claim.staticCall(
      BigInt(entry.index),
      entry.account,
      BigInt(entry.amount),
      entry.proof
    );
    console.log("STATIC CALL: would succeed ✅");
  } catch (e: any) {
    console.error("STATIC CALL REVERT ❌:", e?.shortMessage || e?.message || e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
