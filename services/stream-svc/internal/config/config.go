package config

import (
	"os"
)

type Config struct {
	Port                string
	ObjectStorageURL    string
	ObjectStorageBucket string
}

func Load() *Config {
	cfg := &Config{
		Port:                getEnv("PORT", "8082"),
		ObjectStorageURL:    getEnv("OBJECT_STORAGE_URL", "http://minio:9000"),
		ObjectStorageBucket: getEnv("OBJECT_STORAGE_BUCKET", "downloads"),
	}
	return cfg
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
