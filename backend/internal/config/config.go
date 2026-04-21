package config

import "os"

type Config struct {
	DatabaseURL    string
	Port           string
	UploadsDir     string
	FrontendOrigin string
}

func Load() *Config {
	return &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/job_search"),
		Port:           getEnv("PORT", "8080"),
		UploadsDir:     getEnv("UPLOADS_DIR", "./uploads"),
		FrontendOrigin: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
