import { NextResponse } from 'next/server'

async function checktaskcafe(): Promise<boolean> {
  try {
    const taskcafeUrl = process.env.TASKCAFE_URL
    if (!taskcafeUrl) return false

    const res = await fetch(taskcafeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.TASKCAFE_USERNAME}:${process.env.TASKCAFE_PASSWORD}`)
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
  const taskcafeHealthy = await checktaskcafe()
  const openaiConfigured = !!process.env.OPENAI_API_KEY
  const healthy = taskcafeHealthy && openaiConfigured

  return NextResponse.json({
    ok: healthy,
    status: healthy ? 'healthy' : 'degraded',
    version: '1.0.0-beta',
    timestamp: new Date().toISOString(),
    checks: {
      taskcafe: taskcafeHealthy ? 'up' : 'down',
      openai: openaiConfigured ? 'configured' : 'missing',
      memory: { used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), unit: 'MB' }
    },
    features: ['board', 'chat', 'taskcafe-integration', 'sticky-header', 'fixed-chat-384px']
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-cache, max-age=0' }
  })
}
