#!/usr/bin/env node
// Health Monitor - runs once; schedule via cron every 5 minutes

const fs = require('fs')

const HEALTH_LOG = '/home/ubuntu/logs/health.log'
const BASE = process.env.PUBLIC_BASE || 'http://localhost:3000'
const NGINX_BASE = process.env.NGINX_BASE || 'http://localhost'
const WEBHOOK = process.env.HEALTH_WEBHOOK_URL || ''
const ENDPOINTS = [
  { name: 'App Health', url: `${BASE}/api/health` },
  { name: 'Board State', url: `${BASE}/api/board/state` },
  { name: 'Nginx', url: `${NGINX_BASE}/nginx-health` }
]

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

async function checkHealth() {
  const timestamp = new Date().toISOString()
  const results = []

  for (const ep of ENDPOINTS) {
    try {
      const start = Date.now()
      const res = await fetchWithTimeout(ep.url, 5000)
      const duration = Date.now() - start
      results.push({ endpoint: ep.name, status: res.ok ? 'UP' : 'DOWN', code: res.status, duration: `${duration}ms`, timestamp })
      if (!res.ok) console.error(`❌ ${ep.name}: HTTP ${res.status}`)
    } catch (err) {
      results.push({ endpoint: ep.name, status: 'ERROR', error: String(err.message || err), timestamp })
      console.error(`❌ ${ep.name}: ${String(err.message || err)}`)
    }
  }

  try {
    fs.mkdirSync('/home/ubuntu/logs', { recursive: true })
    fs.appendFileSync(HEALTH_LOG, JSON.stringify(results) + '\n')
  } catch {}

  // Optional webhook alert
  try {
    const critical = results.filter(r => r.status !== 'UP')
    if (WEBHOOK && critical.length > 0) {
      await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'WordFlux health alert',
          results,
          host: require('os').hostname(),
          time: new Date().toISOString()
        })
      }).catch(() => {})
    }
  } catch {}

  const healthy = results.every(r => r.status === 'UP')
  console.log(healthy ? '✅ All systems operational' : '⚠️  Some services degraded')
  process.exit(healthy ? 0 : 1)
}

checkHealth().catch(err => {
  console.error('Health check failed:', err)
  process.exit(1)
})
