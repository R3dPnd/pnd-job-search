package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/prestonharms/pnd-job-search/internal/api"
	"github.com/prestonharms/pnd-job-search/internal/config"
	"github.com/prestonharms/pnd-job-search/internal/db"
	"github.com/prestonharms/pnd-job-search/internal/services"
)

func main() {
	// Load from project root
	_ = godotenv.Load("../.env")

	cfg := config.Load()

	pool, err := db.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	aiSvc := services.NewAIService()

	router := api.NewRouter(pool, aiSvc, cfg)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("pnd-job-search listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, router))
}
