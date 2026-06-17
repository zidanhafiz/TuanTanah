# Task 1 — Meta-actions & turn economy: replace Investasi with Judol + per-lap passive income

- **Type:** 💬 Feature request
- **Effort:** Medium
- **Priority:** High
- **Status:** Not started
- **Notion:** https://app.notion.com/p/38201c5ad04981f0817ed15d02964311

## Goal

Replace the `investasi` meta-action with a **Judol** (online gambling) action, and change passive income to pay once per full lap instead of every turn.

## Scope

### Judol (replaces Investasi)

- Remove `investasi` meta-action entirely.
- Add `judol`: a modal where the player enters a **deposit** amount.
  - 10% win rate → payout x3–x5 (random).
  - Within the win, a 1% sub-roll upgrades to **x10 jackpot**.
  - Otherwise the deposit is lost.
- Modeled on the existing `korupsi` action (injectable RNG, reproducible/testable).
- Extend the `meta_action` socket payload + `MetaActionRequest` with `depositAmount`.

### Passive income → per lap

- Currently collected at the start of every turn (`collectPassiveIncome`).
- Move collection to the pass-GO path so it pays once per lap. Note the balance impact.

## Affected files

- `server/src/engine/actions.ts` (remove invest case, add judol case)
- `server/src/engine/turn.ts`, `server/src/engine/index.ts` (passive income timing)
- `shared/types/events.ts` (`MetaActionType`, payload)
- `shared/types/constants.ts` (judol win rate / multiplier constants)
- `client/src/components/MetaActionBar/MetaActionBar.tsx`, new `JudolModal` (model on `PinjolModal`), `client/src/pages/Game.tsx`
- i18n `en.json` / `id.json`
- `server/test/actions.test.ts`

## Decisions / notes

- Jackpot semantics: x10 is a 1% sub-roll **within** the 10% win (else x3–x5). Confirm during build.
- Gate: `pnpm check` + `pnpm test` must pass.
