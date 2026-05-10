import { useState } from 'react'
import { getClarifyingQuestions, getJobResumeEdits, saveResumeVersion, getResume, getResumes } from '../lib/api'
import type { Application, ClarifyingQuestion, ResumeEdit, Resume } from '../types'

interface Props {
  application: Application
  resumes: Resume[]
  onVersionSaved: (r: Resume) => void
}

type Decision = 'accept' | 'reject' | 'pending'

type Phase =
  | { type: 'idle' }
  | { type: 'loading_questions' }
  | { type: 'questioning'; questions: ClarifyingQuestion[]; answers: Record<string, string> }
  | { type: 'loading_analysis' }
  | { type: 'reviewing'; edits: ResumeEdit[]; decisions: Record<string, Decision> }
  | { type: 'saving' }
  | { type: 'error'; message: string }

export default function JobResumeEditorPanel({ application, resumes, onVersionSaved }: Props) {
  // Mirror the backend fallback: prefer resume linked to application, then active resume
  const linkedResume = application.resume_id ? resumes.find((r) => r.id === application.resume_id) ?? null : null
  const activeResume = resumes.find((r) => r.is_active) ?? null
  const resume = linkedResume ?? activeResume
  const [phase, setPhase] = useState<Phase>({ type: 'idle' })

  const handleAnalyze = async () => {
    if (!application.job_description) return
    setPhase({ type: 'loading_questions' })
    try {
      const { questions } = await getClarifyingQuestions(application.id)
      const answers: Record<string, string> = {}
      questions.forEach((q) => { answers[q.id] = '' })
      setPhase({ type: 'questioning', questions, answers })
    } catch (e) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Failed to load questions' })
    }
  }

  const handleContinueWithAnswers = async (questions: ClarifyingQuestion[], answers: Record<string, string>) => {
    setPhase({ type: 'loading_analysis' })
    const userContext = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => `Q: ${q.question}\nA: ${answers[q.id].trim()}`)
      .join('\n\n')
    try {
      const { edits } = await getJobResumeEdits(application.id, userContext || undefined)
      const decisions: Record<string, Decision> = {}
      edits.forEach((e) => { decisions[e.id] = 'pending' })
      setPhase({ type: 'reviewing', edits, decisions })
    } catch (e) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Analysis failed' })
    }
  }

  const setDecision = (editId: string, decision: Decision) => {
    if (phase.type !== 'reviewing') return
    setPhase({ ...phase, decisions: { ...phase.decisions, [editId]: decision } })
  }

  const handleSave = async () => {
    if (phase.type !== 'reviewing') return
    const { edits, decisions } = phase

    setPhase({ type: 'saving' })
    try {
      // Resolve resume: linked to application → active in store → fetch from API
      let resumeId = resume?.id
      let resumeLabel = resume?.label ?? 'Resume'

      if (!resumeId) {
        const { resumes: fetched } = await getResumes()
        const found = fetched.find((r) => r.id === application.resume_id) ?? fetched.find((r) => r.is_active)
        if (!found) {
          setPhase({ type: 'error', message: 'No resume found — upload a resume and link it to this application.' })
          return
        }
        resumeId = found.id
        resumeLabel = found.label
      }

      const full = await getResume(resumeId)
      if (!full.raw_text) {
        setPhase({ type: 'error', message: 'Resume has no extracted text — re-upload the file.' })
        return
      }

      let editedText = full.raw_text
      for (const edit of edits) {
        if (decisions[edit.id] === 'accept' && editedText.includes(edit.original)) {
          editedText = editedText.replace(edit.original, edit.replacement)
        }
      }

      const label = `${resumeLabel} — ${application.company} (${application.role})`
      const newResume = await saveResumeVersion(resumeId, editedText, label)
      onVersionSaved(newResume)
      setPhase({ type: 'idle' })
    } catch (e) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Save failed' })
    }
  }

  const acceptedCount = phase.type === 'reviewing'
    ? Object.values(phase.decisions).filter((d) => d === 'accept').length
    : 0

  const pendingCount = phase.type === 'reviewing'
    ? Object.values(phase.decisions).filter((d) => d === 'pending').length
    : 0

  if (!application.job_description) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 text-sm text-center">
          Add a job description to this application to get tailored resume edits.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-900">
        <div>
          <p className="text-xs font-semibold text-white">Tailored Resume Edits</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            AI suggestions targeting {application.role} at {application.company}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {phase.type === 'reviewing' && (
            <>
              <span className="text-xs text-gray-400">
                {acceptedCount} accepted
                {pendingCount > 0 && <span className="text-yellow-500 ml-1">· {pendingCount} pending</span>}
              </span>
              <button
                onClick={handleSave}
                disabled={acceptedCount === 0}
                className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
              >
                {resume ? `Save as v${resume.version + 1}` : 'Save as new version'}
              </button>
            </>
          )}
          {phase.type !== 'questioning' && (
            <button
              onClick={handleAnalyze}
              disabled={phase.type === 'loading_questions' || phase.type === 'loading_analysis' || phase.type === 'saving'}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
            >
              {phase.type === 'loading_questions' ? 'Loading…'
                : phase.type === 'loading_analysis' ? 'Analyzing…'
                : phase.type === 'reviewing' ? 'Re-analyze'
                : 'Analyze Resume'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {phase.type === 'idle' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-500 text-sm text-center">
            Click <span className="text-gray-300">Analyze Resume</span> to get targeted edits for this role.
          </p>
        </div>
      )}

      {phase.type === 'loading_questions' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-indigo-400 text-sm animate-pulse">Generating clarifying questions…</span>
        </div>
      )}

      {phase.type === 'loading_analysis' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-indigo-400 text-sm animate-pulse">Analyzing resume against job description…</span>
        </div>
      )}

      {phase.type === 'questioning' && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Answer any of the questions below to give the AI verified details about your experience.
            Your answers will be used as facts — unanswered questions are simply skipped.
          </p>
          {phase.questions.map((q, idx) => (
            <div key={q.id} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-200">
                {idx + 1}. {q.question}
              </label>
              <p className="text-[11px] text-gray-500 italic">{q.context}</p>
              <textarea
                rows={2}
                value={phase.answers[q.id] ?? ''}
                onChange={(e) => {
                  if (phase.type !== 'questioning') return
                  setPhase({ ...phase, answers: { ...phase.answers, [q.id]: e.target.value } })
                }}
                placeholder="Your answer (optional — leave blank to skip)"
                className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleContinueWithAnswers(phase.questions, phase.answers)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded transition-colors"
            >
              Continue to Analysis
            </button>
            <button
              onClick={() => setPhase({ type: 'idle' })}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.type === 'saving' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Saving new version…</span>
        </div>
      )}

      {phase.type === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <p className="text-red-400 text-sm text-center">{phase.message}</p>
          <button onClick={handleAnalyze} className="text-xs text-indigo-400 hover:text-indigo-300 underline">
            Retry
          </button>
        </div>
      )}

      {phase.type === 'reviewing' && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 p-3">
          {phase.edits.map((edit, idx) => (
            <EditCard
              key={edit.id}
              index={idx + 1}
              edit={edit}
              decision={phase.decisions[edit.id] ?? 'pending'}
              onDecide={(d) => setDecision(edit.id, d)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface EditCardProps {
  index: number
  edit: ResumeEdit
  decision: Decision
  onDecide: (d: Decision) => void
}

function EditCard({ index, edit, decision, onDecide }: EditCardProps) {
  return (
    <div
      className={[
        'rounded border p-3 flex flex-col gap-2 text-xs transition-all',
        decision === 'accept'
          ? 'border-green-700 bg-green-950/40'
          : decision === 'reject'
          ? 'border-gray-700 bg-gray-800/20 opacity-50'
          : 'border-gray-600 bg-gray-800/40',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-600 font-mono text-[10px]">#{index}</span>
        <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] flex-1 truncate">
          {edit.section}
        </span>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onDecide(decision === 'accept' ? 'pending' : 'accept')}
            className={[
              'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
              decision === 'accept'
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-green-800 hover:text-white',
            ].join(' ')}
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onDecide(decision === 'reject' ? 'pending' : 'reject')}
            className={[
              'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
              decision === 'reject'
                ? 'bg-gray-600 text-gray-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            ].join(' ')}
          >
            ✗ Reject
          </button>
        </div>
      </div>

      <div className="rounded px-2.5 py-2 bg-red-950/50 border border-red-900/60 text-red-300 leading-relaxed line-through decoration-red-600/60">
        {edit.original}
      </div>

      <div className="rounded px-2.5 py-2 bg-green-950/50 border border-green-900/60 text-green-300 leading-relaxed">
        {edit.replacement}
      </div>

      <p className="text-gray-500 text-[11px] leading-relaxed">{edit.reason}</p>
    </div>
  )
}
