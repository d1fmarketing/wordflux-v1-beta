import fs from 'fs'
import path from 'path'

export type UndoRecord = {
  method: string
  params: Record<string, any>
  label?: string
  timestamp?: number
}

const DRIVER = (process.env.MCP_UNDO_DRIVER || 'json').toLowerCase()
const UNDO_FILE = path.join(process.cwd(), 'data', 'mcp-undo.json')
const MAX_ENTRIES = Number(process.env.MCP_UNDO_MAX || '200')
const REDIS_URL = process.env.MCP_UNDO_REDIS_URL
const REDIS_KEY = process.env.MCP_UNDO_REDIS_KEY || 'mcp:undo'

let redisPromise: Promise<any> | null = null

async function getRedisClient() {
  if (!REDIS_URL) return null
  if (redisPromise) return redisPromise
  redisPromise = (async () => {
    try {
      const pkg = 'redis'
      const redis = await import(pkg)
      const client = (redis as any).createClient({ url: REDIS_URL })
      client.on('error', (err: any) => console.error('[MCP undo] redis error', err))
      await client.connect()
      return client
    } catch (err) {
      console.error('[MCP undo] redis init failed', err)
      redisPromise = null
      return null
    }
  })()
  return redisPromise
}

function loadJson(): UndoRecord[] {
  try {
    const raw = fs.readFileSync(UNDO_FILE, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch (err: any) {
    if (err.code === 'ENOENT') return []
    console.warn('[MCP undo] load error', err)
    return []
  }
}

function saveJson(entries: UndoRecord[]) {
  try {
    fs.mkdirSync(path.dirname(UNDO_FILE), { recursive: true })
    fs.writeFileSync(UNDO_FILE, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch (err) {
    console.error('[MCP undo] save error', err)
  }
}

export async function pushUndo(record: UndoRecord) {
  const entry = { ...record, timestamp: Date.now() }
  if (DRIVER === 'redis') {
    const client = await getRedisClient()
    if (client) {
      await client.rPush(REDIS_KEY, JSON.stringify(entry))
      await client.lTrim(REDIS_KEY, -MAX_ENTRIES, -1)
      return
    }
  }
  const entries = loadJson()
  entries.push(entry)
  saveJson(entries)
}

export async function popUndo(): Promise<UndoRecord | null> {
  if (DRIVER === 'redis') {
    const client = await getRedisClient()
    if (client) {
      const raw = await client.rPop(REDIS_KEY)
      return raw ? JSON.parse(raw) : null
    }
  }
  const entries = loadJson()
  const record = entries.pop() || null
  saveJson(entries)
  return record
}

export async function peekUndo(): Promise<UndoRecord | null> {
  if (DRIVER === 'redis') {
    const client = await getRedisClient()
    if (client) {
      const raw = await client.lIndex(REDIS_KEY, -1)
      return raw ? JSON.parse(raw) : null
    }
  }
  const entries = loadJson()
  return entries.length ? entries[entries.length - 1] : null
}

export async function clearUndo() {
  if (DRIVER === 'redis') {
    const client = await getRedisClient()
    if (client) {
      await client.del(REDIS_KEY)
      return
    }
  }
  saveJson([])
}
