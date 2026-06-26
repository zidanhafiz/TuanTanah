# bots (feature seam — not yet implemented)

Home for AI/computer players. Nothing here runs yet.

Key design note: bots will call the **pure engine** (`../../engine/`) directly to
evaluate moves — the engine's I/O-free purity and injectable `Rng` are exactly
what makes bot decision-making cheap and deterministic to test. A bot is just a
policy that, given a `GameState`, picks the next request to feed through the same
mutation path the realtime handlers use (`../../realtime/mutations.ts`).
