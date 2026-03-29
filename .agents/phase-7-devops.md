# Agent Instructions — Phase 7: DevOps & Local Dev Environment

## Prerequisite
All application phases (1–6) must be complete.

## Goal
1. Add missing Dockerfiles to each service
2. Create a `docker-compose.yml` at the project root for local development
3. Fix `package.json` scripts in `main-api`
4. Verify all K8s manifests reference the correct image names

---

## Task 1 — `services/main-api/Dockerfile`

```dockerfile
# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build          # outputs to dist/

# ---- runner ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
```

---

## Task 2 — `services/stream-svc/Dockerfile`

(This should already exist from Phase 5 — verify and do not overwrite if correct.)

```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o stream-svc ./cmd/

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/stream-svc /usr/local/bin/stream-svc
EXPOSE 8082
ENTRYPOINT ["stream-svc"]
```

---

## Task 3 — `services/drive-worker/Dockerfile`

(Verify exists from Phase 4 — do not overwrite if correct.)

```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o drive-worker ./cmd/

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/drive-worker /usr/local/bin/drive-worker
ENTRYPOINT ["drive-worker"]
```

---

## Task 4 — `services/torrent-worker/Dockerfile`

Already exists. Read it and verify it uses the multi-stage Go build pattern.
If it uses a single stage or references the wrong binary name, update it to:

```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o torrent-worker .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/torrent-worker /usr/local/bin/torrent-worker
ENTRYPOINT ["torrent-worker"]
```

---

## Task 5 — `docker-compose.yml` (project root)

```yaml
version: "3.9"

services:

  # ── Infrastructure ─────────────────────────────────────────────────────────

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis-data:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
    environment:
      MONGO_INITDB_DATABASE: torrent-hunt
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio-data:/data]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      retries: 5

  # ── Application services ────────────────────────────────────────────────────

  main-api:
    build:
      context: ./services/main-api
      dockerfile: Dockerfile
    ports: ["3000:3000"]
    environment:
      NODE_ENV: development
      PORT: "3000"
      MONGODB_URI: mongodb://mongo:27017/torrent-hunt
      REDIS_URL: redis://redis:6379
      AUTH0_DOMAIN: ${AUTH0_DOMAIN}
      AUTH0_AUDIENCE: ${AUTH0_AUDIENCE}
      AUTH0_CLIENT_ID: ${AUTH0_CLIENT_ID}
      AUTH0_CLIENT_SECRET: ${AUTH0_CLIENT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: http://localhost:3000/api/drive/callback
      TMDB_API_KEY: ${TMDB_API_KEY}
      OBJECT_STORAGE_URL: http://minio:9000
      OBJECT_STORAGE_BUCKET: downloads
    depends_on:
      redis: { condition: service_healthy }
      mongo: { condition: service_healthy }

  torrent-worker:
    build:
      context: ./services/torrent-worker
      dockerfile: Dockerfile
    environment:
      REDIS_URL: redis://redis:6379
      OBJECT_STORAGE_URL: http://minio:9000
      OBJECT_STORAGE_BUCKET: downloads
      OBJECT_STORAGE_ACCESS_KEY: minioadmin
      OBJECT_STORAGE_SECRET_KEY: minioadmin
      WORKER_CONCURRENCY: "3"
    depends_on:
      redis: { condition: service_healthy }

  drive-worker:
    build:
      context: ./services/drive-worker
      dockerfile: Dockerfile
    environment:
      REDIS_URL: redis://redis:6379
      MONGODB_URI: mongodb://mongo:27017/torrent-hunt
      OBJECT_STORAGE_URL: http://minio:9000
      OBJECT_STORAGE_BUCKET: downloads
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    depends_on:
      redis: { condition: service_healthy }
      mongo: { condition: service_healthy }

  stream-svc:
    build:
      context: ./services/stream-svc
      dockerfile: Dockerfile
    ports: ["8082:8082"]
    environment:
      PORT: "8082"
      OBJECT_STORAGE_URL: http://minio:9000
      OBJECT_STORAGE_BUCKET: downloads
    depends_on:
      minio: { condition: service_healthy }

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports: ["5173:80"]
    depends_on: [main-api]

volumes:
  redis-data:
  mongo-data:
  minio-data:
```

---

## Task 6 — `client/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build           # outputs to dist/

FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### `client/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to main-api
    location /api/ {
        proxy_pass http://main-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
    }

    # Proxy stream requests to stream-svc
    location /api/stream/ {
        proxy_pass http://stream-svc:8082;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

---

## Task 7 — Fix `services/main-api/package.json` scripts

Read the current `package.json`. Ensure these scripts are present and correct:

```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "lint": "eslint src --ext ts"
  }
}
```

The `"main"` field should be `"dist/src/index.js"`.

---

## Task 8 — `.env.example` (project root)

```bash
# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.torrent-hunt.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Encryption — 32-byte hex string
ENCRYPTION_KEY=

# Google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# TMDB
TMDB_API_KEY=

# Client (Vite)
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=https://api.torrent-hunt.com
VITE_API_BASE_URL=http://localhost:3000
```

---

## Task 9 — MinIO bucket creation (init script)

Create `scripts/init-minio.sh`:

```bash
#!/usr/bin/env bash
# Run once after MinIO starts to create the downloads bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/downloads --ignore-existing
mc anonymous set download local/downloads   # read-only public for stream-svc
```

---

## Task 10 — Verify K8s manifests

Read all files in `k8s/`. Verify:
- `k8s/app/deployment.yaml` — image names match `ghcr.io/{repo}/main-api:latest` pattern
- `k8s/workers/` — torrent-worker + drive-worker deployments exist
- `k8s/data/redis.yaml` + `k8s/data/mongodb.yaml` — StatefulSets exist with PVCs
- `k8s/configmap.yaml` — non-secret env vars for all services
- `k8s/secrets.yaml` — template with base64 placeholders (not real values)

If any of these are missing, create minimal versions following the patterns
established in the other manifests.

---

## Acceptance criteria

### Local docker-compose
```bash
# From project root:
docker compose up --build
```
- All 8 containers start and pass healthchecks
- `http://localhost:5173` serves the client
- `http://localhost:3000/health` returns `{"status":"ok"}`
- `http://localhost:8082/health` returns `{"status":"ok"}`
- MinIO console accessible at `http://localhost:9001`

### Build verification
```bash
# main-api
cd services/main-api && npm run build     # zero TypeScript errors

# torrent-worker
cd services/torrent-worker && go build ./...

# drive-worker
cd services/drive-worker && go build ./...

# stream-svc
cd services/stream-svc && go build ./...

# client
cd client && pnpm build                   # zero errors
```

### End-to-end smoke test (manual)
1. Login via Auth0
2. Connect Google Drive
3. Search a movie → click card → enter a real magnet URL → submit
4. Watch progress bar update via SSE
5. On completion → "Open in Drive" link valid → "Stream" button plays video
