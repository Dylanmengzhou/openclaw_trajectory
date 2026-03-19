import type { Span } from '../types'

interface StatusBadgeProps {
  status: Span['status']
  size?: 'sm' | 'md'
}

const statusConfig = {
  running: {
    label: 'Running',
    className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  },
  success: {
    label: 'Done',
    className: 'bg-green-500/20 text-green-400 border border-green-500/30'
  },
  error: {
    label: 'Error',
    className: 'bg-red-500/20 text-red-400 border border-red-500/30'
  }
} as const

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.running
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded font-mono font-medium ${sizeClass} ${config.className}`}>
      {status === 'running' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {config.label}
    </span>
  )
}
