package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) ListQuestions(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, application_id::text, type, question, difficulty, generated_by, created_at
		FROM interview_questions WHERE application_id = $1 ORDER BY created_at ASC`, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	questions := []models.InterviewQuestion{}
	for rows.Next() {
		var q models.InterviewQuestion
		if err := rows.Scan(&q.ID, &q.ApplicationID, &q.Type, &q.Question, &q.Difficulty, &q.GeneratedBy, &q.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		answers, _ := a.loadAnswers(r, q.ID)
		q.Answers = answers
		questions = append(questions, q)
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": questions, "count": len(questions)})
}

func (a *App) CreateQuestion(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		Type        string  `json:"type"`
		Question    string  `json:"question"`
		Difficulty  *string `json:"difficulty"`
		GeneratedBy string  `json:"generated_by"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Question == "" || body.Type == "" {
		writeError(w, http.StatusBadRequest, "type and question are required")
		return
	}
	if body.GeneratedBy == "" {
		body.GeneratedBy = "manual"
	}

	id := uuid.New().String()
	var q models.InterviewQuestion
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO interview_questions (id, application_id, type, question, difficulty, generated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text, application_id::text, type, question, difficulty, generated_by, created_at`,
		id, appID, body.Type, body.Question, body.Difficulty, body.GeneratedBy,
	).Scan(&q.ID, &q.ApplicationID, &q.Type, &q.Question, &q.Difficulty, &q.GeneratedBy, &q.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	q.Answers = []models.InterviewAnswer{}
	writeJSON(w, http.StatusCreated, q)
}

func (a *App) DeleteQuestion(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	qID := chi.URLParam(r, "qId")

	_, err := a.DB.Exec(r.Context(), `
		DELETE FROM interview_questions WHERE id = $1 AND application_id = $2`, qID, appID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) CreateAnswer(w http.ResponseWriter, r *http.Request) {
	qID := chi.URLParam(r, "qId")

	var body struct {
		Content     string  `json:"content"`
		CodeContent *string `json:"code_content"`
		Language    *string `json:"language"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	id := uuid.New().String()
	var ans models.InterviewAnswer
	err := a.DB.QueryRow(r.Context(), `
		INSERT INTO interview_answers (id, question_id, content, code_content, language)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, question_id::text, content, code_content, language,
		          ai_feedback, ai_score, created_at, updated_at`,
		id, qID, body.Content, body.CodeContent, body.Language,
	).Scan(&ans.ID, &ans.QuestionID, &ans.Content, &ans.CodeContent, &ans.Language,
		&ans.AIFeedback, &ans.AIScore, &ans.CreatedAt, &ans.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, ans)
}

func (a *App) UpdateAnswer(w http.ResponseWriter, r *http.Request) {
	qID := chi.URLParam(r, "qId")
	aID := chi.URLParam(r, "aId")

	var body struct {
		Content     *string `json:"content"`
		CodeContent *string `json:"code_content"`
		Language    *string `json:"language"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var ans models.InterviewAnswer
	err := a.DB.QueryRow(r.Context(), `
		UPDATE interview_answers SET
			content      = COALESCE($3, content),
			code_content = COALESCE($4, code_content),
			language     = COALESCE($5, language),
			updated_at   = $6
		WHERE id = $1 AND question_id = $2
		RETURNING id::text, question_id::text, content, code_content, language,
		          ai_feedback, ai_score, created_at, updated_at`,
		aID, qID, body.Content, body.CodeContent, body.Language, time.Now(),
	).Scan(&ans.ID, &ans.QuestionID, &ans.Content, &ans.CodeContent, &ans.Language,
		&ans.AIFeedback, &ans.AIScore, &ans.CreatedAt, &ans.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "answer not found")
		return
	}
	writeJSON(w, http.StatusOK, ans)
}

func (a *App) DeleteAnswer(w http.ResponseWriter, r *http.Request) {
	qID := chi.URLParam(r, "qId")
	aID := chi.URLParam(r, "aId")

	_, err := a.DB.Exec(r.Context(),
		`DELETE FROM interview_answers WHERE id = $1 AND question_id = $2`, aID, qID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) loadAnswers(r *http.Request, questionID string) ([]models.InterviewAnswer, error) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT id::text, question_id::text, content, code_content, language,
		       ai_feedback, ai_score, created_at, updated_at
		FROM interview_answers WHERE question_id = $1 ORDER BY created_at ASC`, questionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	answers := []models.InterviewAnswer{}
	for rows.Next() {
		var ans models.InterviewAnswer
		if err := rows.Scan(&ans.ID, &ans.QuestionID, &ans.Content, &ans.CodeContent, &ans.Language,
			&ans.AIFeedback, &ans.AIScore, &ans.CreatedAt, &ans.UpdatedAt); err != nil {
			return nil, err
		}
		answers = append(answers, ans)
	}
	return answers, nil
}
