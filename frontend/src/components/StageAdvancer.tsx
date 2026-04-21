import { advanceStage } from '../lib/api'
import type { Application } from '../types'

interface Props {
  application: Application
  onUpdate: (app: Application) => void
}

export default function StageAdvancer({ application, onUpdate }: Props) {
  const { stages, current_stage_id } = application

  if (!stages || stages.length === 0) return null

  const currentIdx = stages.findIndex((s) => s.id === current_stage_id)

  const handleAdvance = async (stageId: string) => {
    const updated = await advanceStage(application.id, stageId)
    onUpdate(updated)
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stages.map((stage, idx) => {
        const isCurrent = stage.id === current_stage_id
        const isPast = idx < currentIdx
        return (
          <button
            key={stage.id}
            onClick={() => !isCurrent && handleAdvance(stage.id)}
            title={stage.name}
            className={[
              'px-2 py-0.5 text-xs rounded-full border transition-colors',
              isCurrent
                ? 'text-white border-transparent'
                : isPast
                ? 'text-gray-500 border-gray-700 hover:border-gray-500'
                : 'text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200',
            ].join(' ')}
            style={isCurrent ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
          >
            {stage.name}
          </button>
        )
      })}
    </div>
  )
}
