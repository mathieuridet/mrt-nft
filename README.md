# MRT dApp

The **MRT dApp** is a decentralized application where users can mint NFTs, claim token rewards, and stake MRT to earn yield over time.  

👉 [Launch the app](https://mrt-nft.vercel.app)  

---

## ✨ Features

- **NFT Minting**  
  Mint one NFT every hour. Each NFT represents eligibility for rewards.
  <br><br/>
  <img width="1440" height="784" alt="Screenshot 2025-09-25 at 21 16 05" src="https://github.com/user-attachments/assets/49790a5b-3a49-4a6c-8765-6d91961bcd76" />
  <br><br/>

- **Claim Rewards**  
  Claim ERC20 MRT tokens within one hour of minting. Rewards are distributed fairly using Merkle proofs.
  <br><br/>
  <img width="1440" height="784" alt="Screenshot 2025-09-25 at 21 18 39" src="https://github.com/user-attachments/assets/f81dac61-e580-403f-ab5a-5998352a1195" />
  <br><br/>

- **Staking**  
  Stake your MRT tokens to earn additional rewards over time.  
  Unstake partially or fully whenever you like.
  <br><br/>
  <img width="1440" height="784" alt="Screenshot 2025-09-25 at 21 16 42" src="https://github.com/user-attachments/assets/6a6425d0-6413-47e5-b84c-abf7cd1493d7" />
  <br><br/>

---

## 🔄 How It Works

1. **Mint NFT** → Each mint event makes the minter eligible for a reward.  
2. **Rewards Distribution** → A Merkle tree of eligible accounts is generated off-chain and anchored on-chain.  
3. **Claim MRT** → Users fetch their proof and submit it on-chain to claim tokens.  
4. **Stake MRT** → Holders can stake tokens for continuous yield and claim rewards anytime.  

---

## 🏗 Architecture & Tech Stack

![WhatsApp Image 2025-09-24 at 13 15 35](https://github.com/user-attachments/assets/5e935505-eb62-45ee-8295-5997b022308d)
<br/>

**Smart Contracts**
- **NFT Contract [`0xf4122cE080299FcDb6B72E007F55608E05dCf501`]** – hourly minting, eligibility for rewards.
- **Distributor Contract [`0x9039103F59855c4eA3AE7Cc048855a6Eccb4624D`]** – manages Merkle root + reward rounds, validates claims.
- **MRT Token (ERC20) [`0xc6b1E9aCF8f08EE96F33a2eA420C483153B8F756`]** – reward token distributed to claimants and stakers.
- **Staking Contract [`0xb50C5E37cE43F10Fc348E0F5eb5bc7e6a62294BF`]** – handles staking/unstaking of MRT and yield accrual.

**Off-chain Builder**
- Watches NFT mint events (via Alchemy webhook & GitHub Actions fallback).
- Rebuilds the Merkle tree of eligible addresses each round.
- Publishes `current.json` (root + claims + proofs) to Vercel Blob.
- Calls `setRoot(newRoot, newRound)` on the distributor contract to sync state.

**Frontend (Next.js + TypeScript)**
- Mint NFTs, view and claim rewards, stake/unstake MRT.
- Reads `current.json` to fetch Merkle proofs.
- Interacts with smart contracts via `ethers.js`.

**Automation**
- **Alchemy Webhook** → triggers rebuild instantly on NFT mint.  
- **GitHub Actions** → runs `/api/rebuild` every 30 minutes as a fallback.

---

## 📝 Notes

- Claims are only valid for the **current round** (1 hour window).  
- All proofs are published transparently for verification.  
- The system is designed to be fully decentralized: rewards cannot be claimed unless both the off-chain file and the on-chain root match.

**Infrastructure**
- Hosting: **Vercel** (frontend + API routes).  
- Storage: **Vercel Blob** for publishing Merkle proofs JSON.  
- Blockchain RPC: **Alchemy** (Ethereum RPC provider).  
