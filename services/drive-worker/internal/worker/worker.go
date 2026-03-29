package worker

import (
	"context"
	"drive-worker/internal/config"
	"drive-worker/internal/crypto"
	"drive-worker/internal/models"
	"drive-worker/internal/mongo"
	"drive-worker/internal/storage"
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"path/filepath"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

type Worker struct {
	cfg         *config.Config
	mongoClient *mongo.Client
	redisClient *redis.Client
}

func RunWorker(ctx context.Context, cfg *config.Config) error {
	// Connect to MongoDB
	mongoClient, err := mongo.Connect(ctx, cfg.MongoURI)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	defer mongoClient.Close(ctx)
	log.Printf("Connected to MongoDB")

	// Connect to Redis
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return fmt.Errorf("failed to parse Redis URL: %w", err)
	}
	redisClient := redis.NewClient(opts)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to ping Redis: %w", err)
	}
	log.Printf("Connected to Redis")

	w := &Worker{
		cfg:         cfg,
		mongoClient: mongoClient,
		redisClient: redisClient,
	}

	// Create consumer group if needed
	_, _ = redisClient.XGroupCreateMkStream(ctx, "upload_queue", "drive-workers", "$").Result()

	// Start consuming
	return w.consumerLoop(ctx)
}

func (w *Worker) consumerLoop(ctx context.Context) error {
	log.Printf("Starting consumer loop for upload_queue")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Read messages from Redis Streams
		streams, err := w.redisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    "drive-workers",
			Consumer: w.cfg.WorkerName,
			Streams:  []string{"upload_queue", ">"},
			Count:    1,
			Block:    time.Second * 5,
		}).Result()

		if err != nil && err != redis.Nil {
			log.Printf("Error reading from stream: %v", err)
			continue
		}

		if len(streams) == 0 {
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				var uploadMsg models.UploadMessage
				if err := json.Unmarshal([]byte(msg.Values["data"].(string)), &uploadMsg); err != nil {
					log.Printf("Failed to unmarshal message: %v", err)
					w.redisClient.XAck(ctx, "upload_queue", "drive-workers", msg.ID)
					continue
				}

				// Process the upload
				if err := w.uploadTask(ctx, uploadMsg); err != nil {
					log.Printf("Failed to process upload for task %s: %v", uploadMsg.TaskID, err)
					// Retry will happen on next attempt
				} else {
					// Acknowledge successful processing
					w.redisClient.XAck(ctx, "upload_queue", "drive-workers", msg.ID)
					log.Printf("Successfully processed task %s", uploadMsg.TaskID)
				}
			}
		}
	}
}

func (w *Worker) uploadTask(ctx context.Context, msg models.UploadMessage) error {
	// Resolve token
	token, err := w.resolveToken(ctx, msg.UserID)
	if err != nil {
		return fmt.Errorf("failed to resolve token: %w", err)
	}

	// Build Drive service
	driveService, err := drive.NewService(ctx, option.WithTokenSource(token.Source()))
	if err != nil {
		return fmt.Errorf("failed to create drive service: %w", err)
	}

	// List blobs from storage
	blobs, err := storage.ListBlobs(ctx, w.cfg.ObjectStorageURL, w.cfg.ObjectStorageBucket, msg.StoragePath)
	if err != nil {
		return fmt.Errorf("failed to list blobs: %w", err)
	}

	if len(blobs) == 0 {
		log.Printf("No blobs found for task %s", msg.TaskID)
		return nil
	}

	// Find or create "Torrent Hunt" folder
	folderID, err := w.findOrCreateFolder(ctx, driveService, "Torrent Hunt")
	if err != nil {
		return fmt.Errorf("failed to find/create folder: %w", err)
	}

	// Upload each blob with retry logic
	fileMap := make(map[string]string)
	for _, blobKey := range blobs {
		var driveFileID string
		for attempt := 0; attempt < 3; attempt++ {
			driveFileID, err = w.uploadFile(ctx, driveService, msg.StoragePath, blobKey, folderID)
			if err == nil {
				break
			}
			log.Printf("Upload attempt %d failed for %s: %v", attempt+1, blobKey, err)
			if attempt < 2 {
				backoffDuration := time.Duration(1<<uint(attempt)) * time.Second
				time.Sleep(backoffDuration)
			}
		}

		if err != nil {
			return fmt.Errorf("failed to upload file %s after 3 attempts: %w", blobKey, err)
		}

		fileMap[blobKey] = driveFileID
	}

	// Delete blobs from storage (ignore individual errors)
	for _, blobKey := range blobs {
		if err := storage.DeleteBlob(ctx, w.cfg.ObjectStorageURL, w.cfg.ObjectStorageBucket, blobKey); err != nil {
			log.Printf("Warning: failed to delete blob %s: %v", blobKey, err)
		}
	}

	// Update MongoDB task
	if err := w.mongoClient.UpdateTask(ctx, msg.TaskID, "complete", folderID); err != nil {
		log.Printf("Failed to update task: %v", err)
	}

	// Insert download record
	if err := w.mongoClient.InsertDownload(ctx, msg.TaskID, msg.UserID, folderID); err != nil {
		log.Printf("Failed to insert download: %v", err)
	}

	// Publish progress to Redis
	progressMsg := map[string]interface{}{
		"status":      "complete",
		"driveFileId": folderID,
	}
	progressJSON, _ := json.Marshal(progressMsg)
	w.redisClient.Publish(ctx, fmt.Sprintf("task:%s:progress", msg.TaskID), string(progressJSON))

	return nil
}

func (w *Worker) uploadFile(ctx context.Context, driveService *drive.Service, storagePath, blobKey, folderID string) (string, error) {
	// Get file content
	body, size, err := storage.StreamBlob(ctx, w.cfg.ObjectStorageURL, w.cfg.ObjectStorageBucket, blobKey)
	if err != nil {
		return "", err
	}
	defer body.Close()

	// Get filename from blob key
	filename := filepath.Base(blobKey)

	// Detect MIME type
	mimeType := mime.TypeByExtension(filepath.Ext(filename))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Create Drive file metadata
	fileMetadata := &drive.File{
		Name:    filename,
		Parents: []string{folderID},
	}

	// Upload file
	file, err := driveService.Files.Create(fileMetadata).
		Media(body, option.WithContentType(mimeType)).
		Fields("id").
		Do()

	if err != nil {
		return "", fmt.Errorf("failed to upload file to Drive: %w", err)
	}

	log.Printf("Uploaded file %s to Drive with ID %s", filename, file.Id)
	return file.Id, nil
}

func (w *Worker) findOrCreateFolder(ctx context.Context, driveService *drive.Service, folderName string) (string, error) {
	// Search for existing folder
	query := fmt.Sprintf("name='%s' and mimeType='application/vnd.google-apps.folder' and trashed=false", folderName)
	files, err := driveService.Files.List().
		Q(query).
		Fields("files(id, name)").
		PageSize(1).
		Do()

	if err != nil {
		return "", fmt.Errorf("failed to search for folder: %w", err)
	}

	if len(files.Files) > 0 {
		return files.Files[0].Id, nil
	}

	// Create folder if not found
	folderMetadata := &drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
	}

	folder, err := driveService.Files.Create(folderMetadata).
		Fields("id").
		Do()

	if err != nil {
		return "", fmt.Errorf("failed to create folder: %w", err)
	}

	log.Printf("Created Drive folder '%s' with ID %s", folderName, folder.Id)
	return folder.Id, nil
}

func (w *Worker) resolveToken(ctx context.Context, userID string) (*oauth2.Token, error) {
	// Check Redis cache
	redisKey := fmt.Sprintf("drive:token:%s", userID)
	cached, err := w.redisClient.Get(ctx, redisKey).Result()
	if err == nil {
		var token oauth2.Token
		if err := json.Unmarshal([]byte(cached), &token); err == nil {
			if token.Expiry.After(time.Now().Add(60 * time.Second)) {
				return &token, nil
			}
		}
	}

	// Get user from MongoDB
	user, err := w.mongoClient.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user from MongoDB: %w", err)
	}

	// Decrypt tokens
	accessToken, err := crypto.Decrypt(user.DriveTokens.EncryptedAccessToken, w.cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}

	refreshToken, err := crypto.Decrypt(user.DriveTokens.EncryptedRefreshToken, w.cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt refresh token: %w", err)
	}

	// Build token
	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		Expiry:       time.UnixMilli(user.DriveTokens.ExpiryDate),
	}

	// If token is expired or expiring soon, refresh it
	if token.Expiry.Before(time.Now().Add(60 * time.Second)) {
		refreshedToken, err := w.refreshToken(ctx, token)
		if err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}
		token = refreshedToken

		// TODO: Update MongoDB with new encrypted tokens
	}

	// Cache in Redis
	tokenJSON, _ := json.Marshal(token)
	ttl := time.Until(token.Expiry)
	if ttl > 0 {
		w.redisClient.Set(ctx, redisKey, string(tokenJSON), ttl)
	}

	return token, nil
}

func (w *Worker) refreshToken(ctx context.Context, token *oauth2.Token) (*oauth2.Token, error) {
	config := &oauth2.Config{
		ClientID:     w.cfg.GoogleClientID,
		ClientSecret: w.cfg.GoogleClientSecret,
		RedirectURL:  w.cfg.GoogleRedirectURI,
		Scopes:       []string{drive.DriveScope},
		Endpoint:     google.Endpoint,
	}

	tokenSource := config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	return newToken, nil
}
