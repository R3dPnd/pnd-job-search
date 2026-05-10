import { useState } from 'react'
import { generateCoverLetter, getClarifyingQuestions, updateApplication } from '../lib/api'
import type { Application, ClarifyingQuestion } from '../types'

interface Props {
  application: Application
  onUpdate: (app: Application) => void
}

type Step = 'compose' | 'loading_questions' | 'questioning' | 'generating'

export default function CoverLetterPanel({ application, onUpdate }: Props) {
  const [companyInfo, setCompanyInfo] = useState('')
  const [text, setText] = useState(application.cover_letter ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [step, setStep] = useState<Step>('compose')
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const handleStartGenerate = async () => {
    if (!application.job_description) {
      setError('Add a job description to this application before generating.')
      return
    }
    setError(null)
    setStep('loading_questions')
    try {
      const { questions: qs } = await getClarifyingQuestions(application.id)
      const initial: Record<string, string> = {}
      qs.forEach((q) => { initial[q.id] = '' })
      setQuestions(qs)
      setAnswers(initial)
      setStep('questioning')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions')
      setStep('compose')
    }
  }

  const handleGenerate = async (userAnswers: Record<string, string>) => {
    setStep('generating')
    const userContext = questions
      .filter((q) => userAnswers[q.id]?.trim())
      .map((q) => `Q: ${q.question}\nA: ${userAnswers[q.id].trim()}`)
      .join('\n\n')
    try {
      const { cover_letter } = await generateCoverLetter(
        application.id,
        companyInfo || undefined,
        userContext || undefined,
      )
      setText(cover_letter)
      onUpdate({ ...application, cover_letter })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setStep('compose')
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

  if (step === 'loading_questions') {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-indigo-400 text-sm animate-pulse">Generating clarifying questions…</span>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-indigo-400 text-sm animate-pulse">Writing cover letter…</span>
      </div>
    )
  }

  if (step === 'questioning') {
    return (
      <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
        <div>
          <p className="text-xs font-semibold text-white mb-1">A few quick questions</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Answer any of the questions below to give the AI verified details about your experience.
            Your answers will be used as facts in the cover letter — unanswered questions are skipped.
          </p>
        </div>
        {questions.map((q, idx) => (
          <div key={q.id} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-200">
              {idx + 1}. {q.question}
            </label>
            <p className="text-[11px] text-gray-500 italic">{q.context}</p>
            <textarea
              rows={2}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Your answer (optional — leave blank to skip)"
              className="bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleGenerate(answers)}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded transition-colors"
          >
            Generate Cover Letter
          </button>
          <button
            onClick={() => setStep('compose')}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

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
        onClick={handleStartGenerate}
        className="self-start bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
      >
        {text ? 'Regenerate' : 'Generate Cover Letter'}
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
