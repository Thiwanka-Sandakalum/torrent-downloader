# Agent Instruction Scripts — Index

7 phase-based scripts for autonomous implementation of the torrent-hunt app.
Feed each script to a coding agent **in order**. Each phase has explicit
acceptance criteria — verify them before proceeding to the next phase.

---

## Execution order

| Phase | Script | Scope | Blocker if skipped |
|-------|--------|-------|-------------------|
| 1 | [phase-1-server-bootstrap.md](phase-1-server-bootstrap.md) | `main-api` config layer + working `index.ts` | App crashes on start |
| 2 | [phase-2-api-core.md](phase-2-api-core.md) | All models, controllers, routes, validation | No REST API |
| 3 | [phase-3-async-pipeline.md](phase-3-async-pipeline.md) | Go torrent-worker rewrite + Redis queue | No downloads |
| 4 | [phase-4-drive-worker.md](phase-4-drive-worker.md) | Go drive-worker from scratch | Files stuck in object storage |
| 5 | [phase-5-stream-svc.md](phase-5-stream-svc.md) | Go stream-svc from scratch | No in-browser playback |
| 6 | [phase-6-client-ui.md](phase-6-client-ui.md) | React UI — Zustand, all pages, SSE wiring | No usable UI |
| 7 | [phase-7-devops.md](phase-7-devops.md) | Dockerfiles, docker-compose, K8s manifest audit | Can't run as a whole |

---

## Key file paths each script touches

### Phase 1 — Server Bootstrap
- `services/main-api/src/config/logger.ts` (create — pino)
- `services/main-api/src/config/database.ts` (create — Mongoose + retry)
- `services/main-api/src/config/server.ts` (create — Express factory)
- `services/main-api/src/index.ts` (rewrite — correct boot order)

### Phase 2 — API Core
- `services/main-api/src/models/taskModel.ts`
- `services/main-api/src/models/userModel.ts`
- `services/main-api/src/models/movieModel.ts`
- `services/main-api/src/services/movieService.ts`
- `services/main-api/src/controllers/taskController.ts`
- `services/main-api/src/controllers/movieController.ts`
- `services/main-api/src/routes/taskRoutes.ts` (rewrite)
- `services/main-api/src/routes/index.ts`
- `services/main-api/src/middlewares/validationMiddleware.ts` (rewrite)

### Phase 3 — Async Download Pipeline (Go)
- `services/torrent-worker/internal/config/` (new)
- `services/torrent-worker/internal/models/` (new)
- `services/torrent-worker/internal/service/service.go` (rewrite)
- `services/torrent-worker/internal/torrent/repository.go` (implement)
- `services/torrent-worker/pkg/torrent/downloader.go` (refactor)
- `services/torrent-worker/main.go` (rewrite)

### Phase 4 — Drive Worker (Go — new service)
- `services/drive-worker/cmd/main.go`
- `services/drive-worker/internal/config/config.go`
- `services/drive-worker/internal/models/models.go`
- `services/drive-worker/internal/crypto/aes.go`
- `services/drive-worker/internal/mongo/client.go`
- `services/drive-worker/internal/storage/object.go`
- `services/drive-worker/internal/worker/worker.go`
- `services/drive-worker/go.mod`
- `services/drive-worker/Dockerfile`

### Phase 5 — Stream Service (Go — new service)
- `services/stream-svc/cmd/main.go`
- `services/stream-svc/internal/config/config.go`
- `services/stream-svc/internal/storage/object.go`
- `services/stream-svc/internal/handler/stream.go`
- `services/stream-svc/go.mod`
- `services/stream-svc/Dockerfile`

### Phase 6 — Client UI
- `client/store/index.ts` (rewrite)
- `client/services/api.ts` (add interceptor)
- `client/providers/AuthTokenProvider.tsx` (new)
- `client/hooks/use-tasks.ts` (new)
- `client/pages/home-page.tsx` (rewrite)
- `client/components/common/navbar.tsx` (new)
- `client/components/common/video-player.tsx` (new)

### Phase 7 — DevOps
- `services/main-api/Dockerfile` (new)
- `services/torrent-worker/Dockerfile` (verify/update)
- `services/drive-worker/Dockerfile` (verify from Phase 4)
- `services/stream-svc/Dockerfile` (verify from Phase 5)
- `client/Dockerfile` (new)
- `client/nginx.conf` (new)
- `docker-compose.yml` (project root — new)
- `.env.example` (project root — new)
- `scripts/init-minio.sh` (new)

---

## Architecture quick-reference for agents

```
Auth0 (RS256 JWT)
    │
    ▼
[ingress-nginx]  →  /api/*       → main-api   (Node.js :3000)
                 →  /api/stream/ → stream-svc (Go :8082)
                 →  /*           → client     (Nginx :80)

main-api  →  Redis Streams (download_queue)  →  torrent-worker (Go)
                                                   └─ Object Storage (MinIO)
                                                       └─ Redis Streams (upload_queue)
                                                           └─ drive-worker (Go)
                                                               └─ Google Drive

main-api  →  Redis Pub/Sub (task:{id}:progress)  →  SSE  →  client
```

### Environment variables shared across services
| Var | Used by |
|-----|---------|
| `REDIS_URL` | main-api, torrent-worker, drive-worker, stream-svc |
| `MONGODB_URI` | main-api, drive-worker |
| `ENCRYPTION_KEY` | main-api (encrypt), drive-worker (decrypt) |
| `OBJECT_STORAGE_URL` | torrent-worker, drive-worker, stream-svc |
| `GOOGLE_CLIENT_ID/SECRET` | main-api, drive-worker |
| `AUTH0_DOMAIN/AUDIENCE` | main-api |
