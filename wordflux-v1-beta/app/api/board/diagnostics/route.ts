import { NextResponse } from 'next/server'
import { KanboardClient } from '@/lib/kanboard-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      kanboard_url: process.env.KANBOARD_URL,
      project_id: process.env.KANBOARD_PROJECT_ID || '1',
      node_env: process.env.NODE_ENV
    },
    tests: []
  }

  try {
    const client = new KanboardClient({
      url: process.env.KANBOARD_URL!,
      username: process.env.KANBOARD_USERNAME!,
      password: process.env.KANBOARD_PASSWORD!
    })
    
    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    
    // Test 1: Basic connectivity
    try {
      const columns = await client.getColumns(projectId)
      results.tests.push({
        name: 'Kanboard Connectivity',
        status: 'PASS',
        message: `Connected. Found ${columns.length} columns`
      })
    } catch (err) {
      results.tests.push({
        name: 'Kanboard Connectivity',
        status: 'FAIL',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
    
    // Test 2: Compare getBoard vs getAllTasks
    try {
      const boardPromise = client.request('getBoard', { project_id: projectId })
      const tasksPromise = client.request('getAllTasks', { project_id: projectId })
      
      const [board, allTasks] = await Promise.all([boardPromise, tasksPromise])
      
      // Count tasks from getBoard
      let boardTaskCount = 0
      const boardTaskIds = new Set()
      if (board && Array.isArray(board) && board[0]?.columns) {
        board[0].columns.forEach((col: any) => {
          if (col.tasks && Array.isArray(col.tasks)) {
            boardTaskCount += col.tasks.length
            col.tasks.forEach((t: any) => boardTaskIds.add(t.id))
          }
        })
      }
      
      // Count active tasks from getAllTasks
      const activeTasks = allTasks.filter((t: any) => t.is_active === 1)
      const allTaskIds = new Set(activeTasks.map((t: any) => t.id))
      
      // Find discrepancies
      const missingInBoard = Array.from(allTaskIds).filter(id => !boardTaskIds.has(id))
      const extraInBoard = Array.from(boardTaskIds).filter(id => !allTaskIds.has(id))
      
      const isConsistent = boardTaskCount === activeTasks.length && 
                           missingInBoard.length === 0 && 
                           extraInBoard.length === 0
      
      results.tests.push({
        name: 'Data Consistency',
        status: isConsistent ? 'PASS' : 'WARN',
        details: {
          getBoard_count: boardTaskCount,
          getAllTasks_count: activeTasks.length,
          missing_in_board: missingInBoard,
          extra_in_board: extraInBoard,
          consistent: isConsistent
        }
      })
      
      // Test 3: Column task distribution
      const columnDistribution: any = {}
      if (board && Array.isArray(board) && board[0]?.columns) {
        board[0].columns.forEach((col: any) => {
          columnDistribution[col.title] = {
            getBoard: col.tasks?.length || 0,
            getAllTasks: activeTasks.filter((t: any) => t.column_id === col.id).length
          }
        })
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