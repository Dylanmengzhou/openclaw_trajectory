import { useState, useCallback } from 'react'
import type { AgentInfo, SessionInfo } from '../types'

const API_BASE = '/api'

interface UseSessionsResult {
  agents: AgentInfo[]
  sessions: Record<string, SessionInfo[]>
  loadingAgents: boolean
  loadingSessions: boolean
  error: string | null
  fetchAgents: () => Promise<void>
  fetchSessions: (agentId: string) => Promise<void>
}

export function useSessions(): UseSessionsResult {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [sessions, setSessions] = useState<Record<string, SessionInfo[]>>({})
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/agents`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { agents: string[] }
      const agentList: AgentInfo[] = (data.agents || []).map((id: string) => ({ agentId: id }))
      setAgents(agentList)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch agents'
      setError(msg)
    } finally {
      setLoadingAgents(false)
    }
  }, [])

  const fetchSessions = useCallback(async (agentId: string) => {
    setLoadingSessions(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/sessions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { sessions: SessionInfo[] }
      setSessions(prev => ({ ...prev, [agentId]: data.sessions || [] }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch sessions'
      setError(msg)
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  return {
    agents,
    sessions,
    loadingAgents,
    loadingSessions,
    error,
    fetchAgents,
    fetchSessions
  }
}
