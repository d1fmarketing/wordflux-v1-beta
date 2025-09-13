import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()
    
    // In production, save to database and update the running monitor
    console.log('AI Monitor config updated:', config)
    
    return NextResponse.json({ 
      success: true,
      config 
    })
  } catch (error) {
    console.error('Failed to update monitor config:', error)
    return NextResponse.json(
      { error: 'Failed to update monitor config' },
      { status: 500 }
    )
  }
}