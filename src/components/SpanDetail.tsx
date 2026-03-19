import type { Span } from '../types'
import { formatDuration, formatTimestamp, truncate } from '../lib/utils'
import { StatusBadge } from './StatusBadge'
import { TokensInfo } from './TokensInfo'

interface SpanDetailProps {
  span: Span | null
}

const typeColors: Record<string, string> = {
  session: 'text-purple-400',
  turn: 'text-blue-400',
  llm: 'text-indigo-400',
  tool: 'text-orange-400',
  message: 'text-zinc-400'
}

function AttributeRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null

  const displayValue =
    typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value)

  const isLong = displayValue.length > 80

  return (
    <div className="border-b border-[#242424] py-2 last:border-0">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      {isLong ? (
        <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-[#0a0a0a] rounded p-2">
          {displayValue}
        </pre>
      ) : (
        <div className="text-xs text-zinc-300 font-mono break-all">{displayValue}</div>
      )}
    </div>
  )
}

export function SpanDetail({ span }: SpanDetailProps) {
  if (!span) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-6 select-none">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">Select a span to view details</p>
      </div>
    )
  }

  const typeColor = typeColors[span.type] || 'text-zinc-400'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[#242424]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium text-zinc-200 break-all leading-snug">{span.name}</h3>
          <StatusBadge status={span.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${typeColor}`}>
            {span.type}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500 font-mono">{formatDuration(span.duration)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Timing */}
          <section>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Timing</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Start</span>
                <span className="text-zinc-300 font-mono">{formatTimestamp(new Date(span.startTime).toISOString())}</span>
              </div>
              {span.endTime && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">End</span>
                  <span className="text-zinc-300 font-mono">{formatTimestamp(new Date(span.endTime).toISOString())}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Duration</span>
                <span className="text-zinc-300 font-mono">{formatDuration(span.duration)}</span>
              </div>
            </div>
          </section>

          {/* Tokens & Cost */}
          {(span.tokens || span.cost !== undefined) && (
            <section>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tokens & Cost</h4>
              <TokensInfo tokens={span.tokens} cost={span.cost} />
            </section>
          )}

          {/* Attributes */}
          {Object.keys(span.attributes).length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Attributes</h4>
              <div className="bg-[#0d0d0d] rounded border border-[#242424] px-3">
                {Object.entries(span.attributes).map(([key, value]) => (
                  <AttributeRow key={key} label={key} value={value} />
                ))}
              </div>
            </section>
          )}

          {/* Span ID */}
          <section>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Span ID</h4>
            <div className="text-xs text-zinc-500 font-mono break-all">{truncate(span.id, 60)}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
