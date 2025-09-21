import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client'

let initialized = false

if (!initialized) {
  collectDefaultMetrics({ prefix: 'wordflux_' })
  initialized = true
}

export const httpRequests = new Counter({
  name: 'wordflux_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status', 'route']
})

export const requestDuration = new Histogram({
  name: 'wordflux_http_request_duration_ms',
  help: 'HTTP request duration in ms',
  buckets: [50, 100, 200, 500, 1000, 2000],
  labelNames: ['method', 'route']
})

export const boardStateFallbacks = new Counter({
  name: 'wordflux_board_state_fallback_total',
  help: 'Number of times the board state endpoint returned a fallback payload',
  labelNames: ['cause']
})

export const sseConnectionsGauge = new Gauge({
  name: 'wordflux_sse_connections_current',
  help: 'Current SSE client connections',
  labelNames: ['channel']
})

export const sseBroadcastsTotal = new Counter({
  name: 'wordflux_sse_broadcast_total',
  help: 'Total SSE broadcasts',
  labelNames: ['channel']
})

export const chatActionsTotal = new Counter({
  name: 'wordflux_chat_actions_total',
  help: 'Chat actions emitted by the agent',
  labelNames: ['action']
})

export { register }
