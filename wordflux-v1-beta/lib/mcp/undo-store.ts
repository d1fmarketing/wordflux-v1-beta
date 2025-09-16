import fs from 'fs'
import path from 'path'

export type UndoRecord = {
  method: string
  params: Record<string, any>
  label?: string
  timestamp?: number
}

const UNDO_FILE = path.join(process.cwd(), 'data', 'mcp-undo.json')
const MAX_ENTRIES = Number(process.env.MCP_UNDO_MAX || '200')

function load(): UndoRecord[] {
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

function save(entries: UndoRecord[]) {
  try {
    fs.mkdirSync(path.dirname(UNDO_FILE), { recursive: true })
    fs.writeFileSync(UNDO_FILE, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch (err) {
    console.error('[MCP undo] save error', err)
  }
}

export function pushUndo(record: UndoRecord) {
  const entries = load()
  entries.push({ ...record, timestamp: Date.now() })
  save(entries)
}

export function popUndo(): UndoRecord | null {
  const entries = load()
  if (entries.length === 0) return null
  const record = entries.pop() || null
  save(entries)
  return record
}

export function peekUndo(): UndoRecord | null {
  const entries = load()
  return entries.length ? entries[entries.length - 1] : null
}

export function clearUndo() {
  save([])
}
