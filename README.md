# MRTNFToken — ERC-721 NFT (Sepolia)

<img width="1440" height="708" alt="Capture d’écran 2025-08-22 à 22 55 54" src="https://github.com/user-attachments/assets/e4470b9c-10ea-42bd-a8c1-e03f648e5dcd" />

<br>

Part of my blockchain portfolio. An ERC-721 NFT built with OpenZeppelin + Hardhat featuring a **paid mint**, **max supply cap**, **IPFS metadata**, and **EIP-2981 royalties**.

- **Live (Sepolia):** `0xDa04b022149F4261be873b43E13d5913E5dc3757`
- **Standard:** ERC-721
- **Metadata baseURI:** `ipfs://bafybeigjn7mvb2k72jviz7x2ubzcrlufmeg7ra7bwglbzv6h5bg5uer2fi/`
- **Mint price:** `0.0001 ETH`
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

- **Front-end**: access `https://mrt-nft.vercel.app/` and connect a Sepolia wallet to interact with the contract.
- **Etherscan → Write**: connect a Sepolia wallet, call `mint(x)` and send x * `0.001 ETH`.
- **View metadata**: `tokenURI(1)` → `ipfs://<METADATA_CID>/1.json` (use a gateway if needed).
- See **docs/DEV.md** for CLI scripts.

> Tip: If `saleActive` is false, the tx reverts until I toggle it on.

---

## Tech

- Solidity `0.8.24`
- OpenZeppelin (ERC-721, Royalty, Ownable)
- Hardhat + Ethers v6
- IPFS (folder-based metadata)
- Front-end with React and Next.js

---

## Deployed networks

- Sepolia: https://sepolia.etherscan.io/address/0xDa04b022149F4261be873b43E13d5913E5dc3757
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




Merkle Distributor : 0x2098026A19521B9B2623cCD772104e627fB8b700
Hourly Distributor : 0x9039103F59855c4eA3AE7Cc048855a6Eccb4624D
Staking : 0xb50C5E37cE43F10Fc348E0F5eb5bc7e6a62294BF

