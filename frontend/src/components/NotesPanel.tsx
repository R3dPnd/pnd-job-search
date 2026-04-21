import { useState, useEffect } from 'react'
import { getNotes, createNote, updateNote, deleteNote } from '../lib/api'
import type { Application, Note, PipelineStage } from '../types'

interface Props {
  application: Application
}

export default function NotesPanel({ application }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [stageFilter, setStageFilter] = useState<string>('')
  const [content, setContent] = useState('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    getNotes(application.id, stageFilter || undefined).then((r) => setNotes(r.notes))
  }, [application.id, stageFilter])

  const handleCreate = async () => {
    if (!content.trim()) return
    const note = await createNote(application.id, {
      content: content.trim(),
      stage_id: selectedStageId || undefined,
    })
    setNotes((prev) => [note, ...prev])
    setContent('')
  }

  const handleUpdate = async (noteId: string) => {
    const note = await updateNote(application.id, noteId, editContent)
    setNotes((prev) => prev.map((n) => (n.id === noteId ? note : n)))
    setEditingId(null)
  }

  const handleDelete = async (noteId: string) => {
    await deleteNote(application.id, noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  const stageById = (id: string | null): PipelineStage | undefined =>
    application.stages?.find((s) => s.id === id)

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3">
      {/* Filter by stage */}
      <div className="flex gap-2 items-center shrink-0">
        <span className="text-xs text-gray-400">Filter by stage:</span>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
        >
          <option value="">All stages</option>
          {application.stages?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {notes.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">No notes yet.</p>
        )}
        {notes.map((note) => {
          const stage = stageById(note.stage_id)
          return (
            <div key={note.id} className="bg-gray-800 border border-gray-700 rounded p-3">
              {stage && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full mb-1.5 inline-block"
                  style={{ backgroundColor: stage.color + '33', color: stage.color }}
                >
                  {stage.name}
                </span>
              )}
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none resize-none w-full"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-600">
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                    <button
                      onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                      className="hover:text-gray-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Compose */}
      <div className="shrink-0 flex flex-col gap-2 border-t border-gray-800 pt-3">
        <div className="flex gap-2">
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none flex-none"
          >
            <option value="">No stage</option>
            {application.stages?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          rows={2}
          placeholder="Add a note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate()
          }}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
        <button
          onClick={handleCreate}
          className="self-end bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
        >
          Add Note
        </button>
      </div>
    </div>
  )
}
