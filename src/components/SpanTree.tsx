import { useState, useCallback } from 'react'
import type { Span } from '../types'
import { formatDuration } from '../lib/utils'
import { StatusBadge } from './StatusBadge'
import { TokensInfo } from './TokensInfo'

interface SpanTreeProps {
  spans: Span[]
  selectedSpanId: string | null
  onSelectSpan: (id: string) => void
}

const typeColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  session: { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  turn: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  llm: { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  tool: { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  message: { bg: 'bg-zinc-500/10', text: 'text-zinc-300', border: 'border-zinc-500/30', dot: 'bg-zinc-400' }
}

interface SpanRowProps {
  span: Span
  depth: number
  selectedSpanId: string | null
  onSelectSpan: (id: string) => void
  expandedIds: Set<string>
  onToggle: (id: string) => void
}

function SpanRow({ span, depth, selectedSpanId, onSelectSpan, expandedIds, onToggle }: SpanRowProps) {
  const hasChildren = span.children && span.children.length > 0
  const isExpanded = expandedIds.has(span.id)
  const isSelected = span.id === selectedSpanId
  const colors = typeColors[span.type] || typeColors.message

  return (
    <>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-[#1a1a1a]
          transition-colors duration-100 group
          ${isSelected ? `${colors.bg} border-l-2 ${colors.border}` : 'hover:bg-white/[0.03]'}
        `}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onSelectSpan(span.id)}
      >
        {/* Expand toggle */}
        <button
          className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-400 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(span.id) }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 6 10">
              <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} opacity-60`} />
          )}
        </button>

        {/* Type badge */}
        <span className={`text-xs font-mono font-semibold uppercase tracking-wider flex-shrink-0 w-14 ${colors.text}`}>
          {span.type}
        </span>

        {/* Name */}
        <span className="flex-1 text-sm text-zinc-300 truncate min-w-0" title={span.name}>
          {span.name}
        </span>

        {/* Right side info */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <TokensInfo tokens={span.tokens} cost={span.cost} compact />
          <span className="text-xs text-zinc-600 font-mono w-16 text-right">
            {formatDuration(span.duration)}
          </span>
          <StatusBadge status={span.status} />
        </div>
      </div>

      {hasChildren && isExpanded && span.children!.map(child => (
        <SpanRow
          key={child.id}
          span={child}
          depth={depth + 1}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
          expandedIds={expandedIds}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

function collectAllIds(spans: Span[]): string[] {
  const ids: string[] = []
  for (const span of spans) {
    ids.push(span.id)
    if (span.children) ids.push(...collectAllIds(span.children))
  }
  return ids
}

export function SpanTree({ spans, selectedSpanId, onSelectSpan }: SpanTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    for (const span of spans) ids.add(span.id)
    return ids
  })

  const onToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(collectAllIds(spans)))
  }, [spans])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  if (spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        No spans to display
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#242424]">
        <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Span Tree</span>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Expand all
          </button>
          <span className="text-zinc-700">·</span>
          <button
            onClick={collapseAll}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {spans.map(span => (
          <SpanRow
            key={span.id}
            span={span}
            depth={0}
            selectedSpanId={selectedSpanId}
            onSelectSpan={onSelectSpan}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}
