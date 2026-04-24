import { useState, useEffect } from 'react'
import { useJobSearchStore } from '../hooks/useJobSearchStore'
import { createApplication, exportApplicationsDOCX, getApplication, getApplications } from '../lib/api'
import ApplicationDetail from './ApplicationDetail'
import type { Application } from '../types'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-indigo-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
  archived: 'bg-gray-500',
}

export default function ApplicationsPage() {
  const { applications, setApplications, selectedApplicationId, setSelectedApplicationId, upsertApplication } =
    useJobSearchStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newJobURL, setNewJobURL] = useState('')
  const [newJobDescription, setNewJobDescription] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Application | null>(null)

  // Load full detail when selection changes
  useEffect(() => {
    if (!selectedApplicationId) { setDetail(null); return }
    getApplication(selectedApplicationId).then(setDetail).catch(() => setDetail(null))
  }, [selectedApplicationId])

  const filtered = applications.filter((a) => {
    const matchSearch =
      !search ||
      a.company.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || a.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleCreate = async () => {
    if (!newCompany || !newRole) return
    setCreateError(null)
    try {
      const app = await createApplication({
        company: newCompany,
        role: newRole,
        job_url: newJobURL || null,
        job_description: newJobDescription || null,
      })
      upsertApplication(app)
      setSelectedApplicationId(app.id)
      setCreating(false)
      setNewCompany('')
      setNewRole('')
      setNewJobURL('')
      setNewJobDescription('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create application')
    }
  }

  const handleDetailUpdate = (app: Application) => {
    upsertApplication(app)
    setDetail(app)
  }

  const handleDelete = async () => {
    if (!selectedApplicationId) return
    setSelectedApplicationId(null)
    setDetail(null)
    const res = await getApplications()
    setApplications(res.applications)
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900">
        <div className="p-3 border-b border-gray-800 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => exportApplicationsDOCX()}
              title="Download CSV"
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-2 py-1.5 text-gray-400 hover:text-gray-200 transition-colors text-sm"
            >
              ↓
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((app) => (
            <button
              key={app.id}
              onClick={() => setSelectedApplicationId(app.id)}
              className={[
                'w-full text-left px-3 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors',
                selectedApplicationId === app.id ? 'bg-gray-800 border-l-2 border-l-indigo-500' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${!app.current_stage ? (STATUS_COLORS[app.status] ?? 'bg-gray-500') : ''}`}
                  style={app.current_stage ? { backgroundColor: app.current_stage.color } : undefined}
                />
                <span className="font-medium text-sm text-white truncate">{app.company}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5 ml-4 truncate">{app.role}</div>
              {app.current_stage && (
                <div
                  className="text-xs mt-1 ml-4 inline-block px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: app.current_stage.color + '33', color: app.current_stage.color }}
                >
                  {app.current_stage.name}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800">
          {creating ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Company"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="url"
                placeholder="Job posting URL (optional)"
                value={newJobURL}
                onChange={(e) => setNewJobURL(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <textarea
                placeholder="Job description (optional)"
                value={newJobDescription}
                onChange={(e) => setNewJobDescription(e.target.value)}
                rows={4}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 rounded transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setCreating(false); setNewJobURL(''); setNewJobDescription(''); setCreateError(null) }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-1.5 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 rounded transition-colors"
            >
              + New Application
            </button>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden">
        {detail ? (
          <ApplicationDetail
            application={detail}
            onUpdate={handleDetailUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            Select an application
          </div>
        )}
      </div>
    </div>
  )
}
