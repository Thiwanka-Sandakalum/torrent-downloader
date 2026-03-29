package config

import (
	"os"
)

type Config struct {
	RedisURL            string
	MongoURI            string
	ObjectStorageURL    string
	ObjectStorageBucket string
	EncryptionKey       string
	GoogleClientID      string
	GoogleClientSecret  string
	GoogleRedirectURI   string
	WorkerName          string
}

func Load() *Config {
	workerName, _ := os.Hostname()
	return &Config{
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379"),
		MongoURI:            getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		ObjectStorageURL:    getEnv("OBJECT_STORAGE_URL", "http://localhost:9000"),
		ObjectStorageBucket: getEnv("OBJECT_STORAGE_BUCKET", "downloads"),
		EncryptionKey:       getEnv("ENCRYPTION_KEY", ""),
		GoogleClientID:      getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:  getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:   getEnv("GOOGLE_REDIRECT_URI", ""),
		WorkerName:          workerName,
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
