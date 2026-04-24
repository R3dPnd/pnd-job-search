import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { go } from '@codemirror/lang-go'
import { createAnswer, updateAnswer, getAnswerFeedback } from '../lib/api'
import AIFeedbackPanel from './AIFeedbackPanel'
import type { Application, InterviewAnswer, InterviewQuestion } from '../types'

const LANGUAGE_EXTENSIONS: Record<string, ReturnType<typeof javascript>> = {
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  python: python(),
  go: go(),
}

interface Props {
  question: InterviewQuestion
  application: Application
  onAnswerChange: (questionId: string, answer: InterviewAnswer) => void
}

export default function AnswerEditor({ question, application, onAnswerChange }: Props) {
  const existing = question.answers?.[0] ?? null
  const [content, setContent] = useState(existing?.content ?? '')
  const [codeContent, setCodeContent] = useState(existing?.code_content ?? '')
  const [language, setLanguage] = useState(existing?.language ?? 'javascript')
  const [answer, setAnswer] = useState<InterviewAnswer | null>(existing)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  const isCoding = question.type === 'coding'

  const handleSave = async () => {
    setLoading(true)
    setSaveError(null)
    try {
      let saved: InterviewAnswer
      if (answer) {
        saved = await updateAnswer(application.id, question.id, answer.id, {
          content,
          code_content: isCoding ? codeContent : null,
          language: isCoding ? language : null,
        })
      } else {
        saved = await createAnswer(application.id, question.id, {
          content,
          code_content: isCoding ? codeContent : null,
          language: isCoding ? language : null,
        })
      }
      setAnswer(saved)
      onAnswerChange(question.id, saved)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGetFeedback = async () => {
    if (!answer) return
    setFeedbackLoading(true)
    setFeedbackError(null)
    try {
      const updated = await getAnswerFeedback(answer.id)
      setAnswer(updated)
      onAnswerChange(question.id, updated)
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Feedback failed')
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {isCoding && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
          >
            {Object.keys(LANGUAGE_EXTENSIONS).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {isCoding && (
        <div className="border border-gray-700 rounded overflow-hidden">
          <CodeMirror
            value={codeContent}
            onChange={setCodeContent}
            theme={oneDark}
            extensions={[LANGUAGE_EXTENSIONS[language] ?? javascript()]}
            height="200px"
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </div>
      )}

      <textarea
        rows={isCoding ? 2 : 4}
        placeholder={isCoding ? 'Explain your approach…' : 'Your answer…'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
        >
          {loading ? 'Saving…' : answer ? 'Update Answer' : 'Save Answer'}
        </button>
        {answer && (
          <button
            onClick={handleGetFeedback}
            disabled={feedbackLoading}
            className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded transition-colors"
          >
            {feedbackLoading ? 'Getting feedback…' : 'Get AI Feedback'}
          </button>
        )}
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
      {feedbackError && <p className="text-xs text-red-400">{feedbackError}</p>}
      {answer && <AIFeedbackPanel answer={answer} />}
    </div>
  )
}
