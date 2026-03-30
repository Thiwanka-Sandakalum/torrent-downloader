# Agent Instructions — Phase 4: Drive Upload Worker

## Prerequisite
Phase 3 must be complete. `upload_queue` is being populated by torrent-worker.

## Goal
Build the `drive-worker` Go service from scratch. It consumes `upload_queue`,
resolves Google OAuth2 tokens, streams each file from Object Storage directly to
Google Drive using the resumable upload API, updates MongoDB, and cleans up
Object Storage on success.

## Working directory
`services/drive-worker/`
(currently empty — contains only `.gitkeep`)

## Architecture reference
Read `.agents/phase-3-async-pipeline.md` for the Redis Streams consumer pattern.
Read `services/main-api/src/services/auth0Management.ts` for the AES-256-GCM
encryption scheme used to store Drive tokens in MongoDB.

---

## Task 1 — Project scaffold

Create the Go module and directory structure:

```
services/drive-worker/
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── models/
│   │   └── models.go
│   ├── crypto/
│   │   └── aes.go
│   ├── mongo/
│   │   └── client.go
│   ├── storage/
│   │   └── object.go
│   └── worker/
│       └── worker.go
├── go.mod
└── Dockerfile
```

**`go.mod`:**
```
module drive-worker

go 1.23

require (
    github.com/redis/go-redis/v9 latest
    go.mongodb.org/mongo-driver/v2 latest
    google.golang.org/api latest
    golang.org/x/oauth2 latest
)
```

Run: `go mod tidy`

---

## Task 2 — `internal/config/config.go`

```go
type Config struct {
    RedisURL            string // REDIS_URL
    MongoURI            string // MONGODB_URI
    ObjectStorageURL    string // OBJECT_STORAGE_URL
    ObjectStorageBucket string // default "downloads"
    EncryptionKey       string // ENCRYPTION_KEY — 32-byte hex
    GoogleClientID      string // GOOGLE_CLIENT_ID
    GoogleClientSecret  string // GOOGLE_CLIENT_SECRET
    GoogleRedirectURI   string // GOOGLE_REDIRECT_URI
    WorkerName          string // hostname
}
```

---

## Task 3 — `internal/models/models.go`

```go
type UploadMessage struct {
    TaskID      string `json:"taskId"`
    UserID      string `json:"userId"`
    StoragePath string `json:"storagePath"` // "downloads/{taskId}/"
}

type DriveTokens struct {
    EncryptedAccessToken  string `bson:"encryptedAccessToken"`
    EncryptedRefreshToken string `bson:"encryptedRefreshToken"`
    ExpiryDate            int64  `bson:"expiryDate"` // Unix ms
}

type UserDoc struct {
    Auth0ID     string      `bson:"auth0Id"`
    DriveLinked bool        `bson:"driveLinked"`
    DriveTokens DriveTokens `bson:"driveTokens"`
}
```

---

## Task 4 — `internal/crypto/aes.go`

Implement AES-256-GCM decrypt to match the Node.js `auth0Management.ts` encryption:

```
Node.js encrypts as:  iv(12 bytes) + authTag(16 bytes) + ciphertext
All concatenated and stored as base64 string
```

```go
// Decrypt(encryptedBase64 string, keyHex string) (string, error)
// 1. hex.DecodeString(keyHex) → 32-byte key
// 2. base64.StdEncoding.DecodeString(encryptedBase64) → raw bytes
// 3. iv = raw[:12]
// 4. tag = raw[12:28]
// 5. ciphertext = raw[28:]
// 6. AES-GCM decrypt with iv + appended tag
// 7. Return plaintext string
```

---

## Task 5 — `internal/mongo/client.go`

```go
// Connect() *mongo.Client — connect to cfg.MongoURI
// GetUser(ctx, userID string) (*models.UserDoc, error)
//   → db("torrent-hunt").collection("users").FindOne({ auth0Id: userID })
// UpdateTask(ctx, taskID, status, driveFileID string) error
//   → db("torrent-hunt").collection("tasks").UpdateOne(...)
// InsertDownload(ctx, ...) error
//   → db("torrent-hunt").collection("downloads").InsertOne(...)
```

---

## Task 6 — `internal/storage/object.go`

```go
// ListBlobs(ctx, bucket, prefix string) ([]string, error)
//   HTTP GET {objectStorageURL}/{bucket}?prefix={prefix}&list-type=2
//   Parse XML ListBucketResult → return slice of Key strings

// StreamBlob(ctx, bucket, key string) (io.ReadCloser, int64, error)
//   HTTP GET {objectStorageURL}/{bucket}/{key}
//   Return body reader + Content-Length

// DeleteBlob(ctx, bucket, key string) error
//   HTTP DELETE {objectStorageURL}/{bucket}/{key}
```

(Using raw HTTP — no SDK dependency needed for MinIO/Azure compatibility)

---

## Task 7 — `internal/worker/worker.go` (core logic)

This is the main file. Implement `RunWorker(ctx, cfg)`:

### Token resolution
```go
// resolveToken(ctx, userID, cfg) (*oauth2.Token, error):
// 1. Check Redis key "drive:token:{userID}" → unmarshal if found + not expired
// 2. Miss → GetUser(ctx, userID) → decrypt access + refresh tokens
// 3. Build oauth2.Token from decrypted values
// 4. If token.Expiry.Before(now + 60s) → token.Source.Token() to refresh
// 5. Cache refreshed token in Redis with TTL = token.Expiry - now
// 6. Update MongoDB with newly encrypted tokens
// 7. Return valid token
```

### Drive upload
```go
// uploadTask(ctx, msg UploadMessage, cfg) error:
// 1. resolveToken → get valid OAuth token
// 2. Build Drive service: drive.NewService(ctx, option.WithTokenSource(...))
// 3. ListBlobs(bucket, msg.StoragePath) → slice of file keys
// 4. drive.Files.Create folder "Torrent Hunt" (findOrCreate by name)
// 5. For each blob key:
//    a. StreamBlob → reader + size
//    b. drive.Files.Create with mime detection, Parent: folder.Id
//       .Media(reader).ProgressUpdater(optional).Do()
// 6. Collect { fileName → driveFileId } map
// 7. On ALL files uploaded:
//    a. DeleteBlob for each key (ignore individual errors — log warning)
//    b. UpdateTask: status="complete", driveFileId=folderId
//    c. InsertDownload record
//    d. Publish to Redis: task:{taskId}:progress { status:"complete", driveFileId }
// 8. Return nil

// Retry: wrap step 5b in retry loop max 3×, exponential backoff 1s/2s/4s
```

### Consumer loop (same XREADGROUP pattern as Phase 3)
```
Group: "drive-workers"
Stream: "upload_queue"
```

---

## Task 8 — `cmd/main.go`

```go
func main() {
    cfg := config.Load()
    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()
    if err := worker.RunWorker(ctx, cfg); err != nil {
        log.Fatalf("drive-worker exited: %v", err)
    }
}
```

---

## Task 9 — `Dockerfile`

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

## Acceptance criteria
- `go build ./...` succeeds
- Worker starts, connects to Redis + MongoDB (log lines)
- When a message appears on `upload_queue`, worker processes it within 2 s
- Files appear in Google Drive under folder "Torrent Hunt"
- Object Storage files deleted after successful upload
- MongoDB task doc updated to `status: "complete"`
- Redis progress channel receives `{ status: "complete", driveFileId }` event
- Token refresh works when access token is expired (verify by manually expiring TTL in Redis)
