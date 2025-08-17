const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const initialOwner    = deployer.address;
  const baseURI         = "ipfs://bafybeihy2srvlpkoz42nhye4xq347pnr2htezqb4zl4xv2vwdxw4ejso3a/";
  const maxSupply       = 1000;
  const mintPriceWei    = ethers.parseEther("0.02");
  const royaltyReceiver = deployer.address;
  const royaltyBps      = 500;

  const MRTNFToken = await ethers.getContractFactory("MRTNFToken");
  const mrtNfToken = await MRTNFToken.deploy(
    initialOwner, 
    baseURI,
    maxSupply,
    mintPriceWei,
    royaltyReceiver,
    royaltyBps);

  await mrtNfToken.waitForDeployment();

  console.log("MRTNFToken deployed to:", await mrtNfToken.getAddress());
  console.log("Owner:", await mrtNfToken.owner());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });