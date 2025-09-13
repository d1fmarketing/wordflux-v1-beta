import { NextResponse } from 'next/server'
import { getAIStatus } from '@/lib/services/ai-startup'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = getAIStatus()
    
    // Format response for UI
    const features = status.controller?.features || {
      autoPlanning: true,
      boardAutomation: true,
      predictiveAssistant: true,
      patternLearning: true
    }
    
    const config = status.monitor?.config || {
      enabled: true,
      intervalMinutes: 5,
      rules: {
        autoMoveStale: true,
        smartPrioritize: true,
        detectDuplicates: true,
        autoArchive: true,
        bottleneckDetection: true
      },
      thresholds: {
        staleHours: 72,
        urgentHours: 48,
        bottleneckLimit: 10,
        archiveDays: 7
      }
    }
    
    const statistics = status.monitor?.statistics || {
      totalEvents: 0,
      last24Hours: 0,
      automatedActions: 0,
      byType: {},
      bySeverity: {},
      isRunning: status.monitor?.running || false
    }
    
    return NextResponse.json({
      features,
      config,
      isRunning: status.monitor?.running || false,
      events: [],  // Events are stored in the monitor instance
      actionHistory: status.controller?.actionHistory || [],
      statistics,
      initialized: status.initialized
    })
  } catch (error) {
    console.error('Failed to get AI status:', error)
    return NextResponse.json(
      { error: 'Failed to get AI status' },
      { status: 500 }
    )
  }
}