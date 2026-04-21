package handlers

import (
	"net/http"
	"time"
)

func (a *App) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "healthy",
		"service":   "pnd-job-search",
		"timestamp": time.Now().UTC(),
	})
}
