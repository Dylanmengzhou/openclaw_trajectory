// ─── Actual OpenClaw JSONL content types ─────────────────────────────────────

export interface ContentText {
  type: 'text'
  text: string
}

export interface ContentThinking {
  type: 'thinking'
  thinking: string
  thinkingSignature?: string
}

export interface ContentToolCall {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
  partialJson?: string
}

export type ContentItem = ContentText | ContentThinking | ContentToolCall

export interface OpenClawUsage {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  totalTokens?: number
  cost?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
    total?: number
  }
}

// The inner message object (what sits under line.message)
export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'toolResult'
  content: ContentItem[]
  /** Only on toolResult messages */
  toolCallId?: string
  toolName?: string
  api?: string
  provider?: string
  model?: string
  usage?: OpenClawUsage
}

// A single raw line in a JSONL session file
export interface OpenClawLine {
  type: 'message' | 'session' | 'model_change' | 'thinking_level_change' | 'custom' | string
  id?: string
  parentId?: string
  timestamp: string
  message?: OpenClawMessage
  // Extra fields on non-message lines
  customType?: string
  provider?: string
  modelId?: string
}

// Gateway WebSocket message types
export interface GatewayFrame {
  type: 'req' | 'res' | 'event'
  id?: string
  method?: string
  params?: Record<string, unknown>
  ok?: boolean
  payload?: Record<string, unknown>
  event?: string
  seq?: number
  stateVersion?: Record<string, unknown>
}

export interface AgentEventPayload {
  runId: string
  stream: 'lifecycle' | 'assistant' | 'tool' | 'thinking' | 'model.usage'
  ts: string
  data: Record<string, unknown>
}

// ─── Internal span model ──────────────────────────────────────────────────────

export interface Span {
  id: string
  parentId?: string
  name: string
  type: 'session' | 'turn' | 'llm' | 'tool' | 'message'
  startTime: number // epoch ms
  endTime?: number
  duration?: number // ms
  status: 'running' | 'success' | 'error'
  attributes: Record<string, unknown>
  tokens?: { input: number; output: number; cache: number }
  cost?: number
  children?: Span[]
}

export interface Trace {
  id: string
  sessionKey: string
  agentId: string
  startTime: number
  endTime?: number
  spanCount: number
  totalCost: number
  totalTokens: number
  spans: Span[] // flat list, use parentId to build tree
}

export interface AgentInfo {
  agentId: string
}

export interface SessionInfo {
  sessionId: string
  updatedAt?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  channel?: string
  displayName?: string
  origin?: Record<string, unknown>
}

export interface AppState {
  agents: AgentInfo[]
  sessions: Record<string, SessionInfo[]>
  selectedAgentId: string | null
  selectedSessionId: string | null
  selectedSpanId: string | null
  liveMode: boolean
  trace: Trace | null
  loadingTrace: boolean
  error: string | null
}

export type AppAction =
  | { type: 'SET_AGENTS'; payload: AgentInfo[] }
  | { type: 'SET_SESSIONS'; payload: { agentId: string; sessions: SessionInfo[] } }
  | { type: 'SELECT_AGENT'; payload: string }
  | { type: 'SELECT_SESSION'; payload: { agentId: string; sessionId: string } }
  | { type: 'SELECT_SPAN'; payload: string | null }
  | { type: 'SET_LIVE_MODE'; payload: boolean }
  | { type: 'SET_TRACE'; payload: Trace | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'APPEND_LIVE_LINE'; payload: OpenClawLine }
