import { NextResponse } from 'next/server'
import { AgentControllerV3 } from '@/lib/agent-controller-v3'

export async function POST() {
  try {
    const controller = new AgentControllerV3()
    const insights = await controller.analyzeBoard()
    
    return NextResponse.json({
      success: true,
      insights,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to analyze board:', error)
    return NextResponse.json(
      { error: 'Failed to analyze board' },
      { status: 500 }
    )
  }
}