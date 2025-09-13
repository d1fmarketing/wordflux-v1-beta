#!/usr/bin/env node

import he from 'he'
import { KanboardClient } from '../lib/kanboard-client'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const PROJECT_ID = Number(process.env.KANBOARD_PROJECT_ID || 1)

async function fixEncodedTitles() {
  console.log('🔧 Starting HTML entity fix for task titles...\n')
  
  const client = new KanboardClient({
    url: process.env.KANBOARD_URL || 'http://localhost:8090/jsonrpc.php',
    username: process.env.KANBOARD_USERNAME || 'jsonrpc',
    password: process.env.KANBOARD_PASSWORD || 'wordflux-api-token-2025'
  })

  try {
    // Get all tasks
    const tasks = await client.listProjectTasks(PROJECT_ID)
    console.log(`Found ${tasks.length} tasks to check\n`)
    
    let fixedCount = 0
    
    for (const task of tasks) {
      const decoded = he.decode(task.title)
      
      // Check if title contains HTML entities
      if (decoded !== task.title) {
        console.log(`📝 Task #${task.id}:`)
        console.log(`   Before: ${task.title}`)
        console.log(`   After:  ${decoded}`)
        
        // Update the task with decoded title
        await client.updateTask(task.id, { title: decoded })
        fixedCount++
        console.log(`   ✅ Fixed!\n`)
      }
    }
    
    if (fixedCount === 0) {
      console.log('✨ No encoded titles found - all tasks are clean!')
    } else {
      console.log(`✅ Fixed ${fixedCount} task(s) with encoded titles`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the migration
fixEncodedTitles().catch(console.error)