# Tuan Tanah — Tech Requirements & Architecture

---

## 1. Project Overview

A real-time multiplayer web-based Monopoly game with Indonesian theme, supporting 2–8 players per room. The system must handle complex game state including two property tracks, role-based abilities, pinjol loan system, timed card effects, structured negotiations, and turn enforcement — all synchronized in real-time across all players.

---

## 2. Tech Stack

### Frontend

| Technology       | Version | Purpose                                           |
| ---------------- | ------- | ------------------------------------------------- |
| React            | 18+     | UI component framework                            |
| TypeScript       | 5+      | Type safety across client and shared types        |
| Vite             | 5+      | Dev server and build tool                         |
| Tailwind CSS     | 3+      | Utility-first styling                             |
| Framer Motion    | 11+     | Animations (dice roll, token movement, card draw) |
| Socket.io-client | 4+      | Real-time WebSocket connection to game server     |
| Zustand          | 4+      | Client-side game state store                      |

### Backend

| Technology  | Version | Purpose                                                          |
| ----------- | ------- | ---------------------------------------------------------------- |
| Node.js     | 20 LTS  | Runtime                                                          |
| TypeScript  | 5+      | Type safety                                                      |
| Fastify     | 4+      | HTTP server (lobby, room creation, health check)                 |
| Socket.io   | 4+      | Real-time WebSocket event handling                               |
| ioredis     | 5+      | Redis client for game state persistence                          |
| kysely + pg | 0.29+   | Type-safe Postgres query builder + driver (game-history archive) |

### Infrastructure

| Service                 | Purpose                                             | Cost          |
| ----------------------- | --------------------------------------------------- | ------------- |
| Contabo VPS (Europe)    | Hosts all containers                                | Already owned |
| Docker + Docker Compose | Container orchestration                             | Free          |
| Nginx (Docker)          | Reverse proxy, static file serving, WebSocket proxy | Free          |
| Redis (Docker)          | In-memory game state storage with TTL               | Free          |
| Postgres (Docker)       | Self-hosted game-history archive (via Kysely)       | Free          |

---

## 3. Repository Structure

```
tuan-tanah/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── nginx/
│   └── nginx.conf
│
├── shared/                        ← shared TypeScript types (no runtime code)
│   └── types/
│       ├── game.ts                ← GameState, Player, Tile, Role, etc.
│       ├── events.ts              ← Socket.io event payloads
│       └── constants.ts           ← board config, region pricing, card data
│
├── client/                        ← React + Vite frontend
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── socket.ts              ← Socket.io client singleton
│       ├── store/
│       │   └── gameStore.ts       ← Zustand store
│       ├── pages/
│       │   ├── Home.tsx           ← create / join room
│       │   ├── Lobby.tsx          ← role selection, room settings
│       │   └── Game.tsx           ← main game screen
│       └── components/
│           ├── Board/
│           ├── PlayerPanel/
│           ├── DiceRoller/
│           ├── CardModal/
│           ├── NegotiationModal/
│           ├── PinjolModal/
│           └── EventLog/
│
└── server/                        ← Node.js + Socket.io backend
    ├── Dockerfile
    └── src/
        ├── bootstrap/             ← index.ts (entry) + env.ts (Fastify/Socket.io wiring)
        ├── rooms/                 ← rooms.ts, sessions.ts, store.ts (lifecycle + live state)
        ├── persistence/           ← Kysely Postgres client, schema, migrations/, gameHistory
        ├── modules/               ← feature seams: auth, social, matchmaking, bots
        ├── realtime/              ← socket handlers (was handlers/)
        │   ├── lobby.ts           ← join, set role, start game
        │   ├── game.ts            ← all in-game socket events
        │   └── mutations.ts       ← shared mutate→broadcast→emit write paths
        └── engine/                ← pure game logic, zero I/O (incl. lawoffice.ts)
            ├── index.ts           ← engine entry point
            ├── turn.ts            ← turn state machine
            ├── board.ts           ← tile definitions, region map
            ├── actions.ts         ← meta actions validator + executor
            ├── cards.ts           ← Kejadian + Hustle card effects
            ├── pinjol.ts          ← loan system logic
            ├── negotiation.ts     ← deal state machine
            ├── effects.ts         ← timed effect scheduler
            ├── roles.ts           ← role ability resolvers
            └── elimination.ts     ← bankruptcy + win condition check
```

---

## 4. Core Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Contabo VPS (Europe)                   │
│                                                          │
│  ┌─────────────┐     ┌──────────────────────────────┐   │
│  │    Nginx    │     │        Backend Container      │   │
│  │  Container  │────▶│   Fastify + Socket.io         │   │
│  │  :80 / :443 │     │   Node.js 20 + TypeScript     │   │
│  └──────┬──────┘     │                               │   │
│         │            │   ┌─────────────────────────┐ │   │
│         │ static     │   │      Game Engine        │ │   │
│         ▼            │   │   (pure TS, no I/O)     │ │   │
│  ┌─────────────┐     │   │                         │ │   │
│  │  Frontend   │     │   │  turn.ts                │ │   │
│  │   (React    │     │   │  actions.ts             │ │   │
│  │   /dist)    │     │   │  effects.ts             │ │   │
│  └─────────────┘     │   │  negotiation.ts         │ │   │
│                      │   │  pinjol.ts              │ │   │
│                      │   └──────────┬──────────────┘ │   │
│                      │              │                 │   │
│                      │   ┌──────────▼──────────────┐ │   │
│                      │   │     Redis Container      │ │   │
│                      │   │   Game State / TTL       │ │   │
│                      │   └─────────────────────────┘ │   │
│                      └──────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
                              │
                              │ Kysely (pg, in-cluster)
                              ▼
                  ┌───────────────────────┐
                  │  Postgres Container    │
                  │  Game-history archive  │
                  └───────────────────────┘
```

---

## 5. Data Flow — One Game Turn

```
Player clicks "Roll Dice"
        │
        ▼
Client emits:  socket.emit('roll_dice', { roomId })
        │
        ▼
Server: validate it's this player's turn
        │
        ▼
Game Engine: rollDice() → movePiece() → resolveTile()
        │
        ▼
Server: apply result → save new GameState to Redis
        │
        ▼
Server: io.to(roomId).emit('game_state', newState)
        │
        ▼
All clients: Zustand store updates → React re-renders
```

**Principle:** Clients only emit _requests_. The server validates, the engine resolves, and the server broadcasts the new canonical state. Clients never mutate state themselves.

---

## 6. Game State Schema (TypeScript)

```typescript
// shared/types/game.ts

type RupiahAmount = number // always in rupiah (e.g. 2_000_000 = Rp 2 juta)
type TileId = number // 0–39

interface GameState {
  roomId: string
  phase: 'lobby' | 'playing' | 'ended'
  round: number
  currentPlayerIndex: number
  players: Player[]
  tiles: TileState[]
  activeEffects: ActiveEffect[]
  kejadianDeck: string[]
  hustleDeck: string[]
  bank: RupiahAmount
  settings: RoomSettings
  winner?: string
  createdAt: number
  updatedAt: number
}

interface Player {
  id: string
  name: string
  role: Role
  cash: RupiahAmount
  position: TileId
  inJail: boolean
  jailTurnsLeft: number
  loans: PinjolLoan[]
  isEliminated: boolean
  isRoomMaster: boolean
  usedAbility: boolean // for once-per-game role abilities
}

interface TileState {
  id: TileId
  ownerId: string | null
  track: 'house' | 'property' | null // locked once first bought
  tier: number // 0 = unbuilt, 1–4 house, 1–5 property
}

interface ActiveEffect {
  id: string
  type: EffectType
  targetTileIds?: TileId[]
  targetPlayerId?: string
  multiplier?: number
  roundsRemaining: number
  sourceCard: string
}

type EffectType =
  | 'rent_multiplier'
  | 'passive_multiplier'
  | 'tier_drop'
  | 'transport_multiplier'
  | 'passive_halved'
  | 'lobby_block'
  | 'turn_skip'

interface PinjolLoan {
  id: string
  amount: RupiahAmount // 2jt / 5jt / 10jt
  interestPerRound: RupiahAmount
  lenderId: string | null // null = bank, playerId = Rentenir
  roundBorrowed: number
}

interface RoomSettings {
  winCondition: 'time' | 'wealth' | 'both'
  timeLimitMinutes?: 30 | 60 | 90 | 120
  targetWealth?: RupiahAmount
  startingCash: RupiahAmount // Rp 5jt – Rp 50jt
  enabledRoles: Role[]
}

type Role =
  | 'pengusaha'
  | 'politisi'
  | 'freelancer'
  | 'investor'
  | 'kontraktor'
  | 'ojol_driver'
  | 'influencer'
  | 'pejabat'
  | 'rentenir'
  | 'sales'
```

---

## 7. Socket.io Event Map

### Client → Server

| Event              | Payload                       | Description                  |
| ------------------ | ----------------------------- | ---------------------------- |
| `join_room`        | `{ roomId, playerName }`      | Join or create a room        |
| `pick_role`        | `{ role }`                    | Select role in lobby         |
| `start_game`       | `{}`                          | Room master starts game      |
| `roll_dice`        | `{}`                          | Roll dice on your turn       |
| `buy_property`     | `{ tileId }`                  | Buy unowned tile             |
| `upgrade_property` | `{ tileId }`                  | Upgrade tier on your tile    |
| `meta_action`      | `{ action, targetId? }`       | Perform a meta action        |
| `pay_jail`         | `{}`                          | Pay Rp 1jt to exit jail      |
| `take_pinjol`      | `{ amount }`                  | Borrow from bank or Rentenir |
| `propose_deal`     | `{ deal: NegotiationDeal }`   | Start a negotiation          |
| `respond_deal`     | `{ dealId, accept: boolean }` | Accept or reject a deal      |
| `sell_property`    | `{ tileId }`                  | Sell property back to bank   |
| `end_turn`         | `{}`                          | End your turn                |

### Server → Client

| Event               | Payload                      | Description                             |
| ------------------- | ---------------------------- | --------------------------------------- |
| `game_state`        | `GameState`                  | Full state broadcast after every change |
| `room_joined`       | `{ roomId, playerId }`       | Confirm join + assign ID                |
| `card_drawn`        | `{ type, card }`             | Show card animation to all              |
| `deal_proposed`     | `{ deal }`                   | Notify target player of incoming deal   |
| `player_eliminated` | `{ playerId }`               | Player went bankrupt                    |
| `game_over`         | `{ winner, finalStandings }` | Game ended                              |
| `error`             | `{ message }`                | Invalid action feedback                 |

---

## 8. Redis Schema

```
room:{roomId}           → JSON string of GameState   TTL: 24h
room:{roomId}:lock      → player turn lock           TTL: 60s (auto-expire safety)
```

All game state fits in a single key per room. On every state change, the full GameState is serialized and written atomically.

---

## 9. Postgres Schema (game-history archive, via Kysely)

```sql
-- Player accounts (future feature)
create table players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz default now()
);

-- Completed games log
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  winner_id uuid references players(id),
  win_condition text,
  duration_seconds int,
  player_count int,
  created_at timestamptz default now()
);

-- Per-player game stats
create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id),
  player_id uuid references players(id),
  role text not null,
  final_cash bigint,
  final_wealth bigint,
  eliminated boolean default false
);
```

---

## 10. Timed Effect Scheduler

Cards like "Banjir Jakarta for 3 rounds" require effects that decay over time. The engine decrements `roundsRemaining` at the start of each full round (after all players have taken a turn):

```typescript
// engine/effects.ts

function tickEffects(state: GameState): GameState {
  const alive = state.activeEffects
    .map((e) => ({ ...e, roundsRemaining: e.roundsRemaining - 1 }))
    .filter((e) => e.roundsRemaining > 0)
  return { ...state, activeEffects: alive }
}

function applyEffects(baseRent: number, tileId: TileId, state: GameState): number {
  let rent = baseRent
  for (const effect of state.activeEffects) {
    if (effect.targetTileIds?.includes(tileId) && effect.type === 'rent_multiplier') {
      rent *= effect.multiplier ?? 1
    }
  }
  return rent
}
```

---

## 11. Docker Compose

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./client/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./server
    env_file: .env
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgres://${POSTGRES_USER:-tuan}:${POSTGRES_PASSWORD:-tuan}@postgres:5432/${POSTGRES_DB:-tuan_tanah}
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis_data:
```

---

## 12. Nginx Config (Key Parts)

```nginx
server {
    listen 80;

    # Serve built React app
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }

    # REST API (room creation, health)
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
    }

    # Socket.io — must upgrade to WebSocket
    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 13. Dev vs Production

|             | Local Development            | Production (VPS)                                  |
| ----------- | ---------------------------- | ------------------------------------------------- |
| Frontend    | `vite dev` (hot reload)      | Built static files served by Nginx                |
| Backend     | `tsx watch src/index.ts`     | Docker container via PM2 or Docker restart policy |
| Redis       | Local install or Docker      | Docker container with persistent volume           |
| Database    | Postgres container (same)    | Postgres container (same)                         |
| Run command | `npm run dev` in each folder | `docker compose up -d`                            |

---

## 14. Environment Variables

```bash
# .env
NODE_ENV=production
PORT=3000

# Postgres (game-history archive; blank disables persistence)
DATABASE_URL=postgres://tuan:tuan@postgres:5432/tuan_tanah

# Redis
REDIS_URL=redis://redis:6379

# Game config
ROOM_TTL_HOURS=24
MAX_PLAYERS_PER_ROOM=8
```

---

## 15. Deployment Flow

```bash
# On Contabo VPS — initial setup
git clone https://github.com/your-org/tuan-tanah.git
cd tuan-tanah
cp .env.example .env && nano .env   # set DATABASE_URL (+ run `pnpm --filter server migrate`)

# Build frontend
cd client && npm install && npm run build && cd ..

# Launch all containers
docker compose up -d

# View logs
docker compose logs -f backend

# Deploy new version
git pull
cd client && npm run build && cd ..
docker compose up -d --build backend
```

---

## 16. Non-Goals (MVP Scope)

- No auction mechanic (per game design)
- No mobile-first UI (desktop only for MVP)
- No persistent player accounts (session-based names only for MVP)
- No leaderboards (Postgres schema ready, feature deferred)
- No SSL/HTTPS (add Certbot + Let's Encrypt after MVP)
- No spectator chat

---

## 17. Summary

| Concern            | Solution                                                       |
| ------------------ | -------------------------------------------------------------- |
| Real-time sync     | Socket.io — server is source of truth                          |
| Game logic         | Pure TypeScript engine — no I/O, fully testable                |
| State persistence  | Redis on same VPS — survives server restart                    |
| Timed card effects | `roundsRemaining` decremented per round tick                   |
| Negotiation        | Mini state machine in `negotiation.ts`                         |
| Auth + history     | Self-hosted Postgres (history live; auth deferred to post-MVP) |
| Deployment         | Docker Compose on Contabo VPS                                  |
| Latency (170ms)    | Acceptable — turn-based game, imperceptible                    |
| Cost               | Rp 0 extra — VPS already owned, Postgres self-hosted           |
