import { useState, useEffect, useCallback } from 'react'
import type { Resume, ResumeEdit } from '../types'
import { fetchResumeBuffer, suggestResumeEdits, saveResumeVersion, getResume } from '../lib/api'

export interface ResumeEditorPanelProps {
  resume: Resume
  onVersionSaved: (newResume: Resume) => void
  onClose: () => void
}

type Decision = 'accept' | 'reject' | 'pending'

type Phase =
  | { type: 'loading-doc' }
  | { type: 'loaded'; html: string; rawText: string }
  | { type: 'suggesting'; html: string; rawText: string }
  | { type: 'reviewing'; html: string; rawText: string; edits: ResumeEdit[]; decisions: Record<string, Decision> }
  | { type: 'saving' }
  | { type: 'error'; message: string }

export default function ResumeEditorPanel({ resume, onVersionSaved, onClose }: ResumeEditorPanelProps) {
  const [phase, setPhase] = useState<Phase>({ type: 'loading-doc' })

  const loadDoc = useCallback(async () => {
    setPhase({ type: 'loading-doc' })
    try {
      const [buffer, full] = await Promise.all([
        fetchResumeBuffer(resume.id),
        getResume(resume.id),
      ])
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
      setPhase({ type: 'loaded', html: result.value, rawText: full.raw_text ?? '' })
    } catch (e: unknown) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Failed to load document' })
    }
  }, [resume.id])

  useEffect(() => { loadDoc() }, [loadDoc])

  async function handleSuggest() {
    if (phase.type !== 'loaded') return
    const { html, rawText } = phase
    setPhase({ type: 'suggesting', html, rawText })
    try {
      const { edits } = await suggestResumeEdits(resume.id)
      const decisions: Record<string, Decision> = {}
      edits.forEach((e) => { decisions[e.id] = 'pending' })
      setPhase({ type: 'reviewing', html, rawText, edits, decisions })
    } catch (e: unknown) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Failed to get suggestions' })
    }
  }

  function setDecision(editId: string, decision: Decision) {
    if (phase.type !== 'reviewing') return
    setPhase({ ...phase, decisions: { ...phase.decisions, [editId]: decision } })
  }

  async function handleSave() {
    if (phase.type !== 'reviewing') return
    const { rawText, edits, decisions } = phase

    let editedText = rawText
    for (const edit of edits) {
      if (decisions[edit.id] === 'accept' && edit.original && editedText.includes(edit.original)) {
        editedText = editedText.replace(edit.original, edit.replacement)
      }
    }

    setPhase({ type: 'saving' })
    try {
      const newResume = await saveResumeVersion(resume.id, editedText)
      onVersionSaved(newResume)
    } catch (e: unknown) {
      setPhase({ type: 'error', message: e instanceof Error ? e.message : 'Failed to save version' })
    }
  }

  const acceptedCount =
    phase.type === 'reviewing'
      ? Object.values(phase.decisions).filter((d) => d === 'accept').length
      : 0

  const pendingCount =
    phase.type === 'reviewing'
      ? Object.values(phase.decisions).filter((d) => d === 'pending').length
      : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700 shrink-0 bg-gray-900">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-xs flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-600">|</span>
        <h2 className="text-sm font-semibold text-white flex-1 truncate">
          {resume.label}
          <span className="text-gray-500 font-normal ml-2">AI Editor</span>
        </h2>

        {phase.type === 'loaded' && (
          <button
            onClick={handleSuggest}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors"
          >
            Suggest Edits
          </button>
        )}

        {phase.type === 'suggesting' && (
          <span className="text-xs text-indigo-400 animate-pulse">Analyzing…</span>
        )}

        {phase.type === 'reviewing' && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {acceptedCount} accepted
              {pendingCount > 0 && <span className="text-yellow-500 ml-1">· {pendingCount} pending</span>}
            </span>
            <button
              onClick={handleSave}
              disabled={acceptedCount === 0}
              className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
            >
              Save as v{resume.version + 1}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {phase.type === 'loading-doc' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Loading document…</span>
        </div>
      )}

      {phase.type === 'saving' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Saving new version…</span>
        </div>
      )}

      {phase.type === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <p className="text-red-400 text-sm text-center">{phase.message}</p>
          <button
            onClick={loadDoc}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {(phase.type === 'loaded' || phase.type === 'suggesting') && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {phase.type === 'suggesting' && (
            <div className="bg-indigo-950/60 border-b border-indigo-800 px-4 py-2 shrink-0">
              <span className="text-xs text-indigo-300">AI is analyzing your resume and generating suggestions…</span>
            </div>
          )}
          <div
            className="resume-preview flex-1 p-6"
            dangerouslySetInnerHTML={{ __html: phase.html }}
          />
        </div>
      )}

      {phase.type === 'reviewing' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Document preview */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-700">
            <div
              className="resume-preview"
              dangerouslySetInnerHTML={{ __html: phase.html }}
            />
          </div>

          {/* Edit review panel */}
          <div className="w-[380px] shrink-0 flex flex-col overflow-hidden bg-gray-900">
            <div className="px-4 py-2.5 border-b border-gray-700 shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {phase.edits.length} Suggested Edits
              </p>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 p-3">
              {phase.edits.map((edit, idx) => (
                <EditCard
                  key={edit.id}
                  index={idx + 1}
                  edit={edit}
                  decision={phase.decisions[edit.id] ?? 'pending'}
                  onDecide={(d) => setDecision(edit.id, d)}
                  matchFound={phase.rawText.includes(edit.original)}
                />
              ))}
            </div>
          </div>
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
  matchFound: boolean
}

function EditCard({ index, edit, decision, onDecide, matchFound }: EditCardProps) {
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
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600 font-mono text-[10px]">#{index}</span>
        <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] flex-1 truncate">
          {edit.section}
        </span>
        {!matchFound && (
          <span className="text-yellow-600 text-[10px]" title="Original text not found in document">⚠ no match</span>
        )}
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

      {/* Original */}
      <div className="rounded px-2.5 py-2 bg-red-950/50 border border-red-900/60 text-red-300 leading-relaxed line-through decoration-red-600/60">
        {edit.original}
      </div>

      {/* Replacement */}
      <div className="rounded px-2.5 py-2 bg-green-950/50 border border-green-900/60 text-green-300 leading-relaxed">
        {edit.replacement}
      </div>

      {/* Reason */}
      <p className="text-gray-500 text-[11px] leading-relaxed">{edit.reason}</p>
    </div>
  )
}
