# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .

# Build args injected at build time by docker-compose
ARG VITE_API_URL=""
ARG VITE_APP_NAME=ChampLens
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ─── Stage 2: nginx ───────────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/champlens.conf

# Copy Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check endpoint (nginx returns 200 for /health via config)
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
