import { NextResponse } from 'next/server'

async function checkKanboard(): Promise<boolean> {
  try {
    const kanboardUrl = process.env.KANBOARD_URL
    if (!kanboardUrl) return false

    const res = await fetch(kanboardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.KANBOARD_USERNAME}:${process.env.KANBOARD_PASSWORD}`)
          .toString('base64')
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'getVersion', id: 1 }),
      // Timeout quickly; we don't want health to hang
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(3000) : undefined
    })

    return res.ok
  } catch {
    return false
  }
}

export async function GET() {
  const kanboardHealthy = await checkKanboard()
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  const healthy = kanboardHealthy && openaiConfigured

  return NextResponse.json({
    ok: healthy,
    status: healthy ? 'healthy' : 'degraded',
    version: '1.0.0-beta',
    timestamp: new Date().toISOString(),
    checks: {
      kanboard: kanboardHealthy ? 'up' : 'down',
      openai: openaiConfigured ? 'configured' : 'missing',
      memory: { used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), unit: 'MB' }
    },
    features: ['board', 'chat', 'kanboard-integration', 'sticky-header', 'fixed-chat-384px']
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-cache, max-age=0' }
  })
}
