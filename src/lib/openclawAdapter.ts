import type { OpenClawLine, ContentToolCall, Span, Trace } from '../types'

let spanCounter = 0
function nextId(prefix: string): string {
  return `${prefix}-${++spanCounter}`
}

function makeSpan(
  id: string,
  name: string,
  type: Span['type'],
  startTime: number,
  parentId?: string,
  attributes: Record<string, unknown> = {}
): Span {
  return { id, parentId, name, type, startTime, status: 'running', attributes, children: [] }
}

/**
 * Parse OpenClaw JSONL lines into a Trace with span hierarchy.
 *
 * Actual format (v3):
 *   { type: "message", timestamp, message: { role, content[], usage?, model? } }
 *   { type: "message", timestamp, message: { role: "toolResult", toolCallId, toolName, content[] } }
 *
 * Hierarchy:
 *   Session (virtual root)
 *     └─ Turn N  (each user text message)
 *          └─ LLM call  (each assistant message)
 *               └─ tool_name  (each toolCall in that assistant message)
 */
export function linesToTrace(lines: OpenClawLine[], agentId: string, sessionId: string): Trace {
  spanCounter = 0

  const flatSpans = new Map<string, Span>()
  const toolSpanById = new Map<string, Span>() // toolCallId → Span

  let totalCost = 0
  let totalInput = 0
  let totalOutput = 0
  let totalCache = 0

  // Find first message timestamp
  const firstMsgLine = lines.find(l => l.type === 'message' && l.message)
  const firstTs = firstMsgLine?.timestamp
    ? new Date(firstMsgLine.timestamp).getTime()
    : Date.now()

  // Virtual session root span
  const sessionSpan = makeSpan('session-root', `Session ${sessionId.slice(0, 8)}`, 'session', firstTs)
  flatSpans.set(sessionSpan.id, sessionSpan)

  let currentTurnSpan: Span | null = null
  let currentLLMSpan: Span | null = null
  let turnIndex = 0

  // Only process message lines
  const msgLines = lines.filter(l => l.type === 'message' && l.message)

  for (let i = 0; i < msgLines.length; i++) {
    const line = msgLines[i]
    const msg = line.message!
    const ts = line.timestamp ? new Date(line.timestamp).getTime() : firstTs + i * 100

    if (msg.role === 'user') {
      const textItems = msg.content.filter(c => c.type === 'text')

      if (textItems.length > 0) {
        // Close previous turn if open
        if (currentTurnSpan && !currentTurnSpan.endTime) {
          const closed: Span = {
            ...currentTurnSpan,
            endTime: ts,
            duration: ts - currentTurnSpan.startTime,
            status: 'success'
          }
          flatSpans.set(closed.id, closed)
          currentTurnSpan = closed
        }

        turnIndex++
        const firstText = textItems[0]
        const userText = firstText.type === 'text'
          ? String(firstText.text).slice(0, 60)
          : `Turn ${turnIndex}`

        const turnId = nextId('turn')
        const turn = makeSpan(turnId, userText, 'turn', ts, sessionSpan.id, {
          userMessage: userText,
          index: turnIndex
        })
        currentTurnSpan = turn
        currentLLMSpan = null
        flatSpans.set(turnId, turn)
      }
    }

    if (msg.role === 'toolResult') {
      // Update the matching tool span with its result
      const toolCallId = msg.toolCallId
      if (toolCallId) {
        const toolSpan = toolSpanById.get(toolCallId)
        if (toolSpan) {
          const resultText = msg.content
            .filter(c => c.type === 'text')
            .map(c => c.type === 'text' ? c.text : '')
            .join('').slice(0, 200)
          const updated: Span = {
            ...toolSpan,
            endTime: ts,
            duration: ts - toolSpan.startTime,
            status: 'success',
            attributes: { ...toolSpan.attributes, result: resultText }
          }
          toolSpanById.set(toolCallId, updated)
          flatSpans.set(updated.id, updated)
        }
      }
    }

    if (msg.role === 'assistant') {
      // Close previous LLM span if open
      if (currentLLMSpan && !currentLLMSpan.endTime) {
        const closed: Span = {
          ...currentLLMSpan,
          endTime: ts,
          duration: ts - currentLLMSpan.startTime,
          status: 'success'
        }
        flatSpans.set(closed.id, closed)
        currentLLMSpan = closed
      }

      const usage = msg.usage
      const cost = usage?.cost?.total ?? 0
      totalCost += cost
      totalInput += usage?.input ?? 0
      totalOutput += usage?.output ?? 0
      totalCache += (usage?.cacheRead ?? 0) + (usage?.cacheWrite ?? 0)

      const modelName = msg.model ? msg.model.split('/').pop() ?? msg.model : 'llm'
      const llmId = nextId('llm')
      const llmParentId = currentTurnSpan?.id ?? sessionSpan.id

      const llmSpan = makeSpan(llmId, `LLM: ${modelName}`, 'llm', ts, llmParentId, {
        model: msg.model,
        provider: msg.provider,
        inputTokens: usage?.input,
        outputTokens: usage?.output,
        cacheRead: usage?.cacheRead,
        cacheWrite: usage?.cacheWrite,
        cost
      })

      if (usage) {
        llmSpan.tokens = {
          input: usage.input ?? 0,
          output: usage.output ?? 0,
          cache: (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
        }
        llmSpan.cost = cost
      }

      // Look ahead to estimate end time (next message timestamp)
      const nextLine = msgLines[i + 1]
      const nextTs = nextLine?.timestamp ? new Date(nextLine.timestamp).getTime() : undefined
      if (nextTs) {
        llmSpan.endTime = nextTs
        llmSpan.duration = nextTs - ts
        llmSpan.status = 'success'
      }

      currentLLMSpan = llmSpan
      flatSpans.set(llmId, llmSpan)

      // Create tool spans for each toolCall in content
      const toolCalls = msg.content.filter(
        (c): c is ContentToolCall => c.type === 'toolCall'
      )

      for (const tc of toolCalls) {
        const toolId = nextId('tool')
        const toolSpan = makeSpan(toolId, tc.name, 'tool', ts, llmId, {
          toolCallId: tc.id,
          toolName: tc.name,
          input: tc.arguments
        })
        toolSpanById.set(tc.id, toolSpan)
        flatSpans.set(toolId, toolSpan)
      }
    }
  }

  // Close any still-open spans
  const lastLine = msgLines[msgLines.length - 1]
  const lastTs = lastLine?.timestamp
    ? new Date(lastLine.timestamp).getTime()
    : Date.now()

  for (const [id, span] of flatSpans) {
    if (!span.endTime && span.id !== sessionSpan.id) {
      flatSpans.set(id, {
        ...span,
        endTime: lastTs,
        duration: lastTs - span.startTime,
        status: 'success'
      })
    }
  }

  // Close session span
  flatSpans.set(sessionSpan.id, {
    ...sessionSpan,
    endTime: lastTs,
    duration: lastTs - sessionSpan.startTime,
    status: 'success'
  })

  const spans = Array.from(flatSpans.values())
  const totalTokens = totalInput + totalOutput + totalCache

  return {
    id: sessionId,
    sessionKey: sessionId,
    agentId,
    startTime: firstTs,
    endTime: lastTs,
    spanCount: spans.length,
    totalCost,
    totalTokens,
    spans
  }
}

export function buildSpanTree(spans: Span[]): Span[] {
  const spanMap = new Map<string, Span>()
  const roots: Span[] = []

  for (const span of spans) {
    spanMap.set(span.id, { ...span, children: [] })
  }

  for (const [, span] of spanMap) {
    if (span.parentId && spanMap.has(span.parentId)) {
      const parent = spanMap.get(span.parentId)!
      if (!parent.children) parent.children = []
      parent.children.push(span)
    } else {
      roots.push(span)
    }
  }

  return roots
}
