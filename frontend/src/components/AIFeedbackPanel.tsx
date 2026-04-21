import type { InterviewAnswer } from '../types'

interface Props {
  answer: InterviewAnswer
}

export default function AIFeedbackPanel({ answer }: Props) {
  if (!answer.ai_feedback) return null

  const score = answer.ai_score ?? 0
  const scoreColor =
    score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Feedback</span>
        <span className={`text-sm font-bold ${scoreColor}`}>{score}/10</span>
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
        {answer.ai_feedback}
      </div>
    </div>
  )
}
