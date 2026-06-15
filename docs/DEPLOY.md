# Deploying Tuan Tanah to a VPS (production, HTTPS)

The production stack is `docker-compose.yml`: a **web** tier (Caddy serving the
built React client + reverse-proxying the API, with automatic Let's Encrypt
TLS), the **backend** (Fastify + Socket.io), and **redis**. Single instance —
horizontal scaling is out of scope for this deploy.

## Prerequisites

- VPS (Ubuntu/Debian) with Docker + docker-compose installed.
- A **domain** with a DNS **A record** pointing at the VPS IP (AAAA too if you
  have IPv6). Verify it resolves before the first deploy — Let's Encrypt issuance
  fails otherwise:
  ```bash
  dig +short yourdomain.com   # should print the VPS IP
  ```
- A non-root user with Docker access (or sudo), and git access to clone the repo.
- Firewall open on 22, 80, 443:
  ```bash
  sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```
  Ports 80 **and** 443 must be reachable — Caddy uses 80 for the ACME HTTP
  challenge and the HTTP→HTTPS redirect.

## First deploy

```bash
# 1. Clone
git clone <repo-url> tuan-tanah && cd tuan-tanah

# 2. Create the prod .env (gitignored)
cp .env.example .env
```

Edit `.env` and set:

| Var               | Value                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`        | `production`                                                                               |
| `PORT`            | `3000`                                                                                     |
| `CORS_ORIGINS`    | `https://yourdomain.com` (the server refuses to start if this is empty/localhost/wildcard) |
| `ROOM_TTL_HOURS`  | `24`                                                                                       |
| `DOMAIN`          | `yourdomain.com`                                                                           |
| `ACME_EMAIL`      | your email (Let's Encrypt expiry notices)                                                  |
| `REDIS_URL`       | leave as-is — compose overrides it to `redis://redis:6379`                                 |
| `VITE_SERVER_URL` | leave **blank** (client talks to the API same-origin)                                      |
| `SUPABASE_*`      | leave **blank** (deferred post-MVP)                                                        |

```bash
# 3. Build + start everything (Caddy auto-issues the TLS cert on first boot)
make deploy        # == git pull + docker compose up -d --build
```

## Verify

```bash
curl -fsS https://yourdomain.com/api/health   # -> {"status":"ok","store":"redis",...}
```

Then open `https://yourdomain.com` in two browser tabs, create a room in one and
join from the other, and confirm the WebSocket stays connected and game state
syncs. Check `store` is `redis` (not `memory`) so state survives restarts.

If certs don't issue: confirm DNS resolves to this box and 80/443 are open, then
`docker compose logs -f web` to watch the ACME exchange.

## Redeploy

```bash
make deploy        # git pull --ff-only + rebuild + restart
```

## Ops

- **Logs:** `make logs` (or `docker compose logs -f web|backend|redis`).
- **Survives reboot:** every service is `restart: unless-stopped`; ensure Docker
  starts on boot — `sudo systemctl enable docker`.
- **Cert renewal:** automatic — Caddy renews in the background; no cron needed.
- **Persistence:** Redis uses a named volume (`redis_data`) with AOF on, so game
  state survives restarts (bounded by `ROOM_TTL_HOURS`). Caddy's certs live in
  `caddy_data`. Back these volumes up if persistence matters.

## Local test of the prod stack (optional)

Set `DOMAIN=localhost`, `ACME_EMAIL=you@example.com`, and
`CORS_ORIGINS=https://localhost` in `.env`, then `docker compose up --build`.
Caddy serves an internal self-signed cert on https://localhost (browser will warn).
