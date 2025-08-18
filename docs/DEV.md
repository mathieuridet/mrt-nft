## Interact via Node scripts (Ethers v6)

Prereqs: `.env` with `RPC_URL`, `PRIVATE_KEY`, `NFT_ADDRESS` set.  
(Install once: `npm i ethers dotenv` and `npx hardhat compile` to generate ABI.)

```bash
# Read basics + tokenURI(1)
npm run node:nft:read -- 1

# Mint 1 NFT (send exact mint price; set OVERPAY_ETH in .env to test refund)
npm run node:nft:mint -- 1

# Toggle sale (works with saleActive or Pausable)
npm run node:nft:sale:off
npm run node:nft:sale:on

# Update base URI
npm run node:nft:baseuri -- ipfs://NEW_CID/

# Withdraw contract balance to your wallet
npm run node:nft:withdraw

# Check royalties on a 1 ETH sale
npm run node:nft:royalty -- 1
