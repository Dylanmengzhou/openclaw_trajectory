import { useEffect, useRef, useState, useCallback } from 'react'
import type { AgentEventPayload } from '../types'

// Status now reflects server-side gateway connection
export type WebSocketStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error'

export interface LiveEvent {
  ts: string
  stream: AgentEventPayload['stream']
  runId?: string
  data: Record<string, unknown>
}

interface UseWebSocketResult {
  status: WebSocketStatus
  events: LiveEvent[]
  connect: () => void
  disconnect: () => void
  clearEvents: () => void
}

const MAX_EVENTS = 500

/**
 * Connects to our Express server's SSE endpoint (/api/gateway/stream),
 * which in turn proxies the OpenClaw gateway WebSocket.
 * This avoids browser-side client schema validation issues.
 */
export function useWebSocket(enabled: boolean): UseWebSocketResult {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [events, setEvents] = useState<LiveEvent[]>([])
  const esRef = useRef<EventSource | null>(null)
  const enabledRef = useRef(enabled)

  useEffect(() => { enabledRef.current = enabled }, [enabled])

  const addEvent = useCallback((evt: LiveEvent) => {
    setEvents(prev => {
      const next = [...prev, evt]
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
    })
  }, [])

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setStatus('disconnected')
  }, [])

  const connect = useCallback(() => {
    if (esRef.current) return // already connected
    setStatus('connecting')

    const es = new EventSource('/api/gateway/stream')
    esRef.current = es

    es.onmessage = (msgEvent) => {
      let msg: { type: string; status?: string; payload?: unknown; error?: unknown }
      try {
        msg = JSON.parse(msgEvent.data as string)
      } catch {
        return
      }

      if (msg.type === 'status' && msg.status) {
        setStatus(msg.status as WebSocketStatus)
        return
      }

      if (msg.type === 'agent-event' && msg.payload) {
        const p = msg.payload as AgentEventPayload
        addEvent({
          ts: p.ts || new Date().toISOString(),
          stream: p.stream,
          runId: p.runId,
          data: p.data ?? {}
        })
      }
    }

    es.onerror = () => {
      // SSE will auto-reconnect; just reflect connecting state
      setStatus('connecting')
    }
  }, [addEvent])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }
    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [enabled, connect, disconnect])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { status, events, connect, disconnect, clearEvents }
}
