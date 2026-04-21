-- +goose Up

CREATE TABLE job_applications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company          TEXT NOT NULL,
    role             TEXT NOT NULL,
    job_description  TEXT,
    job_url          TEXT,
    source           TEXT,
    current_stage_id UUID,
    date_applied     TEXT,
    status           TEXT NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    order_index    INTEGER NOT NULL DEFAULT 0,
    color          TEXT NOT NULL DEFAULT '#6366f1',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_applications
    ADD CONSTRAINT fk_current_stage
    FOREIGN KEY (current_stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE TABLE stage_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    stage_id       UUID NOT NULL REFERENCES pipeline_stages(id),
    entered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at      TIMESTAMPTZ
);

CREATE TABLE notes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    stage_id       UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    content        TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resumes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label      TEXT NOT NULL,
    file_path  TEXT NOT NULL,
    raw_text   TEXT,
    version    INTEGER NOT NULL DEFAULT 1,
    is_active  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label                  TEXT,
    active_application_ids TEXT[] NOT NULL DEFAULT '{}',
    started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE interview_questions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    type           TEXT NOT NULL,
    question       TEXT NOT NULL,
    difficulty     TEXT,
    generated_by   TEXT NOT NULL DEFAULT 'ai',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE interview_answers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id  UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    content      TEXT NOT NULL DEFAULT '',
    code_content TEXT,
    language     TEXT,
    ai_feedback  TEXT,
    ai_score     INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down

DROP TABLE IF EXISTS interview_answers;
DROP TABLE IF EXISTS interview_questions;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS resumes;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS stage_history;
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS fk_current_stage;
DROP TABLE IF EXISTS pipeline_stages;
DROP TABLE IF EXISTS job_applications;
