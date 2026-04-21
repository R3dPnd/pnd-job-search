import { useJobSearchStore } from '../hooks/useJobSearchStore'

export default function StatusBar() {
  const { applications, sessions, activeSessionId } = useJobSearchStore()

  const active = applications.filter((a) => a.status === 'active').length
  const offers = applications.filter((a) => a.status === 'offer').length
  const session = sessions.find((s) => s.id === activeSessionId)

  return (
    <header className="flex items-center gap-6 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
      <span className="font-semibold text-indigo-400 text-sm tracking-wide">JOB SEARCH</span>
      <div className="flex items-center gap-4 text-xs text-gray-400 ml-auto">
        {session && (
          <span className="text-indigo-300 font-medium">
            Session: {session.label ?? 'Unnamed'}
          </span>
        )}
        <span>{active} active</span>
        {offers > 0 && <span className="text-green-400 font-semibold">{offers} offer{offers > 1 ? 's' : ''}</span>}
        <span>{applications.length} total</span>
      </div>
    </header>
  )
}
