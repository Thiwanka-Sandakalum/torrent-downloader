package main

import (
	"torrent-downloader/internal/api"
	"torrent-downloader/internal/config"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize config
	config.InitConfig()

	// Set Gin to debug mode for development
	gin.SetMode(gin.DebugMode)

	// Set up Gin router
	r := gin.Default()

	// Set up API routes
	api.SetupRouter(r)

	// Run the server
	r.Run(":8080")
}
