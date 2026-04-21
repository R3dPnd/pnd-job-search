import { useState } from 'react'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import { createSession, updateSession, deleteSession } from '../lib/api'

export default function SessionsPage() {
  const { sessions, applications, activeSessionId, setActiveSessionId, upsertSession, removeSession } =
    useJobSearchStore()
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!label.trim()) return
    const s = await createSession({ label })
    upsertSession(s)
    setActiveSessionId(s.id)
    setLabel('')
    setCreating(false)
  }

  const handleResume = (id: string) => {
    setActiveSessionId(id)
    updateSession(id, {}).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return
    await deleteSession(id)
    removeSession(id)
    if (activeSessionId === id) setActiveSessionId(null)
  }

  const appById = (id: string) => applications.find((a) => a.id === id)

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-200">Job Search Sessions</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {creating ? 'Cancel' : '+ New Session'}
        </button>
      </div>

      {creating && (
        <div className="bg-gray-800/50 border border-gray-700 rounded p-4 mb-4 flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Session label (e.g. Q1 2025 Search)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded transition-colors"
          >
            Create
          </button>
        </div>
      )}

      {sessions.length === 0 && !creating && (
        <p className="text-gray-600 text-sm text-center py-12">
          No sessions yet. Create one to track your job search progress.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId
          const pinned = session.active_application_ids
            .map((id) => appById(id))
            .filter(Boolean)

          return (
            <div
              key={session.id}
              className={[
                'bg-gray-800/50 border rounded p-4 flex flex-col gap-2 transition-colors',
                isActive ? 'border-indigo-500' : 'border-gray-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  )}
                  <span className="font-medium text-sm text-white">
                    {session.label ?? 'Unnamed Session'}
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  {!isActive && (
                    <button
                      onClick={() => handleResume(session.id)}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Resume
                    </button>
                  )}
                  {isActive && (
                    <button
                      onClick={() => setActiveSessionId(null)}
                      className="text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Pause
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Started {new Date(session.started_at).toLocaleDateString()}
                {' · '}
                Last active {new Date(session.last_active_at).toLocaleDateString()}
              </div>

              {pinned.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {pinned.map((app) => (
                    <span key={app!.id} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                      {app!.company} — {app!.role}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
