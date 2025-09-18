import { Counter, Histogram, collectDefaultMetrics, register } from 'prom-client'

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

export { register }
