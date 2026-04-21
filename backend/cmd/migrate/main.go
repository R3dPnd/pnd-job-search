package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	// Load .env from project root (two levels up from backend/cmd/migrate)
	godotenv.Load("../../.env")
	godotenv.Load("../.env")
	godotenv.Load(".env")

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/job_search"
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := db.PingContext(context.Background()); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("set dialect: %v", err)
	}

	args := os.Args[1:]
	cmd := "up"
	if len(args) > 0 {
		cmd = args[0]
	}

	if err := goose.RunContext(context.Background(), cmd, db, "internal/db/migrations"); err != nil {
		log.Fatalf("goose %s: %v", cmd, err)
	}
}
