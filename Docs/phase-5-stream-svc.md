# Agent Instructions — Phase 5: Stream Service

## Prerequisite
Phase 3 must be complete. Object Storage is populated by torrent-worker at path
`downloads/{taskId}/`.

## Goal
Build the `stream-svc` Go service from scratch. It serves video files directly
from Object Storage with full byte-range (`Range`/`206 Partial Content`) support,
enabling browser `<video>` element seeking.

## Working directory
`services/stream-svc/`
(currently empty — contains only `.gitkeep`)

---

## Architecture

```
browser <video> element
  → GET /api/stream/:taskId   Range: bytes=0-
  → stream-svc
  → Object Storage  GET /{bucket}/downloads/{taskId}/{primaryFile}
                    Range: bytes=0-{rangeEnd}
  → 206 Partial Content → browser
```

The stream-svc is stateless and scales horizontally. It does NOT touch MongoDB
or Redis — it only reads Object Storage.

---

## Task 1 — Project scaffold

```
services/stream-svc/
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── storage/
│   │   └── object.go
│   └── handler/
│       └── stream.go
├── go.mod
└── Dockerfile
```

**`go.mod`:**
```
module stream-svc

go 1.23

require (
    github.com/gin-gonic/gin v1.10.0
)
```

Run `go mod tidy`.

---

## Task 2 — `internal/config/config.go`

```go
type Config struct {
    Port                string // PORT default "8082"
    ObjectStorageURL    string // OBJECT_STORAGE_URL e.g. http://minio:9000
    ObjectStorageBucket string // OBJECT_STORAGE_BUCKET default "downloads"
}
```

---

## Task 3 — `internal/storage/object.go`

```go
var videoExtensions = []string{".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"}

// ListBlobs(ctx, baseURL, bucket, prefix) ([]BlobItem, error)
//   HTTP GET {baseURL}/{bucket}?prefix={prefix}&list-type=2
//   Parse XML ListBucketResult — return []BlobItem{Key, Size}

type BlobItem struct {
    Key  string
    Size int64
}

// DetectPrimary(blobs []BlobItem) (BlobItem, bool)
//   Filter by video extension, return the one with the largest Size.
//   Returns false if no video blobs found.

// RangedGet(ctx, baseURL, bucket, key, rangeHeader string) (*http.Response, error)
//   HTTP GET {baseURL}/{bucket}/{key}
//   Set "Range" header if rangeHeader != ""
//   Return raw *http.Response — caller streams body to client
```

---

## Task 4 — `internal/handler/stream.go`

This is the core handler. Implement `StreamHandler(cfg *config.Config) gin.HandlerFunc`.

### Primary file detection cache
```go
var (
    primaryCache   = map[string]storage.BlobItem{}
    primaryCacheMu sync.RWMutex
)
```

### Handler logic
```go
func StreamHandler(cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        taskID := c.Param("taskId")
        prefix := taskID + "/"      // "downloads/{taskId}/" prefix

        // 1. Look up primary file from cache
        primaryCacheMu.RLock()
        blob, found := primaryCache[taskID]
        primaryCacheMu.RUnlock()

        if !found {
            // 2. List blobs at prefix
            blobs, err := storage.ListBlobs(c.Request.Context(),
                cfg.ObjectStorageURL, cfg.ObjectStorageBucket, prefix)
            if err != nil || len(blobs) == 0 {
                c.JSON(404, gin.H{"error": "task not found or no files"})
                return
            }

            // 3. Detect primary video file
            primary, ok := storage.DetectPrimary(blobs)
            if !ok {
                c.JSON(404, gin.H{"error": "no video file found"})
                return
            }

            // 4. Cache it
            primaryCacheMu.Lock()
            primaryCache[taskID] = primary
            primaryCacheMu.Unlock()
            blob = primary
        }

        // 5. Parse Range header
        rangeHeader := c.GetHeader("Range")

        // 6. Ranged GET from Object Storage
        resp, err := storage.RangedGet(c.Request.Context(),
            cfg.ObjectStorageURL, cfg.ObjectStorageBucket, blob.Key, rangeHeader)
        if err != nil {
            c.JSON(502, gin.H{"error": "upstream error"})
            return
        }
        defer resp.Body.Close()

        // 7. Forward status + headers
        statusCode := resp.StatusCode
        if rangeHeader == "" {
            statusCode = 200
        }

        // Copy relevant headers
        for _, h := range []string{
            "Content-Type", "Content-Length",
            "Content-Range", "Accept-Ranges", "Last-Modified", "ETag",
        } {
            if v := resp.Header.Get(h); v != "" {
                c.Header(h, v)
            }
        }

        // Ensure Accept-Ranges is set for browser seeking
        c.Header("Accept-Ranges", "bytes")

        // 8. Stream body to client
        c.Status(statusCode)
        io.Copy(c.Writer, resp.Body)
    }
}
```

---

## Task 5 — `cmd/main.go`

```go
func main() {
    cfg := config.Load()

    r := gin.New()
    r.Use(gin.Recovery())
    r.Use(gin.Logger())

    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    r.GET("/api/stream/:taskId", handler.StreamHandler(cfg))

    log.Printf("stream-svc listening on :%s", cfg.Port)
    if err := r.Run(":" + cfg.Port); err != nil {
        log.Fatalf("server error: %v", err)
    }
}
```

---

## Task 6 — CORS & auth note

The stream-svc sits behind the K8s ingress which handles auth at the ingress
level (forward-auth). The service itself does NOT validate JWT tokens — it trusts
the ingress to block unauthenticated requests.

If running locally with docker-compose (not behind ingress), add a simple CORS
middleware allowing the Vite dev server origin (`http://localhost:5173`).

---

## Task 7 — `Dockerfile`

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
ENTRYPOINT ["stream-svc"]
```

---

## Acceptance criteria
- `go build ./...` succeeds
- `GET /health` returns 200
- `GET /api/stream/{taskId}` without Range → 200, full file body
- `GET /api/stream/{taskId}` with `Range: bytes=0-1023` → 206, 1024 bytes, correct `Content-Range`
- Seeking mid-video in a browser `<video>` element does not restart from beginning
- `GET /api/stream/{unknownTaskId}` → 404
- Multiple concurrent range requests work without data corruption (no shared buffers)
