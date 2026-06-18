# Plan: Tiered Lahan Kosong businesses (Dapur MBG / Warkop-Cafe)

## Context

Today, a **Lahan Kosong** (`buildable_land`) tile — tiles 9 and 29 — is a one-shot, single-tier
build: you buy bare land (Rp 1.5jt), then build **either** Dapur MBG (flat Rp 0.6jt passive, no
rent) **or** Warkop-Cafe (flat Rp 1.2jt landing rent, no passive). There are no tiers and no
owned-tier indicator on the board.

The goal is to make Lahan Kosong behave like a house/property: each business becomes a **4-tier**
building that earns **both** landing rent _and_ per-lap passive income, with a build/upgrade flow and
a board tier indicator. Per the user's choices:

- **Dapur MBG and Warkop-Cafe stay mechanically distinct** — two separate 4-tier tables. Dapur leans
  toward higher passive income; Warkop leans toward higher landing rent.
- **Rent is an explicit per-tier table** (not derived live from investment), calibrated to roughly
  ~30% of the tile's cumulative investment.
- **Upgrades are free of the per-turn cap** — the owner may build up tiers as fast as cash allows.

The current build/passive/rent constants (`LAHAN_BUILD_COST`, `DAPUR_PASSIVE`, `WARKOP_RENT`) are
replaced by tier tables.

## Data model (no schema migration needed)

`TileState` already has `tier: number` and `landBuild?: LandBusiness | null`
(`shared/types/game.ts`). We reuse them: for a `buildable_land` tile, `tier 0` = bare land,
`tier 1–4` = the business level, `landBuild` = which business. No new fields.

## Changes

### 1. `shared/types/constants.ts` — tier tables (the balance lives here)

Replace `LAHAN_BUILD_COST`, `DAPUR_PASSIVE`, `WARKOP_RENT` (lines ~343–345) with a per-business
4-tier table. Keep `LAHAN_LAND_PRICE` (1.5jt). All values are flat rupiah (Lahan has no region base).

```ts
export interface LandTierDef {
  tier: number
  name: string
  buildCost: RupiahAmount // flat cost to upgrade INTO this tier
  rent: RupiahAmount // landing rent charged to others at this tier
  passive: RupiahAmount // per-lap passive income at this tier
}

// Starting balance — tunable. Rent ≈ 30% of cumulative investment
// (land 1.5jt + builds): tier totals 3.5 / 6.5 / 11.5 / 19.5jt.
export const LAND_BUSINESS_TIERS: Record<LandBusiness, LandTierDef[]> = {
  dapur_mbg: [
    // passive-leaning
    { tier: 1, name: 'Dapur Rumahan', buildCost: jt(2), rent: jt(1), passive: jt(1.5) },
    { tier: 2, name: 'Katering MBG', buildCost: jt(3), rent: jt(1.5), passive: jt(2.5) },
    { tier: 3, name: 'Dapur Sentral', buildCost: jt(5), rent: jt(2.5), passive: jt(4) },
    { tier: 4, name: 'Dapur MBG Nasional', buildCost: jt(8), rent: jt(4), passive: jt(6) },
  ],
  warkop_cafe: [
    // rent-leaning
    { tier: 1, name: 'Warkop', buildCost: jt(2), rent: jt(1.5), passive: jt(0.8) },
    { tier: 2, name: 'Kopi Kekinian', buildCost: jt(3), rent: jt(3), passive: jt(1.2) },
    { tier: 3, name: 'Cafe', buildCost: jt(5), rent: jt(5), passive: jt(2) },
    { tier: 4, name: 'Coffee Chain', buildCost: jt(8), rent: jt(8), passive: jt(3.5) },
  ],
}

export const LAND_MAX_TIER = 4
/** Tier def for a built land tile, or null if not built / out of range. */
export const landTier = (b: LandBusiness, tier: number): LandTierDef | null =>
  tier >= 1 && tier <= LAND_MAX_TIER ? (LAND_BUSINESS_TIERS[b][tier - 1] ?? null) : null
```

These passive values (0.8–6jt/lap) sit above low/mid property passives for comparable invested cash,
satisfying "bigger than property." Adjust freely — all balance is in this table.

### 2. `server/src/engine/index.ts`

- **`buildLahan(state, playerId, tileId, business)`** (lines ~729–756): make it handle **both initial
  build and tier upgrades**.
  - `tile.tier === 0`: require `business`, set `tile.landBuild = business`, charge tier-1 `buildCost`,
    set `tile.tier = 1`.
  - `tile.tier >= 1`: ignore/validate that `business === tile.landBuild` (locked), reject if already at
    `LAND_MAX_TIER`, otherwise charge the next tier's `buildCost`, `tile.tier += 1`.
  - **No per-turn cap** (do not touch `state.turn.upgradesUsed`) — free upgrades.
  - Keep ownership + turn guards; update the log line to mention the new tier/level name.
- **`computeRent(state, tileId)`** (lines ~521–546): add a `buildable_land` branch up front —
  if `tile.landBuild && tile.tier >= 1`, return
  `Math.round(applyRentEffects(landTier(tile.landBuild, tile.tier).rent, tileId, state))`.
- **Landing resolution `case 'buildable_land'`** (lines ~430–442): replace the `warkop_cafe`-only rent
  branch with: for **any** built land owned by another player, `payRent(state, player, tile.ownerId,
computeRent(state, player.position), player.position)`. (Both businesses now charge rent.)
- `buyTile` is unchanged — still buys bare land at `LAHAN_LAND_PRICE`, `tier 0`, `landBuild = null`.

### 3. `server/src/engine/turn.ts` — `collectPassiveIncome` (lines ~14–59)

Replace the Dapur-only flat block with one that sums **both** businesses by tier:
for each owned `buildable_land` tile with `tier >= 1`, add `landTier(tile.landBuild, tile.tier).passive`.
Fold this into the normal `total` (before `applyPassiveMultiplier`) so it behaves like property passive
(subject to card multipliers and revenue-share deals) — consistent with "like property." Update the log
wording. (This drops the old "Dapur is immune to all multipliers" carve-out, which is the intended
unification.)

### 4. `server/src/engine/elimination.ts` — `tileValue` (lines ~9–28)

For `buildable_land`, return `LAHAN_LAND_PRICE` + the sum of `buildCost` for tiers `1..tile.tier`
from `LAND_BUSINESS_TIERS[tile.landBuild]`. Drives sell-refund, wealth, and pinjol borrow limits.

### 5. Sell / downgrade

Check the sell path that resets a land tile (`index.ts:~679` sets `landBuild = null`) and the client
`handleDowngrade`/`canDowngrade` in `PropertyModal.tsx`. Make land downgrade drop one tier
(`tier -= 1`, clear `landBuild` only when dropping from tier 1 → 0), refunding `SELL_REFUND_RATE` ×
that tier's `buildCost`, mirroring property tier downgrades. Selling the whole tile resets it as today.

### 6. Client

- **`components/Board/icons.tsx`**: add a `landIcon(business)` → `UtensilsCrossed`/`ChefHat` for
  `dapur_mbg`, `Coffee` for `warkop_cafe` (lucide-react), and a `LandGlyph({ business, tier, color })`
  component mirroring `DevGlyph` (icon + `{tier}×` label).
- **`components/Board/Tile.tsx` → `TilePips`** (lines ~141–177): when `tile.landBuild && tier >= 1`,
  render `<LandGlyph …>` instead of the bare owner dot — the owned tier indicator on top of the tile,
  matching house/property tiles. Bare-owned land (`tier 0`) keeps the single colored dot.
- **`components/PropertyModal/PropertyModal.tsx`**:
  - `canBuildLahan` (line ~113): split into "build tier 1" (when `!tile.landBuild`, choose business)
    and "upgrade" (when `landBuild` set and `tier < LAND_MAX_TIER`, owner + my turn). The upgrade
    button calls the same `buildLahan(tileId, tile.landBuild)` action with cost = next tier `buildCost`.
  - Add a rent/passive **schedule table** for land (4 rows: tier name, rent, passive, build cost),
    mirroring the property `rentSchedule` block (lines ~233–259), highlighting the current tier.
  - The invested-value row (line ~225) already uses `tileValue` — now reflects tiers automatically.
- **`store/gameStore.ts`**: `buildLahan` emit (line ~349) is reused for upgrades — no change.

### 7. i18n — `client/src/i18n/gameData.ts` + `locales/{en,id}.json`

Add localized tier names for both businesses and UI strings (upgrade button label, land schedule
column headers / passive label). Reuse the existing overlay pattern (`property.*` keys, `gameData.ts`).
Server log/error strings stay English (known gap).

### 8. Tests — `server/test/lahan.test.ts`

Update existing tests (they import the removed `DAPUR_PASSIVE`/`WARKOP_RENT`/`LAHAN_BUILD_COST`) and add
coverage:

- Build tier 1 (pick business) then upgrade 2→3→4; reject upgrade past tier 4; reject switching business.
- Free upgrades: multiple upgrades in one turn allowed (no `upgradesUsed` consumed).
- `computeRent` returns the per-tier rent for both businesses; landing on another's built land charges it.
- `collectPassiveIncome` pays tiered passive for both businesses and respects passive multipliers.
- `tileValue` = land + cumulative build cost by tier (sell-refund / wealth sanity).

## Verification

1. `pnpm typecheck && pnpm lint` — must be clean (0 errors).
2. `pnpm test` — engine suite, especially the updated `lahan.test.ts`, passes.
3. `pnpm dev`, open two tabs, create/join a room, start a 2-player game:
   - Land on a Lahan Kosong, buy it, build Dapur MBG (tier 1), then upgrade through tier 4 in one turn
     (free upgrades) — confirm the tier glyph appears on the tile and grows.
   - Send the other player onto it — confirm they pay the per-tier landing rent.
   - Pass GO / start a new turn — confirm the owner collects the tiered passive (bigger than a
     comparable property) in the log.
   - Repeat with Warkop-Cafe on tile 29; confirm its rent-leaning numbers and distinct icon.
   - Open the PropertyModal on the tile — confirm the 4-tier schedule and invested value display.
