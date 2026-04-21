export interface PipelineStage {
  id: string
  application_id: string
  name: string
  order_index: number
  color: string
  created_at: string
}

export interface Application {
  id: string
  company: string
  role: string
  job_description: string | null
  job_url: string | null
  source: string | null
  current_stage_id: string | null
  current_stage: PipelineStage | null
  date_applied: string | null
  status: 'active' | 'archived' | 'rejected' | 'offer'
  resume_id: string | null
  cover_letter: string | null
  stages: PipelineStage[]
  created_at: string
  updated_at: string
}

export interface StageHistoryEntry {
  id: string
  application_id: string
  stage_id: string
  stage_name: string
  entered_at: string
  exited_at: string | null
}

export interface Note {
  id: string
  application_id: string
  stage_id: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface Resume {
  id: string
  label: string
  file_path: string
  raw_text?: string
  version: number
  is_active: boolean
  created_at: string
}

export interface Session {
  id: string
  label: string | null
  active_application_ids: string[]
  started_at: string
  last_active_at: string
}

export interface InterviewAnswer {
  id: string
  question_id: string
  content: string
  code_content: string | null
  language: string | null
  ai_feedback: string | null
  ai_score: number | null
  created_at: string
  updated_at: string
}

export interface InterviewQuestion {
  id: string
  application_id: string
  type: 'behavioral' | 'technical' | 'situational' | 'coding'
  question: string
  difficulty: 'easy' | 'medium' | 'hard' | null
  generated_by: 'ai' | 'manual'
  created_at: string
  answers: InterviewAnswer[]
}

export interface FitScoreResult {
  score: number
  reasoning: string
  strengths: string[]
  gaps: string[]
}

export interface ResumeReviewResult {
  ats_score: number
  issues: string[]
  suggestions: string[]
  keywords: string[]
  summary: string
}

export interface CompareResult {
  match_score: number
  strengths: string[]
  gaps: string[]
  suggestions: string[]
  summary: string
}

export interface ResumeEdit {
  id: string
  section: string
  original: string
  replacement: string
  reason: string
}

export type Tab = 'dashboard' | 'applications' | 'resume' | 'discover' | 'sessions'
