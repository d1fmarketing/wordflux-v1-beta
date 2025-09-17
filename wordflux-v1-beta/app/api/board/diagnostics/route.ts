import { NextResponse } from 'next/server'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      taskcafe_url: process.env.TASKCAFE_URL,
      project_id: process.env.TASKCAFE_PROJECT_ID || '1',
      node_env: process.env.NODE_ENV
    },
    tests: []
  }

  try {
    const client = new TaskCafeClient({
      url: process.env.TASKCAFE_URL!,
      username: process.env.TASKCAFE_USERNAME!,
      password: process.env.TASKCAFE_PASSWORD!,
      projectId: process.env.TASKCAFE_PROJECT_ID
    })
    
    const projectId = process.env.TASKCAFE_PROJECT_ID || '1'
    
    // Test 1: Basic connectivity
    try {
      const columns = await client.getColumns(projectId)
      results.tests.push({
        name: 'taskcafe Connectivity',
        status: 'PASS',
        message: `Connected. Found ${columns.length} columns`
      })
    } catch (err) {
      results.tests.push({
        name: 'taskcafe Connectivity',
        status: 'FAIL',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
    
    // Test 2: Compare getBoard vs getAllTasks
    try {
      const boardState = await client.getBoardState(projectId)
      const allTasks = await client.getTasks(projectId)
      
      const boardTaskIds = new Set<string>()
      let boardTaskCount = 0
      for (const column of boardState.columns) {
        for (const card of column.cards) {
          boardTaskIds.add(String(card.id))
          boardTaskCount += 1
        }
      }
      
      const allTaskIds = new Set(allTasks.map(task => String(task.id)))
      const missingInBoard = Array.from(allTaskIds).filter(id => !boardTaskIds.has(id))
      const extraInBoard = Array.from(boardTaskIds).filter(id => !allTaskIds.has(id))
      const isConsistent = missingInBoard.length === 0 && extraInBoard.length === 0
      
      results.tests.push({
        name: 'Data Consistency',
        status: isConsistent ? 'PASS' : 'WARN',
        details: {
          getBoard_count: boardTaskCount,
          getAllTasks_count: allTasks.length,
          missing_in_board: missingInBoard,
          extra_in_board: extraInBoard,
          consistent: isConsistent
        }
      })
      
      // Test 3: Column task distribution
      const columnDistribution: any = {}
      const tasksByColumn = allTasks.reduce<Record<string, number>>((acc, task) => {
        const key = String(task.column_id)
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})

      for (const column of boardState.columns) {
        columnDistribution[column.name] = {
          getBoard: column.cards.length,
          getAllTasks: tasksByColumn[String(column.id)] ?? 0
        }
      }
      
      results.tests.push({
        name: 'Column Distribution',
        status: 'INFO',
        details: columnDistribution
      })
      
    } catch (err) {
      results.tests.push({
        name: 'Data Consistency',
        status: 'ERROR',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
    
    // Test 4: Check getBoardState method
    try {
      const boardState = await client.getBoardState(projectId)
      const totalCards = boardState.columns.reduce((sum, col) => sum + col.cards.length, 0)
      
      results.tests.push({
        name: 'getBoardState Method',
        status: 'PASS',
        details: {
          columns: boardState.columns.map(c => ({
            name: c.name,
            cards: c.cards.length
          })),
          total_cards: totalCards
        }
      })
    } catch (err) {
      results.tests.push({
        name: 'getBoardState Method',
        status: 'FAIL',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
    
    // Summary
    const failedTests = results.tests.filter((t: any) => t.status === 'FAIL').length
    const warnTests = results.tests.filter((t: any) => t.status === 'WARN').length
    
    results.summary = {
      total_tests: results.tests.length,
      passed: results.tests.filter((t: any) => t.status === 'PASS').length,
      failed: failedTests,
      warnings: warnTests,
      health: failedTests === 0 ? (warnTests === 0 ? 'HEALTHY' : 'DEGRADED') : 'UNHEALTHY',
      duration_ms: Date.now() - startTime
    }
    
    return NextResponse.json(results)
    
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.summary = {
      health: 'ERROR',
      duration_ms: Date.now() - startTime
    }
    return NextResponse.json(results, { status: 500 })
  }
}
