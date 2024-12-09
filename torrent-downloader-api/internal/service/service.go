package service

import (
	"errors"
	"fmt"

	"torrent-downloader/internal/models"
	"torrent-downloader/pkg/torrent"
)

// StartTorrentDownload starts the torrent download using a magnet link
// func StartTorrentDownload(magnetLink string) (*models.TorrentTask, error) {
// 	taskID := generateTaskID()
// 	// Start the torrent using the magnet link
// 	torrentClient := torrent.NewTorrentClient()
// 	err := torrentClient.DownloadMagnet(magnetLink)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to start download: %v", err)
// 	}

// 	return &models.TorrentTask{
// 		ID:     taskID,
// 		Status: "downloading",
// 	}, nil
// }

// StartTorrentDownload starts the torrent download using a magnet link and uploads to Google Drive
func StartTorrentDownload(magnetLink string, driveToken string) (*models.TorrentTask, error) {
	taskID := generateTaskID()

	// Call the function that will handle torrent downloading and uploading to Google Drive
	err := torrent.DownloadTorrentToGoogleDrive(magnetLink, driveToken)
	if err != nil {
		return nil, fmt.Errorf("failed to start download and upload: %v", err)
	}

	return &models.TorrentTask{
		ID:     taskID,
		Status: "downloading",
	}, nil
}

// GetTorrentStatus returns the current status of the torrent task
func GetTorrentTaskStatus(taskID string) (*models.TorrentStatus, error) {
	// Check if the task exists
	// For now, just return a dummy status
	if taskID == "" {
		return nil, errors.New("task not found")
	}

	return &models.TorrentStatus{
		ID:       taskID,
		Status:   "downloading",
		Progress: 45.5, // Dummy progress
	}, nil
}

// PauseTorrent pauses the torrent download
func PauseTorrentByID(taskID string) error {
	// Pause logic here (communicate with torrent client)
	return nil
}

// ResumeTorrent resumes the torrent download
func ResumeTorrentByID(taskID string) error {
	// Resume logic here (communicate with torrent client)
	return nil
}

// Helper function to generate a unique task ID
func generateTaskID() string {
	// Generate a simple task ID (could be replaced with a more sophisticated one)
	return "task-" + fmt.Sprintf("%d", 12345)
}
