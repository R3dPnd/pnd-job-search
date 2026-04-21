-- +goose Up

ALTER TABLE job_applications ADD COLUMN resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;

-- +goose Down

ALTER TABLE job_applications DROP COLUMN IF EXISTS resume_id;
