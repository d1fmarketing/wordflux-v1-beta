import { NextResponse } from 'next/server'
import { initializeAI, getAIStatus } from '@/lib/services/ai-startup'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = getAIStatus()
    
    if (status.initialized) {
      return NextResponse.json({
        success: true,
        message: 'AI services already initialized',
        status
      })
    }
    
    const result = await initializeAI()
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'AI services initialized successfully' : 'Failed to initialize some services',
      services: result.services,
      errors: result.errors,
      status: getAIStatus()
    })
  } catch (error) {
    console.error('Failed to initialize AI:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to initialize AI services',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  // Force re-initialization
  try {
    const result = await initializeAI()
    
    return NextResponse.json({
      success: result.success,
      message: 'AI services re-initialized',
      services: result.services,
      errors: result.errors,
      status: getAIStatus()
    })
  } catch (error) {
    console.error('Failed to re-initialize AI:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to re-initialize AI services',
        details: error.message 
      },
      { status: 500 }
    )
  }
}