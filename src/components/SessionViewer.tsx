import { useMemo, useState, useCallback } from 'react'
import { formatDuration, formatCost } from '../lib/utils'
import { EventList, DetailPanel, buildRows } from './EventList'
import { ChatPanel } from './ChatPanel'
import { ResizeDivider } from './ResizeDivider'
import type { EventRow } from './EventList'
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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<EventRow | null>(null)
  const [detailHeight, setDetailHeight] = useState(208)
  const [chatWidth, setChatWidth] = useState(320)

  const handleDetailResize = useCallback((delta: number) => {
    setDetailHeight(h => Math.max(64, Math.min(500, h - delta)))
  }, [])

  const handleChatResize = useCallback((delta: number) => {
    setChatWidth(w => Math.max(200, Math.min(640, w - delta)))
  }, [])

  const checkedRows: EventRow[] = rows.filter(r => checkedIds.has(r.id))

  const header = (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs text-zinc-500 font-mono">{agentId}</span>
        <span className="text-zinc-700">/</span>
        <span className="text-xs text-zinc-600 font-mono">{sessionId.slice(0, 8)}</span>
        <span className="ml-auto text-xs text-zinc-700">{rows.length} events</span>
        <button
          onClick={() => setChatOpen(o => !o)}
          className="text-xs px-2 py-1 rounded border transition-colors flex-shrink-0"
          style={chatOpen
            ? { color: '#818cf8', borderColor: '#4f46e5', background: 'rgba(79,70,229,0.15)' }
            : { color: 'var(--text-muted)', borderColor: 'var(--border-faint)', background: 'transparent' }}
        >
          Chat{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
        </button>
      </div>
      <div
        className="flex items-center gap-3 px-3 py-1.5 border-b text-[11px] text-zinc-600 flex-shrink-0 flex-wrap"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top: event list + optional chat panel side by side */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EventList
          rows={rows}
          header={header}
          checkedIds={checkedIds}
          onCheckedChange={setCheckedIds}
          onRowSelect={setSelectedRow}
          rightPanel={chatOpen ? <ChatPanel checkedRows={checkedRows} /> : undefined}
          rightPanelWidth={chatWidth}
          onRightPanelResize={handleChatResize}
        />
      </div>

      {/* Resize handle between event list and detail panel */}
      <ResizeDivider direction="vertical" onResize={handleDetailResize} />

      {/* Bottom: detail panel */}
      <div
        style={{
          height: detailHeight,
          flexShrink: 0,
          background: 'var(--bg-panel)',
          borderTopColor: 'var(--border)'
        }}
        className="border-t overflow-hidden"
      >
        <DetailPanel row={selectedRow} />
      </div>
    </div>
  )
}
