# Balance Pass v2 — Rent-Dominant Rebalance (2026-06)

**Status:** Proposal (awaiting lock) · **Scope:** rebalance only — **zero engine code**, all `shared/data/` · **Owner:** design

Supersedes the earlier "reprice-only ROI flatten" draft. Implementation is gated on this doc being
approved; once locked, mirror to the ClickUp Game Design doc and implement against the checklist (§7).

---

## 1. The real problem (not pricing — _structure_)

Playtest complaints: every player funnels to Bali/Jakarta/Tangerang; cheap-region players (Papua,
Kalimantan) can't survive; everyone builds **Property** (passive) not **House** (rent); and a
cheap-region player has **no way to bankrupt anyone**.

Root cause, proven by the numbers: **income comes from the bank (passive + GO salary), not from
opponents.** Almost no money flows _between_ players, so the optimal play is "buy the best regions,
build Property, farm guaranteed passive, never interact." It's solitaire. A poor player has no weapon,
so there's no comeback and no tension.

Measured proof — a maxed **House (Villa)** vs a maxed **Property (Konglomerat)**, today's numbers:

| Track             | Per event    | Frequency                          | Expected /lap (3 opp)       |
| ----------------- | ------------ | ---------------------------------- | --------------------------- |
| House (Villa)     | 35jt rent    | only when someone lands (~30%/lap) | **~10.5jt** (high variance) |
| Property (Konglo) | 30jt passive | every lap, guaranteed              | **30jt** (zero variance)    |

Property is ~3× the expected value of House with no risk → everyone hoards passive → no confrontation.

## 2. Design decision (locked direction)

- **Rent is the weapon; passive is a survival floor.** You _win_ by developing Houses and forcing
  opponents to land on them. Passive keeps you alive but cannot win on its own.
- **Pure rebalance, no new mechanic.** The comeback channel is rent itself — a fully-developed wall,
  _even on the cheapest region_, must be able to bankrupt a careless player. Comeback = bait the leader
  onto your wall. We accept the luck dependence.
- **No engine code.** This works entirely through `shared/data/` because:
  - House rent already scales with tier in the engine (`HOUSE_TIERS[tier-1].rentMult`).
  - The set bonuses are **data constants** — moving the bonus off passive/value onto rent is just
    setting two constants to `1`.
  - "Passive = floor" is just lower `passiveBase` + a flatter `passiveMult`.

## 3. Proposed numbers

### 3.1 Regions — `shared/data/regions.ts`

`buyPrice` set by design owner (6× spread, premium trio jumps). `rentBase` is deliberately
**regressive** vs buy (compresses the _weapon_ spread to ~2× so cheap regions stay viable walls).
`passiveBase` is a low floor.

| Region     | buyPrice (old→new) | rentBase (old→new) | passiveBase (old→new) |
| ---------- | ------------------ | ------------------ | --------------------- |
| Papua      | 1.0 → **1.0jt**    | 0.40 → **0.60jt**  | 0.29 → **0.40jt**     |
| Kalimantan | 1.6 → **1.5jt**    | 0.66 → **0.70jt**  | 0.47 → **0.50jt**     |
| Medan      | 2.2 → **2.0jt**    | 0.92 → **0.80jt**  | 0.65 → **0.60jt**     |
| Yogyakarta | 2.8 → **2.5jt**    | 1.20 → **0.85jt**  | 0.85 → **0.70jt**     |
| Lombok     | 3.4 → **3.0jt**    | 1.45 → **0.95jt**  | 1.00 → **0.80jt**     |
| Surabaya   | 4.0 → **3.5jt**    | 1.75 → **1.00jt**  | 1.25 → **0.90jt**     |
| Bali       | 4.5 → **4.0jt**    | 1.40 → **1.10jt**  | 1.00 → **0.95jt**     |
| Jakarta    | 6.0 → **5.0jt**    | 2.80 → **1.15jt**  | 2.00 → **1.05jt**     |
| Tangerang  | 8.0 → **6.0jt**    | 4.00 → **1.25jt**  | 3.00 → **1.15jt**     |

### 3.2 Set bonus — `shared/data/regions.ts` constants

| Constant                        | old → new | rationale                                                |
| ------------------------------- | --------- | -------------------------------------------------------- |
| `REGION_SET_RENT_MULTIPLIER`    | 2 → **2** | keep — completing a set rewards your rent _weapon_       |
| `REGION_SET_PASSIVE_MULTIPLIER` | 2 → **1** | stop rewarding passive hoarding                          |
| `REGION_SET_VALUE_MULTIPLIER`   | 2 → **1** | stop inflating the leader's wealth-win & pinjol leverage |

### 3.3 Build tracks — `shared/data/tiers.ts`

**House** = the weapon → steepen the top so a Villa is a wall (`buildCostMult` unchanged):

| Tier | name         | rentMult (old→new) |
| ---- | ------------ | ------------------ |
| 1    | Rumah Kecil  | 1 → **1**          |
| 2    | Rumah Sedang | 2.5 → **3**        |
| 3    | Rumah Besar  | 5 → **6**          |
| 4    | Villa/Hotel  | 10 → **12**        |

**Property** = the floor → **drop tier 5 (Konglomerat); both tracks now cap at 4 tiers** + flatten
passive so it can't snowball (`buildCostMult`, `rentMult` unchanged). Mall (tier 4) is now the ceiling
at passive ×3 — matching the validated floor in §4.

| Tier  | name            | passiveMult (old→new) |
| ----- | --------------- | --------------------- |
| 1     | Warung          | 1 → **1**             |
| 2     | Toko            | 2 → **1.6**           |
| 3     | Minimarket      | 4 → **2.2**           |
| 4     | Mall (new top)  | 7 → **3**             |
| ~~5~~ | ~~Konglomerat~~ | **removed**           |

> Removing tier 5 needs no engine edit — the upgrade cap (`index.ts:755`) and max-tier rent bump
> (`index.ts:653`) both read `PROPERTY_TIERS.length` dynamically, so 4 entries auto-cap at Mall. Touch
> points: delete the array entry; remove the `"5": "Konglomerat"` i18n key in `en.json` + `id.json`;
> in `Board/icons.tsx` move the distinctive `Building2` icon from the (now-dead) `tier >= 5` branch onto
> the new top tier (Mall/4). `tileValue.ts` + `gameData.ts` read the array dynamically and adapt.

### 3.4 Lahan Kosong — `shared/data/tiers.ts` `LAND_BUSINESS_TIERS`

Fits the new world cleanly: **Warkop = a guaranteed single-tile rent wall** (no set needed),
**Dapur = a passive floor**. Land price + build costs unchanged; rent/passive retuned:

| Warkop tier | rent (old→new) | passive (old→new) |
| ----------- | -------------- | ----------------- |
| 1           | 1.5 → **2jt**  | 0.8 → **0.8jt**   |
| 2           | 3 → **5jt**    | 1.2 → **1.2jt**   |
| 3           | 5 → **9jt**    | 2 → **1.8jt**     |
| 4           | 8 → **15jt**   | 3.5 → **2.5jt**   |

| Dapur tier | rent (old→new)  | passive (old→new) |
| ---------- | --------------- | ----------------- |
| 1          | 1 → **1jt**     | 1.5 → **1.2jt**   |
| 2          | 1.5 → **1.5jt** | 2.5 → **2jt**     |
| 3          | 2.5 → **2jt**   | 4 → **3jt**       |
| 4          | 4 → **3jt**     | 6 → **4.5jt**     |

## 4. Validated outcomes (model in `scratchpad/v3.mjs`)

| Region    | Villa hit (full set) | House EV/lap (3 opp) | max Passive floor | full-set dev cost |
| --------- | -------------------- | -------------------- | ----------------- | ----------------- |
| Papua     | 14.4jt               | 9.5jt                | 3.6jt             | 25.5jt            |
| Surabaya  | 24.0jt               | 15.8jt               | 8.1jt             | 89.3jt            |
| Tangerang | 30.0jt               | 15.3jt               | 6.9jt             | 102.0jt           |

- **Rent dominates:** House EV > maxed passive in every region.
- **Cheap regions bankrupt:** Papua's 14.4jt Villa one-shots a 15jt-start player.
- **Passive can't win:** floor caps ~8jt/lap.
- **Premiums = glass cannons:** easiest to _complete_ (2 tiles) + biggest burst (30jt), but lower
  sustained EV and most expensive to max. The opposite of today.

## 5. Knobs left open for the lock

- The **64%→rent-dominant** aggressiveness (House `rentMult` top = 12; Property `passiveMult` cap = 3).
- Whether premiums should stay slightly stronger (raise their `rentBase` a touch).
- Whether the rent-weapon spread (~2×) is tight enough or should widen to justify premium prices.

## 6. Ripple effects to re-check on implement (NOT extra mechanics — just sanity passes)

- **Win conditions:** with `VALUE_MULTIPLIER`→1 and passive capped, total wealth in a game is lower →
  `TARGET_WEALTH_DEFAULT` (100jt) may take too long; consider lowering, or just playtest.
- **Pinjol leverage / Law-office transfer / sell refund** all read `tileValue`, which no longer doubles
  on a full set — leverage shrinks slightly. Likely fine; note it.
- **Property track depth:** resolved by dropping tier 5 — both tracks are now 4 tiers. Mall (×3
  passive for ×3 build) is the genuine ceiling; still floor-economics, not a snowball.

## 7. Implementation checklist (after lock)

1. `shared/data/regions.ts` — `buyPrice` + `rentBase` + `passiveBase` for all 9 regions (§3.1);
   `REGION_SET_PASSIVE_MULTIPLIER`→1, `REGION_SET_VALUE_MULTIPLIER`→1 (§3.2). Author in `jt()`/`rb()`.
2. `shared/data/tiers.ts` — `HOUSE_TIERS.rentMult` (§3.3); `PROPERTY_TIERS.passiveMult` **and delete the
   tier-5 Konglomerat entry** (§3.3); `LAND_BUSINESS_TIERS` rent/passive (§3.4).
3. `client/src/i18n/locales/en.json` + `id.json` — remove the property tier-name `"5": "Konglomerat"`
   key from both.
4. `client/src/features/game/Board/icons.tsx` — move the `Building2` icon off the dead `tier >= 5`
   branch onto the new top tier (Mall/4); update the comment.
5. **No engine edits.** Confirm `computeRent`, `collectPassiveIncome`, `tileValue` untouched (the tier
   cap reads `PROPERTY_TIERS.length` dynamically).
6. Tests — update `server/test/rent.test.ts`, `passive-income.test.ts`, and any `property`/`elimination`
   snapshots with hardcoded amounts; check `client/.../tileValue.test.ts` (refs `PROPERTY_TIERS[1]`).
   Add a case asserting a developed cheap-region Villa can bankrupt.
7. `pnpm check` then `pnpm test`.
8. Update `docs/GAME_DESIGN.md` balance tables + the ClickUp Game Design doc together.

_All numbers reproducible from `scratchpad/{roi,proposal,track,v2,v3}.mjs`._
