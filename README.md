# Sudoku on Shelby

Production-grade Next.js 14 dApp: campaign Sudoku (levels 1–20+) where every puzzle is a **blob on [Shelby Protocol](https://docs.shelby.xyz/protocol)** (Aptos Labs × Jump Crypto). Players pay **shelbyUSD** for hints, earn shelbyUSD on solve, and fund wallets from an in-app faucet (Aptos testnet APT + shelbyUSD).

## Stack

- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + hand-rolled shadcn-style primitives
- `@shelby-protocol/sdk` (browser) · `@aptos-labs/ts-sdk` · `@aptos-labs/wallet-adapter-react` (Petra + Martian)
- Move modules under `move/` for registry, hint shop, and rewards
- Node **20+**, package manager **npm**

## Prerequisites

1. **Node.js 20+** and npm  
2. **Petra** (or Martian) browser wallet — [petra.app](https://petra.app/)  
3. **Aptos API key** — create at [https://geomi.dev](https://geomi.dev) / Aptos Labs developer portal  
4. Optional: [Aptos CLI](https://aptos.dev/tools/aptos-cli) for compiling/deploying Move (`aptos move compile`)

## Setup

```bash
cd sudoku-shelby-dapp
cp .env.example .env.local
# edit .env.local with your API keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APTOS_NETWORK` | `testnet` |
| `NEXT_PUBLIC_APTOS_API_KEY` | Aptos / Geomi API key |
| `NEXT_PUBLIC_SHELBY_API_KEY` | Shelby SDK API key (often same Aptos key) |
| `NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS` | Published Move package address (empty until deploy) |
| `NEXT_PUBLIC_APTOS_FAUCET_URL` | Default `https://faucet.testnet.aptoslabs.com` |
| `NEXT_PUBLIC_SHELBYUSD_FAUCET_URL` | Default `https://faucet.shelby.xyz/shelbyusd` |
| `NEXT_PUBLIC_PROGRESS_SALT` | HMAC salt for casual anti-cheat on level progress |

Never commit `.env.local`.

## Wallet + faucet

1. Install Petra → switch network to **Testnet**.
2. Connect on the home page (address shortens; APT + shelbyUSD badges appear).
3. Use the **Faucet** panel:
   - **APT** → `POST` Aptos testnet faucet `/mint`
   - **shelbyUSD** → `POST` Shelby faucet with `{ address, network: "shelbynet" }`
4. Explorer links use `https://explorer.aptoslabs.com/txn/{hash}?network=testnet`.

Official Aptos faucet UI (backup): [https://aptos.dev/network/faucet](https://aptos.dev/network/faucet).  
ShelbyUSD faucet docs: [https://docs.shelby.xyz/apis/faucet/shelbyusd](https://docs.shelby.xyz/apis/faucet/shelbyusd).

## Gameplay

1. **Level 1** is unlocked. Opening a level calls `fetchPuzzle`:
   1. Shelby `client.download({ account, blobName })`
   2. `localStorage` cache
   3. Deterministic local generator (`[shelby:fallback]` in console)
2. Board: click / arrow keys / 1–9 / Backspace. Conflicts highlight red. Timer + hint counter live on the board.
3. **Buy hint** → `hint_shop::buy_hint` (or local fallback if registry unset) → fills the highest-inference empty cell.
4. Full correct board → **Reward** modal → `rewards::claim` → progress HMAC unlocks the next level.
5. **Read Ledger** increments on every successful puzzle fetch (Shelby / cache / generated).
6. **Curator** (`/curator`) uploads a fresh blob: commitments → register payload → wallet sign → `rpc.putBlob`.

## Deploy Move package

```bash
cd move
aptos move compile --named-addresses sudoku=YOUR_ADDR
aptos move publish --named-addresses sudoku=YOUR_ADDR
```

Expected: `aptos move compile` succeeds against AptosFramework (`rev = "mainnet"` in `Move.toml`).

After publish:

1. Set `NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS=YOUR_ADDR` in `.env.local`.
2. Replace `SHELBYUSD_METADATA` constants in `hint_shop.move` / `rewards.move` (`TODO(deployer)`).
3. Fund the treasury with shelbyUSD (`rewards::top_up_treasury`).
4. Use **Curator** to upload blobs and call `registry::register_puzzle`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on port **3000** |
| `npm run build` | Production build (typecheck via `tsc`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Sudoku generator / codec unit tests (`node:test`) |
| `npm start` | Serve production build on 3000 |

## Tokenomics

| Levels | Difficulty | Empty | Hint (sUSD) | Reward (sUSD) |
|---|---|---|---|---|
| 1–3 | easy | 36 | 0.1 | 0.5 |
| 4–6 | medium | 44 | 0.2 | 1.0 |
| 7–10 | hard | 50 | 0.4 | 2.5 |
| 11–14 | expert | 55 | 0.7 | 5.0 |
| 15+ | master | 60 | 1.0 | 10.0 |

## Architecture notes

- **SSR-safe Shelby**: `@shelby-protocol/sdk/browser` is dynamic-imported only in the browser; failures log `[shelby:fallback]` and use the deterministic generator (`FNV-1a` + mulberry32).
- **Blob layout**: `<JSON header>\n` + 81 puzzle bytes + 81 solution bytes.
- **Progress**: `localStorage` key `shelby-sudoku-progress`, HMAC-SHA-256 over `address:level` with `NEXT_PUBLIC_PROGRESS_SALT` (public salt — casual anti-tamper only).

## References

- [Shelby Protocol](https://docs.shelby.xyz/protocol)
- [Shelby browser SDK](https://docs.shelby.xyz/sdks/typescript/browser)
- [Shelby upload guide](https://docs.shelby.xyz/sdks/typescript/browser/guides/upload)
- [shelbyUSD faucet](https://docs.shelby.xyz/apis/faucet/shelbyusd)
- [Aptos wallet adapter](https://aptos.dev/build/sdks/wallet-adapter/dapp)
