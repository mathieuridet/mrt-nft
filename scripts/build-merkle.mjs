import fs from "node:fs";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers } from "ethers";

// 1) Put claims here OR read from a CSV/JSON.
//    amount must be a string in wei (respect token decimals).
const entries = [
  // [index, account, amountWei]
  [0, "0xbd187E110DBFc7Fdf9cCaF42786015b4160Ae3f2", ethers.parseUnits("100", 18).toString()],
  [1, "0xE930572eEA58D85aBDA7FF4C53Ff865a2B94306D", ethers.parseUnits("50", 18).toString()],
  // ...
];

// 2) Build leaves EXACTLY like the Solidity leaf:
// keccak256(abi.encodePacked(index, account, amount))
function leafFor(i, addr, amtWei) {
  return Buffer.from(
    ethers.keccak256(
      ethers.solidityPacked(["uint256","address","uint256"], [i, addr, amtWei])
    ).slice(2),
    "hex"
  );
}

const leaves = entries.map(([i,a,m]) => leafFor(i, a, m));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = "0x" + tree.getRoot().toString("hex");
console.log("Merkle root:", root);

// 3) Write proofs JSON for frontend
const claims = entries.map(([i, account, amount], idx) => ({
  index: i,
  account,
  amount,
  proof: tree.getHexProof(leaves[idx]),
}));

const payload = { root, claims };
fs.mkdirSync("./frontend/public/claims", { recursive: true });
fs.writeFileSync("./frontend/public/claims/first.json", JSON.stringify(payload, null, 2));
console.log("Wrote: frontend/public/claims/first.json");
