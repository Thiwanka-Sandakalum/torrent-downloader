package config

import (
	"log"

	"github.com/joho/godotenv"
)

// InitConfig loads environment variables using godotenv
func InitConfig() {
	// Load .env file from the root directory
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}
}
