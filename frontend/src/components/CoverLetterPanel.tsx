import { useState } from 'react'
import { generateCoverLetter, updateApplication } from '../lib/api'
import type { Application } from '../types'

interface Props {
  application: Application
  onUpdate: (app: Application) => void
}

export default function CoverLetterPanel({ application, onUpdate }: Props) {
  const [companyInfo, setCompanyInfo] = useState('')
  const [text, setText] = useState(application.cover_letter ?? '')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleGenerate = async () => {
    if (!application.job_description) {
      setError('Add a job description to this application before generating.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const { cover_letter } = await generateCoverLetter(application.id, companyInfo || undefined)
      setText(cover_letter)
      setSaved(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateApplication(application.id, { cover_letter: text })
      onUpdate(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = text !== (application.cover_letter ?? '')

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          Company context <span className="text-gray-600">(optional — helps personalize the letter)</span>
        </label>
        <textarea
          rows={2}
          placeholder="e.g. Series B startup building dev tools, known for strong eng culture…"
          value={companyInfo}
          onChange={(e) => setCompanyInfo(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="self-start bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 rounded transition-colors"
      >
        {generating ? 'Generating…' : text ? 'Regenerate' : 'Generate Cover Letter'}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex-1 flex flex-col gap-1 min-h-0">
        <label className="text-xs text-gray-400">Cover letter</label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false) }}
          placeholder="Generated cover letter will appear here. You can edit it freely before saving."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-sans leading-relaxed"
          style={{ minHeight: '280px' }}
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-600">{text.length} chars</span>
          <div className="flex items-center gap-2">
            {saved && !isDirty && (
              <span className="text-xs text-green-500">Saved</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || text === ''}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
