import { useState } from 'react'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import { scoreFit } from '../lib/api'
import type { FitScoreResult } from '../types'

export default function DiscoverPage() {
  const { resumes } = useJobSearchStore()
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    resumes.find((r) => r.is_active)?.id ?? resumes[0]?.id ?? ''
  )
  const [jd, setJD] = useState('')
  const [result, setResult] = useState<FitScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScore = async () => {
    if (!selectedResumeId || !jd.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await scoreFit(selectedResumeId, jd)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor =
    result
      ? result.score >= 75
        ? 'text-green-400'
        : result.score >= 50
        ? 'text-yellow-400'
        : 'text-red-400'
      : ''

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Job Fit Scorer</h2>
      <p className="text-sm text-gray-400 mb-5">
        Paste a job description and score how well your resume matches it.
      </p>

      {resumes.length === 0 ? (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded p-4 text-sm text-yellow-300">
          Upload a resume first on the Resume tab.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Resume</label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} (v{r.version}){r.is_active ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Job Description</label>
            <textarea
              rows={8}
              placeholder="Paste the full job description here…"
              value={jd}
              onChange={(e) => setJD(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <button
            onClick={handleScore}
            disabled={loading || !jd.trim() || !selectedResumeId}
            className="self-start bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            {loading ? 'Scoring…' : 'Score Fit with AI'}
          </button>

          {error && (
            <div className="bg-red-400/10 border border-red-400/30 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-gray-800/50 border border-gray-700 rounded p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className={`text-5xl font-bold ${scoreColor}`}>{result.score}</span>
                <div>
                  <div className="text-sm text-gray-400">out of 100</div>
                  <div className={`text-sm font-medium ${scoreColor}`}>
                    {result.score >= 75 ? 'Strong match' : result.score >= 50 ? 'Moderate match' : 'Weak match'}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed">{result.reasoning}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-green-400 mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-green-400 shrink-0">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-2">Gaps</p>
                  <ul className="space-y-1.5">
                    {result.gaps.map((g, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-red-400 shrink-0">✗</span>{g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
