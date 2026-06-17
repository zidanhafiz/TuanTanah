# Task backups

Local markdown backups of the Tuan Tanah improvement tasks. Notion **Tasks Tracker** is the source of truth (see `CLAUDE.md`); these are mirrors for offline reference.

Generated from the game-improvement notes (board stays 40 tiles, repurposing freed slots in place).

| #   | Task                                                                     | Type       | Effort | Priority | Notion                                                            |
| --- | ------------------------------------------------------------------------ | ---------- | ------ | -------- | ----------------------------------------------------------------- |
| 1   | [Meta-actions & turn economy](./01-meta-actions-judol-passive-income.md) | 💬 Feature | Medium | High     | [link](https://app.notion.com/p/38201c5ad04981f0817ed15d02964311) |
| 2   | [Cards & free-pass inventory](./02-cards-free-pass-inventory.md)         | 💬 Feature | Large  | High     | [link](https://app.notion.com/p/38201c5ad04981ca9402ed78b9a246a5) |
| 3   | [Board re-layout](./03-board-relayout.md)                                | 💬 Feature | Large  | Medium   | [link](https://app.notion.com/p/38201c5ad049811eade3fc39560344ea) |

## Suggested order & dependencies

- **Task 2 before Task 3** — the "buy free-pass card" option in Kantor Hukum (Task 3) depends on the inventory system from Task 2.
- Task 1 is independent and can go first or in parallel.

## Open design points (decide during build)

- **Judol jackpot semantics** — assumed: x10 is a 1% sub-roll _within_ the 10% win (else x3–x5).
- **Board** — exact freed-slot → tile-ID mapping and new-region prices need a short design pass.
- **Game Design doc** — the locked master spec in Notion diverges from these changes; update it when designs firm up.
- Server-side log/error strings remain English-only (existing i18n gap) unless addressed.
