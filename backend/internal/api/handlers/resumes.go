package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListResumes(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, label, file_path, version, is_active, created_at
		FROM resumes ORDER BY created_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	resumes := []models.Resume{}
	for rows.Next() {
		var res models.Resume
		if err := rows.Scan(&res.ID, &res.Label, &res.FilePath, &res.Version, &res.IsActive, &res.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		resumes = append(resumes, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"resumes": resumes, "count": len(resumes)})
}

func (a *App) UploadResume(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse form")
		return
	}

	label := r.FormValue("label")
	if label == "" {
		label = fmt.Sprintf("Resume %s", time.Now().Format("2006-01-02"))
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".docx") {
		writeError(w, http.StatusBadRequest, "only .docx files are accepted")
		return
	}

	// Determine version: count existing resumes with same label prefix
	var count int
	_ = a.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM resumes WHERE label LIKE $1`, label+"%").Scan(&count)
	version := count + 1

	// Save file to disk
	resumesDir := filepath.Join(a.Config.UploadsDir, "resumes")
	_ = os.MkdirAll(resumesDir, 0o755)
	filename := fmt.Sprintf("%s_v%d_%s.docx", uuid.New().String(), version, sanitizeFilename(header.Filename))
	filePath := filepath.Join(resumesDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dst.Close()

	buf := make([]byte, 32<<20)
	n, _ := file.Read(buf)
	dst.Write(buf[:n])
	dst.Close()

	// Extract text
	rawText, err := a.Docx.ExtractText(filePath)
	if err != nil {
		rawText = ""
	}

	id := uuid.New().String()
	var res models.Resume
	err = a.DB.QueryRow(r.Context(), `
		INSERT INTO resumes (id, label, file_path, raw_text, version)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, label, file_path, version, is_active, created_at`,
		id, label, filePath, rawText, version,
	).Scan(&res.ID, &res.Label, &res.FilePath, &res.Version, &res.IsActive, &res.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (a *App) GetResume(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var res models.Resume
	err := a.DB.QueryRow(r.Context(), `
		SELECT id::text, label, file_path, raw_text, version, is_active, created_at
		FROM resumes WHERE id = $1`, id,
	).Scan(&res.ID, &res.Label, &res.FilePath, &res.RawText, &res.Version, &res.IsActive, &res.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "resume not found")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (a *App) DeleteResume(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var filePath string
	err := a.DB.QueryRow(r.Context(), `DELETE FROM resumes WHERE id = $1 RETURNING file_path`, id).Scan(&filePath)
	if err != nil {
		writeError(w, http.StatusNotFound, "resume not found")
		return
	}
	_ = os.Remove(filePath)
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) ActivateResume(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	_, err := a.DB.Exec(r.Context(), `UPDATE resumes SET is_active = FALSE`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var res models.Resume
	err = a.DB.QueryRow(r.Context(), `
		UPDATE resumes SET is_active = TRUE WHERE id = $1
		RETURNING id::text, label, file_path, version, is_active, created_at`, id,
	).Scan(&res.ID, &res.Label, &res.FilePath, &res.Version, &res.IsActive, &res.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "resume not found")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (a *App) DownloadResume(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var filePath string
	err := a.DB.QueryRow(r.Context(), `SELECT file_path FROM resumes WHERE id = $1`, id).Scan(&filePath)
	if err != nil {
		writeError(w, http.StatusNotFound, "resume not found")
		return
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="resume.docx"`)
	w.WriteHeader(http.StatusOK)
	w.Write(data) //nolint:errcheck
}

func (a *App) SaveResumeVersion(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		EditedText string `json:"edited_text"`
		Label      string `json:"label"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.EditedText == "" {
		writeError(w, http.StatusBadRequest, "edited_text is required")
		return
	}

	var originalLabel string
	var originalVersion int
	err := a.DB.QueryRow(r.Context(), `SELECT label, version FROM resumes WHERE id = $1`, id).
		Scan(&originalLabel, &originalVersion)
	if err != nil {
		writeError(w, http.StatusNotFound, "resume not found")
		return
	}

	newLabel := body.Label
	if newLabel == "" {
		newLabel = originalLabel
	}
	newVersion := originalVersion + 1

	docxBytes, err := a.Docx.GenerateDocx(body.EditedText)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate docx")
		return
	}

	resumesDir := filepath.Join(a.Config.UploadsDir, "resumes")
	_ = os.MkdirAll(resumesDir, 0o755)
	filename := fmt.Sprintf("%s_v%d.docx", uuid.New().String(), newVersion)
	filePath := filepath.Join(resumesDir, filename)
	if err := os.WriteFile(filePath, docxBytes, 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}

	newID := uuid.New().String()
	var res models.Resume
	err = a.DB.QueryRow(r.Context(), `
		INSERT INTO resumes (id, label, file_path, raw_text, version)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, label, file_path, version, is_active, created_at`,
		newID, newLabel, filePath, body.EditedText, newVersion,
	).Scan(&res.ID, &res.Label, &res.FilePath, &res.Version, &res.IsActive, &res.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, res)
}

func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	var b strings.Builder
	for _, c := range name {
		if c == ' ' {
			b.WriteRune('_')
		} else if c == '.' || c == '-' || c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			b.WriteRune(c)
		}
	}
	return b.String()
}
