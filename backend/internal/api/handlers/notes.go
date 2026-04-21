package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListNotes(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	stageID := r.URL.Query().Get("stage_id")

	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, application_id::text, stage_id::text, content, created_at, updated_at
		FROM notes
		WHERE application_id = $1
		  AND ($2 = '' OR stage_id::text = $2)
		ORDER BY created_at DESC`,
		appID, stageID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	notes := []models.Note{}
	for rows.Next() {
		var n models.Note
		if err := rows.Scan(&n.ID, &n.ApplicationID, &n.StageID, &n.Content, &n.CreatedAt, &n.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		notes = append(notes, n)
	}
	writeJSON(w, http.StatusOK, map[string]any{"notes": notes, "count": len(notes)})
}

func (a *App) CreateNote(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		Content string  `json:"content"`
		StageID *string `json:"stage_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	id := uuid.New().String()
	var n models.Note
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO notes (id, application_id, stage_id, content)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, application_id::text, stage_id::text, content, created_at, updated_at`,
		id, appID, body.StageID, body.Content,
	).Scan(&n.ID, &n.ApplicationID, &n.StageID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, n)
}

func (a *App) UpdateNote(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	noteID := chi.URLParam(r, "noteId")

	var body struct {
		Content string `json:"content"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var n models.Note
	err := a.DB.QueryRow(r.Context(), `
		UPDATE notes SET content = $1, updated_at = $2
		WHERE id = $3 AND application_id = $4
		RETURNING id::text, application_id::text, stage_id::text, content, created_at, updated_at`,
		body.Content, time.Now(), noteID, appID,
	).Scan(&n.ID, &n.ApplicationID, &n.StageID, &n.Content, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "note not found")
		return
	}
	writeJSON(w, http.StatusOK, n)
}

func (a *App) DeleteNote(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	noteID := chi.URLParam(r, "noteId")

	_, err := a.DB.Exec(r.Context(), `
		DELETE FROM notes WHERE id = $1 AND application_id = $2`, noteID, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
