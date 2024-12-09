package api

import (
	"torrent-downloader/internal/torrent"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// SetupRouter initializes the routes and connects them to handlers
func SetupRouter(router *gin.Engine) {
	// root route
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Welcome to the Torrent Downloader API! Use the /swagger endpoint to view the API documentation.",
		})
	})
	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "OK",
		})
		c.Status(200)
	})

	// Torrent download routes
	torrentGroup := router.Group("/torrent")
	{
		torrentGroup.POST("/", torrent.StartTorrent)
		torrentGroup.GET("/status/:taskID", torrent.GetTorrentStatus)
		torrentGroup.POST("/pause/:taskID", func(c *gin.Context) {
			torrent.PauseTorrent(c)
			c.Status(200)
		})
		torrentGroup.POST("/resume/:taskID", func(c *gin.Context) {
			torrent.ResumeTorrent(c)
			c.Status(200)
		})
	}
}
