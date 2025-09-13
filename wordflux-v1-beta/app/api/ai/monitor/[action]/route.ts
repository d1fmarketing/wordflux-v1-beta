import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const { action } = params
    
    if (action === 'start') {
      // Start the AI monitor
      console.log('Starting AI monitor...')
      
      // In production, this would start the actual monitoring service
      return NextResponse.json({ 
        success: true,
        message: 'AI Monitor started',
        isRunning: true
      })
    } else if (action === 'stop') {
      // Stop the AI monitor
      console.log('Stopping AI monitor...')
      
      return NextResponse.json({ 
        success: true,
        message: 'AI Monitor stopped',
        isRunning: false
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Failed to control monitor:', error)
    return NextResponse.json(
      { error: 'Failed to control monitor' },
      { status: 500 }
    )
  }
}