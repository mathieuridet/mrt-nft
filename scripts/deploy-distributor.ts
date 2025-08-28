import { ethers } from "hardhat";
import fs from "node:fs";

async function main() {
  const owner = (await ethers.getSigners())[0].address;
  const TOKEN = process.env.TOKEN_ADDRESS!; // your MRT token address

  // Read root from the exact file your app fetches
  const file = JSON.parse(fs.readFileSync("./frontend/public/claims/first.json", "utf8"));
  const ROOT: `0x${string}` = file.root;

  console.log("Owner:", owner);
  console.log("Token:", TOKEN);
  console.log("Root (file):", ROOT);

  const F = await ethers.getContractFactory("MerkleDistributor");
  const c = await F.deploy(owner, TOKEN, ROOT);
  await c.waitForDeployment();

  const addr = await c.getAddress();
  console.log("MerkleDistributor:", addr);

  // quick sanity check
  console.log("On-chain root:", await c.merkleRoot());
}

main().catch((e) => { console.error(e); process.exit(1); });
