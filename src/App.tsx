import { useState, useEffect, useCallback } from 'react'
import type { OpenClawLine } from './types'
import { useSessions } from './hooks/useSessions'
import { Sidebar } from './components/Sidebar'
import { SessionViewer } from './components/SessionViewer'
import { LiveMonitor } from './components/LiveMonitor'
import { ResizeDivider } from './components/ResizeDivider'

const API_BASE = '/api'

export default function App() {
  const { agents, sessions, loadingAgents, fetchAgents, fetchSessions } = useSessions()

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const [sessionEvents, setSessionEvents] = useState<OpenClawLine[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = (localStorage.getItem('oc-theme') as 'dark' | 'light') ?? 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    return saved
  })
  const [sidebarWidth, setSidebarWidth] = useState(320)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('oc-theme', theme)
  }, [theme])

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(w => Math.max(160, Math.min(400, w + delta)))
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const handleExpandAgent = useCallback((agentId: string) => {
    fetchSessions(agentId)
  }, [fetchSessions])

  const loadSession = useCallback(async (agentId: string, sessionId: string) => {
    setSessionError(null)
    setLoadingSession(true)
    setSessionEvents([])
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionId)}`
      )
      if (res.status === 404) throw new Error('Session file not found on disk')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { events: OpenClawLine[] }
      setSessionEvents(data.events ?? [])
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const handleSelectSession = useCallback((agentId: string, sessionId: string) => {
    setSelectedAgentId(agentId)
    setSelectedSessionId(sessionId)
    loadSession(agentId, sessionId)
  }, [loadSession])

  const handleToggleLive = useCallback(() => {
    setLiveMode(prev => !prev)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchAgents()
    for (const agentId of Object.keys(sessions)) {
      fetchSessions(agentId)
    }
  }, [fetchAgents, fetchSessions, sessions])

  useEffect(() => {
    const id = setInterval(() => {
      for (const agentId of Object.keys(sessions)) {
        fetchSessions(agentId)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [sessions, fetchSessions])

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      const firstAgent = agents[0].agentId
      setSelectedAgentId(firstAgent)
      fetchSessions(firstAgent)
    }
  }, [agents, selectedAgentId, fetchSessions])

  const renderMain = () => {
    if (liveMode) {
      return <LiveMonitor onClear={() => setLiveMode(false)} />
    }

    if (loadingSession) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm">Loading session…</p>
        </div>
      )
    }

    if (sessionError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="text-red-500 text-sm">Failed to load session</div>
          <div className="text-zinc-600 text-xs font-mono">{sessionError}</div>
          {selectedAgentId && selectedSessionId && (
            <button
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded px-3 py-1.5 transition-colors"
              onClick={() => loadSession(selectedAgentId, selectedSessionId)}
            >
              Retry
            </button>
          )}
        </div>
      )
    }

    if (!selectedSessionId || sessionEvents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 select-none">
          <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">Select a session from the sidebar</p>
          <p className="text-xs text-zinc-700">Or enable Live Monitor to watch real-time events</p>
        </div>
      )
    }

    return (
      <SessionViewer
        events={sessionEvents}
        agentId={selectedAgentId ?? ''}
        sessionId={selectedSessionId}
      />
    )
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--bg-app)', color: 'var(--text-base)' }}
      data-theme={theme}
    >
      <header
        className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--bg-header)', borderColor: 'var(--border)' }}
      >
        <span className="text-md font-semibold text-red-600 tracking-widest uppercase">
          OpenClaw Trajectory
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-xs text-zinc-500 hover:text-zinc-300 rounded px-2 py-1 transition-colors border"
            style={{ borderColor: 'var(--border-faint)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300 rounded px-2 py-1 transition-colors border"
            style={{ borderColor: 'var(--border-faint)' }}
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarWidth, flexShrink: 0 }} className="overflow-hidden">
          <Sidebar
            agents={agents}
            sessions={sessions}
            selectedAgentId={selectedAgentId}
            selectedSessionId={selectedSessionId}
            liveMode={liveMode}
            loadingAgents={loadingAgents}
            onSelectSession={handleSelectSession}
            onToggleLive={handleToggleLive}
            onExpandAgent={handleExpandAgent}
            onRefresh={handleRefresh}
          />
        </div>
        <ResizeDivider direction="horizontal" onResize={handleSidebarResize} />
        <div className="flex-1 overflow-hidden">
          {renderMain()}
        </div>
      </div>
    </div>
  )
}
