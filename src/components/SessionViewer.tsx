import { useMemo } from 'react'
import { formatDuration, formatCost } from '../lib/utils'
import { EventList, buildRows } from './EventList'
import type { OpenClawLine } from '../types'

interface SessionViewerProps {
  events: OpenClawLine[]
  agentId: string
  sessionId: string
}

function useStats(events: OpenClawLine[]) {
  return useMemo(() => {
    let totalIn = 0, totalOut = 0, totalCost = 0
    let firstTs: number | null = null, lastTs: number | null = null
    for (const line of events) {
      if (line.type !== 'message' || !line.message) continue
      const t = line.timestamp ? new Date(line.timestamp).getTime() : null
      if (t) { if (!firstTs || t < firstTs) firstTs = t; if (!lastTs || t > lastTs) lastTs = t }
      if (line.message.role === 'assistant' && line.message.usage) {
        const u = line.message.usage
        totalIn += u.input ?? 0
        totalOut += u.output ?? 0
        totalCost += u.cost?.total ?? 0
      }
    }
    return { totalIn, totalOut, totalCost, duration: firstTs && lastTs ? lastTs - firstTs : null }
  }, [events])
}

export function SessionViewer({ events, agentId, sessionId }: SessionViewerProps) {
  const rows = useMemo(() => buildRows(events), [events])
  const stats = useStats(events)

  const header = (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#242424] bg-[#141414] flex-shrink-0">
        <span className="text-xs text-zinc-500 font-mono">{agentId}</span>
        <span className="text-zinc-700">/</span>
        <span className="text-xs text-zinc-600 font-mono">{sessionId.slice(0, 8)}</span>
        <span className="ml-auto text-xs text-zinc-700">{rows.length} events</span>
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1e1e1e] text-[11px] text-zinc-600 flex-shrink-0 flex-wrap">
        <span>in <span className="text-zinc-400 font-mono">{stats.totalIn.toLocaleString()}</span></span>
        <span>out <span className="text-zinc-400 font-mono">{stats.totalOut.toLocaleString()}</span></span>
        {stats.totalCost > 0 && (
          <span>cost <span className="text-green-400 font-mono">{formatCost(stats.totalCost)}</span></span>
        )}
        {stats.duration !== null && (
          <span>duration <span className="text-zinc-400 font-mono">{formatDuration(stats.duration)}</span></span>
        )}
      </div>
    </>
  )

  return <EventList rows={rows} header={header} />
}
