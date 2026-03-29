# Torrent Hunt

> Full-stack torrent management and video streaming platform — built with a polyglot microservice architecture, async task queues, real-time SSE, and Kubernetes-native deployment.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Services](#services)
- [Key Engineering Decisions](#key-engineering-decisions)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Security Design](#security-design)
- [Project Structure](#project-structure)

---

## Overview

Torrent Hunt lets users search for movies, initiate torrent downloads via magnet link, receive real-time progress through Server-Sent Events, stream video content directly in the browser, and save completed downloads to their personal Google Drive — all behind a single Auth0-secured API gateway.

**What this project demonstrates:**

- Designing a **polyglot microservice system** (Node.js + Go) with clear service boundaries
- Replacing synchronous HTTP with **Redis Streams** as an async task queue for multi-GB downloads
- Implementing **SSE over Redis Pub/Sub** to push real-time progress without polling
- Choosing **Go over Node.js** for the stream service to handle concurrent byte-range I/O at scale
- Securing OAuth2 refresh tokens with **AES-256-GCM encryption at rest** in MongoDB
- Writing a **Kubernetes-native deployment** with namespace isolation, StatefulSets, PVCs, and Secrets

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                           │
│                                                                  │
│  ┌─ namespace: ingress ──────────────────────────────────────┐  │
│  │  Nginx Ingress Controller  (SSL · CORS · Rate Limit)      │  │
│  └───────────────────────────────────────────────────────────┘  │
│           │ /api/*                    │ /api/stream/*            │
│  ┌─ namespace: app ──────────────────────────────────────────┐  │
│  │  main-api (Node.js · ×2)     stream-svc (Go · ×2)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│           │ Redis Streams                                        │
│  ┌─ namespace: workers ──────────────────────────────────────┐  │
│  │  torrent-worker (Go · ×1–3)  drive-worker (Go · ×1)      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌─ namespace: data ─────────────────────────────────────────┐  │
│  │  redis StatefulSet (5Gi PVC)  mongodb StatefulSet (20Gi)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │                                        │
  Azure Blob Storage                        External APIs
  /downloads/{taskId}/                   Auth0 · TMDB · Google
```

A full Mermaid diagram, sequence flows, and all service use cases are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Build tooling and HMR |
| Auth0 React SDK | Authentication (OIDC/OAuth2 + `drive.file` scope) |
| Tailwind CSS + Radix UI | Styling and accessible components |
| React Router v7 | Client-side routing with route guards |
| Zod | Runtime environment config validation |
| SSE (`EventSource`) | Real-time download progress |

### Main API (`main-api`)
| Technology | Purpose |
|------------|---------|
| Node.js + Express + TypeScript | HTTP server |
| `express-oauth2-jwt-bearer` | Auth0 JWT RS256 middleware |
| `googleapis` SDK | Google Drive OAuth2 + file operations |
| MongoDB (Mongoose) | Task, user, and movie persistence |
| Redis Streams (`XADD` / `XREADGROUP`) | Async task queue |
| Redis Pub/Sub (`PUBLISH` / `SUBSCRIBE`) | SSE progress fan-out |
| AES-256-GCM | Encrypt Drive tokens at rest |

### Torrent Service (`torrent-worker`)
| Technology | Purpose |
|------------|---------|
| Go 1.23 + Gin | HTTP and internal API |
| `anacrolix/torrent` | BitTorrent client (DHT · PEX · µTP) |
| `google.golang.org/api` | Object Storage + Drive upload |
| Swagger / `swaggo` | Auto-generated OpenAPI docs |
| Viper + godotenv | Config management |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Kubernetes | Container orchestration with namespace isolation |
| Nginx Ingress Controller | TLS termination, routing, rate limiting |
| Redis 7 | Streams + Pub/Sub + token cache |
| MongoDB 7 | Primary persistence |
| Azure Blob Storage / MinIO | Shared object storage between services |
| Docker | Container builds |

---

## Services

### `main-api` — Node.js · namespace `app` · replicas 2

The orchestrator. Validates every JWT, handles all HTTP requests from the client, manages task lifecycle, and bridges async workers to the browser via SSE.

- **Auth**: `express-oauth2-jwt-bearer` verifying Auth0 RS256 JWTs on every protected route
- **Task creation**: writes to Redis `download_queue` Stream + inserts to MongoDB < 100 ms response
- **Progress**: subscribes to Redis `task:{taskId}:progress` channel and streams events to connected browsers (`text/event-stream`)
- **Drive OAuth**: one-time token exchange; tokens AES-256-GCM encrypted before MongoDB persistence; cached in Redis for hot reads

### `stream-svc` — Go · namespace `app` · replicas 2

Dedicated byte-range video streaming. Receiving blob bytes from Azure and forwarding them to the browser happens in a goroutine per request — no Node.js event loop contention, no buffering in Nginx (`proxy_buffering off`).

- Detects primary video file in a torrent (largest `.mkv`/`.mp4`) from the blob prefix
- Handles browser `Range` requests and `seek` jumps with arbitrary byte offsets
- Returns `206 Partial Content` directly; serves `200 OK` for players that omit `Range`

### `torrent-worker` — Go · namespace `workers` · replicas 1–3

Consumes from `download_queue` consumer group. Each task runs in its own goroutine with a dedicated `torrent.Client` instance — full DHT, PEX, and µTP peer negotiation. Publishes progress every 2 s. On completion, uploads files to Object Storage and enqueues an upload task.

- Concurrency bounded by semaphore (default 5 per pod)
- Cancel signal via Redis `task:{taskId}:control` channel — clean abort with `torrent.Drop()`
- Multi-part upload for files > 100 MB with checksum verification

### `drive-worker` — Go · namespace `workers` · replicas 1

Consumes from `upload_queue`. Resolves and refreshes Google OAuth2 tokens (Redis → MongoDB → Google refresh endpoint), then streams each file from Object Storage directly to Drive using the resumable upload API — zero intermediate buffering. Deletes Object Storage files on success.

---

## Key Engineering Decisions

### Why not poll for progress?

HTTP polling at 1 s intervals from 100 concurrent users = 100 req/s of pure overhead. Instead, workers publish to a Redis Pub/Sub channel (`PUBLISH task:{taskId}:progress`). The Main API subscribes per task and pushes events to the browser over a single long-lived SSE connection. Zero wasted requests.

### Why Go for streaming and workers?

Node.js runs on a single event loop. Piping 500 concurrent 5 Mbps streams = 2.5 Gbps through that loop degrades every other request in the process. Go spawns a goroutine per connection (4 KB initial stack vs. 1 MB OS thread) and the scheduler handles I/O blocking natively. Streaming and torrent I/O are the ideal Go use case.

### Why Redis Streams over a simple queue?

Redis Streams provide consumer groups with at-least-once delivery and pending-entry lists. If a torrent-worker Pod crashes mid-download, Redis keeps the message in the PEL; the next worker picks it up after a visibility timeout. A plain `LPUSH/RPOP` queue would silently drop it.

### Why AES-256-GCM for Drive tokens?

Google OAuth2 refresh tokens are permanent until revoked. If a MongoDB dump leaks, unencrypted tokens give an attacker permanent read/write access to every user's Drive. AES-256-GCM adds authenticated encryption — any bit flip in the ciphertext causes decryption to fail, preventing silent corruption.

### Why Object Storage as the shared file contract?

The torrent worker runs in `namespace: workers`; the stream service runs in `namespace: app`. A shared PVC would bind them to the same node and break horizontal scaling. Object Storage decouples them completely: the worker writes, the stream service reads, the drive worker reads then deletes — all independently, all scalable.

---

## API Reference

Full OpenAPI spec: [`torrent-downloader-api/openapi.yaml`](./torrent-downloader-api/openapi.yaml)

### Task Management

```
POST   /tasks                   Create download task
GET    /tasks                   List user tasks
GET    /tasks/:taskId           Get task status
GET    /tasks/:taskId/progress  SSE progress stream
DELETE /tasks/:taskId           Cancel task
```

### Movies

```
GET /movies                 Popular movies
GET /movies/search?q=       Search by title
GET /movies/:id             Movie details
```

### Drive & Subtitles

```
POST /drive/link-google-drive    OAuth2 callback — store tokens
GET  /drive/files                List user Drive files
GET  /subtitles/:imdbId          Fetch subtitles (OpenSubtitles)
```

### Torrent Worker (Internal — not exposed by Ingress)

```
POST /torrent/start            Start torrent from magnet
GET  /torrent/status/:taskId   Poll task status
POST /torrent/pause/:taskId    Pause
POST /torrent/resume/:taskId   Resume
```

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for main-service)
- Go 1.23+
- Auth0 account (free tier)
- Google Cloud project with Drive API enabled

### Local Development

```bash
# Clone
git clone https://github.com/your-username/torrent-hunt.git
cd torrent-hunt

# Start data layer
docker compose up -d redis mongo minio

# Start torrent API (Go)
cd torrent-downloader-api
go run cmd/torrent-api/main.go

# Start main API (Node.js)
cd backend/main-service
npm install && npm run dev

# Start client
cd client
pnpm install && pnpm dev
```

### Full stack with Docker Compose

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Client | http://localhost:5173 |
| Main API | http://localhost:3000 |
| Torrent API | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |
| Swagger UI | http://localhost:8080/swagger/index.html |

---

## Environment Variables

### Main API (`backend/main-service/.env`)

```env
PORT=3000
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
AUTH0_MGMT_CLIENT_ID=
AUTH0_MGMT_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/drive/callback
MONGODB_URI=mongodb://localhost:27017/torrent-hunt
REDIS_URL=redis://localhost:6379
TMDB_API_KEY=
OPENSUBTITLES_API_KEY=
ENCRYPTION_KEY=32-byte-hex-string-for-aes256gcm
```

### Torrent API (`torrent-downloader-api/.env`)

```env
PORT=8080
REDIS_URL=redis://localhost:6379
OBJECT_STORAGE_URL=http://localhost:9000
OBJECT_STORAGE_BUCKET=downloads
MAX_CONCURRENT_DOWNLOADS=5
```

### Client (`client/.env`)

```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_CALLBACK_URL=http://localhost:5173/callback
VITE_AUTH_IDENTIFIER=https://your-api-identifier
VITE_GOOGLE_CLIENT_ID=
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_ENVIRONMENT=development
```

---

## Kubernetes Deployment

```bash
# Create namespaces
kubectl apply -f k8s/namespaces.yaml

# Secrets and ConfigMap
kubectl apply -f k8s/config/

# Data layer (StatefulSets + PVCs)
kubectl apply -f k8s/data/

# Application services
kubectl apply -f k8s/app/

# Workers
kubectl apply -f k8s/workers/

# Ingress
kubectl apply -f k8s/ingress/
```

### Namespace overview

| Namespace | Resources |
|-----------|-----------|
| `ingress` | Nginx Ingress Controller |
| `app` | `main-api` Deployment ×2, `stream-svc` Deployment ×2 + ClusterIP Services |
| `workers` | `torrent-worker` Deployment ×1–3, `drive-worker` Deployment ×1 |
| `data` | `redis` StatefulSet (5Gi PVC), `mongodb` StatefulSet (20Gi PVC) |

### Scaling workers

```bash
# Scale up torrent workers during peak
kubectl scale deployment torrent-worker -n workers --replicas=3

# Scale down
kubectl scale deployment torrent-worker -n workers --replicas=1
```

Redis consumer groups automatically distribute `download_queue` entries across all replicas — no configuration required.

---

## Security Design

| Layer | Mechanism |
|-------|-----------|
| Client → Ingress | HTTPS TLS 1.3 |
| JWT validation | Auth0 RS256, verified on every Main API request via cached JWKS |
| Drive token storage | AES-256-GCM encrypted at rest in MongoDB |
| Drive token cache | Redis with TTL tied to `access_token` expiry |
| Inter-service calls | ClusterIP only — no service exposed outside the cluster except via Ingress |
| Object Storage | Service account credentials in K8s `Secret`; `envFrom secretRef` in all Pods |
| Magnet link input | Regex validation + 1024-char length cap before queue insertion |

---
