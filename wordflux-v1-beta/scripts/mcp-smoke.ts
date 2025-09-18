import fetch from 'node-fetch'

async function main() {
  const base = process.env.MCP_BASE || process.env.NEXTAUTH_URL || `http://127.0.0.1:${process.env.PORT || '3000'}`
  const token = process.env.MCP_TOKEN
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['x-mcp-token'] = token

  const invoke = async (method: string, params: any = {}) => {
    const res = await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method, params })
    })
    if (!res.ok) throw new Error(`mcp ${method} failed: ${res.status}`)
    const data = await res.json()
    return data.result
  }

  const state = await invoke('list_cards')
  console.log('[mcp] columns:', state?.columns?.length ?? 0)

  const firstColumn = state?.columns?.[0]
  if (!firstColumn) {
    console.warn('[mcp] no columns found; skipping create/move smoke')
    return
  }

  const created = await invoke('create_card', { title: `[smoke] ${Date.now()}`, columnId: firstColumn.id })
  console.log('[mcp] created:', created?.taskId)
  if (created?.taskId) {
    await invoke('undo_last', {})
    console.log('[mcp] undo_last ok')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
