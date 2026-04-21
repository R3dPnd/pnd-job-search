package models

import "time"

type PipelineStage struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	Name          string    `json:"name"`
	OrderIndex    int       `json:"order_index"`
	Color         string    `json:"color"`
	CreatedAt     time.Time `json:"created_at"`
}

type Application struct {
	ID              string         `json:"id"`
	Company         string         `json:"company"`
	Role            string         `json:"role"`
	JobDescription  *string        `json:"job_description"`
	JobURL          *string        `json:"job_url"`
	Source          *string        `json:"source"`
	CurrentStageID  *string        `json:"current_stage_id"`
	CurrentStage    *PipelineStage `json:"current_stage,omitempty"`
	DateApplied     *string        `json:"date_applied"`
	Status          string         `json:"status"`
	ResumeID        *string        `json:"resume_id"`
	CoverLetter     *string        `json:"cover_letter"`
	Stages          []PipelineStage `json:"stages,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

type StageHistory struct {
	ID            string     `json:"id"`
	ApplicationID string     `json:"application_id"`
	StageID       string     `json:"stage_id"`
	StageName     string     `json:"stage_name"`
	EnteredAt     time.Time  `json:"entered_at"`
	ExitedAt      *time.Time `json:"exited_at"`
}

type Note struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	StageID       *string   `json:"stage_id"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Resume struct {
	ID        string    `json:"id"`
	Label     string    `json:"label"`
	FilePath  string    `json:"file_path"`
	RawText   *string   `json:"raw_text,omitempty"`
	Version   int       `json:"version"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Session struct {
	ID                   string    `json:"id"`
	Label                *string   `json:"label"`
	ActiveApplicationIDs []string  `json:"active_application_ids"`
	StartedAt            time.Time `json:"started_at"`
	LastActiveAt         time.Time `json:"last_active_at"`
}

type InterviewQuestion struct {
	ID            string            `json:"id"`
	ApplicationID string            `json:"application_id"`
	Type          string            `json:"type"`
	Question      string            `json:"question"`
	Difficulty    *string           `json:"difficulty"`
	GeneratedBy   string            `json:"generated_by"`
	CreatedAt     time.Time         `json:"created_at"`
	Answers       []InterviewAnswer `json:"answers,omitempty"`
}

type InterviewAnswer struct {
	ID          string    `json:"id"`
	QuestionID  string    `json:"question_id"`
	Content     string    `json:"content"`
	CodeContent *string   `json:"code_content"`
	Language    *string   `json:"language"`
	AIFeedback  *string   `json:"ai_feedback"`
	AIScore     *int      `json:"ai_score"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
