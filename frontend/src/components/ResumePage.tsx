import { useState } from 'react'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import { uploadResume, deleteResume, activateResume, reviewResume, downloadResume } from '../lib/api'
import type { Resume, ResumeReviewResult } from '../types'
import ResumeEditorPanel from './ResumeEditorPanel'

export default function ResumePage() {
  const { resumes, upsertResume, removeResume } = useJobSearchStore()
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [review, setReview] = useState<ResumeReviewResult | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadResume(file, label || undefined)
      upsertResume(res)
      setSelectedId(res.id)
      setLabel('')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleActivate = async (id: string) => {
    const res = await activateResume(id)
    // Deactivate all others in store
    useJobSearchStore.getState().resumes.forEach((r) => {
      if (r.id !== id) upsertResume({ ...r, is_active: false })
    })
    upsertResume(res)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resume?')) return
    await deleteResume(id)
    removeResume(id)
    if (selectedId === id) { setSelectedId(null); setEditorOpen(false) }
  }

  const handleVersionSaved = (newResume: Resume) => {
    upsertResume(newResume)
    setSelectedId(newResume.id)
    setEditorOpen(false)
  }

  const handleDownload = async (res: Resume) => {
    const filename = `${res.label}_v${res.version}`
    await downloadResume(res.id, filename)
  }

  const handleReview = async () => {
    if (!selectedId) return
    setLoadingReview(true)
    setReview(null)
    try {
      const result = await reviewResume(selectedId)
      setReview(result)
    } finally {
      setLoadingReview(false)
    }
  }

  const selected = resumes.find((r) => r.id === selectedId)

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900 p-3 gap-3">
        <h2 className="text-sm font-semibold text-gray-300">Resumes</h2>

        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <label className={[
            'cursor-pointer text-center text-xs py-1.5 rounded transition-colors',
            uploading
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white',
          ].join(' ')}>
            {uploading ? 'Uploading…' : '+ Upload .docx'}
            <input
              type="file"
              accept=".docx"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {resumes.map((res) => (
            <div
              key={res.id}
              onClick={() => { setSelectedId(res.id); setReview(null) }}
              className={[
                'p-2 rounded cursor-pointer border transition-colors',
                selectedId === res.id
                  ? 'border-indigo-500 bg-gray-800'
                  : 'border-gray-700 hover:border-gray-600',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                {res.is_active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                )}
                <span className="text-xs text-gray-200 truncate">{res.label}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">v{res.version}</div>
              <div className="flex gap-2 mt-1">
                {!res.is_active && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleActivate(res.id) }}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Set active
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(res) }}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Download
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(res.id) }}
                  className="text-xs text-gray-600 hover:text-red-400 ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {resumes.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">No resumes uploaded.</p>
          )}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selected && (
          <p className="text-gray-600 text-sm text-center mt-20">Select a resume to analyze.</p>
        )}

        {selected && editorOpen && (
          <ResumeEditorPanel
            resume={selected}
            onVersionSaved={handleVersionSaved}
            onClose={() => setEditorOpen(false)}
          />
        )}

        {selected && !editorOpen && (
          <div className="overflow-y-auto p-5 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">{selected.label}</h2>
              <span className="text-xs text-gray-500">v{selected.version}</span>
              {selected.is_active && (
                <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Active</span>
              )}
              <button
                onClick={() => handleDownload(selected)}
                className="ml-auto text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition-colors"
              >
                Download
              </button>
              <button
                onClick={() => setEditorOpen(true)}
                className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded transition-colors"
              >
                Edit with AI
              </button>
            </div>

            {/* ATS Review */}
            <div className="bg-gray-800/50 border border-gray-700 rounded p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">ATS Review</h3>
                <button
                  onClick={handleReview}
                  disabled={loadingReview}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                >
                  {loadingReview ? 'Analyzing…' : 'Analyze with AI'}
                </button>
              </div>
              {review && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-indigo-400">{review.ats_score}</span>
                    <span className="text-gray-400 text-sm">/ 100 ATS Score</span>
                  </div>
                  <p className="text-sm text-gray-300">{review.summary}</p>
                  {review.issues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-400 mb-1">Issues</p>
                      <ul className="space-y-1">
                        {review.issues.map((i, idx) => (
                          <li key={idx} className="text-xs text-gray-300 flex gap-2">
                            <span className="text-red-400 shrink-0">✗</span>{i}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {review.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-400 mb-1">Suggestions</p>
                      <ul className="space-y-1">
                        {review.suggestions.map((s, idx) => (
                          <li key={idx} className="text-xs text-gray-300 flex gap-2">
                            <span className="text-green-400 shrink-0">→</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {review.keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-1">Key Terms Found</p>
                      <div className="flex flex-wrap gap-1">
                        {review.keywords.map((k, idx) => (
                          <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
