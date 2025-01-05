package torrent

import (
	"context"
	"fmt"
	"io"
	"log"
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
	// Initialize Google Drive client
	// driveService, err := initializeGoogleDriveClient(driveToken)
	// if err != nil {
	// 	return fmt.Errorf("failed to initialize Google Drive client: %w", err)
	// }

	// Torrent client setup
	clientConfig := torrent.NewDefaultClientConfig()
	clientConfig.Debug = false
	client, err := torrent.NewClient(clientConfig)
	if err != nil {
		return fmt.Errorf("failed to create torrent client: %w", err)
	}
	defer client.Close()

	// Add magnet link to the client
	t, err := client.AddMagnet(magnetLink)
	if err != nil {
		return fmt.Errorf("failed to add magnet link: %w", err)
	}
	<-t.GotInfo() // Wait for torrent metadata

	// Create folder in Google Drive
	// driveFolder, err := createDriveFolder(driveService, t.Name(), driveToken)
	// if err != nil {
	// 	return err
	// }

	// Define tempDir using the Docker volume
	tempDir := "/root/temp"
	err = os.MkdirAll(tempDir, os.ModePerm)
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}

	// Download torrent files to temporary directory
	for _, file := range t.Files() {
		// Create the file path on disk
		filePath := filepath.Join(tempDir, file.Path())

		err = os.MkdirAll(filepath.Dir(filePath), os.ModePerm)
		if err != nil {
			return fmt.Errorf("failed to create directories for file: %w", err)
		}

		// Create the file on disk
		outFile, err := os.Create(filePath)
		if err != nil {
			return fmt.Errorf("failed to create file: %w", err)
		}
		defer outFile.Close()

		// Download the file
		reader := file.NewReader()
		_, err = io.Copy(outFile, reader)
		if err != nil {
			return fmt.Errorf("failed to download file: %w", err)
		}
	}

	// Upload the downloaded files to Google Drive
	// for _, file := range t.Files() {
	// 	// Upload the file to Google Drive
	// 	err := uploadFileToGoogleDrive(driveService, file, tempDir, driveFolder.Id)
	// 	if err != nil {
	// 		return fmt.Errorf("failed to upload file to Google Drive: %w", err)
	// Temporary directory will be cleaned up by deferred call to os.RemoveAll
	err = os.RemoveAll(tempDir)
	if err != nil {
		log.Printf("Failed to remove temporary directory: %v", err)
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

	// Create a MediaUpload request
	uploadRequest := svc.Files.Create(driveFile).Media(file)

	// Upload the file in chunks with progress reporting
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}
	fileSize := fileInfo.Size()
	var uploaded int64

	// The media upload will automatically chunk the file if needed
	progressReader := &ProgressReader{Reader: file, TotalSize: fileSize, ProgressCallback: func(n int64) {
		uploaded += n
		progress := float64(uploaded) / float64(fileSize) * 100
		fmt.Printf("\rUploading file: %s (%.2f%%)", tf.Path(), progress)
	}}

	// Set up the upload request with the progress reader
	uploadRequest.Media(progressReader)

	// Start the upload
	_, err = uploadRequest.Do()
	if err != nil {
		return fmt.Errorf("failed to upload file to Google Drive: %w", err)
	}

	// Successful upload
	fmt.Println("\nUpload complete.")
	return nil
}

// ProgressReader provides progress reporting while reading the file
type ProgressReader struct {
	Reader           io.Reader
	TotalSize        int64
	ProgressCallback func(int64)
}

func (pr *ProgressReader) Read(p []byte) (n int, err error) {
	n, err = pr.Reader.Read(p)
	if err == nil || err == io.EOF {
		pr.ProgressCallback(int64(n))
	}
	return n, err
}
