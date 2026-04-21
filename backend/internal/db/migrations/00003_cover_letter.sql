-- +goose Up
ALTER TABLE job_applications ADD COLUMN cover_letter TEXT;

-- +goose Down
ALTER TABLE job_applications DROP COLUMN cover_letter;
