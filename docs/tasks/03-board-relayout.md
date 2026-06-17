# Task 3 — Board re-layout: drop 6 tiles, add new region + Kantor Hukum + Lahan Kosong + Gunung Rinjani

- **Type:** 💬 Feature request
- **Effort:** Large
- **Priority:** Medium
- **Status:** Not started
- **Notion:** https://app.notion.com/p/38201c5ad049811eade3fc39560344ea

## Goal

Re-layout the board **without changing its size** (stays 40 tiles, tile IDs do not shift). Repurpose freed slots in place.

## Scope

### Drop 6 tiles (free their slots)

- 2 hustle tiles (hustle 3 → 1)
- Pajak Hadiah
- 1 kejadian nasional tile (kejadian 3 → 2)
- 2 Parkir Bebas

### Refill the 6 slots

- **2 tiles** → a **new region** (around Jakarta / Bali tier). Add to `RegionId` union + `REGIONS` with prices.
- **1 Kantor Hukum** (new tile type `law_office`).
- **2 Lahan Kosong** (buildable: Dapur MBG / Warkop-Cafe — new tile type `buildable_land`).
- **1 Gunung Rinjani** (new tile type `vacation`): forces all players to the tile, everyone pays **Rp 1 juta**.

### Kantor Hukum landing actions (4)

- Buy land/house/property **remotely** → reuse `buyTile`.
- **Force-transfer** another player's property at **70% discount** → NEW mechanic (no steal exists today).
- **Force-jail** another player → reuse `sendToJail`.
- **Buy a free-pass card** → depends on Task 2's inventory.

## Affected files

- `shared/types/constants.ts` (BOARD, REGIONS)
- `shared/types/game.ts` (TileType, RegionId)
- `server/src/engine/index.ts` (resolveTile + new actions), board helpers
- New client modals (landing choice) + tile rendering
- i18n `en.json` / `id.json` + game-data overlay
- Engine tests referencing tile IDs (will need updates)

## Notes / open

- Exact freed-slot → tile-ID assignment and new-region prices need a short design pass before coding.
- **Dependency**: "buy free-pass card" option needs Task 2 (inventory) done first.
- Gate: `pnpm check` + `pnpm test` must pass; verify movement/landing/rent end-to-end with `pnpm dev`.
