package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListStages(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	stages, err := a.loadStages(r, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stages": stages, "count": len(stages)})
}

func (a *App) CreateStage(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		Name       string `json:"name"`
		Color      string `json:"color"`
		OrderIndex *int   `json:"order_index"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if body.Color == "" {
		body.Color = "#6366f1"
	}

	// Default order: append to end
	orderIndex := 999
	if body.OrderIndex != nil {
		orderIndex = *body.OrderIndex
	}

	id := uuid.New().String()
	var s models.PipelineStage
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO pipeline_stages (id, application_id, name, order_index, color)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, application_id::text, name, order_index, color, created_at`,
		id, appID, body.Name, orderIndex, body.Color,
	).Scan(&s.ID, &s.ApplicationID, &s.Name, &s.OrderIndex, &s.Color, &s.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (a *App) ReorderStages(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		// ordered list of stage IDs
		StageIDs []string `json:"stage_ids"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	for i, stageID := range body.StageIDs {
		_, err := a.DB.Exec(r.Context(), `
			UPDATE pipeline_stages SET order_index = $1
			WHERE id = $2 AND application_id = $3`,
			i, stageID, appID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	stages, err := a.loadStages(r, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stages": stages})
}

func (a *App) DeleteStage(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	stageID := chi.URLParam(r, "stageId")

	_, err := a.DB.Exec(r.Context(), `
		DELETE FROM pipeline_stages WHERE id = $1 AND application_id = $2`, stageID, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) AdvanceStage(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		StageID string `json:"stage_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.StageID == "" {
		writeError(w, http.StatusBadRequest, "stage_id is required")
		return
	}

	// Close previous history entry
	_, _ = a.DB.Exec(r.Context(), `
		UPDATE stage_history SET exited_at = NOW()
		WHERE application_id = $1 AND exited_at IS NULL`, appID)

	// Open new history entry
	_, err := a.DB.Exec(r.Context(), `
		INSERT INTO stage_history (id, application_id, stage_id) VALUES ($1, $2, $3)`,
		uuid.New().String(), appID, body.StageID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Update current stage on application
	_, err = a.DB.Exec(r.Context(), `
		UPDATE job_applications SET current_stage_id = $1, updated_at = NOW() WHERE id = $2`,
		body.StageID, appID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	a.GetApplication(w, r)
}

func (a *App) GetStageHistory(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	rows, err := a.DB.Query(r.Context(), `
		SELECT sh.id::text, sh.application_id::text, sh.stage_id::text,
		       ps.name, sh.entered_at, sh.exited_at
		FROM stage_history sh
		JOIN pipeline_stages ps ON ps.id = sh.stage_id
		WHERE sh.application_id = $1
		ORDER BY sh.entered_at DESC`, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	history := []models.StageHistory{}
	for rows.Next() {
		var h models.StageHistory
		if err := rows.Scan(&h.ID, &h.ApplicationID, &h.StageID, &h.StageName, &h.EnteredAt, &h.ExitedAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		history = append(history, h)
	}
	writeJSON(w, http.StatusOK, map[string]any{"history": history})
}
