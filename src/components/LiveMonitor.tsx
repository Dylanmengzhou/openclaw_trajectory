import { useEffect, useRef, useState, useCallback } from 'react'
import { formatDuration, formatCost } from '../lib/utils'
import { EventList, DetailPanel, buildRows } from './EventList'
import { ChatPanel } from './ChatPanel'
import type { EventRow } from './EventList'
import type { OpenClawLine } from '../types'

interface LiveMonitorProps {
  onClear: () => void
}

// ─── Live JSONL stream hook ───────────────────────────────────────────────────

function useLiveStream() {
  const [events, setEvents] = useState<OpenClawLine[]>([])
  const [sessionInfo, setSessionInfo] = useState<{ agentId: string; sessionId: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle')
  const esRef = useRef<EventSource | null>(null)
  const enabledRef = useRef(false)
  const sessionInfoRef = useRef<{ agentId: string; sessionId: string } | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    setEvents([])
    setSessionInfo(null)
    sessionInfoRef.current = null
    setStatus('connecting')

    const es = new EventSource('/api/live/stream')
    esRef.current = es

    es.onmessage = (ev) => {
      let line: OpenClawLine & { type: string }
      try { line = JSON.parse(ev.data as string) } catch { return }

      if (line.type === '__meta') {
        const meta = line as unknown as { agentId?: string; sessionId?: string; error?: string }
        if (meta.error) { setStatus('error'); return }
        if (meta.agentId && meta.sessionId) {
          const info = { agentId: meta.agentId, sessionId: meta.sessionId }
          setSessionInfo(info)
          sessionInfoRef.current = info
          setStatus('streaming')
        }
        return
      }

      setEvents(prev => [...prev, line])
    }

    es.onerror = () => setStatus('error')
  }, [])

  const disconnect = useCallback(() => {
    enabledRef.current = false
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    setStatus('idle')
    setEvents([])
    setSessionInfo(null)
    sessionInfoRef.current = null
  }, [])

  // Poll /api/live every 5s to auto-detect a new session (e.g. after /new)
  useEffect(() => {
    const poll = setInterval(async () => {
      if (!enabledRef.current) return
      try {
        const res = await fetch('/api/live')
        if (!res.ok) return
        const data = await res.json() as { agentId: string; sessionId: string }
        const current = sessionInfoRef.current
        if (current && data.sessionId !== current.sessionId) {
          // New session detected — reconnect
          connect()
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(poll)
  }, [connect])

  const start = useCallback(() => {
    enabledRef.current = true
    connect()
  }, [connect])

  useEffect(() => () => { esRef.current?.close() }, [])

  return { events, sessionInfo, status, start, disconnect }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function useStats(events: OpenClawLine[]) {
  let totalIn = 0, totalOut = 0, totalCost = 0
  let firstTs: number | null = null, lastTs: number | null = null
  for (const e of events) {
    if (e.type !== 'message' || !e.message) continue
    const t = e.timestamp ? new Date(e.timestamp).getTime() : null
    if (t) { if (!firstTs || t < firstTs) firstTs = t; if (!lastTs || t > lastTs) lastTs = t }
    if (e.message.role === 'assistant' && e.message.usage) {
      const u = e.message.usage
      totalIn += u.input ?? 0
      totalOut += u.output ?? 0
      totalCost += u.cost?.total ?? 0
    }
  }
  return { totalIn, totalOut, totalCost, duration: firstTs && lastTs ? lastTs - firstTs : null }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LiveMonitor({ onClear }: LiveMonitorProps) {
  const { events, sessionInfo, status, start, disconnect } = useLiveStream()
  const [enabled, setEnabled] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<EventRow | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  const rows = buildRows(events)
  const stats = useStats(events)
  const checkedRows: EventRow[] = rows.filter(r => checkedIds.has(r.id))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rows.length])

  const handleToggle = () => {
    if (enabled) { disconnect(); setEnabled(false) }
    else { start(); setEnabled(true) }
  }

  const handleClear = () => {
    disconnect()
    setEnabled(false)
    onClear()
  }

  const statusDot = status === 'streaming'
    ? <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
    : status === 'connecting'
    ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
    : status === 'error'
    ? <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
    : <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 flex-shrink-0" />

  const header = (
    <>
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {statusDot}
        <span className="text-xs text-zinc-500 font-mono truncate">
          {sessionInfo
            ? `${sessionInfo.agentId} / ${sessionInfo.sessionId.slice(0, 8)}`
            : status === 'connecting' ? 'Connecting…'
            : status === 'error' ? 'No sessions found'
            : 'Live Monitor'}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToggle}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={enabled
              ? { color: '#4ade80', borderColor: '#166534', background: 'rgba(22,101,52,0.2)' }
              : { color: 'var(--text-muted)', borderColor: 'var(--border-faint)', background: 'transparent' }}
          >
            {enabled ? 'Stop' : 'Start'}
          </button>
          {rows.length > 0 && (
            <button onClick={handleClear} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Clear
            </button>
          )}
          <button
            onClick={() => setChatOpen(o => !o)}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={chatOpen
              ? { color: '#818cf8', borderColor: '#4f46e5', background: 'rgba(79,70,229,0.15)' }
              : { color: 'var(--text-muted)', borderColor: 'var(--border-faint)', background: 'transparent' }}
          >
            Chat{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
          </button>
        </div>
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b text-[11px] text-zinc-600 flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--border-subtle)' }}>
          <span>in <span className="text-zinc-400 font-mono">{stats.totalIn.toLocaleString()}</span></span>
          <span>out <span className="text-zinc-400 font-mono">{stats.totalOut.toLocaleString()}</span></span>
          {stats.totalCost > 0 && (
            <span>cost <span className="text-green-400 font-mono">{formatCost(stats.totalCost)}</span></span>
          )}
          {stats.duration !== null && (
            <span>duration <span className="text-zinc-400 font-mono">{formatDuration(stats.duration)}</span></span>
          )}
        </div>
      )}
    </>
  )

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-2 text-zinc-600 select-none">
      {!enabled ? (
        <p className="text-sm">Press Start to watch the latest session</p>
      ) : status === 'connecting' ? (
        <>
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-sm">Connecting…</p>
        </>
      ) : status === 'error' ? (
        <p className="text-sm text-red-500">No sessions found</p>
      ) : (
        <>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-sm">Waiting for events…</p>
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top: event list + optional chat panel side by side */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EventList
          rows={rows}
          header={header}
          footer={emptyState}
          bottomRef={bottomRef}
          checkedIds={checkedIds}
          onCheckedChange={setCheckedIds}
          onRowSelect={setSelectedRow}
          rightPanel={chatOpen ? <ChatPanel checkedRows={checkedRows} /> : undefined}
        />
      </div>

      {/* Bottom: detail panel, always visible */}
      <div className="h-52 flex-shrink-0 border-t overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        <DetailPanel row={selectedRow} />
      </div>
    </div>
  )
}
