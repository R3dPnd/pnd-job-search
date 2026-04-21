package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prestonharms/pnd-job-search/internal/models"
)

func (a *App) GenerateQuestions(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ApplicationID string   `json:"application_id"`
		Types         []string `json:"types"`
		Count         int      `json:"count"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ApplicationID == "" {
		writeError(w, http.StatusBadRequest, "application_id is required")
		return
	}
	if len(body.Types) == 0 {
		body.Types = []string{"behavioral", "technical", "situational"}
	}
	if body.Count == 0 {
		body.Count = 5
	}

	// Load application context
	var company, role string
	var jobDesc *string
	err := a.DB.QueryRow(r.Context(),
		`SELECT company, role, job_description FROM job_applications WHERE id = $1`,
		body.ApplicationID,
	).Scan(&company, &role, &jobDesc)
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}

	questions, err := a.AI.GenerateInterviewQuestions(r.Context(), company, role, jobDesc, body.Types, body.Count)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist generated questions
	saved := []models.InterviewQuestion{}
	for _, q := range questions {
		id := uuid.New().String()
		var saved_q models.InterviewQuestion
		err := a.DB.QueryRow(r.Context(), `
			INSERT INTO interview_questions (id, application_id, type, question, difficulty, generated_by)
			VALUES ($1, $2, $3, $4, $5, 'ai')
			RETURNING id::text, application_id::text, type, question, difficulty, generated_by, created_at`,
			id, body.ApplicationID, q.Type, q.Question, q.Difficulty,
		).Scan(&saved_q.ID, &saved_q.ApplicationID, &saved_q.Type, &saved_q.Question,
			&saved_q.Difficulty, &saved_q.GeneratedBy, &saved_q.CreatedAt)
		if err != nil {
			continue
		}
		saved_q.Answers = []models.InterviewAnswer{}
		saved = append(saved, saved_q)
	}

	writeJSON(w, http.StatusOK, map[string]any{"questions": saved, "count": len(saved)})
}

func (a *App) ScoreFit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResumeID       string `json:"resume_id"`
		JobDescription string `json:"job_description"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ResumeID == "" || body.JobDescription == "" {
		writeError(w, http.StatusBadRequest, "resume_id and job_description are required")
		return
	}

	var rawText *string
	err := a.DB.QueryRow(r.Context(), `SELECT raw_text FROM resumes WHERE id = $1`, body.ResumeID).Scan(&rawText)
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusNotFound, "resume not found or has no extracted text")
		return
	}

	result, err := a.AI.ScoreFit(r.Context(), *rawText, body.JobDescription)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *App) ReviewResume(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResumeID string `json:"resume_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ResumeID == "" {
		writeError(w, http.StatusBadRequest, "resume_id is required")
		return
	}

	var rawText *string
	err := a.DB.QueryRow(r.Context(), `SELECT raw_text FROM resumes WHERE id = $1`, body.ResumeID).Scan(&rawText)
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusNotFound, "resume not found or has no extracted text")
		return
	}

	result, err := a.AI.ReviewResume(r.Context(), *rawText)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *App) CompareResumeToApplication(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")

	var body struct {
		ResumeID string `json:"resume_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ResumeID == "" {
		writeError(w, http.StatusBadRequest, "resume_id is required")
		return
	}

	var jobDesc *string
	err := a.DB.QueryRow(r.Context(),
		`SELECT job_description FROM job_applications WHERE id = $1`, appID,
	).Scan(&jobDesc)
	if err != nil || jobDesc == nil || *jobDesc == "" {
		writeError(w, http.StatusBadRequest, "application not found or has no job description")
		return
	}

	var rawText *string
	err = a.DB.QueryRow(r.Context(), `SELECT raw_text FROM resumes WHERE id = $1`, body.ResumeID).Scan(&rawText)
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusNotFound, "resume not found or has no extracted text")
		return
	}

	result, err := a.AI.CompareResumeToJob(r.Context(), *rawText, *jobDesc)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *App) CompareResumeToJob(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResumeID       string `json:"resume_id"`
		JobDescription string `json:"job_description"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ResumeID == "" || body.JobDescription == "" {
		writeError(w, http.StatusBadRequest, "resume_id and job_description are required")
		return
	}

	var rawText *string
	err := a.DB.QueryRow(r.Context(), `SELECT raw_text FROM resumes WHERE id = $1`, body.ResumeID).Scan(&rawText)
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusNotFound, "resume not found or has no extracted text")
		return
	}

	result, err := a.AI.CompareResumeToJob(r.Context(), *rawText, body.JobDescription)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *App) EditResume(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResumeID string `json:"resume_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ResumeID == "" {
		writeError(w, http.StatusBadRequest, "resume_id is required")
		return
	}

	var rawText *string
	err := a.DB.QueryRow(r.Context(), `SELECT raw_text FROM resumes WHERE id = $1`, body.ResumeID).Scan(&rawText)
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusNotFound, "resume not found or has no extracted text")
		return
	}

	edits, err := a.AI.SuggestEdits(r.Context(), *rawText)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"edits": edits})
}

func (a *App) JobResumeEdits(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ApplicationID string `json:"application_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ApplicationID == "" {
		writeError(w, http.StatusBadRequest, "application_id is required")
		return
	}

	var company, role string
	var jobDesc *string
	err := a.DB.QueryRow(r.Context(),
		`SELECT company, role, job_description FROM job_applications WHERE id = $1`,
		body.ApplicationID,
	).Scan(&company, &role, &jobDesc)
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}
	if jobDesc == nil || *jobDesc == "" {
		writeError(w, http.StatusBadRequest, "application must have a job description")
		return
	}

	var rawText *string
	err = a.DB.QueryRow(r.Context(), `
		SELECT r.raw_text FROM resumes r
		JOIN job_applications ja ON ja.resume_id = r.id
		WHERE ja.id = $1 AND r.raw_text IS NOT NULL AND r.raw_text != ''`,
		body.ApplicationID,
	).Scan(&rawText)
	if err != nil {
		err = a.DB.QueryRow(r.Context(),
			`SELECT raw_text FROM resumes WHERE is_active = true AND raw_text IS NOT NULL AND raw_text != '' LIMIT 1`,
		).Scan(&rawText)
	}
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusBadRequest, "no resume with extracted text found — upload and activate a resume first")
		return
	}

	edits, err := a.AI.SuggestJobTargetedEdits(r.Context(), *rawText, *jobDesc, company, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"edits": edits})
}

func (a *App) GenerateCoverLetter(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ApplicationID string `json:"application_id"`
		CompanyInfo   string `json:"company_info"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.ApplicationID == "" {
		writeError(w, http.StatusBadRequest, "application_id is required")
		return
	}

	var company, role string
	var jobDesc *string
	err := a.DB.QueryRow(r.Context(),
		`SELECT company, role, job_description FROM job_applications WHERE id = $1`,
		body.ApplicationID,
	).Scan(&company, &role, &jobDesc)
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}
	if jobDesc == nil || *jobDesc == "" {
		writeError(w, http.StatusBadRequest, "application must have a job description")
		return
	}

	// Use resume linked to application, falling back to active resume
	var rawText *string
	err = a.DB.QueryRow(r.Context(), `
		SELECT r.raw_text FROM resumes r
		JOIN job_applications ja ON ja.resume_id = r.id
		WHERE ja.id = $1 AND r.raw_text IS NOT NULL AND r.raw_text != ''`,
		body.ApplicationID,
	).Scan(&rawText)
	if err != nil {
		// Fall back to active resume
		err = a.DB.QueryRow(r.Context(),
			`SELECT raw_text FROM resumes WHERE is_active = true AND raw_text IS NOT NULL AND raw_text != '' LIMIT 1`,
		).Scan(&rawText)
	}
	if err != nil || rawText == nil || *rawText == "" {
		writeError(w, http.StatusBadRequest, "no resume with extracted text found — upload and activate a resume first")
		return
	}

	coverLetter, err := a.AI.GenerateCoverLetter(r.Context(), company, role, *jobDesc, *rawText, body.CompanyInfo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"cover_letter": coverLetter})
}

func (a *App) AnswerFeedback(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AnswerID string `json:"answer_id"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.AnswerID == "" {
		writeError(w, http.StatusBadRequest, "answer_id is required")
		return
	}

	var ans models.InterviewAnswer
	var questionText, questionType string
	err := a.DB.QueryRow(r.Context(), `
		SELECT a.id::text, a.question_id::text, a.content, a.code_content, a.language,
		       a.ai_feedback, a.ai_score, a.created_at, a.updated_at,
		       q.question, q.type
		FROM interview_answers a
		JOIN interview_questions q ON q.id = a.question_id
		WHERE a.id = $1`, body.AnswerID,
	).Scan(&ans.ID, &ans.QuestionID, &ans.Content, &ans.CodeContent, &ans.Language,
		&ans.AIFeedback, &ans.AIScore, &ans.CreatedAt, &ans.UpdatedAt,
		&questionText, &questionType)
	if err != nil {
		writeError(w, http.StatusNotFound, "answer not found")
		return
	}

	feedback, score, err := a.AI.ReviewAnswer(r.Context(), questionText, questionType, ans.Content, ans.CodeContent, ans.Language)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist feedback back to DB
	err = a.DB.QueryRow(r.Context(), `
		UPDATE interview_answers SET ai_feedback = $1, ai_score = $2, updated_at = $3
		WHERE id = $4
		RETURNING id::text, question_id::text, content, code_content, language,
		          ai_feedback, ai_score, created_at, updated_at`,
		feedback, score, time.Now(), body.AnswerID,
	).Scan(&ans.ID, &ans.QuestionID, &ans.Content, &ans.CodeContent, &ans.Language,
		&ans.AIFeedback, &ans.AIScore, &ans.CreatedAt, &ans.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, ans)
}
