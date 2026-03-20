import { useState, useEffect, useCallback } from "react";
import { GiCrossedClaws } from "react-icons/gi";
import type { AgentInfo, SessionInfo } from "../types";

interface SidebarProps {
  agents: AgentInfo[];
  sessions: Record<string, SessionInfo[]>;
  selectedAgentId: string | null;
  selectedSessionId: string | null;
  liveMode: boolean;
  loadingAgents: boolean;
  onSelectSession: (agentId: string, sessionId: string) => void;
  onToggleLive: () => void;
  onExpandAgent: (agentId: string) => void;
  onRefresh: () => void;
}

function AgentNode({
  agent,
  sessions,
  selectedAgentId,
  selectedSessionId,
  onSelectSession,
  onExpand,
}: {
  agent: AgentInfo;
  sessions: SessionInfo[];
  selectedAgentId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (agentId: string, sessionId: string) => void;
  onExpand: (agentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(agent.agentId === selectedAgentId);

  useEffect(() => {
    if (agent.agentId === selectedAgentId) setExpanded(true);
  }, [agent.agentId, selectedAgentId]);

  const handleToggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand(agent.agentId);
  }, [expanded, agent.agentId, onExpand]);

  return (
    <div>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left"
        onClick={handleToggle}
      >
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 6 10"
        >
          <path
            d="M1 1l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
        <span className="text-sm text-zinc-300 truncate font-mono">
          {agent.agentId}
        </span>
      </button>

      {expanded && (
        <div className="pl-6">
          {sessions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-600">
              No sessions found
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected =
                selectedAgentId === agent.agentId &&
                selectedSessionId === session.sessionId;
              const missing = session.fileExists === false;
              const isReset = session.isReset === true;
              return (
                <button
                  key={session.sessionId}
                  disabled={missing}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    missing
                      ? "opacity-35 cursor-not-allowed"
                      : `hover:bg-white/[0.04] ${
                          isSelected
                            ? isReset
                              ? "bg-amber-500/10 border-l-2 border-amber-500"
                              : "bg-indigo-500/10 border-l-2 border-indigo-500"
                            : ""
                        }`
                  }`}
                  onClick={() =>
                    !missing &&
                    onSelectSession(agent.agentId, session.sessionId)
                  }
                  title={
                    missing
                      ? "Session file not found on disk"
                      : isReset
                        ? `Archived session — reset at ${session.resetAt ?? ""}`
                        : undefined
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      missing
                        ? "bg-zinc-600"
                        : isReset
                          ? "bg-amber-400"
                          : "bg-blue-400"
                    }`}
                  />
                  <span
                    className={`text-xs truncate font-mono ${
                      isSelected
                        ? isReset
                          ? "text-amber-300"
                          : "text-indigo-300"
                        : missing
                          ? "text-zinc-600"
                          : isReset
                            ? "text-amber-600"
                            : "text-zinc-400"
                    }`}
                  >
                    {session.sessionId}
                  </span>
                  {isReset && (
                    <span className="ml-auto text-[10px] text-amber-700 flex-shrink-0">
                      archived
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  agents,
  sessions,
  selectedAgentId,
  selectedSessionId,
  liveMode,
  loadingAgents,
  onSelectSession,
  onToggleLive,
  onExpandAgent,
  onRefresh,
}: SidebarProps) {
  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <GiCrossedClaws size={22} color="#ef4444" />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>OpenClaw</span>
        </div>

        {/* Live button */}
        <button
          onClick={onToggleLive}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
            liveMode
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600/50"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${liveMode ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}
          />
          {liveMode ? "Live Monitor Active" : "Start Live Monitor"}
        </button>
      </div>

      {/* Sessions list */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span className="text-xs text-zinc-600 font-semibold uppercase tracking-wider">
          Sessions
        </span>
        <button
          onClick={onRefresh}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Refresh"
          disabled={loadingAgents}
        >
          <svg
            className={`w-3.5 h-3.5 ${loadingAgents ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingAgents ? (
          <div className="px-4 py-6 text-xs text-zinc-600 text-center">
            Loading agents…
          </div>
        ) : agents.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-zinc-600 mb-1">No agents found</p>
            <p className="text-xs text-zinc-700">
              ~/.openclaw/agents/ is empty
            </p>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentNode
              key={agent.agentId}
              agent={agent}
              sessions={sessions[agent.agentId] || []}
              selectedAgentId={selectedAgentId}
              selectedSessionId={selectedSessionId}
              onSelectSession={onSelectSession}
              onExpand={onExpandAgent}
            />
          ))
        )}
      </div>
    </div>
  );
}
