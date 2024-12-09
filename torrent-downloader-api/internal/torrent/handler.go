package torrent

import (
	"net/http"

	"fmt"
	"torrent-downloader/internal/models"
	"torrent-downloader/internal/service"

	"github.com/gin-gonic/gin"
)

// StartTorrent handles the start torrent request (using a magnet link)
// func StartTorrent(c *gin.Context) {
// 	var request models.StartTorrentRequest
// 	if err := c.ShouldBindJSON(&request); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
// 		return
// 	}
// 	// Get the Drive-Authorization header
// 	driveToken := c.GetHeader("Drive-Authorization")
// 	fmt.Println("driveToken", driveToken)

// 	// Get the MagnetLink from the request
// 	fmt.Println("request.MagnetLink", request.MagnetLink)

// 	task, err := service.StartTorrentDownload(request.MagnetLink)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
// 		return
// 	}

// 	c.JSON(http.StatusOK, task)
// }

// StartTorrent handles the start torrent request (using a magnet link)
func StartTorrent(c *gin.Context) {
	var request models.StartTorrentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the Drive-Authorization header
	driveToken := c.GetHeader("Drive-Authorization")
	if driveToken == "" || driveToken == "undefined" || driveToken == "null" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Drive authorization token is required"})
		return
	}

	// Get the MagnetLink from the request
	fmt.Println("Magnet link:", request.MagnetLink)

	task, err := service.StartTorrentDownload(request.MagnetLink, driveToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

// GetTorrentStatus handles the status check for a torrent download
func GetTorrentStatus(c *gin.Context) {
	taskID := c.Param("taskID")

	status, err := service.GetTorrentTaskStatus(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// PauseTorrent pauses a specific torrent download
func PauseTorrent(c *gin.Context) {
	taskID := c.Param("taskID")

	if err := service.PauseTorrentByID(taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Torrent paused successfully"})
}

// ResumeTorrent resumes a specific torrent download
func ResumeTorrent(c *gin.Context) {
	taskID := c.Param("taskID")

	if err := service.ResumeTorrentByID(taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Torrent resumed successfully"})
}
