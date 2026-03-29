package handler

import (
	"io"
	"sync"

	"stream-svc/internal/config"
	"stream-svc/internal/storage"

	"github.com/gin-gonic/gin"
)

var (
	primaryCache   = map[string]storage.BlobItem{}
	primaryCacheMu sync.RWMutex
)

func StreamHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("taskId")
		prefix := taskID + "/"

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
