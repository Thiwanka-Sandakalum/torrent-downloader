package torrent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/anacrolix/torrent"
	"golang.org/x/oauth2"
	drive "google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// TorrentClient wraps around the external torrent library
type TorrentClient struct {
	client *torrent.Client
}

// NewTorrentClient creates and initializes a new TorrentClient
func NewTorrentClient() *TorrentClient {
	client, err := torrent.NewClient(nil)
	if err != nil {
		fmt.Printf("Error initializing torrent client: %v", err)
	}

	return &TorrentClient{client: client}
}

// DownloadMagnet downloads a torrent using a magnet link
func (tc *TorrentClient) DownloadMagnet(magnetLink string) error {
	_, err := tc.client.AddMagnet(magnetLink)
	if err != nil {
		return fmt.Errorf("failed to download magnet: %v", err)
	}
	return nil
}

// DownloadTorrentToGoogleDrive downloads a torrent and uploads to Google Drive
func DownloadTorrentToGoogleDrive(magnetLink string, driveToken string) error {
	// Initialize Google Drive client using the provided token
	driveService, err := initializeGoogleDriveClient(driveToken)
	if err != nil {
		return fmt.Errorf("failed to initialize Google Drive client: %w", err)
	}

	// Your torrent client setup code
	clientConfig := torrent.NewDefaultClientConfig()
	clientConfig.Debug = false
	client, err := torrent.NewClient(clientConfig)
	if err != nil {
		return fmt.Errorf("failed to create torrent client: %w", err)
	}
	defer client.Close()

	t, err := client.AddMagnet(magnetLink)
	if err != nil {
		return fmt.Errorf("failed to add magnet link: %w", err)
	}
	<-t.GotInfo() // Wait for metadata

	// Create folder in Google Drive
	driveFolder, err := createDriveFolder(driveService, t.Name(), driveToken)
	if err != nil {
		return err
	}

	// Create temporary directory for torrent downloads
	tempDir := "temp-torrent-download"
	err = os.MkdirAll(tempDir, os.ModePerm)
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Upload files to Google Drive
	for _, file := range t.Files() {
		err = uploadFileToGoogleDrive(driveService, file, tempDir, driveFolder.Id)
		if err != nil {
			return fmt.Errorf("failed to upload file to Google Drive: %w", err)
		}
	}

	return nil
}

// initializeGoogleDriveClient initializes a Google Drive client using the provided access token.
func initializeGoogleDriveClient(driveToken string) (*drive.Service, error) {
	// Create an OAuth2 token using the provided access token string
	token := &oauth2.Token{
		AccessToken: driveToken,
	}

	// Create an OAuth2 token source using the provided token
	tokenSource := oauth2.StaticTokenSource(token)

	// Initialize the Google Drive service with the token source
	ctx := context.Background()
	driveService, err := drive.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("failed to create Google Drive service: %w", err)
	}

	return driveService, nil
}

// createDriveFolder creates a new folder in Google Drive
func createDriveFolder(driveService *drive.Service, folderName, parentFolderID string) (*drive.File, error) {
	driveFolder := &drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{parentFolderID},
	}

	createdFolder, err := driveService.Files.Create(driveFolder).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to create folder in Google Drive: %w", err)
	}

	return createdFolder, nil
}

// uploadFileToGoogleDrive uploads a torrent file to Google Drive
func uploadFileToGoogleDrive(svc *drive.Service, tf *torrent.File, tempDir, folderID string) error {
	localFilePath := filepath.Join(tempDir, tf.Path())
	// Ensure the directory exists
	if err := os.MkdirAll(filepath.Dir(localFilePath), os.ModePerm); err != nil {
		return fmt.Errorf("failed to create directories for file: %w", err)
	}

	file, err := os.Open(localFilePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Create Google Drive file metadata.
	driveFile := &drive.File{
		Name:    filepath.Base(localFilePath),
		Parents: []string{folderID},
	}

	// Upload the file.
	// Show progress
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}
	fileSize := fileInfo.Size()
	buffer := make([]byte, 1024*1024) // 1MB buffer
	var uploaded int64

	for {
		n, err := file.Read(buffer)
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return fmt.Errorf("failed to read file: %w", err)
		}

		_, err = svc.Files.Create(driveFile).Media(file).Do()
		if err != nil {
			return fmt.Errorf("failed to upload file to Google Drive: %w", err)
		}

		uploaded += int64(n)
		progress := float64(uploaded) / float64(fileSize) * 100
		fmt.Printf("\rUploading file: %s (%.2f%%)", tf.Path(), progress)
	}

	fmt.Println("\nUpload complete.")
	if err != nil {
		return fmt.Errorf("failed to upload file to Google Drive: %w", err)
	}
	fmt.Printf("Uploaded file: %s\n", tf.Path())

	// Delete the local file after uploading.
	err = os.Remove(localFilePath)
	if err != nil {
		return fmt.Errorf("failed to delete local file: %w", err)
	}

	return nil
}
