#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'data', 'deploy.json')

try {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  let count = 0
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    try { count = JSON.parse(raw).count || 0 } catch {}
  }
  const next = count + 1
  fs.writeFileSync(filePath, JSON.stringify({ count: next }, null, 2))
  console.log(`[deploy] bump to`, next)
} catch (e) {
  console.error('[deploy] bump failed:', e)
  process.exit(0)
}

