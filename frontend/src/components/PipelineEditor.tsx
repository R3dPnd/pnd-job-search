import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createStage, deleteStage, reorderStages, getApplication } from '../lib/api'
import type { Application, PipelineStage } from '../types'

interface SortableStageProps {
  stage: PipelineStage
  onDelete: (id: string) => void
}

function SortableStage({ stage, onDelete }: SortableStageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'flex items-center gap-2 px-3 py-2 rounded bg-gray-800 border border-gray-700',
        isDragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing"
      >
        ⠿
      </button>
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />
      <span className="text-sm text-gray-200 flex-1">{stage.name}</span>
      <button
        onClick={() => onDelete(stage.id)}
        className="text-gray-600 hover:text-red-400 text-xs transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

interface Props {
  application: Application
  onUpdate: (app: Application) => void
}

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6',
  '#10b981', '#ef4444', '#ec4899', '#06b6d4',
]

export default function PipelineEditor({ application, onUpdate }: Props) {
  const [stages, setStages] = useState<PipelineStage[]>(application.stages ?? [])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = stages.findIndex((s) => s.id === active.id)
    const newIdx = stages.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(stages, oldIdx, newIdx)
    setStages(reordered)

    const result = await reorderStages(application.id, reordered.map((s) => s.id))
    setStages(result.stages)
    const fresh = await getApplication(application.id)
    onUpdate(fresh)
  }

  const handleAddStage = async () => {
    if (!newName.trim()) return
    const stage = await createStage(application.id, { name: newName.trim(), color: newColor })
    setStages((prev) => [...prev, stage])
    setNewName('')
    setAdding(false)
    const fresh = await getApplication(application.id)
    onUpdate(fresh)
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Delete this stage?')) return
    await deleteStage(application.id, stageId)
    setStages((prev) => prev.filter((s) => s.id !== stageId))
    const fresh = await getApplication(application.id)
    onUpdate(fresh)
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Pipeline Stages
      </h3>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5 mb-3">
            {stages.map((stage) => (
              <SortableStage key={stage.id} stage={stage} onDelete={handleDeleteStage} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="flex flex-col gap-2 mt-2">
          <input
            autoFocus
            type="text"
            placeholder="Stage name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  newColor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddStage}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 rounded transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-1.5 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add stage
        </button>
      )}
    </div>
  )
}
