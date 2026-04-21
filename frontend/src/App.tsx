import { useEffect } from 'react'
import { useJobSearchStore } from './hooks/useJobSearchStore'
import { getApplications, getResumes, getSessions } from './lib/api'
import StatusBar from './components/StatusBar'
import DashboardPage from './components/DashboardPage'
import ApplicationsPage from './components/ApplicationsPage'
import ResumePage from './components/ResumePage'
import DiscoverPage from './components/DiscoverPage'
import SessionsPage from './components/SessionsPage'
import type { Tab } from './types'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
  { id: 'resume', label: 'Resume' },
  { id: 'discover', label: 'Discover' },
  { id: 'sessions', label: 'Sessions' },
]

export default function App() {
  const { activeTab, setActiveTab, setApplications, setResumes, setSessions } = useJobSearchStore()

  useEffect(() => {
    getApplications().then((r) => setApplications(r.applications))
    getResumes().then((r) => setResumes(r.resumes))
    getSessions().then((r) => setSessions(r.sessions))
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <StatusBar />

      {/* Tab bar */}
      <nav className="flex border-b border-gray-800 bg-gray-900 px-4 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab panels — absolutely positioned so unmounted tabs don't lose state */}
      <main className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'dashboard' ? 'h-full' : 'hidden'}>
          <DashboardPage />
        </div>
        <div className={activeTab === 'applications' ? 'h-full' : 'hidden'}>
          <ApplicationsPage />
        </div>
        <div className={activeTab === 'resume' ? 'h-full' : 'hidden'}>
          <ResumePage />
        </div>
        <div className={activeTab === 'discover' ? 'h-full' : 'hidden'}>
          <DiscoverPage />
        </div>
        <div className={activeTab === 'sessions' ? 'h-full' : 'hidden'}>
          <SessionsPage />
        </div>
      </main>
    </div>
  )
}
