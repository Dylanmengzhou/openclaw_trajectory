import type { Span } from '../types'
import { formatDuration } from '../lib/utils'

interface TimelineChartProps {
  spans: Span[]
  startTime: number
  endTime?: number
  selectedSpanId: string | null
  onSelectSpan: (id: string) => void
}

const typeColors: Record<string, string> = {
  session: 'bg-purple-500/70 border-purple-400/50',
  turn: 'bg-blue-500/70 border-blue-400/50',
  llm: 'bg-indigo-500/70 border-indigo-400/50',
  tool: 'bg-orange-500/70 border-orange-400/50',
  message: 'bg-zinc-500/70 border-zinc-400/50'
}

const typeTextColors: Record<string, string> = {
  session: 'text-purple-200',
  turn: 'text-blue-200',
  llm: 'text-indigo-200',
  tool: 'text-orange-200',
  message: 'text-zinc-200'
}

function flattenSpans(spans: Span[], result: Span[] = []): Span[] {
  for (const span of spans) {
    result.push(span)
    if (span.children) flattenSpans(span.children, result)
  }
  return result
}

function TimelineRow({
  span,
  totalDuration,
  traceStart,
  selectedSpanId,
  onSelectSpan
}: {
  span: Span
  totalDuration: number
  traceStart: number
  selectedSpanId: string | null
  onSelectSpan: (id: string) => void
}) {
  const isSelected = span.id === selectedSpanId
  const colors = typeColors[span.type] || typeColors.message
  const textColor = typeTextColors[span.type] || typeTextColors.message

  const offset = totalDuration > 0
    ? ((span.startTime - traceStart) / totalDuration) * 100
    : 0

  const spanEnd = span.endTime || span.startTime + (span.duration || 0)
  const rawWidth = totalDuration > 0
    ? ((spanEnd - span.startTime) / totalDuration) * 100
    : 0
  const width = Math.max(rawWidth, 0.3)

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 cursor-pointer group transition-colors ${isSelected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'}`}
      onClick={() => onSelectSpan(span.id)}
    >
      {/* Label */}
      <div className="w-40 flex-shrink-0 flex items-center gap-1.5 min-w-0">
        <span className={`text-xs font-mono font-semibold uppercase w-10 flex-shrink-0 ${textColor}`}>
          {span.type.slice(0, 4)}
        </span>
        <span className="text-xs text-zinc-400 truncate">{span.name}</span>
      </div>

      {/* Bar */}
      <div className="flex-1 relative h-5 bg-[#0d0d0d] rounded overflow-hidden">
        <div
          className={`absolute top-0 h-full rounded border ${colors} transition-all duration-300 ${isSelected ? 'ring-1 ring-white/20' : ''}`}
          style={{
            left: `${Math.min(offset, 99.7)}%`,
            width: `${Math.min(width, 100 - offset)}%`
          }}
        />
      </div>

      {/* Duration */}
      <div className="w-16 flex-shrink-0 text-right">
        <span className="text-xs text-zinc-500 font-mono">{formatDuration(span.duration)}</span>
      </div>
    </div>
  )
}

export function TimelineChart({ spans, startTime, endTime, selectedSpanId, onSelectSpan }: TimelineChartProps) {
  const flatSpans = flattenSpans(spans)

  if (flatSpans.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-zinc-600 text-sm">
        No timeline data
      </div>
    )
  }

  const traceEnd = endTime || Math.max(...flatSpans.map(s => s.endTime || s.startTime + (s.duration || 0)))
  const totalDuration = traceEnd - startTime

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#242424]">
        <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Timeline</span>
        <span className="text-xs text-zinc-600 font-mono">{formatDuration(totalDuration)} total</span>
      </div>

      {/* Time axis labels */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-[#1a1a1a]">
        <div className="w-40 flex-shrink-0" />
        <div className="flex-1 flex justify-between">
          <span className="text-xs text-zinc-700 font-mono">0</span>
          <span className="text-xs text-zinc-700 font-mono">{formatDuration(totalDuration / 2)}</span>
          <span className="text-xs text-zinc-700 font-mono">{formatDuration(totalDuration)}</span>
        </div>
        <div className="w-16 flex-shrink-0" />
      </div>

      <div className="overflow-y-auto max-h-64">
        {flatSpans.map(span => (
          <TimelineRow
            key={span.id}
            span={span}
            totalDuration={totalDuration}
            traceStart={startTime}
            selectedSpanId={selectedSpanId}
            onSelectSpan={onSelectSpan}
          />
        ))}
      </div>
    </div>
  )
}
