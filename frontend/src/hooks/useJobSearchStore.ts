import { create } from 'zustand'
import type { Application, Resume, Session, Tab } from '../types'

interface JobSearchStore {
  // Data
  applications: Application[]
  resumes: Resume[]
  sessions: Session[]
  activeSessionId: string | null

  // UI state
  selectedApplicationId: string | null
  activeTab: Tab

  // Setters
  setApplications: (apps: Application[]) => void
  setResumes: (resumes: Resume[]) => void
  setSessions: (sessions: Session[]) => void
  setActiveSessionId: (id: string | null) => void
  setSelectedApplicationId: (id: string | null) => void
  setActiveTab: (tab: Tab) => void

  // Granular updates
  upsertApplication: (app: Application) => void
  removeApplication: (id: string) => void
  upsertSession: (session: Session) => void
  removeSession: (id: string) => void
  upsertResume: (resume: Resume) => void
  removeResume: (id: string) => void
}

export const useJobSearchStore = create<JobSearchStore>((set) => ({
  applications: [],
  resumes: [],
  sessions: [],
  activeSessionId: null,
  selectedApplicationId: null,
  activeTab: 'dashboard',

  setApplications: (applications) => set({ applications }),
  setResumes: (resumes) => set({ resumes }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSelectedApplicationId: (id) => set({ selectedApplicationId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  upsertApplication: (app) =>
    set((s) => ({
      applications: s.applications.some((a) => a.id === app.id)
        ? s.applications.map((a) => (a.id === app.id ? app : a))
        : [app, ...s.applications],
    })),

  removeApplication: (id) =>
    set((s) => ({ applications: s.applications.filter((a) => a.id !== id) })),

  upsertSession: (session) =>
    set((s) => ({
      sessions: s.sessions.some((ss) => ss.id === session.id)
        ? s.sessions.map((ss) => (ss.id === session.id ? session : ss))
        : [session, ...s.sessions],
    })),

  removeSession: (id) =>
    set((s) => ({ sessions: s.sessions.filter((ss) => ss.id !== id) })),

  upsertResume: (resume) =>
    set((s) => ({
      resumes: s.resumes.some((r) => r.id === resume.id)
        ? s.resumes.map((r) => (r.id === resume.id ? resume : r))
        : [resume, ...s.resumes],
    })),

  removeResume: (id) =>
    set((s) => ({ resumes: s.resumes.filter((r) => r.id !== id) })),
}))
