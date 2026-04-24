package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListApplications(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")

	rows, err := a.DB.Query(r.Context(), `
		SELECT
			ja.id::text, ja.company, ja.role, ja.job_description, ja.job_url, ja.source,
			ja.current_stage_id::text, ja.date_applied, ja.status, ja.resume_id::text,
			ja.created_at, ja.updated_at,
			ps.id::text, ps.name, ps.color, ps.order_index
		FROM job_applications ja
		LEFT JOIN pipeline_stages ps ON ps.id = ja.current_stage_id
		WHERE ($1 = '' OR ja.status = $1)
		  AND ($2 = '' OR ja.company ILIKE '%' || $2 || '%' OR ja.role ILIKE '%' || $2 || '%')
		ORDER BY ja.updated_at DESC`,
		status, search,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	apps := []models.Application{}
	for rows.Next() {
		var app models.Application
		var stageID, stageName, stageColor *string
		var stageOrder *int
		if err := rows.Scan(
			&app.ID, &app.Company, &app.Role, &app.JobDescription, &app.JobURL, &app.Source,
			&app.CurrentStageID, &app.DateApplied, &app.Status, &app.ResumeID,
			&app.CreatedAt, &app.UpdatedAt,
			&stageID, &stageName, &stageColor, &stageOrder,
		); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if stageID != nil {
			app.CurrentStage = &models.PipelineStage{
				ID: *stageID, Name: *stageName, Color: *stageColor, OrderIndex: *stageOrder,
			}
		}
		apps = append(apps, app)
	}
	writeJSON(w, http.StatusOK, map[string]any{"applications": apps, "count": len(apps)})
}

func (a *App) GetApplication(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var app models.Application
	var stageID, stageName, stageColor *string
	var stageOrder *int
	var fitResultStr *string
	err := a.DB.QueryRow(r.Context(), `
		SELECT
			ja.id::text, ja.company, ja.role, ja.job_description, ja.job_url, ja.source,
			ja.current_stage_id::text, ja.date_applied, ja.status, ja.resume_id::text,
			ja.cover_letter, ja.fit_result::text, ja.fit_analyzed_at,
			ja.created_at, ja.updated_at,
			ps.id::text, ps.name, ps.color, ps.order_index
		FROM job_applications ja
		LEFT JOIN pipeline_stages ps ON ps.id = ja.current_stage_id
		WHERE ja.id = $1`, id,
	).Scan(
		&app.ID, &app.Company, &app.Role, &app.JobDescription, &app.JobURL, &app.Source,
		&app.CurrentStageID, &app.DateApplied, &app.Status, &app.ResumeID,
		&app.CoverLetter, &fitResultStr, &app.FitAnalyzedAt,
		&app.CreatedAt, &app.UpdatedAt,
		&stageID, &stageName, &stageColor, &stageOrder,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}
	if fitResultStr != nil && *fitResultStr != "" {
		var fr models.FitResult
		if json.Unmarshal([]byte(*fitResultStr), &fr) == nil {
			app.FitResult = &fr
		}
	}
	if stageID != nil {
		app.CurrentStage = &models.PipelineStage{
			ID: *stageID, Name: *stageName, Color: *stageColor, OrderIndex: *stageOrder,
		}
	}

	// Attach stages
	stages, err := a.loadStages(r, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	app.Stages = stages

	writeJSON(w, http.StatusOK, app)
}

func (a *App) CreateApplication(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Company        string  `json:"company"`
		Role           string  `json:"role"`
		JobDescription *string `json:"job_description"`
		JobURL         *string `json:"job_url"`
		Source         *string `json:"source"`
		DateApplied    *string `json:"date_applied"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Company == "" || body.Role == "" {
		writeError(w, http.StatusBadRequest, "company and role are required")
		return
	}

	id := uuid.New().String()
	var app models.Application
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO job_applications (id, company, role, job_description, job_url, source, date_applied)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id::text, company, role, job_description, job_url, source,
		          current_stage_id::text, date_applied, status, created_at, updated_at`,
		id, body.Company, body.Role, body.JobDescription, body.JobURL, body.Source, body.DateApplied,
	).Scan(
		&app.ID, &app.Company, &app.Role, &app.JobDescription, &app.JobURL, &app.Source,
		&app.CurrentStageID, &app.DateApplied, &app.Status, &app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Seed default pipeline stages
	defaultStages := []struct{ name, color string }{
		{"Interested", "#94a3b8"},
		{"Ready to Apply", "#0ea5e9"},
		{"Applied", "#6366f1"},
		{"Phone Screen", "#f59e0b"},
		{"Technical Interview", "#3b82f6"},
		{"Final Round", "#8b5cf6"},
		{"Offer", "#10b981"},
		{"Rejected", "#ef4444"},
	}
	for i, s := range defaultStages {
		stageID := uuid.New().String()
		_, err := a.DB.Exec(r.Context(), `
			INSERT INTO pipeline_stages (id, application_id, name, order_index, color)
			VALUES ($1, $2, $3, $4, $5)`,
			stageID, id, s.name, i, s.color,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// Set current_stage_id to "Applied" on creation
		if i == 0 {
			_, _ = a.DB.Exec(r.Context(),
				`UPDATE job_applications SET current_stage_id = $1 WHERE id = $2`, stageID, id)
			app.CurrentStageID = &stageID
			app.CurrentStage = &models.PipelineStage{ID: stageID, Name: s.name, Color: s.color, OrderIndex: 0}

			// Record history
			_, _ = a.DB.Exec(r.Context(), `
				INSERT INTO stage_history (id, application_id, stage_id)
				VALUES ($1, $2, $3)`,
				uuid.New().String(), id, stageID,
			)
		}
	}

	stages, _ := a.loadStages(r, id)
	app.Stages = stages

	writeJSON(w, http.StatusCreated, app)
}

func (a *App) UpdateApplication(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Company        *string `json:"company"`
		Role           *string `json:"role"`
		JobDescription *string `json:"job_description"`
		JobURL         *string `json:"job_url"`
		Source         *string `json:"source"`
		DateApplied    *string `json:"date_applied"`
		Status         *string `json:"status"`
		ResumeID       *string `json:"resume_id"`
		CoverLetter    *string `json:"cover_letter"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	_, err := a.DB.Exec(r.Context(), `
		UPDATE job_applications SET
			company         = COALESCE($2, company),
			role            = COALESCE($3, role),
			job_description = COALESCE($4, job_description),
			job_url         = COALESCE($5, job_url),
			source          = COALESCE($6, source),
			date_applied    = COALESCE($7, date_applied),
			status          = COALESCE($8, status),
			resume_id       = COALESCE($10::uuid, resume_id),
			cover_letter    = COALESCE($11, cover_letter),
			updated_at      = $9
		WHERE id = $1`,
		id, body.Company, body.Role, body.JobDescription, body.JobURL,
		body.Source, body.DateApplied, body.Status, time.Now(), body.ResumeID, body.CoverLetter,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	a.GetApplication(w, r)
}

func (a *App) DeleteApplication(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, err := a.DB.Exec(r.Context(), `DELETE FROM job_applications WHERE id = $1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) ExportApplicationsDOCX(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT
			ja.company, ja.role, ja.status, ja.source,
			ja.date_applied, ja.job_url,
			ps.name
		FROM job_applications ja
		LEFT JOIN pipeline_stages ps ON ps.id = ja.current_stage_id
		ORDER BY ja.updated_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var body strings.Builder
	type appRow struct {
		company, role, status       string
		source, dateApplied, jobURL *string
		stageName                   *string
	}
	var apps []appRow
	for rows.Next() {
		var ar appRow
		if err := rows.Scan(&ar.company, &ar.role, &ar.status, &ar.source,
			&ar.dateApplied, &ar.jobURL, &ar.stageName); err != nil {
			continue
		}
		apps = append(apps, ar)
	}

	for i, ar := range apps {
		body.WriteString(wBoldPara(xmlEsc(ar.company)))
		body.WriteString(wLabelValue("Role", xmlEsc(ar.role)))
		body.WriteString(wLabelValue("Status", xmlEsc(ar.status)))
		if ar.stageName != nil {
			body.WriteString(wLabelValue("Stage", xmlEsc(*ar.stageName)))
		}
		if ar.dateApplied != nil && *ar.dateApplied != "" {
			body.WriteString(wLabelValue("Applied", xmlEsc(*ar.dateApplied)))
		}
		if ar.source != nil && *ar.source != "" {
			body.WriteString(wLabelValue("Source", xmlEsc(*ar.source)))
		}
		if ar.jobURL != nil && *ar.jobURL != "" {
			body.WriteString(wLabelValue("URL", xmlEsc(*ar.jobURL)))
		}
		if i < len(apps)-1 {
			body.WriteString(wHR())
		}
	}

	doc := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
		`<w:body>` + body.String() + `<w:sectPr/></w:body></w:document>`

	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
		`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
		`<Default Extension="xml" ContentType="application/xml"/>` +
		`<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
		`</Types>`

	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
		`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
		`</Relationships>`

	wordRels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	for _, f := range []struct{ name, content string }{
		{"[Content_Types].xml", contentTypes},
		{"_rels/.rels", rels},
		{"word/_rels/document.xml.rels", wordRels},
		{"word/document.xml", doc},
	} {
		fw, _ := zw.Create(f.name)
		fw.Write([]byte(f.content))
	}
	zw.Close()

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="applications.docx"`)
	w.Write(buf.Bytes())
}

func wBoldPara(text string) string {
	return `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>` + text + `</w:t></w:r></w:p>`
}

func wLabelValue(label, value string) string {
	return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">` + label + `: </w:t></w:r>` +
		`<w:r><w:t>` + value + `</w:t></w:r></w:p>`
}

func wHR() string {
	return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>`
}

func xmlEsc(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// loadStages is a shared helper used by get + create.
func (a *App) loadStages(r *http.Request, appID string) ([]models.PipelineStage, error) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, application_id::text, name, order_index, color, created_at
		FROM pipeline_stages WHERE application_id = $1 ORDER BY order_index`, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := []models.PipelineStage{}
	for rows.Next() {
		var s models.PipelineStage
		if err := rows.Scan(&s.ID, &s.ApplicationID, &s.Name, &s.OrderIndex, &s.Color, &s.CreatedAt); err != nil {
			return nil, err
		}
		stages = append(stages, s)
	}
	return stages, nil
}
