import type { Trace, Span } from '../types'
import { formatDuration, formatCost } from '../lib/utils'
import { TimelineChart } from './TimelineChart'
import { SpanTree } from './SpanTree'
import { buildSpanTree } from '../lib/openclawAdapter'

interface TraceViewProps {
  trace: Trace
  selectedSpanId: string | null
  onSelectSpan: (id: string | null) => void
}

function TraceSummary({ trace }: { trace: Trace }) {
  const duration = trace.endTime ? trace.endTime - trace.startTime : undefined

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-[#141414] border-b border-[#242424]">
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Session</div>
        <div className="text-sm font-mono text-zinc-300">{(trace.sessionKey || '').slice(0, 12)}…</div>
      </div>
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Agent</div>
        <div className="text-sm font-mono text-zinc-300">{trace.agentId}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Duration</div>
        <div className="text-sm font-mono text-zinc-300">{formatDuration(duration)}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Spans</div>
        <div className="text-sm font-mono text-zinc-300">{trace.spanCount}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Tokens</div>
        <div className="text-sm font-mono text-indigo-300">{trace.totalTokens.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-600 mb-0.5">Total Cost</div>
        <div className="text-sm font-mono text-green-400">{formatCost(trace.totalCost)}</div>
      </div>
    </div>
  )
}

export function TraceView({ trace, selectedSpanId, onSelectSpan }: TraceViewProps) {
  const treeSpans: Span[] = buildSpanTree(trace.spans)

  if (trace.spans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 select-none">
        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No events in this session yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TraceSummary trace={trace} />

      <div className="border-b border-[#242424]">
        <TimelineChart
          spans={treeSpans}
          startTime={trace.startTime}
          endTime={trace.endTime}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <SpanTree
          spans={treeSpans}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
        />
      </div>
    </div>
  )
}
