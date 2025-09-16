export type McpMethod =
  | 'list_cards'
  | 'create_card'
  | 'move_card'
  | 'update_card'
  | 'remove_card'
  | 'set_due'
  | 'assign_card'
  | 'add_label'
  | 'remove_label'
  | 'add_comment'
  | 'bulk_move'
  | 'set_points'
  | 'undo_create'
  | 'undo_move'
  | 'undo_update'
  | 'undo_last'
  | 'tidy_board'
  | 'undo_last'
  | 'bulk_move'
  | 'set_points'
  | 'undo_create'
  | 'undo_move'
  | 'undo_update'

function resolveBaseUrl() {
  const internal = process.env.MCP_INTERNAL_URL
  if (internal) return internal.replace(/\/$/, '')
  const nextUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
  if (nextUrl) return nextUrl.replace(/\/$/, '')
  const port = process.env.PORT || '3000'
  return `http://127.0.0.1:${port}`
}

export async function callMcp<T = any>(method: McpMethod, params?: Record<string, any>): Promise<T> {
  const base = resolveBaseUrl()
  const res = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params })
  })
  if (!res.ok) {
    let err
    try { err = await res.json() } catch (_) { err = null }
    throw new Error(err?.error || `mcp ${method} failed`)
  }
  const data = await res.json()
  return data?.result as T
}
