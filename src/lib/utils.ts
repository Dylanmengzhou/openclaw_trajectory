// ─── Event type classification (ported from clawmetry) ───────────────────────

export type EventType =
  | 'AGENT' | 'THINK' | 'USER' | 'CONTEXT' | 'RESULT'
  | 'READ' | 'WRITE' | 'EXEC' | 'BROWSER' | 'SEARCH'
  | 'SPAWN' | 'MSG' | 'TOOL'

export const EVENT_TYPE_META: Record<EventType, { color: string; bg: string }> = {
  AGENT:   { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  THINK:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  USER:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  CONTEXT: { color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  RESULT:  { color: 'var(--color-result)', bg: 'var(--bg-result)' },
  READ:    { color: 'var(--color-read)', bg: 'var(--bg-read)' },
  WRITE:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  EXEC:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  BROWSER: { color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  SEARCH:  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  SPAWN:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  MSG:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  TOOL:    { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
}

/** Classify a tool name into an event type — mirrors clawmetry's tool_to_type() */
export function toolToType(toolName: string): EventType {
  const tn = toolName.toLowerCase()
  if (tn === 'exec' || tn.includes('shell') || tn.includes('bash') || tn === 'process') return 'EXEC'
  if (tn.includes('read')) return 'READ'
  if (tn.includes('write') || tn.includes('edit')) return 'WRITE'
  if (tn.includes('browser') || tn.includes('canvas') || tn.includes('image')) return 'BROWSER'
  if (tn === 'message' || tn.includes('tts')) return 'MSG'
  if (tn.includes('web_search') || tn.includes('web_fetch') || tn.includes('search')) return 'SEARCH'
  if (tn.includes('subagent') || tn.includes('spawn')) return 'SPAWN'
  return 'TOOL'
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

export function formatCost(cost: number | undefined): string {
  if (cost === undefined || cost === null) return '—'
  if (cost === 0) return '$0.00'
  if (cost < 0.001) return `$${cost.toFixed(6)}`
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(3)}`
}

export function formatTimestamp(ts: string | number | undefined): string {
  if (!ts) return '—'
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(ts)
  }
}

export function formatTokens(tokens: { input: number; output: number; cache: number } | undefined): string {
  if (!tokens) return '—'
  const total = tokens.input + tokens.output + tokens.cache
  return `${total.toLocaleString()} (in: ${tokens.input.toLocaleString()}, out: ${tokens.output.toLocaleString()}, cache: ${tokens.cache.toLocaleString()})`
}

export function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Append a hex alpha suffix only for plain hex colors; CSS variables can't use this trick. */
export function withAlpha(color: string, alpha: string): string {
  if (color.startsWith('var(')) return color
  return color + alpha
}
