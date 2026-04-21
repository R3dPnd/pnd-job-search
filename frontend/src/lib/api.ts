import type {
  Application,
  Note,
  PipelineStage,
  Resume,
  ResumeEdit,
  Session,
  InterviewQuestion,
  InterviewAnswer,
  FitScoreResult,
  ResumeReviewResult,
  CompareResult,
  StageHistoryEntry,
} from '../types'

const BASE = '/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`)
}

// --- Applications ---
export const getApplications = (params?: { status?: string; search?: string }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.search) q.set('search', params.search)
  const qs = q.toString()
  return get<{ applications: Application[]; count: number }>(`/applications${qs ? '?' + qs : ''}`)
}
export const getApplication = (id: string) => get<Application>(`/applications/${id}`)
export const createApplication = (body: Partial<Application>) =>
  post<Application>('/applications', body)
export const updateApplication = (id: string, body: Partial<Application>) =>
  patch<Application>(`/applications/${id}`, body)
export const deleteApplication = (id: string) => del(`/applications/${id}`)
export const exportApplicationsDOCX = async (): Promise<void> => {
  const res = await fetch(`${BASE}/applications/export`)
  if (!res.ok) throw new Error(`export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'applications.docx'
  a.click()
  URL.revokeObjectURL(url)
}

// --- Pipeline ---
export const getStages = (appId: string) =>
  get<{ stages: PipelineStage[] }>(`/applications/${appId}/stages`)
export const createStage = (appId: string, body: { name: string; color?: string }) =>
  post<PipelineStage>(`/applications/${appId}/stages`, body)
export const reorderStages = (appId: string, stageIds: string[]) =>
  put<{ stages: PipelineStage[] }>(`/applications/${appId}/stages`, { stage_ids: stageIds })
export const deleteStage = (appId: string, stageId: string) =>
  del(`/applications/${appId}/stages/${stageId}`)
export const advanceStage = (appId: string, stageId: string) =>
  post<Application>(`/applications/${appId}/advance`, { stage_id: stageId })
export const getStageHistory = (appId: string) =>
  get<{ history: StageHistoryEntry[] }>(`/applications/${appId}/history`)

// --- Notes ---
export const getNotes = (appId: string, stageId?: string) => {
  const qs = stageId ? `?stage_id=${stageId}` : ''
  return get<{ notes: Note[]; count: number }>(`/applications/${appId}/notes${qs}`)
}
export const createNote = (appId: string, body: { content: string; stage_id?: string }) =>
  post<Note>(`/applications/${appId}/notes`, body)
export const updateNote = (appId: string, noteId: string, content: string) =>
  patch<Note>(`/applications/${appId}/notes/${noteId}`, { content })
export const deleteNote = (appId: string, noteId: string) =>
  del(`/applications/${appId}/notes/${noteId}`)

// --- Resumes ---
export const getResumes = () => get<{ resumes: Resume[]; count: number }>('/resumes')
export const getResume = (id: string) => get<Resume>(`/resumes/${id}`)
export const uploadResume = (file: File, label?: string) => {
  const form = new FormData()
  form.append('file', file)
  if (label) form.append('label', label)
  return fetch(`${BASE}/resumes`, { method: 'POST', body: form }).then(r => r.json() as Promise<Resume>)
}
export const deleteResume = (id: string) => del(`/resumes/${id}`)
export const activateResume = (id: string) => post<Resume>(`/resumes/${id}/activate`)
export const downloadResume = async (id: string, filename: string): Promise<void> => {
  const res = await fetch(`${BASE}/resumes/${id}/download`)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
export const fetchResumeBuffer = async (id: string): Promise<ArrayBuffer> => {
  const res = await fetch(`${BASE}/resumes/${id}/download`)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  return res.arrayBuffer()
}
export const saveResumeVersion = (id: string, editedText: string, label?: string) =>
  post<Resume>(`/resumes/${id}/version`, { edited_text: editedText, label })

// --- Sessions ---
export const getSessions = () => get<{ sessions: Session[]; count: number }>('/sessions')
export const createSession = (body: Partial<Session>) => post<Session>('/sessions', body)
export const updateSession = (id: string, body: Partial<Session>) =>
  patch<Session>(`/sessions/${id}`, body)
export const deleteSession = (id: string) => del(`/sessions/${id}`)

// --- Interview ---
export const getQuestions = (appId: string) =>
  get<{ questions: InterviewQuestion[]; count: number }>(`/applications/${appId}/questions`)
export const createQuestion = (appId: string, body: Partial<InterviewQuestion>) =>
  post<InterviewQuestion>(`/applications/${appId}/questions`, body)
export const deleteQuestion = (appId: string, qId: string) =>
  del(`/applications/${appId}/questions/${qId}`)
export const createAnswer = (appId: string, qId: string, body: Partial<InterviewAnswer>) =>
  post<InterviewAnswer>(`/applications/${appId}/questions/${qId}/answers`, body)
export const updateAnswer = (appId: string, qId: string, aId: string, body: Partial<InterviewAnswer>) =>
  patch<InterviewAnswer>(`/applications/${appId}/questions/${qId}/answers/${aId}`, body)
export const deleteAnswer = (appId: string, qId: string, aId: string) =>
  del(`/applications/${appId}/questions/${qId}/answers/${aId}`)

// --- AI ---
export const generateQuestions = (body: {
  application_id: string
  types?: string[]
  count?: number
}) => post<{ questions: InterviewQuestion[] }>('/ai/generate-questions', body)

export const scoreFit = (resumeId: string, jobDescription: string) =>
  post<FitScoreResult>('/ai/score-fit', { resume_id: resumeId, job_description: jobDescription })

export const reviewResume = (resumeId: string) =>
  post<ResumeReviewResult>('/ai/review-resume', { resume_id: resumeId })

export const suggestResumeEdits = (resumeId: string) =>
  post<{ edits: ResumeEdit[] }>('/ai/edit-resume', { resume_id: resumeId })

export const compareResumeToJob = (resumeId: string, jobDescription: string) =>
  post<CompareResult>('/ai/compare', { resume_id: resumeId, job_description: jobDescription })

export const compareResumeToApplication = (appId: string, resumeId: string) =>
  post<CompareResult>(`/applications/${appId}/compare-resume`, { resume_id: resumeId })

export const getAnswerFeedback = (answerId: string) =>
  post<InterviewAnswer>('/ai/answer-feedback', { answer_id: answerId })

export const getJobResumeEdits = (applicationId: string) =>
  post<{ edits: ResumeEdit[] }>('/ai/job-resume-edits', { application_id: applicationId })

export const generateCoverLetter = (applicationId: string, companyInfo?: string) =>
  post<{ cover_letter: string }>('/ai/generate-cover-letter', {
    application_id: applicationId,
    company_info: companyInfo ?? '',
  })
