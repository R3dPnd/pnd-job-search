import { useState, useEffect } from 'react'
import { deleteApplication, updateApplication } from '../lib/api'
import PipelineEditor from './PipelineEditor'
import StageAdvancer from './StageAdvancer'
import NotesPanel from './NotesPanel'
import InterviewPanel from './InterviewPanel'
import ResumeFitPanel from './ResumeFitPanel'
import CoverLetterPanel from './CoverLetterPanel'
import JobResumeEditorPanel from './JobResumeEditorPanel'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import type { Application } from '../types'

type Panel = 'pipeline' | 'notes' | 'interview' | 'resume' | 'cover-letter' | 'tailored-edits'

interface Props {
  application: Application
  onUpdate: (app: Application) => void
  onDelete: () => void
}

export default function ApplicationDetail({ application, onUpdate, onDelete }: Props) {
  const { resumes, upsertResume } = useJobSearchStore()

  const [panel, setPanel] = useState<Panel>('pipeline')
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({
    job_url: application.job_url ?? '',
    job_description: application.job_description ?? '',
    date_applied: application.date_applied ?? '',
    source: application.source ?? '',
  })

  useEffect(() => {
    setEditFields({
      job_url: application.job_url ?? '',
      job_description: application.job_description ?? '',
      date_applied: application.date_applied ?? '',
      source: application.source ?? '',
    })
    setEditing(false)
  }, [application.id])

  const saveEdit = async () => {
    const updated = await updateApplication(application.id, {
      job_url: editFields.job_url || undefined,
      job_description: editFields.job_description || undefined,
      date_applied: editFields.date_applied || undefined,
      source: editFields.source || undefined,
    })
    onUpdate(updated)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${application.company} — ${application.role}?`)) return
    await deleteApplication(application.id)
    onDelete()
  }

  const handleStatusChange = async (status: string) => {
    const updated = await updateApplication(application.id, { status: status as Application['status'] })
    onUpdate(updated)
  }

  const PANELS: { id: Panel; label: string }[] = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'notes', label: 'Notes' },
    { id: 'interview', label: 'Interview Prep' },
    { id: 'resume', label: 'Resume Fit' },
    { id: 'cover-letter', label: 'Cover Letter' },
    { id: 'tailored-edits', label: 'Tailored Edits' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{application.company}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{application.role}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={application.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Edit fields */}
        {editing && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Job URL"
              value={editFields.job_url}
              onChange={(e) => setEditFields({ ...editFields, job_url: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Date applied (YYYY-MM-DD)"
              value={editFields.date_applied}
              onChange={(e) => setEditFields({ ...editFields, date_applied: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Source (LinkedIn, referral…)"
              value={editFields.source}
              onChange={(e) => setEditFields({ ...editFields, source: e.target.value })}
              className="col-span-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Job description"
              rows={4}
              value={editFields.job_description}
              onChange={(e) => setEditFields({ ...editFields, job_description: e.target.value })}
              className="col-span-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={saveEdit}
              className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 rounded transition-colors"
            >
              Save
            </button>
          </div>
        )}

        {/* Info row */}
        {!editing && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {application.date_applied && <span>Applied: {application.date_applied}</span>}
              {application.source && <span>via {application.source}</span>}
              {application.job_url && (
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  Job posting ↗
                </a>
              )}
            </div>
            {application.job_description && (
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer select-none hover:text-gray-300 transition-colors">
                  Job description
                </summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans bg-gray-800 rounded p-2 text-gray-300 max-h-48 overflow-y-auto">
                  {application.job_description}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Stage advancer */}
        <div className="mt-3">
          <StageAdvancer application={application} onUpdate={onUpdate} />
        </div>

        {/* Sub-panel tabs */}
        <div className="flex gap-1 mt-3">
          {PANELS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPanel(p.id)}
              className={[
                'px-3 py-1 text-xs rounded transition-colors',
                panel === p.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {panel === 'pipeline' && (
          <PipelineEditor application={application} onUpdate={onUpdate} />
        )}
        {panel === 'notes' && <NotesPanel application={application} />}
        {panel === 'interview' && <InterviewPanel application={application} />}
        {panel === 'resume' && <ResumeFitPanel key={application.id} application={application} onUpdate={onUpdate} />}
        {panel === 'cover-letter' && <CoverLetterPanel key={application.id} application={application} onUpdate={onUpdate} />}
        {panel === 'tailored-edits' && (
          <JobResumeEditorPanel
            key={application.id}
            application={application}
            resumes={resumes}
            onVersionSaved={(r) => { upsertResume(r) }}
          />
        )}
      </div>
    </div>
  )
}
