package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prestonharms/pnd-job-search/internal/api/handlers"
	"github.com/prestonharms/pnd-job-search/internal/api/middleware"
	"github.com/prestonharms/pnd-job-search/internal/config"
	"github.com/prestonharms/pnd-job-search/internal/services"
)

func NewRouter(db *pgxpool.Pool, ai *services.AIService, cfg *config.Config) http.Handler {
	app := handlers.NewApp(db, ai, cfg)

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.CORS(cfg.FrontendOrigin))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", app.Health)

		// Applications
		r.Route("/applications", func(r chi.Router) {
			r.Get("/", app.ListApplications)
			r.Post("/", app.CreateApplication)
			r.Get("/export", app.ExportApplicationsDOCX)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", app.GetApplication)
				r.Patch("/", app.UpdateApplication)
				r.Delete("/", app.DeleteApplication)

				// Pipeline
				r.Get("/stages", app.ListStages)
				r.Post("/stages", app.CreateStage)
				r.Put("/stages", app.ReorderStages)
				r.Delete("/stages/{stageId}", app.DeleteStage)
				r.Post("/advance", app.AdvanceStage)
				r.Get("/history", app.GetStageHistory)

				// Notes
				r.Get("/notes", app.ListNotes)
				r.Post("/notes", app.CreateNote)
				r.Patch("/notes/{noteId}", app.UpdateNote)
				r.Delete("/notes/{noteId}", app.DeleteNote)

				// Interview
				r.Get("/questions", app.ListQuestions)
				r.Post("/questions", app.CreateQuestion)
				r.Delete("/questions/{qId}", app.DeleteQuestion)
				r.Post("/questions/{qId}/answers", app.CreateAnswer)
				r.Patch("/questions/{qId}/answers/{aId}", app.UpdateAnswer)
				r.Delete("/questions/{qId}/answers/{aId}", app.DeleteAnswer)

				// Resume fit
				r.Post("/compare-resume", app.CompareResumeToApplication)
			})
		})

		// Resumes
		r.Route("/resumes", func(r chi.Router) {
			r.Get("/", app.ListResumes)
			r.Post("/", app.UploadResume)
			r.Get("/{id}", app.GetResume)
			r.Delete("/{id}", app.DeleteResume)
			r.Post("/{id}/activate", app.ActivateResume)
			r.Get("/{id}/download", app.DownloadResume)
			r.Post("/{id}/version", app.SaveResumeVersion)
		})

		// Sessions
		r.Route("/sessions", func(r chi.Router) {
			r.Get("/", app.ListSessions)
			r.Post("/", app.CreateSession)
			r.Get("/{id}", app.GetSession)
			r.Patch("/{id}", app.UpdateSession)
			r.Delete("/{id}", app.DeleteSession)
		})

		// AI
		r.Route("/ai", func(r chi.Router) {
			r.Post("/generate-questions", app.GenerateQuestions)
			r.Post("/score-fit", app.ScoreFit)
			r.Post("/review-resume", app.ReviewResume)
			r.Post("/edit-resume", app.EditResume)
			r.Post("/compare", app.CompareResumeToJob)
			r.Post("/answer-feedback", app.AnswerFeedback)
			r.Post("/generate-cover-letter", app.GenerateCoverLetter)
			r.Post("/job-resume-edits", app.JobResumeEdits)
			r.Post("/clarifying-questions", app.ClarifyingQuestions)
		})
	})

	return r
}
