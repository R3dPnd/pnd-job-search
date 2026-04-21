package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prestonharms/pnd-job-search/internal/config"
	"github.com/prestonharms/pnd-job-search/internal/services"
)

type App struct {
	DB     *pgxpool.Pool
	AI     *services.AIService
	Docx   *services.DocxService
	Config *config.Config
}

func NewApp(db *pgxpool.Pool, ai *services.AIService, cfg *config.Config) *App {
	return &App{
		DB:     db,
		AI:     ai,
		Docx:   services.NewDocxService(),
		Config: cfg,
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	if status >= 500 {
		log.Printf("ERROR %d: %s", status, msg)
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
