---
name: game
description: Game-engine and game-design work for Tuan Tanah — the pure I/O-free rules engine, mechanics (rent, pinjol, negotiation, roles, elimination, win conditions), balance, and reproducible tests. Use when implementing or changing a game mechanic, tuning balance, or writing engine tests.
---

# Game engine & design — Tuan Tanah

The game is an Indonesian-themed Monopoly (2–8 players). Design docs: `docs/GAME_DESIGN.md` (gameplay) and `docs/TECHNICAL_REQUIREMENT.md` (architecture). The locked master spec lives in ClickUp; the repo derives from it. Consult the docs when implementing a new mechanic — types and constants are derived from them.

## The engine is pure

`server/src/engine/` holds all rules with **no I/O**. Functions take `GameState` and mutate it in place or `throw new EngineError(code, params)`. Randomness is always the injectable `Rng` param (`util.ts`, defaults to `Math.random`) — never call `Math.random()`/`Date.now()` directly, so games stay reproducible and testable. `engine/index.ts` is the entry point and re-exports board helpers + the law-office subsystem.

## Submodules

| File             | Responsibility                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`       | `GameState` factory, lobby lifecycle (addPlayer, pickRole, updateSettings, startGame), action dispatch, `EngineError` class |
| `turn.ts`        | turn/round state machine, GO salary, passive income                                                                         |
| `board.ts`       | tile/region queries over shared data                                                                                        |
| `cards.ts`       | Kejadian/Hustle decks (`drawKejadian`, `drawHustle`)                                                                        |
| `roles.ts`       | role modifiers (build/buy/tax multipliers, salary) — has balance TODOs                                                      |
| `abilities.ts`   | role active abilities (`useAbility` dispatch)                                                                               |
| `actions.ts`     | meta-actions: invest/work/hustle/sabotage/korupsi/negotiate; voting                                                         |
| `effects.ts`     | timed card/status effects, `effectiveTier`, rent immunity                                                                   |
| `pinjol.ts`      | loans + debt resolution (loanshark mechanics)                                                                               |
| `negotiation.ts` | structured deals (`proposeDeal`, `respondToDeal`)                                                                           |
| `lawoffice.ts`   | Kantor Hukum landing actions + force-buy auction (re-exported via `index.ts`)                                               |
| `elimination.ts` | charge/wealth, bankruptcy cascade, voting, final standings, game-over                                                       |
| `util.ts`        | `Rng`, `uid`, `shuffle`, `pushLog`, `logKey`                                                                                |

## Logging & errors (both are i18n-keyed)

Player-visible events append to `state.log` via `logKey(state, code, params, playerId?)` (bounded to 200). Errors throw `new EngineError(code, params)`. Both reference stable string `code`s whose bilingual templates live in `shared/i18n/messages/*` (one module per engine file). **When you add a log or error, add its code to the matching module in both `en` and `id`** — a parity test (`server/test/i18n-messages.test.ts`) guards this. Use tagged param constructors (`tileP`, `rpP`, …) from `shared/i18n/params.ts` rather than pre-formatting values. Rupiah is always a raw `RupiahAmount` number.

## Balance & content lives in `shared/data/`, not the engine

Tuning numbers, cards, roles, tiers, regions, the board → edit `shared/data/` (see the `add-game-content` skill). The engine reads the classic ruleset directly; don't hardcode balance in engine code. Remaining `TODO`s in `engine/` (e.g. role-modifier follow-ups in `roles.ts`) are intentional later-milestone work, not bugs.

## Tests — the engine is the well-tested part

`server/test/*.test.ts` covers turn, rent, cards, effects, pinjol, negotiation, elimination, win, roles, actions, property, passive-income. Because RNG is injectable, seed a deterministic `Rng` to make games reproducible. When you add or change a mechanic, add/extend a test. Run `pnpm --filter server test` (or `test:watch`), then `pnpm check`.

## Adding a player action end-to-end

That spans the socket contract + handler too — use the `add-game-action` skill for the full recipe. This skill is the engine/design half: write the pure function, throw `EngineError`, emit `logKey` entries, add i18n codes, test it.
