import { NextResponse } from 'next/server'

const MCP_HEALTH_URL = process.env.MCP_GATEWAY_HEALTH_URL || 'http://localhost:8811/health'

export async function GET() {
  const token = process.env.MCP_GATEWAY_TOKEN || process.env.MCP_TOKEN

  try {
    const res = await fetch(MCP_HEALTH_URL, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store'
    })

    return NextResponse.json({ status: res.ok ? 'UP' : 'DOWN' }, { status: res.ok ? 200 : 503 })
  } catch (error) {
    console.warn('[mcp-proxy] health check failed', error)
    return NextResponse.json({ status: 'DOWN' }, { status: 503 })
  }
}
