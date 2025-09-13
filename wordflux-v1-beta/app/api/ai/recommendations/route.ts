import { NextResponse } from 'next/server'
import { AgentControllerV3 } from '@/lib/agent-controller-v3'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const controller = new AgentControllerV3()
    const recommendations = await controller.getNextTaskRecommendation()
    
    return NextResponse.json(recommendations)
  } catch (error) {
    console.error('Failed to get recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}