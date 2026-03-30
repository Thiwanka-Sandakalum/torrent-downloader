# Agent Instructions — Phase 3: Async Download Pipeline

## Prerequisite
Phase 1 and 2 must be complete. `POST /api/tasks` returns `201 { taskId }`.

## Goal
Rewrite the torrent-worker Go service to consume from Redis Streams, execute real
BitTorrent downloads using anacrolix/torrent, publish per-task progress to Redis
Pub/Sub, upload completed files to Object Storage, then enqueue upload tasks.
Delete all the old HTTP-trigger-based code.

## Working directory
`services/torrent-worker/`

## Read these files first
- `go.mod` (module name: `torrent-downloader`, Go 1.23)
- `pkg/torrent/downloader.go` (existing — partially working, synchronous, needs full rewrite)
- `internal/service/service.go` (broken — hardcoded task ID, blocking, needs full rewrite)
- `internal/api/router.go`
- `internal/models/torrent.go`
- `internal/config/config.go`

---

## Task 1 — `internal/config/config.go` (extend)

Add these fields to the existing config struct (or replace if empty):

```go
type Config struct {
    Port                   string // keep for health endpoint
    RedisURL               string // REDIS_URL
    ObjectStorageURL       string // OBJECT_STORAGE_URL
    ObjectStorageBucket    string // OBJECT_STORAGE_BUCKET default "downloads"
    MaxConcurrentDownloads int    // MAX_CONCURRENT_DOWNLOADS default 5
    MongoURI               string // MONGODB_URI (for task status updates)
}
```

Load from environment with `os.Getenv`. Use `strconv.Atoi` for int fields.

---

## Task 2 — `internal/models/torrent.go` (extend)

```go
type TaskMessage struct {
    TaskID     string `json:"taskId"`
    UserID     string `json:"userId"`
    MagnetLink string `json:"magnetLink"`
}

type ProgressEvent struct {
    TaskID   string  `json:"taskId"`
    Status   string  `json:"status"`   // "downloading" | "uploading" | "complete" | "failed"
    Progress float64 `json:"progress"` // 0–100
    Speed    string  `json:"speed"`    // "5.2 MB/s"
    ETA      int64   `json:"eta"`      // seconds remaining
}
```

---

## Task 3 — `pkg/torrent/downloader.go` (full rewrite)

Replace the entire file. The new file must export one function:

```go
func DownloadTorrent(ctx context.Context, task models.TaskMessage, cfg *config.Config,
    onProgress func(models.ProgressEvent)) error
```

**Implementation steps:**

1. Create an isolated `torrent.ClientConfig` with `DataDir = /tmp/{task.TaskID}`
2. `client, _ := torrent.NewClient(cfg)` — defer `client.Close()`
3. `t, err := client.AddMagnet(task.MagnetLink)`
4. Wait for metadata: `select { case <-t.GotInfo(): case <-time.After(30s): return errTimeout }`  
   On timeout: call `onProgress` with `status:"failed"` before returning.
5. Call `t.DownloadAll()`
6. Progress ticker goroutine (runs concurrently in a goroutine, stops when channel closes):
   - Every 2 s: read `t.Stats()`
   - Calculate `progress = float64(stats.PiecesComplete) / float64(info.NumPieces()) * 100`
   - Calculate speed from `stats.BytesReadData` delta
   - Call `onProgress(ProgressEvent{ Status:"downloading", Progress: p, Speed: s, ETA: eta })`
7. Wait for `t.Complete.On()` (blocking — all pieces downloaded)
8. Close the progress ticker goroutine
9. Walk `/tmp/{task.TaskID}/` — upload each file to Object Storage:
   - `PUT {bucket}/downloads/{taskId}/{relativePath}`
   - Use HTTP multipart for files > 100 MB (or just streaming PUT if MinIO SDK available)
   - For simplicity, use `net/http` PUT with `io.Copy` from the file reader
10. On all uploads complete: call `onProgress(ProgressEvent{ Status:"uploading", Progress:100 })`
11. Clean up: `os.RemoveAll("/tmp/" + task.TaskID)`
12. Return nil

**Error handling:** any step failure calls `onProgress` with `status:"failed"` before returning the error.

---

## Task 4 — `internal/service/service.go` (full rewrite)

Replace the entire file with a Redis Streams consumer loop.

```go
// RunWorker(ctx context.Context, cfg *config.Config) — the main blocking loop:

// 1. Connect to Redis via go-redis v9
//    github.com/redis/go-redis/v9

// 2. Ensure consumer group exists:
//    XGROUP CREATE download_queue torrent-workers $ MKSTREAM

// 3. Acquire semaphore channel: sem := make(chan struct{}, cfg.MaxConcurrentDownloads)

// 4. Loop forever:
//    a. XREADGROUP GROUP torrent-workers worker-{hostname} COUNT 1 BLOCK 5000 STREAMS download_queue >
//    b. If no messages: continue
//    c. Parse TaskMessage from stream entry fields
//    d. Validate magnetLink — XACK + log + skip if invalid
//    e. sem <- struct{}{}
//    f. go func(task) {
//         defer func() { <-sem }()
//         processTask(ctx, task, cfg, redisClient)
//       }(task)
```

```go
// processTask(ctx, task, cfg, redis):
// 1. Publish initial event: status="downloading" progress=0
// 2. Subscribe to task:{taskId}:control channel (for cancel signal)
// 3. Call downloader.DownloadTorrent(ctx, task, cfg, func(event) {
//      publishProgress(redis, event)
//      updateMongoDB(task.TaskID, event)  // optional but good
//    })
// 4. On cancel signal received: cancel the ctx passed to DownloadTorrent
// 5. On downloader error: publishProgress with status="failed"; XACK; return
// 6. On success: XADD upload_queue * taskId X userId X storagePath X
// 7. publishProgress with status="uploading" progress=100
// 8. XACK download_queue entry
```

```go
// publishProgress(redis, event ProgressEvent):
//   payload, _ := json.Marshal(event)
//   redis.Publish(ctx, "task:"+event.TaskID+":progress", payload)
//   redis.Set(ctx, "task:"+event.TaskID+":snapshot", payload, 10*time.Minute)
```

**Add to go.mod:**
```
github.com/redis/go-redis/v9
```
Run: `go get github.com/redis/go-redis/v9`

---

## Task 5 — `main.go` (rewrite)

```go
func main() {
    cfg := config.Load()
    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()

    // Start health HTTP server on cfg.Port in a goroutine
    go startHealthServer(cfg.Port)

    // Block on worker loop
    if err := service.RunWorker(ctx, cfg); err != nil {
        log.Fatalf("worker exited: %v", err)
    }
    log.Println("shutdown complete")
}
```

---

## Task 6 — Remove HTTP-trigger handlers

- Delete or empty `internal/torrent/handler.go` — HTTP-triggered download is replaced by queue consumer
- Delete or empty `internal/torrent/repository.go`
- Update `internal/api/router.go` to only expose `GET /health`

---

## Acceptance criteria
- `go build ./...` compiles with no errors
- Worker connects to Redis on startup (log line)
- Posting a task via `POST /api/tasks` (from Phase 2) → worker picks it up within 1 s
- Progress events appear on Redis channel `task:{taskId}:progress`
- Files appear in MinIO under `downloads/{taskId}/` after download completes
- `XADD upload_queue` message visible after download completes
- If Redis is unavailable on start, log fatal and exit (do not silently retry forever)
