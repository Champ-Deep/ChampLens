# ChampLens — Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose                        │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐│
│  │ frontend │   │ backend  │   │       worker         ││
│  │  nginx   │──▶│ Fastify  │   │  BullMQ processor    ││
│  │  :80     │   │  :3001   │   │  (transcoder/QR/AR)  ││
│  └──────────┘   └────┬─────┘   └──────────┬───────────┘│
│        │             │                    │             │
│        │        ┌────┴────────────────────┤             │
│        │        ▼                         ▼             │
│  ┌─────┴──┐ ┌──────────┐           ┌──────────┐        │
│  │uploads │ │ mongodb  │           │  redis   │        │
│  │volume  │ │  :27017  │           │  :6379   │        │
│  └────────┘ └──────────┘           └──────────┘        │
└─────────────────────────────────────────────────────────┘
```

**5 containers:**
| Container | Image | Purpose |
|---|---|---|
| `champlens-frontend` | nginx:1.25-alpine | Serves React SPA, proxies /api and /files |
| `champlens-backend` | node:20-alpine | Fastify REST API + WebSocket |
| `champlens-worker` | node:20-alpine | BullMQ job processor (FFmpeg, QR, MindAR) |
| `champlens-mongodb` | mongo:7.0 | Primary database |
| `champlens-redis` | redis:7-alpine | BullMQ job queue |

**3 named volumes:**
- `mongodb_data` — MongoDB data files
- `redis_data` — Redis AOF persistence
- `uploads_data` — Shared between backend + worker (videos, QR images, print packs)

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- That's it. No Node, MongoDB, Redis, or FFmpeg needed on the host.

---

## Quick Start (Production)

### 1. Clone / enter project

```bash
git clone https://github.com/Champ-Deep/ChampLens.git
cd ChampLens
```

### 2. Set environment variables

```bash
cp .env.docker .env.docker.local
```

Edit `.env.docker.local` — **minimum required changes:**

```env
MONGO_INITDB_ROOT_PASSWORD=your_strong_mongo_password
REDIS_PASSWORD=your_strong_redis_password
FRONTEND_URL=http://your-domain.com
FILE_BASE_URL=http://your-domain.com/files
CLERK_PUBLISHABLE_KEY=pk_test_...      # from clerk.com → API Keys
CLERK_SECRET_KEY=sk_test_...           # from clerk.com → API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... # same publishable key — baked into the SPA bundle
```

Auth runs entirely on Clerk — no JWT secret, no bcrypt, no local password storage. Sign up
at <https://clerk.com>, create a ChampLens app, and grab the publishable + secret keys from
the API Keys page.

### 3. Add Champions Group logo

Place your logo at:
```
backend/src/assets/champions-ranch-logo.png
```
Requirements: PNG, transparent background, minimum 300×300px.
The Dockerfile copies this into the image at build time.
If the file is absent, QR codes are generated without the center logo — no errors.

### 4. Build and start

```bash
docker compose --env-file .env.docker.local up -d --build
```

First build takes 3–5 minutes (installs canvas, sharp, compiles TypeScript).
Subsequent builds use Docker layer cache and are much faster.

### 5. Open the app

```
http://localhost        → Landing page
http://localhost/login  → Sign in
```

---

## Development Mode

Development mode mounts source code into containers for hot-reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  --env-file .env.docker.local up --build
```

- Frontend hot-reload: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

---

## Useful Commands

```bash
# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f mongodb

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove volumes (DELETES ALL DATA)
docker compose down -v

# Rebuild a single service
docker compose up -d --build backend

# Open a shell in the backend container
docker compose exec backend sh

# Open MongoDB shell
docker compose exec mongodb mongosh -u champlens -p --authenticationDatabase admin champlens

# Flush Redis (clears job queue)
docker compose exec redis redis-cli -a your_redis_password FLUSHALL
```

---

## Health Checks

All services have health checks. Check status:

```bash
docker compose ps
```

Expected output when healthy:
```
NAME                 STATUS
champlens-frontend     Up (healthy)
champlens-backend      Up (healthy)
champlens-worker       Up
champlens-mongodb      Up (healthy)
champlens-redis        Up (healthy)
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Yes | `champlens` | MongoDB root user |
| `MONGO_INITDB_ROOT_PASSWORD` | **Yes** | — | MongoDB root password |
| `REDIS_PASSWORD` | **Yes** | — | Redis password |
| `CLERK_PUBLISHABLE_KEY` | **Yes** | — | Clerk publishable key (`pk_test_...` / `pk_live_...`) — backend uses it to verify JWTs |
| `CLERK_SECRET_KEY` | **Yes** | — | Clerk secret key (`sk_test_...` / `sk_live_...`) — backend only |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | — | Same publishable key — must be a **Build Arg** so Vite bakes it into the SPA bundle |
| `FRONTEND_URL` | Yes | `http://localhost` | Public URL of the frontend |
| `FILE_BASE_URL` | Yes | `http://localhost/files` | Public base URL for file downloads |
| `LOGO_PATH` | No | `/app/src/assets/qr-logo.jpeg` | Path to Champions Group logo inside container |
| `RESEND_API_KEY` | No | — | Password reset emails (Phase 2) |
| `OPENROUTER_API_KEY` | No | — | AI video analysis (Phase 2) |

---

## Production Deployment (VPS / Cloud)

1. SSH into your server
2. Install Docker + Docker Compose
3. Clone the repo
4. Follow Quick Start steps above, replacing `localhost` with your domain
5. For HTTPS, put Cloudflare or Traefik in front, or add certbot:

```yaml
# Add to docker-compose.yml under frontend:
  certbot:
    image: certbot/certbot
    volumes:
      - ./docker/certbot/conf:/etc/letsencrypt
      - ./docker/certbot/www:/var/www/certbot
```

---

## Railway Deployment

ChampLens is structured to deploy as **3 services** on Railway from this single repo,
plus 2 managed datastores. Railway configs live at:

| Path | Service |
|---|---|
| `/railway.toml` + `/Dockerfile` | **API** (Fastify backend) |
| `/frontend/railway.toml` + `/frontend/Dockerfile.railway` | **Frontend** (Vite SPA via `serve`) |
| (same as API, with overridden start command) | **Worker** (BullMQ processor) |

### Step 1 — Datastores

Both datastores are deployed on Railway itself (no Atlas, no external services).

1. **Redis** — In the project, **`Cmd+K` → "Add Redis"** (or **+ New → Database → Add Redis**).
   Exposes `${{Redis.REDIS_URL}}` for other services to reference.

2. **MongoDB** — Deploy the official Mongo template:
   **`Cmd+K` → "Deploy MongoDB"**, or from <https://railway.com/deploy/mongo>.
   - Uses the official `mongo` Docker image with start command
     `mongod --ipv6 --bind_ip ::,0.0.0.0 --setParameter diagnosticDataCollectionEnabled=false`
     (IPv6 + private networking enabled).
   - Exposes these env vars for inter-service references:
     - `${{Mongo.MONGO_URL}}` — full connection string (use this)
     - `${{Mongo.MONGOHOST}}`, `${{Mongo.MONGOPORT}}`, `${{Mongo.MONGOUSER}}`, `${{Mongo.MONGOPASSWORD}}` — individual parts
   - **Important:** The template attaches a persistent volume for data. **Deploys to this
     service will incur downtime** (Railway can't mount the volume twice at once). That's
     fine for a database — just don't redeploy Mongo casually.
   - **Backups are NOT automatic.** Enable Railway's native Backups feature in the Mongo
     service settings before going to production.
   - The TCP Proxy (external access) is enabled by default but incurs egress charges.
     Disable it if you don't need to connect from outside Railway — the API/Worker reach
     Mongo over Railway's private network either way.

### Step 2 — API service

1. **+ New service → GitHub Repo → Champ-Deep/ChampLens → main**
2. Settings → **Service Name:** `champlens-api`
3. Settings → **Networking:** Generate a public domain (you'll need it for the frontend build arg)
4. Settings → **Variables:** set
   ```
   NODE_ENV=production
   MONGODB_URI=${{Mongo.MONGO_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   CLERK_PUBLISHABLE_KEY=pk_test_...   # from clerk.com → API Keys
   CLERK_SECRET_KEY=sk_test_...        # from clerk.com → API Keys
   FRONTEND_URL=https://<frontend-service>.up.railway.app
   FILE_BASE_URL=https://<this-service>.up.railway.app/files
   ```
   Note: if you named your Mongo service something other than `Mongo`, adjust the
   reference (e.g. `${{champlens-mongo.MONGO_URL}}`). Do NOT set `PORT` — Railway
   injects it.
5. Deploy. Healthcheck hits `/health` — should return 200 within seconds (the
   listen-first pattern means the API responds before MongoDB connects).

### Step 3 — Worker service

The worker shares the API's image but runs a different process. Don't try to run it
inside the API container — Railway expects one process per service.

1. **+ New service → GitHub Repo → same repo, same branch**
2. Settings → **Service Name:** `champlens-worker`
3. Settings → **Networking:** Disable public domain (worker is internal-only)
4. Settings → **Deploy → Start Command** (override):
   ```
   sh -c 'node dist/workers/index.js'
   ```
5. Settings → **Variables:** copy these from the API service:
   ```
   NODE_ENV=production
   MONGODB_URI=${{Mongo.MONGO_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   CLERK_SECRET_KEY=sk_test_...
   FRONTEND_URL=https://<frontend-service>.up.railway.app
   FILE_BASE_URL=https://<champlens-api>.up.railway.app/files
   LOGO_PATH=/app/src/assets/qr-logo.jpeg
   ```
   The worker doesn't serve HTTP, so it doesn't need `CLERK_PUBLISHABLE_KEY`.
6. Deploy.

### Step 4 — Frontend service

1. **+ New service → GitHub Repo → same repo, same branch**
2. Settings → **Service Name:** `champlens-frontend`
3. Settings → **Source → Root Directory:** `frontend`
4. Settings → **Build → Build Args:**
   ```
   VITE_API_URL=https://<champlens-api>.up.railway.app
   VITE_APP_NAME=ChampLens
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
   *(Vite bakes env vars into the JS bundle at BUILD time — runtime env vars are ignored.
   The Clerk **publishable** key is safe to ship to the browser; never put the **secret**
   key as a build arg.)*
5. Settings → **Networking:** Generate a public domain
6. Deploy.

### Step 5 — Verify

```bash
# API responds
curl https://<champlens-api>.up.railway.app/health
# → {"ok":true,"ts":...}

# Frontend loads
curl -I https://<champlens-frontend>.up.railway.app/
# → HTTP/2 200

# Frontend bundle has the right API URL baked in
curl -s https://<champlens-frontend>.up.railway.app/ | grep -oE 'assets/[^"]+\.js' | head -1
# fetch that JS file and grep for your API URL
```

### Step 6 — Promote yourself to admin in Clerk

Admin role lives in Clerk's `publicMetadata`, not in Mongo. After you sign up via the SPA:

1. Open <https://dashboard.clerk.com> → your app → Users → click yourself
2. Scroll to **Metadata → Public** → Edit
3. Set:
   ```json
   { "role": "admin" }
   ```
4. Save. Sign out + back in on the SPA — `/admin/users` and `/admin/stats` will unlock.

Repeat for any other admin. To revoke, set `role` to anything else or remove the key.

### Common Railway gotchas

- **`Invalid value for '--port': '$PORT'`** — start command must wrap in `sh -c` so the
  shell expands `$PORT`. Already done in the bundled `railway.toml` files.
- **`Railpack could not determine how to build the app`** — Railway didn't find the
  Dockerfile. Make sure Root Directory matches (root for API/worker, `frontend` for SPA).
- **Frontend hits `localhost:8000` in production** — `VITE_API_URL` was set as a runtime
  env var. It MUST be a Build Arg.
- **CORS errors** — the API's `cors` registration reads `FRONTEND_URL`. Set it to your
  frontend's public Railway URL (comma-separate multiple origins if you also use a custom
  domain).
- **`VITE_CLERK_PUBLISHABLE_KEY is not set` error in browser console** — set it as a Build
  Arg on the frontend service (not a Variable). Rebuild after adding.
- **`401 Unauthorized` on every API call** — backend has `CLERK_SECRET_KEY` unset or wrong,
  OR the frontend isn't sending the Bearer token. Check the request's `Authorization`
  header in DevTools.

For deeper troubleshooting see <https://docs.railway.com/deployments/healthchecks>.

---

## Data Persistence

All persistent data is stored in named Docker volumes:

| Volume | Contents |
|---|---|
| `champlens_mongodb_data` | All MongoDB documents (users, cards, scans) |
| `champlens_redis_data` | Redis AOF log (job queue state) |
| `champlens_uploads_data` | All uploaded/processed files (videos, QR PNGs, .mind files, ZIPs) |

Backup uploads:
```bash
docker run --rm -v champlens_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz /data
```

Backup MongoDB:
```bash
docker compose exec mongodb mongodump \
  -u champlens -p your_password \
  --authenticationDatabase admin \
  --db champlens --out /tmp/dump

docker compose cp mongodb:/tmp/dump ./mongo-backup
```
