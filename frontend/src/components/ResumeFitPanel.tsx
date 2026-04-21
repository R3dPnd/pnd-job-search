import { useState } from 'react'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import { updateApplication, compareResumeToApplication } from '../lib/api'
import type { Application, CompareResult } from '../types'

interface Props {
  application: Application
  onUpdate: (app: Application) => void
}

export default function ResumeFitPanel({ application, onUpdate }: Props) {
  const { resumes } = useJobSearchStore()
  const [selectedResumeId, setSelectedResumeId] = useState<string>(application.resume_id ?? '')
  const [linking, setLinking] = useState(false)
  const [compare, setCompare] = useState<CompareResult | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)

  const linkedResume = resumes.find((r) => r.id === application.resume_id)
  const hasJD = !!application.job_description

  const handleLink = async () => {
    if (!selectedResumeId) return
    setLinking(true)
    try {
      const updated = await updateApplication(application.id, { resume_id: selectedResumeId })
      onUpdate(updated)
    } finally {
      setLinking(false)
    }
  }

  const handleCompare = async () => {
    if (!application.resume_id || !hasJD) return
    setLoadingCompare(true)
    setCompare(null)
    try {
      const result = await compareResumeToApplication(application.id, application.resume_id)
      setCompare(result)
    } finally {
      setLoadingCompare(false)
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      {/* Resume selector */}
      <div className="bg-gray-800/50 border border-gray-700 rounded p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-300">Linked Resume</h3>

        {resumes.length === 0 ? (
          <p className="text-xs text-gray-500">No resumes uploaded. Upload one in the Resume tab.</p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— select a resume —</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} v{r.version}{r.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleLink}
              disabled={linking || !selectedResumeId || selectedResumeId === application.resume_id}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors shrink-0"
            >
              {linking ? 'Saving…' : 'Link'}
            </button>
          </div>
        )}

        {linkedResume && (
          <p className="text-xs text-gray-400">
            Currently linked: <span className="text-indigo-400">{linkedResume.label} v{linkedResume.version}</span>
          </p>
        )}
      </div>

      {/* Compare */}
      <div className="bg-gray-800/50 border border-gray-700 rounded p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Resume Fit Analysis</h3>
          <button
            onClick={handleCompare}
            disabled={loadingCompare || !application.resume_id || !hasJD}
            title={!hasJD ? 'Add a job description to this application first' : !application.resume_id ? 'Link a resume first' : ''}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
          >
            {loadingCompare ? 'Analyzing…' : 'Compare with AI'}
          </button>
        </div>

        {!application.resume_id && (
          <p className="text-xs text-gray-500">Link a resume above to enable comparison.</p>
        )}
        {application.resume_id && !hasJD && (
          <p className="text-xs text-gray-500">Add a job description to this application (via Edit) to enable comparison.</p>
        )}

        {compare && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-indigo-400">{compare.match_score}</span>
              <span className="text-gray-400 text-sm">/ 100 Match Score</span>
            </div>
            <p className="text-sm text-gray-300">{compare.summary}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-green-400 mb-1">Strengths</p>
                <ul className="space-y-1">
                  {compare.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                      <span className="text-green-400 shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1">Gaps</p>
                <ul className="space-y-1">
                  {compare.gaps.map((g, i) => (
                    <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                      <span className="text-red-400 shrink-0">✗</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {compare.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-1">Suggestions</p>
                <ul className="space-y-1">
                  {compare.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                      <span className="text-yellow-400 shrink-0">→</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
