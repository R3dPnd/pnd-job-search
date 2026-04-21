import { useJobSearchStore } from '../hooks/useJobSearchStore'
import type { Application } from '../types'

function ApplicationCard({ app, onClick }: { app: Application; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-indigo-500 transition-colors"
    >
      <div className="font-medium text-sm text-white truncate">{app.company}</div>
      <div className="text-xs text-gray-400 truncate mt-0.5">{app.role}</div>
      {app.date_applied && (
        <div className="text-xs text-gray-500 mt-1">{app.date_applied}</div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { applications, setActiveTab, setSelectedApplicationId } = useJobSearchStore()

  const active = applications.filter((a) => a.status === 'active')

  // Group by current stage name
  const columns = new Map<string, Application[]>()
  for (const app of active) {
    const key = app.current_stage?.name ?? 'Unplaced'
    if (!columns.has(key)) columns.set(key, [])
    columns.get(key)!.push(app)
  }

  const openApp = (id: string) => {
    setSelectedApplicationId(id)
    setActiveTab('applications')
  }

  if (applications.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
        <span className="text-4xl">📋</span>
        <p>No applications yet.</p>
        <button
          onClick={() => setActiveTab('applications')}
          className="text-sm text-indigo-400 hover:underline"
        >
          Add your first application →
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-x-auto p-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-200">Pipeline</h2>
      <div className="flex gap-4 h-[calc(100%-3rem)] pb-4">
        {[...columns.entries()].map(([stageName, apps]) => (
          <div key={stageName} className="flex-none w-56">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {stageName}
              </span>
              <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                {apps.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-full">
              {apps.map((app) => (
                <ApplicationCard key={app.id} app={app} onClick={() => openApp(app.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
