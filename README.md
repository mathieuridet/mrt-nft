# MRTNFToken — ERC-721 NFT (Sepolia)

Part of my blockchain portfolio. An ERC-721 NFT built with OpenZeppelin + Hardhat featuring a **paid mint**, **max supply cap**, **IPFS metadata**, and **EIP-2981 royalties**.

- **Live (Sepolia):** `0xA401Fd2Ef678f15eB2485C4E79EF0bF3AFE35a57`
- **Standard:** ERC-721
- **Metadata baseURI:** `ipfs://bafybeifnle7syv4d4cxwad2wk2iti2ubaee57jvcfk46wbi6dswxpamoi4/`
- **Mint price:** `0.02 ETH`
- **Max supply:** `1000`
- **Royalties:** `5%` to `0xbd187E110DBFc7Fdf9cCaF42786015b4160Ae3f2`

---

## Features

- **Payable mint**: `mint(uint256 quantity)` enforces `quantity * mintPrice`.
- **Supply safety**: immutable `MAX_SUPPLY`; mints revert if cap would be exceeded.
- **IPFS metadata**: `tokenURI(id) = baseURI + id + ".json"` (folder-based).
- **Royalties (EIP-2981)**: marketplaces can read `royaltyInfo(...)`.
- **Owner controls**: `setSaleActive(bool)`, `setBaseURI(string)`, `withdraw(...)`.
- **Security patterns**: checks-effects-interactions; optional `nonReentrant` on payable paths.

---

## Why it matters

This project demonstrates:
- Pricing & payments in **wei** with precise value checks (and optional refunds).
- Managing scarcity via on-chain **caps**.
- **Decentralized assets**: IPFS-hosted metadata and images.
- **Creator economics**: EIP-2981 royalties integration.

---

## Try it quickly

- **Etherscan → Write**: connect a Sepolia wallet, call `mint(1)` and send exactly `0.02 ETH`.
- **View metadata**: `tokenURI(1)` → `ipfs://<METADATA_CID>/1.json` (use a gateway if needed).
- See **docs/DEV.md** for CLI scripts.

> Tip: If `saleActive` is false, the tx reverts until I toggle it on.

---

## Tech

- Solidity `0.8.24`
- OpenZeppelin (ERC-721, Royalty, Ownable)
- Hardhat + Ethers v6
- IPFS (folder-based metadata)

---

## Deployed networks

- Sepolia: https://sepolia.etherscan.io/address/0xA401Fd2Ef678f15eB2485C4E79EF0bF3AFE35a57
- Polygon Amoy: pending (skipped for now due to faucet balance)

---

## Testing (Hardhat)

I added unit tests with **chai** + **ethers v6** to validate core behavior:

- ✅ Mint succeeds when sale is active; updates `totalSupply` and ownership  
- ✅ Reverts on paused sale / zero quantity / over cap / insufficient ETH  
- ✅ Refund path: contract retains only `mintPrice * quantity`  
- ✅ `tokenURI(id)` builds the correct IPFS URL  
- ✅ `withdraw` moves contract balance to owner  
- ✅ `royaltyInfo` returns the right receiver/amount (e.g., 5% on 1 ETH)

**Run tests**
```bash
npx hardhat test
