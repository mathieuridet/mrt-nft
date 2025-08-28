// scripts/verify-local.mjs  (run with: node scripts/verify-local.mjs)
import fs from "node:fs";
import keccak256 from "keccak256";
import { ethers } from "ethers";

const f = JSON.parse(fs.readFileSync("./frontend/public/claims/first.json","utf8"));
const entry = f.claims.find(c => c.account.toLowerCase() === "0xe930572eea58d85abda7ff4c53ff865a2b94306d");
if (!entry) throw new Error("entry not found");

const buf = (h) => Buffer.from(h.slice(2), "hex");
const hashPair = (a,b) => (Buffer.compare(a,b)<0)
  ? keccak256(Buffer.concat([a,b]))
  : keccak256(Buffer.concat([b,a]));

const leafHex = ethers.keccak256(
  ethers.solidityPacked(["uint256","address","uint256"], [entry.index, entry.account, entry.amount])
);

let computed = buf(leafHex);
for (const p of entry.proof) computed = hashPair(computed, buf(p));

console.log("OK? ", "0x"+computed.toString("hex") === f.root);
