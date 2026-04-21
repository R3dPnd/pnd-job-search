package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListSessions(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, label, active_application_ids, started_at, last_active_at
		FROM sessions ORDER BY last_active_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	sessions := []models.Session{}
	for rows.Next() {
		var s models.Session
		if err := rows.Scan(&s.ID, &s.Label, &s.ActiveApplicationIDs, &s.StartedAt, &s.LastActiveAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		sessions = append(sessions, s)
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions, "count": len(sessions)})
}

func (a *App) CreateSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label                *string  `json:"label"`
		ActiveApplicationIDs []string `json:"active_application_ids"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ActiveApplicationIDs == nil {
		body.ActiveApplicationIDs = []string{}
	}

	id := uuid.New().String()
	var s models.Session
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO sessions (id, label, active_application_ids)
		VALUES ($1, $2, $3)
		RETURNING id::text, label, active_application_ids, started_at, last_active_at`,
		id, body.Label, body.ActiveApplicationIDs,
	).Scan(&s.ID, &s.Label, &s.ActiveApplicationIDs, &s.StartedAt, &s.LastActiveAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (a *App) GetSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var s models.Session
	err := a.DB.QueryRow(r.Context(), `
		SELECT id::text, label, active_application_ids, started_at, last_active_at
		FROM sessions WHERE id = $1`, id,
	).Scan(&s.ID, &s.Label, &s.ActiveApplicationIDs, &s.StartedAt, &s.LastActiveAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (a *App) UpdateSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Label                *string  `json:"label"`
		ActiveApplicationIDs []string `json:"active_application_ids"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var s models.Session
	err := a.DB.QueryRow(r.Context(), `
		UPDATE sessions SET
			label                  = COALESCE($2, label),
			active_application_ids = COALESCE($3, active_application_ids),
			last_active_at         = $4
		WHERE id = $1
		RETURNING id::text, label, active_application_ids, started_at, last_active_at`,
		id, body.Label, body.ActiveApplicationIDs, time.Now(),
	).Scan(&s.ID, &s.Label, &s.ActiveApplicationIDs, &s.StartedAt, &s.LastActiveAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (a *App) DeleteSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := a.DB.Exec(r.Context(), `DELETE FROM sessions WHERE id = $1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
