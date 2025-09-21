import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function getGitCommit(): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --short HEAD')
    return stdout.trim()
  } catch {
    return 'unknown'
  }
}

function getSSEStatus(): 'live' | 'reconnecting' | 'offline' {
  // Check if SSE is configured and available
  const sseEnabled = process.env.SSE_ENABLED !== 'false'
  if (!sseEnabled) return 'offline'

  // In dev mode with MCP proxy, SSE is typically live
  const mcpUrl = process.env.MCP_URL || process.env.MCP_INTERNAL_URL
  if (mcpUrl) return 'live'

  return 'reconnecting'
}

export async function GET() {
  const commit = await getGitCommit()
  const agent = process.env.AGENT_NAME || 'gpt5'
  const model = process.env.AGENT_MODEL || 'gpt-5-thinking'
  const agentMode = (process.env.AGENT_MODE || 'mcp').toLowerCase()
  const sseStatus = getSSEStatus()

  const response = {
    ok: true,
    agent,              // "gpt5"
    model,              // "gpt-5-thinking"
    mode: agentMode,
    sse: sseStatus,
    quiet: true,
    commit,
    env: process.env.NODE_ENV || 'development',
    taskcafe: !!process.env.TASKCAFE_PROJECT_ID,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(response)
}