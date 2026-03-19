interface TokensInfoProps {
  tokens?: { input: number; output: number; cache: number }
  cost?: number
  compact?: boolean
}

export function TokensInfo({ tokens, cost, compact = false }: TokensInfoProps) {
  if (!tokens && cost === undefined) return null

  if (compact) {
    const total = tokens ? tokens.input + tokens.output + tokens.cache : 0
    return (
      <span className="text-xs text-zinc-500 font-mono">
        {tokens ? `${total.toLocaleString()} tok` : ''}
        {tokens && cost !== undefined ? ' · ' : ''}
        {cost !== undefined ? `$${cost.toFixed(4)}` : ''}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      {tokens && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#1a1a2e]/60 rounded p-2 text-center">
            <div className="text-xs text-zinc-500 mb-1">Input</div>
            <div className="text-sm font-mono text-indigo-300">{tokens.input.toLocaleString()}</div>
          </div>
          <div className="bg-[#1a1a2e]/60 rounded p-2 text-center">
            <div className="text-xs text-zinc-500 mb-1">Output</div>
            <div className="text-sm font-mono text-indigo-300">{tokens.output.toLocaleString()}</div>
          </div>
          <div className="bg-[#1a1a2e]/60 rounded p-2 text-center">
            <div className="text-xs text-zinc-500 mb-1">Cache</div>
            <div className="text-sm font-mono text-indigo-300">{tokens.cache.toLocaleString()}</div>
          </div>
        </div>
      )}
      {cost !== undefined && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Cost</span>
          <span className="font-mono text-green-400">${cost.toFixed(5)}</span>
        </div>
      )}
    </div>
  )
}
