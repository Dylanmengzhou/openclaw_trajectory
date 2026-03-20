/**
 * Shared event list used by both SessionViewer and LiveMonitor.
 * Right panel and detail panel are managed by the parent.
 */
import { useState } from 'react'
import { formatTimestamp, toolToType, EVENT_TYPE_META, withAlpha } from '../lib/utils'
import { ResizeDivider } from './ResizeDivider'
import type { EventType } from '../lib/utils'
import type { OpenClawLine } from '../types'

// ─── Models ───────────────────────────────────────────────────────────────────

interface DetailSection { title: string; content: string }

export interface EventRow {
  id: string
  type: EventType
  summary: string
  detail: { label: string; sections: DetailSection[] }
  ts: string
  isError?: boolean
}

// ─── JSONL → rows ─────────────────────────────────────────────────────────────

function extractArgSummary(name: string, args: Record<string, unknown>): string {
  const tn = name.toLowerCase()
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (args[k] !== undefined) return String(args[k]).slice(0, 80)
    }
    const first = Object.values(args)[0]
    return first !== undefined ? String(first).slice(0, 80) : ''
  }
  if (tn.includes('bash') || tn.includes('shell') || tn === 'exec') return pick('command', 'action')
  if (tn.includes('read')) return pick('path', 'file_path', 'filePath')
  if (tn.includes('write') || tn.includes('edit')) return pick('path', 'file_path', 'filePath')
  if (tn.includes('browser')) return pick('url', 'targetUrl', 'action')
  if (tn.includes('search') || tn.includes('fetch')) return pick('query', 'url', 'q')
  return pick(...Object.keys(args))
}

export function buildRows(events: OpenClawLine[]): EventRow[] {
  const rows: EventRow[] = []
  let seq = 0

  for (const line of events) {
    if (line.type !== 'message' || !line.message) continue
    const { role, content = [], toolCallId, toolName } = line.message
    const ts = line.timestamp ?? ''

    if (role === 'user') {
      const text = content
        .filter(c => c.type === 'text')
        .map(c => c.type === 'text' ? c.text : '')
        .join(' ').trim()
      if (text) {
        rows.push({
          id: `r${seq++}`, type: 'USER', ts,
          summary: text.slice(0, 120),
          detail: { label: 'User message', sections: [{ title: 'Message', content: text }] }
        })
      }
    }

    if (role === 'assistant') {
      for (const c of content) {
        if (c.type === 'thinking' && c.thinking?.trim()) {
          const text = c.thinking.trim()
          rows.push({
            id: `r${seq++}`, type: 'THINK', ts,
            summary: text.slice(0, 120),
            detail: { label: 'Thinking', sections: [{ title: 'Thought', content: text }] }
          })
        }
        if (c.type === 'toolCall') {
          const evType = toolToType(c.name)
          const argSummary = extractArgSummary(c.name, c.arguments ?? {})
          rows.push({
            id: `r${seq++}`, type: evType, ts,
            summary: `${c.name}${argSummary ? ` · ${argSummary}` : ''}`,
            detail: {
              label: c.name,
              sections: [
                { title: 'Tool', content: c.name },
                { title: 'Arguments', content: JSON.stringify(c.arguments ?? {}, null, 2) }
              ]
            }
          })
        }
        if (c.type === 'text' && c.text?.trim()) {
          const text = c.text.trim()
          rows.push({
            id: `r${seq++}`, type: 'AGENT', ts,
            summary: text.slice(0, 120),
            detail: { label: 'Agent response', sections: [{ title: 'Response', content: text }] }
          })
        }
      }
    }

    if (role === 'toolResult') {
      const text = content
        .filter(c => c.type === 'text')
        .map(c => c.type === 'text' ? c.text : '')
        .join('')
      const name = toolName ?? toolCallId ?? 'result'
      rows.push({
        id: `r${seq++}`, type: 'RESULT', ts,
        summary: `${name} → ${text.slice(0, 100)}`,
        detail: {
          label: `Result: ${name}`,
          sections: [
            { title: 'Tool', content: name },
            { title: 'Output', content: text }
          ]
        }
      })
    }
  }

  return rows
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function TypeBadge({ type }: { type: EventType }) {
  const meta = EVENT_TYPE_META[type]
  return (
    <span
      className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: meta.color, background: meta.bg, letterSpacing: '0.05em' }}
    >
      {type}
    </span>
  )
}

export function FilterChip({
  type, count, active, onClick
}: { type: EventType | 'ALL'; count: number; active: boolean; onClick: () => void }) {
  const meta = type === 'ALL' ? null : EVENT_TYPE_META[type]
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex-shrink-0"
      style={active && meta
        ? { color: meta.color, borderColor: meta.color, background: meta.bg }
        : active
        ? { color: 'var(--text-base)', borderColor: 'var(--text-muted)', background: 'rgba(82,82,91,0.15)' }
        : { color: 'var(--text-muted)', borderColor: 'var(--border-faint)', background: 'transparent' }}
    >
      {type}
      <span className="opacity-70">{count}</span>
    </button>
  )
}

function RowLine({
  row, selected, checked, onCheck, onClick
}: { row: EventRow; selected: boolean; checked: boolean; onCheck: (id: string, v: boolean) => void; onClick: () => void }) {
  const meta = EVENT_TYPE_META[row.type]
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 py-1.5 border-b border-white/[0.03] last:border-0 cursor-pointer rounded px-1 transition-colors"
      style={selected ? { background: 'rgba(99,102,241,0.12)' } : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => { e.stopPropagation(); onCheck(row.id, e.target.checked) }}
        onClick={e => e.stopPropagation()}
        className="mt-0.5 flex-shrink-0 accent-indigo-500 cursor-pointer"
      />
      <span className="text-zinc-700 font-mono text-[10px] flex-shrink-0 pt-px w-14">
        {formatTimestamp(row.ts)}
      </span>
      <TypeBadge type={row.type} />
      <span
        className="flex-1 text-xs leading-snug break-all min-w-0 truncate"
        style={{ color: row.isError ? '#f87171' : withAlpha(meta.color, 'cc') }}
      >
        {row.summary}
      </span>
    </div>
  )
}

export function DetailPanel({ row }: { row: EventRow | null }) {
  if (!row) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-700 text-xs select-none px-4 text-center">
        Click an event to see details
      </div>
    )
  }
  const meta = EVENT_TYPE_META[row.type]
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
      <div
        className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <TypeBadge type={row.type} />
        <span className="text-xs font-semibold truncate" style={{ color: meta.color }}>
          {row.detail.label}
        </span>
        <span className="ml-auto text-zinc-700 font-mono text-[10px] flex-shrink-0">
          {formatTimestamp(row.ts)}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {row.detail.sections.map((s, i) => (
          <div key={i}>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
              {s.title}
            </div>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap break-all font-mono"
              style={{ color: withAlpha(meta.color, 'dd') }}
            >
              {s.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface EventListProps {
  rows: EventRow[]
  header?: React.ReactNode
  footer?: React.ReactNode
  bottomRef?: React.RefObject<HTMLDivElement>
  checkedIds?: Set<string>
  onCheckedChange?: (ids: Set<string>) => void
  onRowSelect?: (row: EventRow | null) => void
  /** Optional panel rendered to the right of the list (e.g. ChatPanel) */
  rightPanel?: React.ReactNode
  rightPanelWidth?: number
  onRightPanelResize?: (delta: number) => void
}

export function EventList({
  rows, header, footer, bottomRef,
  checkedIds, onCheckedChange,
  onRowSelect, rightPanel, rightPanelWidth, onRightPanelResize
}: EventListProps) {
  const [activeType, setActiveType] = useState<EventType | 'ALL'>('ALL')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const typeCounts: Partial<Record<EventType, number>> = {}
  for (const r of rows) typeCounts[r.type] = (typeCounts[r.type] ?? 0) + 1
  const totalEvents = rows.length
  const activeTypes = (Object.keys(typeCounts) as EventType[]).filter(t => (typeCounts[t] ?? 0) > 0)
  const visibleRows = activeType === 'ALL' ? rows : rows.filter(r => r.type === activeType)

  const handleRowClick = (row: EventRow) => {
    const next = selectedRowId === row.id ? null : row.id
    setSelectedRowId(next)
    onRowSelect?.(next ? row : null)
  }

  const handleCheck = (id: string, v: boolean) => {
    if (!onCheckedChange) return
    const next = new Set(checkedIds ?? [])
    if (v) next.add(id); else next.delete(id)
    onCheckedChange(next)
  }

  const checkedCount = checkedIds?.size ?? 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Event list */}
      <div
        className="flex flex-col flex-1 overflow-hidden border-r"
        style={{ borderRightColor: 'var(--border)' }}
      >
        {header}

        {totalEvents > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto flex-shrink-0 scrollbar-none"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <FilterChip type="ALL" count={totalEvents} active={activeType === 'ALL'} onClick={() => setActiveType('ALL')} />
            {activeTypes.map(t => (
              <FilterChip
                key={t} type={t} count={typeCounts[t] ?? 0}
                active={activeType === t}
                onClick={() => setActiveType(activeType === t ? 'ALL' : t)}
              />
            ))}
            {onCheckedChange && (
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                {checkedCount > 0 && (
                  <span className="text-[10px] text-indigo-400">{checkedCount} selected</span>
                )}
                <button
                  onClick={() => onCheckedChange(new Set(visibleRows.map(r => r.id)))}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 rounded px-1.5 py-0.5 transition-colors border"
                  style={{ borderColor: 'var(--border-faint)' }}
                >
                  All
                </button>
                {checkedCount > 0 && (
                  <button
                    onClick={() => onCheckedChange(new Set())}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {visibleRows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            {footer ?? <span className="text-zinc-700 text-sm">No events</span>}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {visibleRows.map(row => (
              <RowLine
                key={row.id}
                row={row}
                selected={selectedRowId === row.id}
                checked={checkedIds?.has(row.id) ?? false}
                onCheck={handleCheck}
                onClick={() => handleRowClick(row)}
              />
            ))}
            {bottomRef && <div ref={bottomRef} />}
          </div>
        )}
      </div>

      {/* Right panel (e.g. ChatPanel) */}
      {rightPanel && (
        <>
          <ResizeDivider direction="horizontal" onResize={onRightPanelResize ?? (() => {})} />
          <div
            style={{ width: rightPanelWidth ?? 320, flexShrink: 0, background: 'var(--bg-panel)' }}
            className="overflow-hidden"
          >
            {rightPanel}
          </div>
        </>
      )}
    </div>
  )
}
