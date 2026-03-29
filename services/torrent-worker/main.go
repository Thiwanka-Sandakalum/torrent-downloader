package main

import (
	"fmt"
	"torrent-downloader/internal/api"
	"torrent-downloader/internal/config"

	"github.com/gin-gonic/gin"
)

func main() {
	fmt.Println("Starting main.go")
	config.InitConfig()
	fmt.Println("Config loaded")

	gin.SetMode(gin.DebugMode)
	fmt.Println("Gin debug mode set")

	r := gin.Default()
	fmt.Println("Gin router initialized")

	api.SetupRouter(r)
	fmt.Println("API routes set up")

	fmt.Println("Starting server on :8080")
	r.Run(":8080")
}
