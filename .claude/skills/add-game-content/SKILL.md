---
name: add-game-content
description: Recipe for adding or tuning Tuan Tanah game content/balance — cards (Kejadian/Hustle), roles, tiers, regions, economy numbers, or board tiles — all in shared/data with the i18n overlay, no engine edits. Use for any balance or content change.
---

# Add / tune game content (balance, cards, roles, board)

**Content and balance live in `shared/data/`, never in engine code.** The engine reads the classic ruleset; you change the data it reads. The locked master spec is in ClickUp (Nekobytes → TuanTanah) — if gameplay/balance changes, update ClickUp and the repo together, and keep `docs/GAME_DESIGN.md` in sync.

## Where each kind of content lives — `shared/data/`

| Change                           | File                                   |
| -------------------------------- | -------------------------------------- |
| Money/salary/rent/cost constants | `economy.ts`                           |
| Region definitions/grouping      | `regions.ts`                           |
| Property/house tier specs        | `tiers.ts`                             |
| Roles + their modifiers          | `roles.ts`                             |
| Unit definitions                 | `units.ts`                             |
| The board / map tiles            | `boards/classic.ts`                    |
| Kejadian (event) cards           | `cards/kejadian.ts`                    |
| Hustle cards                     | `cards/hustle.ts`                      |
| Bundle of board+economy+roles    | `rulesets/classic.ts` (game-mode seam) |

`shared/index.ts` re-exports everything flat, so the `@tuan-tanah/shared` import surface is unchanged when you add data.

## Recipe

1. **Edit the data.** Add/adjust the entry in the right `shared/data/` file. Match the existing shape exactly — IDs, enums, and tagged unions are consumed by the engine and the typed event contract, so a wrong shape is a type error. Rupiah values are raw numbers.
2. **No engine change for pure balance.** If you're only tuning numbers or adding a card/role that fits existing mechanics, you're done with logic. Only touch `server/src/engine/` if the content needs a _new mechanic_ — then use the `game` and `add-game-action` skills.
3. **Localize display names via the overlay.** Game-data strings shown in the client are localized through `client/src/i18n/gameData.ts` (overlay over `shared` constants) with text in `locales/{en,id}.json`. Add EN + ID entries for any new card/role/region/tile name.
4. **Key any new engine messages.** If the content makes the engine emit a _new_ log/error code (e.g. a card with a novel effect), add it to the matching `shared/i18n/messages/*` module in both `en` and `id` — the parity test guards this.
5. **Update tests.** Engine tests in `server/test/` (e.g. `cards.test.ts`, `roles.test.ts`, `rent.test.ts`) assert specific balance/behavior — update or add cases. Seed a deterministic `Rng` for card draws.

## Gotchas

- Don't hardcode the new numbers in engine functions — read them from the data the engine already imports.
- Keep card/role/region IDs stable; other data and saved references key off them.
- A role-modifier may have a `TODO` follow-up in `engine/roles.ts` — adding the data isn't enough if the modifier hook is still stubbed; check before assuming it takes effect.

## Gate

```bash
pnpm --filter server test     # balance/content assertions
pnpm check                    # typecheck (catches shape mismatches) + lint + format
```
