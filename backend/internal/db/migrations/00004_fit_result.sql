-- +goose Up
ALTER TABLE job_applications ADD COLUMN fit_result JSONB;
ALTER TABLE job_applications ADD COLUMN fit_analyzed_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE job_applications DROP COLUMN fit_result;
ALTER TABLE job_applications DROP COLUMN fit_analyzed_at;
