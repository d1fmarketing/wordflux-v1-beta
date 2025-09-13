import { NextRequest, NextResponse } from 'next/server'
import { AgentControllerV3 } from '@/lib/agent-controller-v3'

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json()
    
    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }
    
    const controller = new AgentControllerV3()
    const result = await controller.autoPlannProject(description)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to auto-plan project:', error)
    return NextResponse.json(
      { error: 'Failed to auto-plan project' },
      { status: 500 }
    )
  }
}