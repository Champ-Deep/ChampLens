# Root Dockerfile — builds the ChampLens API (Fastify backend) for Railway.
# Build context = repo root. Paths reference ./backend.
# Worker service uses this same image but overrides the start command.

# ─── Stage 1: deps (production node_modules with native builds) ──────────────
FROM node:20-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts=false

# ─── Stage 2: builder (compile TypeScript) ────────────────────────────────────
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --ignore-scripts=false

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    libvips42 \
    ffmpeg \
    wget \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY backend/src/assets ./src/assets
COPY backend/package.json ./

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 3001

# Shell form so $PORT (provided by Railway) expands; fallback for local docker run.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "PORT=${PORT:-3001} node dist/server.js"]
