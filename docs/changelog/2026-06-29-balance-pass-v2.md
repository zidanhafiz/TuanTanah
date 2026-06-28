# Balance Pass v2 — Rent-Dominant Rebalance

**Date:** 2026-06-29
**Type:** Balance / content
**ClickUp:** [86ey2z88x](https://app.clickup.com/t/86ey2z88x)
**Spec:** [docs/proposals/balance-pass-2026-06.md](../proposals/balance-pass-2026-06.md)
**Scope:** `shared/data/` + one constant-default reference in the engine + i18n + tests + docs. No game-rule logic changed.

## Why

Playtests showed everyone funnelling to the premium regions, cheap regions being unviable, players
hoarding **Property (passive)** over **House (rent)**, and no way for a poor player to bankrupt anyone.
Root cause: income came from the **bank** (passive + GO salary), not from opponents — the game played
like solitaire with no comeback channel.

**Direction:** make **rent the weapon** (you win by developing Houses and forcing landings) and **passive
a survival floor** (keeps you alive, can't win). A fully-developed wall — even on the cheapest region —
can now bankrupt a careless player.

## Changes

### Regions — `shared/data/regions.ts`

- Re-priced all 9 regions' `buyPrice` / `rentBase` / `passiveBase`. `rentBase` is now deliberately
  regressive vs `buyPrice` (compresses the rent "weapon" spread so cheap regions stay viable walls);
  `passiveBase` is a low floor.
- Set-bonus constants: `REGION_SET_RENT_MULTIPLIER` stays **×2** (rewards the rent weapon);
  `REGION_SET_PASSIVE_MULTIPLIER` **2 → 1** and `REGION_SET_VALUE_MULTIPLIER` **2 → 1** (passive no longer
  snowballs; full sets no longer inflate wealth-win / pinjol leverage).

| Region     | buyPrice | rentBase   | passiveBase |
| ---------- | -------- | ---------- | ----------- |
| Papua      | 1.0jt    | 0.60jt     | 0.40jt      |
| Kalimantan | 1.5jt    | 0.70jt     | 0.50jt      |
| Medan      | 2.0jt    | 0.80jt     | 0.60jt      |
| Yogyakarta | 2.5jt    | 0.85jt     | 0.70jt      |
| Lombok     | 3.0jt    | 0.95jt     | 0.80jt      |
| Surabaya   | 3.5jt    | 1.00jt     | 0.90jt      |
| Bali       | 4.0jt    | 1.10jt     | 0.95jt      |
| Jakarta    | 5.0jt    | **1.30jt** | 1.05jt      |
| Tangerang  | 6.0jt    | **1.45jt** | 1.15jt      |

> Jakarta/Tangerang `rentBase` were buffed above the original spec (1.15 / 1.25) to widen the rent-weapon
> spread to ~2.42× so premiums justify their price while cheap regions keep the best ROI.

### Build tracks — `shared/data/tiers.ts`

- **House** (the weapon) — `rentMult` steepened: `1 / 3 / 6 / 12` (was `1 / 2.5 / 5 / 10`). A maxed Villa
  on a full set is now a wall.
- **Property** (the floor) — **deleted tier 5 (Konglomerat)**; both tracks now cap at 4 tiers. `passiveMult`
  flattened to `1 / 1.6 / 2.2 / 3` (Mall is the new ceiling). The engine reads `PROPERTY_TIERS.length`
  dynamically, so no rule code changed.
- **Lahan Kosong** — sharpened the two identities: **Warkop** = a single-tile rent wall (rent `2 / 5 / 9 / 15`),
  **Dapur** = a passive floor (passive `1.2 / 2 / 3 / 4.5`).

### Economy tuning — `shared/data/economy.ts`

Scaled the non-content numbers down to match the smaller economy and tightened the early game:

- **Starting cash:** default `15 → 6jt`, min `5 → 1jt`, max `50 → 20jt`.
- **Win target:** `TARGET_WEALTH_DEFAULT` `100 → 80jt` (set-value ×2 gone + passive capped → lower total
  wealth). Now referenced from `createGameState` in `engine/index.ts` instead of a magic literal.
- **Pinjol interest:** `10% → 20%` per lap. **Sell refund:** `50% → 70%` (cushions bankruptcy).
- **Law office:** transfer rate `70% → 80%`; jail fee `2 → 1jt`; free-pass price `3 → 1jt`. **Lobby meta
  cost:** `2 → 1jt`. **Jail exit:** `1 → 2jt`. **Auction timeout:** `15 → 20s`.
- **Korupsi:** success `30% → 40%`, steal `7 → 4jt`, fine `2 → 1jt`.
- **Judol:** win rate `10% → 20%`, jackpot rate `1% → 10%`, kept **net-negative EV (~−8% house edge)** —
  win rate stays below the ~0.217 break-even so it's a comeback gamble, not a bank faucet.

### Client

- Removed the now-dead property tier-5 name key (`"5"`) from both `en.json` (`"Conglomerate"`) and
  `id.json` (`"Konglomerat"`).
- `Board/icons.tsx` — moved the distinctive `Building2` glyph onto the new top tier (Mall / tier 4).

### Docs

- Synced `docs/GAME_DESIGN.md` balance tables (regions incl. Tangerang, both build tracks).
- Marked `docs/proposals/balance-pass-2026-06.md` **locked & implemented** and recorded the premium-buff
  and 80jt-target deviations.

## Validation

Reproduced the proposal's model with the implemented (buffed) numbers — all invariants hold:

- **Rent dominates everywhere** — House EV/lap > maxed passive floor in every region (min ratio ~1.96×).
- **Cheap regions bankrupt** — Papua's full-set Villa hits for **14.4jt**, one-shotting a careless player.
- **Passive can't snowball** — floor caps at ~8.1jt/lap.
- **Premiums justify their price** — buffed Jakarta/Tangerang top the EV table without killing cheap-region ROI.

## Tests

- Updated `rent` / `passive-income` / `elimination` / `pinjol` / `lahan` and client `tileValue` tests for
  the new tier cap, set bonuses, and economy constants (deriving from the constants where they previously
  hardcoded a rate, so future tuning won't re-break them).
- Added a regression asserting a developed full-set Papua Villa (14.4jt) bankrupts a careless player.
- Gate green: `pnpm check` (0 errors) + `pnpm test` (server **241**, client **11**).

## Out of scope

Role balance (`shared/data/roles.ts`) — tracked as a separate task.
