import { useState, useRef, useEffect } from 'react'
import type { EventRow } from './EventList'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  checkedRows: EventRow[]
}

export function ChatPanel({ checkedRows }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userText = input.trim()
    setInput('')

    // Build user content: append selected logs if any
    let userContent = userText
    if (checkedRows.length > 0) {
      const logContext = checkedRows
        .map(r => `[${r.type}] ${r.summary}\n${r.detail.sections.map(s => `${s.title}:\n${s.content}`).join('\n')}`)
        .join('\n\n---\n\n')
      userContent = `${userText}\n\n<selected_logs>\n${logContext}\n</selected_logs>`
    }

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent }
    ]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt:
            'You are a helpful assistant that explains AI agent log entries and execution trajectories from the OpenClaw framework. Be concise and clear.'
        })
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              assistantContent += event.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
            if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: `Error: ${event.message}` }
                return updated
              })
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const placeholder = checkedRows.length > 0
    ? `Ask about ${checkedRows.length} selected log${checkedRows.length > 1 ? 's' : ''}…`
    : 'Ask about these logs…'

  return (
    <div className="flex flex-col h-full border-t border-[#242424] bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#242424] bg-[#141414] flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-400">Chat</span>
        {checkedRows.length > 0 && (
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">
            {checkedRows.length} log{checkedRows.length > 1 ? 's' : ''} selected
          </span>
        )}
        <button
          onClick={() => setMessages([])}
          className="ml-auto text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs select-none text-center px-4">
            {checkedRows.length > 0
              ? `${checkedRows.length} log${checkedRows.length > 1 ? 's' : ''} selected — ask anything about them`
              : 'Select logs with the checkboxes, then ask questions'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] text-xs px-2.5 py-1.5 rounded-lg leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/20'
                    : 'bg-zinc-800/50 text-zinc-300 border border-zinc-700/30'
                }`}
              >
                {msg.content}
                {loading && i === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                  <span className="inline-block w-1.5 h-3 bg-zinc-500 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#242424] bg-[#141414] flex-shrink-0">
        <input
          className="flex-1 text-xs bg-[#1a1a1a] border border-[#333] rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors disabled:opacity-40"
          style={{ color: '#818cf8', borderColor: '#4f46e5', background: 'rgba(79,70,229,0.1)' }}
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  )
}
