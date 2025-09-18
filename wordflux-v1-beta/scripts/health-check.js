#!/usr/bin/env node

const { exec } = require('child_process')

const services = [
  { name: 'wordflux-v1-beta', url: 'http://localhost:3001/api/health', restart: 'pm2 restart wordflux-v1-beta' },
  { name: 'websocket', url: 'http://localhost:3003/health', restart: 'pm2 restart websocket' },
  { name: 'mcp-gateway', url: 'http://localhost:8811/health', restart: 'pm2 restart wordflux-mcp-gateway' }
]

async function checkHealth() {
  for (const service of services) {
    try {
      const res = await fetch(service.url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Unhealthy status ${res.status}`)
      console.log(`✅ ${service.name} healthy`)
    } catch (error) {
      console.error(`❌ ${service.name} down, restarting...`, error.message)
      exec(service.restart, execErr => {
        if (execErr) {
          console.error(`⚠️ Failed to restart ${service.name}:`, execErr.message)
        } else {
          console.log(`🔄 Restart triggered for ${service.name}`)
        }
      })
    }
  }
}

setInterval(checkHealth, 30000)
checkHealth()
