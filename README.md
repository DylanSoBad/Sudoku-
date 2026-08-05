# Sudoku on Shelby

Production-grade Next.js 14 dApp: campaign Sudoku (levels 1–20+) where every puzzle is a **blob on Shelby Protocol** (Aptos Labs × Jump Crypto). Players pay **shelbyUSD** for hints, earn shelbyUSD on solve, and fund wallets from an in-app faucet (Aptos testnet APT + shelbyUSD).

Live: **https://sudoku-d.vercel.app/**

## Stack

- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + hand-rolled shadcn-style primitives
- `@shelby-protocol/sdk` (browser) · `@aptos-labs/ts-sdk` · `@aptos-labs/wallet-adapter-react` (Petra + Pontem + Nightly)
- Move modules under `move/` for registry, hint shop, and rewards
- Node **20+**, package manager **npm**

## Setup

```bash
cd sudoku-shelby-dapp
cp .env.example .env.local
# edit .env.local with your API keys
npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

| Variable                                | Purpose                                             |
| --------------------------------------- | --------------------------------------------------- |
| NEXT_PUBLIC_APTOS_NETWORK               | testnet                                             |
| NEXT_PUBLIC_APTOS_API_KEY               | Aptos / Geomi API key                               |
| NEXT_PUBLIC_SHELBY_API_KEY              | Shelby SDK API key (often same Aptos key)           |
| NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS     | Published Move package address (empty until deploy) |
| NEXT_PUBLIC_APTOS_FAUCET_URL            | Default https://faucet.testnet.aptoslabs.com        |
| NEXT_PUBLIC_SHELBYUSD_FAUCET_URL        | Default https://faucet.shelby.xyz/shelbyusd         |
| NEXT_PUBLIC_PROGRESS_SALT               | HMAC salt for casual anti-cheat on level progress   |
| CLAIM_SIGNER_PRIVATE_KEY                | Server-only Ed25519 key that signs reward claims    |
| CURATOR_GATE_SECRET                     | Server-only gate for `/curator`                     |

Never commit `.env.local`.

## Scripts

| Command           | Description                                     |
| ----------------- | ----------------------------------------------- |
| npm run dev       | Dev server on port **3000**                     |
| npm run build     | Production build (typecheck via tsc)            |
| npm run typecheck | tsc --noEmit                                    |
| npm test          | Sudoku generator / codec unit tests (node:test) |
| npm start         | Serve production build on 3000                  |
| npm run claim:keygen | Create the claim signer key in `.env.local`   |
| npm run claim:verify | Check the signer against on-chain ClaimGuard  |
| npm run claim:check  | Smoke-test `/api/claim-ticket` (needs dev server) |

## Deploy Move package

```bash
cd move
aptos move compile --named-addresses sudoku=YOUR_ADDR
aptos move publish --named-addresses sudoku=YOUR_ADDR
```

After publish:
1. Set `NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS=YOUR_ADDR` in `.env.local`.
2. Replace `SHELBYUSD_METADATA` constants in `hint_shop.move` / `rewards.move`.
3. Fund the treasury with shelbyUSD (`rewards::top_up_treasury`).
4. Use **Curator** to upload blobs and call `registry::register_puzzle`.

## Tokenomics

| Item                | Value            |
| ------------------- | ---------------- |
| Reward per level    | 0.01 sUSD (flat) |
| Hint cost           | 0.0005 sUSD      |
| Max hints per level | 5                |

Difficulty still scales with the level (36/44/50/55/60 empty cells for
easy/medium/hard/expert/master); only the pricing is flat.

shelbyUSD reports **8 decimals** on testnet, so the on-chain raw amounts are
`1_000_000` for a reward and `50_000` for a hint.

## Architecture notes

- **SSR-safe Shelby**: `@shelby-protocol/sdk/browser` is dynamic-imported only in the browser; failures log `[shelby:fallback]` and use the deterministic generator.
- **Blob layout**: `<JSON header>\n` + 81 puzzle bytes + 81 solution bytes.
- **Progress**: `localStorage` key `shelby-sudoku-progress`, HMAC-SHA-256 over `address:level` with `NEXT_PUBLIC_PROGRESS_SALT` (public salt — casual anti-tamper only).

### Reward claim authorisation

The blob ships the solution, so "player solved it" cannot be proven on-chain.
Payouts are gated by an off-chain verifier instead:

1. `/api/claim-ticket` checks the submitted grid is solved, keeps the level's
   givens and took at least 10s, then signs `(address, level, expiresAt, nonce)`
   with `CLAIM_SIGNER_PRIVATE_KEY`.
2. `rewards::claim_with_proof` verifies that signature against
   `ClaimGuard.verifier`, rejects reused nonces and expired tickets, then pays.
3. `rewards::ClaimGuard` also caps **all** treasury outflow (claims and
   referral bonuses) on a rolling 24h budget, so a leaked signer key or a sybil
   farm cannot empty the treasury in one pass.

Rollout order matters: set `CLAIM_SIGNER_PRIVATE_KEY` in the host environment
**before** `rewards::set_require_proof(true)`, otherwise every claim fails
closed with `E_PROOF_REQUIRED` (1004).

Two follow-on gates depend on a recorded claim: `referral::register` requires
the referee to have claimed a level (and caps a referrer at 25 paid referrals),
and `nft_badge::mint_milestone` requires the badge's level to be claimed.

## References

- Shelby Protocol
- Shelby browser SDK
- shelbyUSD faucet
- Aptos wallet adapter
