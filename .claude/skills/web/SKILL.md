---
name: web
description: Full-stack web concerns for Tuan Tanah — the end-to-end Socket.io contract, shared types as the single source of truth, the dev proxy, HTTP/Fastify routes, CORS, rate limiting, and security headers. Use when changing the client↔server contract or wiring that spans both ends.
---

# Web (full-stack) — Tuan Tanah

This skill covers the seam between client and server: the typed real-time contract, shared types, and the HTTP/security edge. For one-sided work use `backend` or `frontend`; for this layer, both ends must stay in sync.

## The contract is typed end-to-end

`shared/types/events.ts` defines two interfaces that type **both** ends of Socket.io:

```ts
export interface ClientToServerEvents {
  roll_dice: () => void
  buy_property: (payload: { tileId: TileId }) => void
  join_room: (p: { roomId: string; playerName: string }, ack: AckCallback) => void
  // ...
}
export interface ServerToClientEvents {
  game_state: (state: GameState) => void
  card_drawn: (p: { type: 'kejadian' | 'hustle'; card: string; playerId: string }) => void
  error: (p: { message: string; code?: string; params?: LogParams }) => void
  // ...
}
export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string }
```

**Adding any event means editing the correct map** (client→server for actions, server→client for pushes). The server types its socket as `TTSocket`/`TTServer` (`realtime/common.ts`); the client's `socket.ts` is typed off the same interfaces. A typo in a payload shape is a compile error on both ends — keep it that way.

## State broadcast model

The server pushes the **entire** `GameState` via `game_state` after every mutation. The client store replaces `state` wholesale. There is no partial/delta protocol and no client-side prediction. One-off side events (`card_drawn`, `rent_paid`, `player_eliminated`, `game_over`, `error`) are emitted alongside the state push for animation/UX cues — they never carry authoritative state the client must reconcile.

## `shared/` is the single source of truth (no build step)

`@tuan-tanah/shared` exports raw `.ts` (`main`/`types` point at source). Both ends import it directly: `GameState`, `Player`, `RupiahAmount`, `TileId`, the event maps, and all game constants. Change a type once, both ends see it. Server uses relative `.js` imports; client uses the `@/` alias for its own src.

## Dev proxy vs prod

In dev, Vite proxies `/api` and `/socket.io` to the backend on `:3000` (`client/vite.config.ts`); client on `:5173`. In prod, Caddy reverse-proxies the same paths to `backend:3000` and serves the SPA (see `devops`). `VITE_SERVER_URL` is blank for same-origin/proxy; set it only to point the client at a different origin.

## HTTP & security edge

- Fastify serves `/api/*` (e.g. `/api/health`). `@fastify/cors` + `@fastify/rate-limit` are wired in `bootstrap/`.
- **CORS is required in prod**: `CORS_ORIGINS` must be set — blank/wildcard/localhost values refuse to start. In dev it's `http://localhost:5173`.
- `server/src/security.ts` gates connections (`connectionGate`, `trackConnection`).
- Prod security headers (HSTS, X-Frame-Options DENY, X-Content-Type-Options, a strict CSP allowing `connect-src 'self' wss:`, 64KB body cap) are set by Caddy, not the app — see the `Caddyfile`.

## Checklist when touching the contract

1. Edit the right interface in `shared/types/events.ts`.
2. Add the server handler (`backend` skill) and the client emit/listener (`frontend` skill).
3. If it surfaces a message, key it in `shared/i18n/messages/*` (en+id).
4. `pnpm check` — the typed contract makes mismatches show up as type errors.
