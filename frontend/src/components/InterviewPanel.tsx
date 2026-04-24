import { useState, useEffect } from 'react'
import { getQuestions, generateQuestions, deleteQuestion } from '../lib/api'
import AnswerEditor from './AnswerEditor'
import type { Application, InterviewAnswer, InterviewQuestion } from '../types'

const TYPE_COLORS: Record<string, string> = {
  behavioral: 'text-blue-400 bg-blue-400/10',
  technical: 'text-purple-400 bg-purple-400/10',
  situational: 'text-yellow-400 bg-yellow-400/10',
  coding: 'text-green-400 bg-green-400/10',
}

const DIFF_COLORS: Record<string, string> = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
}

interface Props {
  application: Application
}

export default function InterviewPanel({ application }: Props) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genTypes, setGenTypes] = useState<string[]>(['behavioral', 'technical', 'situational', 'coding'])
  const [genCount, setGenCount] = useState(5)
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    getQuestions(application.id).then((r) => setQuestions(r.questions)).catch(() => {})
  }, [application.id])

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const result = await generateQuestions({
        application_id: application.id,
        types: genTypes,
        count: genCount,
      })
      setQuestions((prev) => [...prev, ...result.questions])
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (qId: string) => {
    try {
      await deleteQuestion(application.id, qId)
      setQuestions((prev) => prev.filter((q) => q.id !== qId))
      if (expandedId === qId) setExpandedId(null)
    } catch {
      // ignore delete errors
    }
  }

  const handleAnswerChange = (questionId: string, answer: InterviewAnswer) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, answers: (q.answers ?? []).some((a) => a.id === answer.id)
              ? (q.answers ?? []).map((a) => (a.id === answer.id ? answer : a))
              : [...(q.answers ?? []), answer] }
          : q
      )
    )
  }

  const toggleType = (t: string) =>
    setGenTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])

  const filtered = typeFilter ? questions.filter((q) => q.type === typeFilter) : questions

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3">
      {/* Generate controls */}
      <div className="shrink-0 bg-gray-800/50 border border-gray-700 rounded p-3 flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Generate Questions
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(['behavioral', 'technical', 'situational', 'coding'] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={[
                'text-xs px-2 py-0.5 rounded-full border transition-colors',
                genTypes.includes(t)
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Count:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={genCount}
            onChange={(e) => setGenCount(Number(e.target.value))}
            className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || genTypes.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>
        {genError && <p className="text-xs text-red-400">{genError}</p>}
      </div>

      {/* Filter */}
      {questions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">Filter:</span>
          {(['', 'behavioral', 'technical', 'situational', 'coding'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={[
                'text-xs px-2 py-0.5 rounded-full transition-colors',
                typeFilter === t
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              {t === '' ? 'All' : t}
            </button>
          ))}
        </div>
      )}

      {/* Question list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">
            No questions yet. Generate some above or add manually.
          </p>
        )}
        {filtered.map((q) => (
          <div key={q.id} className="bg-gray-800 border border-gray-700 rounded p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[q.type] ?? ''}`}>
                    {q.type}
                  </span>
                  {q.difficulty && (
                    <span className={`text-xs ${DIFF_COLORS[q.difficulty] ?? 'text-gray-400'}`}>
                      {q.difficulty}
                    </span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">
                    {q.generated_by === 'ai' ? '✦ AI' : 'manual'}
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-snug">{q.question}</p>
              </div>
              <button
                onClick={() => handleDelete(q.id)}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expandedId === q.id ? '▲ Hide answer' : `▼ ${(q.answers ?? []).length > 0 ? 'Edit' : 'Add'} answer`}
            </button>

            {expandedId === q.id && (
              <AnswerEditor
                question={q}
                application={application}
                onAnswerChange={handleAnswerChange}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
