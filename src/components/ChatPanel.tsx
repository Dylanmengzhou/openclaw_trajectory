import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
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

  const EVAL_PROMPT = `你是一位严格的 AI Agent 质量评审员。请对以下对话轨迹进行评判。

## 第一步：识别用户目标
首先，从对话中明确提取用户的核心诉求（一句话概括）。所有维度的评分都必须以"用户目标是否被达成"为核心判断依据。

## 第二步：任务完成判定
在打分之前，先判断：**Agent 是否成功完成了用户的核心任务？**
- ✅ 成功：任务完整交付，用户目标达成
- ⚠️ 部分成功：主要目标达成但有遗漏/瑕疵
- ❌ 失败：核心任务未完成（无论过程多流畅）

**注意：如果任务失败，D2 内容正确性不得超过 1 分。**

## 第三步：分维度打分（每项 0/1/2 分，必须全部打分）

**D1 工具调用准确性**（若无工具调用默认 2 分）
- 2分：工具选择正确、参数准确、调用链合理高效
- 1分：工具基本对但有小问题：参数有瑕疵、有冗余调用
- 0分：工具选错、关键参数错误导致失败、或该用工具时没用

**D2 内容正确性**（以用户目标是否实现为核心）
- 2分：完全完成了用户要求的任务，内容准确无幻觉
- 1分：部分完成，或核心内容正确但有细节偏差
- 0分：任务未完成、存在关键错误或严重幻觉

**D3 回复表达质量**
- 2分：语言流畅自然、逻辑清晰、风格匹配场景、无冗余
- 1分：基本可读，但有小瑕疵：略显生硬、有少量重复
- 0分：表达混乱、严重语病、不可理解

**D4 格式与结构**
- 2分：完全符合用户指定格式，结构清晰可直接使用
- 1分：格式基本对，有小偏差但不影响使用
- 0分：格式严重不符或缺失

**D5 执行效率与稳定性**
- 2分：执行高效、无冗余步骤、错误处理得当
- 1分：最终完成但过程有冗余：多余重试、绕路
- 0分：严重低效或执行失败

---
请严格按以下格式输出：

## 用户目标
（一句话概括用户想要什么）

## 任务完成判定
**结论：✅/⚠️/❌**
说明：...

## 评估结果

### D1 工具调用准确性
**得分：X/2**
结论：...

### D2 内容正确性
**得分：X/2**
结论：...

### D3 回复表达质量
**得分：X/2**
结论：...

### D4 格式与结构
**得分：X/2**
结论：...

### D5 执行效率与稳定性
**得分：X/2**
结论：...

---
## 综合结论
**总分：X/10**
综合评价：...`

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? input.trim()
    if (!text || loading) return

    const userText = text
    if (!overrideText) setInput('')

    // Append selected logs to user content if any
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
            'You are a helpful assistant that explains AI agent log entries and execution trajectories from the OpenClaw framework. Be concise and clear. Use markdown formatting in your responses.'
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
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-panel)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-semibold text-zinc-400">Chat</span>
        {checkedRows.length > 0 && (
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">
            {checkedRows.length} log{checkedRows.length > 1 ? 's' : ''}
          </span>
        )}
        {checkedRows.length > 0 && (
          <button
            onClick={() => sendMessage(EVAL_PROMPT)}
            disabled={loading}
            className="text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40"
            style={{ color: '#a78bfa', borderColor: '#7c3aed', background: 'rgba(124,58,237,0.1)' }}
            title="按 rubric 评判所选日志"
          >
            Evaluate
          </button>
        )}
        <button
          onClick={() => setMessages([])}
          className="ml-auto text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs select-none text-center px-4">
            {checkedRows.length > 0
              ? `${checkedRows.length} log${checkedRows.length > 1 ? 's' : ''} selected — ask anything about them`
              : 'Select logs with the checkboxes, then ask questions'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] text-xs px-2.5 py-1.5 rounded-lg leading-relaxed break-words bg-indigo-600/20 text-indigo-200 border border-indigo-500/20">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] text-xs px-2.5 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30 prose-chat">
                  {msg.content ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-zinc-300 text-xs leading-relaxed mb-2 last:mb-0">{children}</p>,
                        h1: ({ children }) => <h1 className="text-zinc-200 text-sm font-bold mb-1 mt-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-zinc-200 text-xs font-bold mb-1 mt-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-zinc-300 text-xs font-semibold mb-1 mt-1">{children}</h3>,
                        ul: ({ children }) => <ul className="text-zinc-300 text-xs list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="text-zinc-300 text-xs list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        code: ({ children, className }) => {
                          const isBlock = className?.includes('language-')
                          return isBlock ? (
                            <code className="block bg-zinc-900 border border-zinc-700/50 rounded px-2.5 py-2 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap overflow-x-auto mb-2">
                              {children}
                            </code>
                          ) : (
                            <code className="bg-zinc-900 border border-zinc-700/50 rounded px-1 py-0.5 text-[11px] font-mono text-indigo-300">
                              {children}
                            </code>
                          )
                        },
                        pre: ({ children }) => <pre className="mb-2">{children}</pre>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-zinc-600 pl-2 text-zinc-500 italic mb-2">{children}</blockquote>
                        ),
                        strong: ({ children }) => <strong className="text-zinc-200 font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-zinc-400 italic">{children}</em>,
                        hr: () => <hr className="border-zinc-700 my-2" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="inline-block w-1.5 h-3 bg-zinc-500 animate-pulse align-middle" />
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-t flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <input
          className="flex-1 text-xs rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-600 outline-none transition-colors border"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border-input)',
          }}
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(undefined) } }}
          disabled={loading}
        />
        <button
          onClick={() => sendMessage(undefined)}
          disabled={loading || !input.trim()}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors disabled:opacity-40 flex-shrink-0"
          style={{ color: '#818cf8', borderColor: '#4f46e5', background: 'rgba(79,70,229,0.1)' }}
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  )
}
