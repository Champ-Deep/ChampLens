# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libvips-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts=false

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 3: development ─────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS development

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libvips-dev \
    ffmpeg wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts=false

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ─── Stage 4: production ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    # canvas runtime deps
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    # sharp runtime deps
    libvips42 \
    # ffmpeg for video transcoding
    ffmpeg \
    # wget for health checks
    wget \
    # tini for signal handling
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production deps (pre-built native modules — glibc-compatible)
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Copy assets (QR logo)
COPY src/assets ./src/assets

# Copy package.json for scripts reference
COPY package.json ./

# Create uploads dir with correct permissions
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Run as non-root
USER node

EXPOSE 3001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
