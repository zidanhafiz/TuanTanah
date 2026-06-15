# Production deploy helpers (run on the VPS, from the repo root).
# Requires a prod .env (see .env.example). The web tier builds the client and
# runs Caddy (auto-TLS); backend + redis run alongside it.

.PHONY: deploy up down logs restart ps health

# One-step redeploy: pull latest, rebuild images, restart in the background.
deploy:
	git pull --ff-only
	docker compose up -d --build

# Bring the stack up (rebuild) / take it down.
up:
	docker compose up -d --build
down:
	docker compose down

# Restart without rebuilding.
restart:
	docker compose restart

# Follow logs / list containers.
logs:
	docker compose logs -f
ps:
	docker compose ps

# Quick health check against the backend through Caddy.
health:
	curl -fsS https://$${DOMAIN:-localhost}/api/health && echo
