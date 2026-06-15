-- +goose Up

ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS resume_id       UUID,
    ADD COLUMN IF NOT EXISTS cover_letter    TEXT,
    ADD COLUMN IF NOT EXISTS fit_result      JSONB,
    ADD COLUMN IF NOT EXISTS fit_analyzed_at TIMESTAMPTZ;

-- +goose Down

ALTER TABLE job_applications
    DROP COLUMN IF EXISTS resume_id,
    DROP COLUMN IF EXISTS cover_letter,
    DROP COLUMN IF EXISTS fit_result,
    DROP COLUMN IF EXISTS fit_analyzed_at;
