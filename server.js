import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw')
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents')

function expandPath(p) {
  return p.replace(/^~/, os.homedir())
}

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

function parseJsonlFile(filePath) {
  const content = safeReadFile(filePath)
  if (!content) return []

  const lines = content.split('\n').filter(line => line.trim())
  const events = []

  for (const line of lines) {
    try {
      events.push(JSON.parse(line))
    } catch {
      // skip malformed lines
    }
  }

  return events
}

// GET /api/agents - list agent IDs
app.get('/api/agents', (req, res) => {
  try {
    const agentsDir = expandPath(AGENTS_DIR)
    const entries = safeReadDir(agentsDir)

    const agents = entries.filter(entry => {
      try {
        const stat = fs.statSync(path.join(agentsDir, entry))
        return stat.isDirectory()
      } catch {
        return false
      }
    })

    res.json({ agents })
  } catch (err) {
    console.error('Error listing agents:', err)
    res.status(500).json({ error: 'Failed to list agents' })
  }
})

// GET /api/agents/:agentId/sessions - list sessions for an agent
app.get('/api/agents/:agentId/sessions', (req, res) => {
  try {
    const { agentId } = req.params
    const sessionsDir = expandPath(path.join(AGENTS_DIR, agentId, 'sessions'))
    const indexPath = path.join(sessionsDir, 'sessions.json')

    // sessions.json is a MAP keyed by sessionKey, e.g. { "agent:abc:main": { sessionId, updatedAt, ... } }
    const indexContent = safeReadFile(indexPath)
    if (indexContent) {
      try {
        const indexMap = JSON.parse(indexContent)
        if (indexMap && typeof indexMap === 'object' && !Array.isArray(indexMap)) {
          const sessions = Object.entries(indexMap).map(([sessionKey, meta]) => ({
            sessionId: meta.sessionId || sessionKey,
            sessionKey,
            ...meta
          }))
          return res.json({ sessions })
        }
        if (Array.isArray(indexMap)) {
          return res.json({ sessions: indexMap })
        }
      } catch {
        // fall through to directory listing
      }
    }

    // Fall back to listing .jsonl files
    const entries = safeReadDir(sessionsDir)
    const sessions = entries
      .filter(e => e.endsWith('.jsonl') && !e.includes('.reset.'))
      .map(e => ({
        sessionId: e.replace('.jsonl', ''),
        sessionKey: e.replace('.jsonl', '')
      }))

    res.json({ sessions })
  } catch (err) {
    console.error('Error listing sessions:', err)
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

// GET /api/sessions/:agentId/:sessionId - return parsed JSONL events
app.get('/api/sessions/:agentId/:sessionId', (req, res) => {
  try {
    const { agentId, sessionId } = req.params
    const filePath = expandPath(
      path.join(AGENTS_DIR, agentId, 'sessions', `${sessionId}.jsonl`)
    )

    const events = parseJsonlFile(filePath)
    res.json({ events })
  } catch (err) {
    console.error('Error reading session:', err)
    res.status(500).json({ error: 'Failed to read session' })
  }
})

// GET /api/sessions/:agentId/:sessionId/stream - SSE endpoint
app.get('/api/sessions/:agentId/:sessionId/stream', (req, res) => {
  const { agentId, sessionId } = req.params
  const filePath = expandPath(
    path.join(AGENTS_DIR, agentId, 'sessions', `${sessionId}.jsonl`)
  )

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Read existing content first
  const existingContent = safeReadFile(filePath)
  if (existingContent) {
    const lines = existingContent.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        sendEvent(event)
      } catch {
        // skip malformed lines
      }
    }
  }

  // Watch for new lines using fs.watch
  let lastSize = existingContent ? Buffer.byteLength(existingContent, 'utf-8') : 0
  let watcher = null

  try {
    watcher = fs.watch(filePath, (eventType) => {
      if (eventType !== 'change') return

      try {
        const stat = fs.statSync(filePath)
        if (stat.size <= lastSize) return

        const fd = fs.openSync(filePath, 'r')
        const newBytes = stat.size - lastSize
        const buffer = Buffer.alloc(newBytes)
        fs.readSync(fd, buffer, 0, newBytes, lastSize)
        fs.closeSync(fd)

        lastSize = stat.size

        const newContent = buffer.toString('utf-8')
        const newLines = newContent.split('\n').filter(l => l.trim())

        for (const line of newLines) {
          try {
            const event = JSON.parse(line)
            sendEvent(event)
          } catch {
            // skip malformed lines
          }
        }
      } catch (readErr) {
        console.error('Error reading new content:', readErr)
      }
    })
  } catch (watchErr) {
    if (watchErr.code !== 'ENOENT') {
      console.error('Error watching file:', watchErr)
    }
  }

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 15000)

  req.on('close', () => {
    clearInterval(keepAlive)
    if (watcher) {
      try { watcher.close() } catch {}
    }
  })
})

// ─── Live JSONL stream (tail the most-recently-modified session file) ─────────

function findLatestSession() {
  let latestFile = null, latestMtime = 0, agentId = null, sessionId = null

  for (const agent of safeReadDir(AGENTS_DIR)) {
    const sessDir = path.join(AGENTS_DIR, agent, 'sessions')
    for (const f of safeReadDir(sessDir)) {
      if (!f.endsWith('.jsonl') || f.includes('.reset.')) continue
      const filePath = path.join(AGENTS_DIR, agent, 'sessions', f)
      try {
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs
          latestFile = filePath
          agentId = agent
          sessionId = f.replace('.jsonl', '')
        }
      } catch { /* skip */ }
    }
  }
  return { file: latestFile, agentId, sessionId }
}

// GET /api/live - return info about the latest session
app.get('/api/live', (req, res) => {
  const { file, agentId, sessionId } = findLatestSession()
  if (!file) return res.status(404).json({ error: 'No sessions found' })
  res.json({ agentId, sessionId })
})

// GET /api/live/stream - SSE that tails the latest session JSONL
app.get('/api/live/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const { file, agentId, sessionId } = findLatestSession()
  if (!file) {
    res.write(`data: ${JSON.stringify({ type: '__meta', error: 'no-sessions' })}\n\n`)
    res.end()
    return
  }

  // Send meta so client knows which session it's watching
  res.write(`data: ${JSON.stringify({ type: '__meta', agentId, sessionId })}\n\n`)

  // Stream all existing lines
  const existingContent = safeReadFile(file)
  let lastSize = 0
  if (existingContent) {
    const lines = existingContent.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        res.write(`data: ${JSON.stringify(parsed)}\n\n`)
      } catch { /* skip malformed */ }
    }
    lastSize = Buffer.byteLength(existingContent, 'utf-8')
  }

  // Watch for new lines
  let watcher = null
  try {
    watcher = fs.watch(file, (eventType) => {
      if (eventType !== 'change') return
      try {
        const stat = fs.statSync(file)
        if (stat.size <= lastSize) return
        const fd = fs.openSync(file, 'r')
        const newBytes = stat.size - lastSize
        const buffer = Buffer.alloc(newBytes)
        fs.readSync(fd, buffer, 0, newBytes, lastSize)
        fs.closeSync(fd)
        lastSize = stat.size
        const newLines = buffer.toString('utf-8').split('\n').filter(l => l.trim())
        for (const line of newLines) {
          try {
            const parsed = JSON.parse(line)
            res.write(`data: ${JSON.stringify(parsed)}\n\n`)
          } catch { /* skip */ }
        }
      } catch { /* read error */ }
    })
  } catch (watchErr) {
    if (watchErr.code !== 'ENOENT') console.error('[live] watch error:', watchErr)
  }

  const ka = setInterval(() => { try { res.write(': ka\n\n') } catch {} }, 15000)

  req.on('close', () => {
    clearInterval(ka)
    if (watcher) { try { watcher.close() } catch {} }
  })
})

// ─── OpenClaw Gateway WebSocket proxy ────────────────────────────────────────
// Node.js 22+ has built-in WebSocket. We connect server-side so that
// process.platform / process.arch pass OpenClaw's client schema validation.

const GATEWAY_URL = 'ws://127.0.0.1:18789'

// Read gateway auth token and port from ~/.openclaw/openclaw.json
function readGatewayConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(OPENCLAW_DIR, 'openclaw.json'), 'utf-8'))
    return {
      token: cfg?.gateway?.auth?.token ?? '',
      port: cfg?.gateway?.port ?? 18789
    }
  } catch {
    return { token: '', port: 18789 }
  }
}

let gatewayWs = null
let gatewayStatus = 'disconnected'
const sseClients = new Set()

function broadcastGateway(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try { res.write(msg) } catch { sseClients.delete(res) }
  }
}

function connectGateway() {
  if (gatewayWs) {
    try { gatewayWs.close() } catch {}
    gatewayWs = null
  }

  gatewayStatus = 'connecting'
  broadcastGateway({ type: 'status', status: 'connecting' })

  let ws
  try {
    ws = new globalThis.WebSocket(GATEWAY_URL)
  } catch (err) {
    console.error('[gateway] failed to create WebSocket:', err.message)
    gatewayStatus = 'error'
    broadcastGateway({ type: 'status', status: 'error', message: err.message })
    setTimeout(connectGateway, 5000)
    return
  }

  gatewayWs = ws

  ws.addEventListener('open', () => {
    gatewayStatus = 'authenticating'
    broadcastGateway({ type: 'status', status: 'authenticating' })
    console.log('[gateway] connected, waiting for challenge…')
  })

  ws.addEventListener('message', (evt) => {
    let frame
    try { frame = JSON.parse(evt.data) } catch { return }

    // Respond to challenge
    if (frame.type === 'event' && frame.event === 'connect.challenge') {
      const { token } = readGatewayConfig()
      const req = {
        type: 'req',
        id: crypto.randomUUID(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'cli',
            displayName: 'OpenClaw Trajectory Viewer',
            version: '1.0.0',
            platform: process.platform,
            mode: 'cli'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          auth: { token },
          locale: 'en-US'
        }
      }
      ws.send(JSON.stringify(req))
      console.log('[gateway] challenge response sent')
      return
    }

    // hello-ok
    if (frame.type === 'res' && frame.ok === true) {
      gatewayStatus = 'connected'
      broadcastGateway({ type: 'status', status: 'connected' })
      console.log('[gateway] authenticated ✓')
      return
    }

    // Auth error
    if (frame.type === 'res' && frame.ok === false) {
      console.error('[gateway] auth error:', JSON.stringify(frame.error))
      gatewayStatus = 'error'
      broadcastGateway({ type: 'status', status: 'error', error: frame.error })
      return
    }

    // tick / presence → confirm connected
    if (frame.type === 'event' && (frame.event === 'tick' || frame.event === 'presence')) {
      if (gatewayStatus !== 'connected') {
        gatewayStatus = 'connected'
        broadcastGateway({ type: 'status', status: 'connected' })
      }
      return
    }

    // Forward agent events to browser
    if (frame.type === 'event' && frame.event === 'agent') {
      // Debug: log first occurrence of each stream type
      const p = frame.payload
      if (p) console.log(`[agent stream=${p.stream}]`, JSON.stringify(p.data ?? {}).slice(0, 120))
      if (gatewayStatus !== 'connected') {
        gatewayStatus = 'connected'
        broadcastGateway({ type: 'status', status: 'connected' })
      }
      broadcastGateway({ type: 'agent-event', payload: frame.payload })
    }
  })

  ws.addEventListener('error', (evt) => {
    console.error('[gateway] WebSocket error:', evt.message ?? 'unknown')
    gatewayStatus = 'error'
    broadcastGateway({ type: 'status', status: 'error' })
  })

  ws.addEventListener('close', () => {
    gatewayWs = null
    console.log('[gateway] disconnected, reconnecting in 3s…')
    gatewayStatus = 'connecting'
    broadcastGateway({ type: 'status', status: 'connecting' })
    setTimeout(connectGateway, 3000)
  })
}

// SSE endpoint — browser subscribes here instead of connecting to WS directly
app.get('/api/gateway/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send current status immediately so UI reflects real state on connect
  res.write(`data: ${JSON.stringify({ type: 'status', status: gatewayStatus })}\n\n`)

  sseClients.add(res)

  const ka = setInterval(() => { try { res.write(': ka\n\n') } catch {} }, 20000)

  req.on('close', () => {
    clearInterval(ka)
    sseClients.delete(res)
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`OpenClaw Trajectory API server running on http://localhost:${PORT}`)
  console.log(`Reading data from: ${AGENTS_DIR}`)
  connectGateway()
})
