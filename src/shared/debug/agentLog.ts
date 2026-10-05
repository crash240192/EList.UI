/** NDJSON debug logs for agent investigation (dev: Vite → /opt/cursor/logs/debug.log). */

export function agentDebugLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}): void {
  // #region agent log
  fetch('/__agent_debug_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
    keepalive: true,
  }).catch(() => {});
  // #endregion
}
