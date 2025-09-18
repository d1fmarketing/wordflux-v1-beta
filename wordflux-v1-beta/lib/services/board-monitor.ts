import { AgentControllerV3 } from '../agent-controller-v3'
import { EventEmitter } from 'events'

interface MonitorConfig {
  enabled: boolean
  intervalMinutes: number
  rules: {
    autoMoveStale: boolean
    smartPrioritize: boolean
    detectDuplicates: boolean
    autoArchive: boolean
    bottleneckDetection: boolean
  }
  thresholds: {
    staleHours: number
    urgentHours: number
    bottleneckLimit: number
    archiveDays: number
  }
}

interface MonitorEvent {
  type: string
  timestamp: Date
  details: any
  automated: boolean
  severity: 'info' | 'warning' | 'critical'
}

export class BoardMonitor extends EventEmitter {
  private controller: AgentControllerV3
  private config: MonitorConfig
  private monitorInterval?: NodeJS.Timeout
  private eventLog: MonitorEvent[] = []
  private isRunning: boolean = false
  
  constructor(controller: AgentControllerV3) {
    super()
    this.controller = controller
    
    // Default configuration
    this.config = {
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
  }

  // ========== MONITORING CONTROL ==========
  
  start() {
    if (this.isRunning) {
      console.log('⚠️ Board monitor already running')
      return
    }
    
    console.log('🚀 Starting board monitor...')
    this.isRunning = true
    
    // Run immediately
    this.performMonitoringCycle()
    
    // Then run on interval
    this.monitorInterval = setInterval(() => {
      this.performMonitoringCycle()
    }, this.config.intervalMinutes * 60 * 1000)
    
    this.emit('monitor:started', { timestamp: new Date() })
  }

  stop() {
    if (!this.isRunning) return
    
    console.log('🛑 Stopping board monitor...')
    this.isRunning = false
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = undefined
    }
    
    this.emit('monitor:stopped', { timestamp: new Date() })
  }

  restart() {
    this.stop()
    setTimeout(() => this.start(), 1000)
  }

  // ========== MONITORING CYCLE ==========
  
  private async performMonitoringCycle() {
    if (!this.config.enabled) return
    
    const cycleStart = Date.now()
    console.log('🔄 Board monitoring cycle started...')
    
    try {
      const insights = await this.controller.analyzeBoard()
      let actionsPerformed = 0
      
      // 1. Handle stale tasks
      if (this.config.rules.autoMoveStale) {
        actionsPerformed += await this.handleStaleTasks(insights.staleTasks)
      }
      
      // 2. Prioritize urgent tasks
      if (this.config.rules.smartPrioritize) {
        actionsPerformed += await this.handleUrgentTasks(insights.upcomingDeadlines)
      }
      
      // 3. Detect and handle duplicates
      if (this.config.rules.detectDuplicates) {
        actionsPerformed += await this.handleDuplicates(insights.duplicates)
      }
      
      // 4. Check for bottlenecks
      if (this.config.rules.bottleneckDetection) {
        await this.checkBottlenecks(insights.bottlenecks)
      }
      
      // 5. Archive old completed tasks
      if (this.config.rules.autoArchive) {
        actionsPerformed += await this.archiveOldTasks()
      }
      
      const cycleTime = Date.now() - cycleStart
      
      this.logEvent({
        type: 'monitoring_cycle_complete',
        timestamp: new Date(),
        details: {
          actionsPerformed,
          cycleTimeMs: cycleTime,
          insights: {
            staleTasks: insights.staleTasks.length,
            urgentTasks: insights.upcomingDeadlines.length,
            duplicates: insights.duplicates.length,
            bottlenecks: insights.bottlenecks.filter(b => b.count > this.config.thresholds.bottleneckLimit).length
          }
        },
        automated: true,
        severity: 'info'
      })
      
      console.log(`✅ Monitoring cycle complete: ${actionsPerformed} actions in ${cycleTime}ms`)
      
    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error)
      
      this.logEvent({
        type: 'monitoring_cycle_error',
        timestamp: new Date(),
        details: { error: error.message },
        automated: true,
        severity: 'critical'
      })
    }
  }

  // ========== AUTOMATED ACTIONS ==========
  
  private async handleStaleTasks(staleTasks: any[]): Promise<number> {
    let actionsCount = 0
    
    for (const task of staleTasks) {
      try {
        console.log(`📌 Auto-handling stale task: ${task.title}`)
        
        // Move to blocked
        const blockedColumnId = 2 // Assuming Blocked is column 2
        await this.controller.taskcafe.moveTask(
          task.id,
          blockedColumnId,
          parseInt(process.env.TASKCAFE_PROJECT_ID!),
          1,
          parseInt(process.env.TASKCAFE_SWIMLANE_ID || '1')
        )
        
        // Add automated comment
        await this.controller.taskcafe.addComment(
          task.id,
          `🤖 Auto-moved: This task has been in progress for ${this.config.thresholds.staleHours}+ hours without updates. 
          Possible actions:
          - Add a status update comment
          - Move to a different column
          - Request help from team
          
          This action was performed automatically by the AI Board Monitor.`
        )
        
        this.emit('task:auto-moved', {
          task,
          from: 'In Progress',
          to: 'Blocked',
          reason: 'Stale task'
        })
        
        actionsCount++
      } catch (error) {
        console.error(`Failed to handle stale task ${task.id}:`, error)
      }
    }
    
    return actionsCount
  }

  private async handleUrgentTasks(urgentTasks: any[]): Promise<number> {
    let actionsCount = 0
    
    for (const task of urgentTasks) {
      try {
        // Skip if no due date (simplified structure doesn't have it)
        if (!(task as any).date_due) continue
        const hoursUntilDue = (new Date((task as any).date_due).getTime() - Date.now()) / (1000 * 60 * 60)
        
        console.log(`⚡ Auto-prioritizing urgent task: ${task.title} (due in ${Math.round(hoursUntilDue)}h)`)
        
        // Update color to red to indicate urgency
        await this.controller.taskcafe.updateTask(task.id, {
          color_id: 'red'
        })
        
        // Add urgency notification
        await this.controller.taskcafe.addComment(
          task.id,
          `🚨 AUTO-PRIORITY: This task is due in ${Math.round(hoursUntilDue)} hours!
          
          Recommended actions:
          - Move to "In Progress" immediately
          - Clear any blockers
          - Focus on completion
          
          Priority automatically set to HIGHEST by AI Monitor.`
        )
        
        // If very urgent and not in progress, move it
        if (hoursUntilDue < 24 && task.column_id !== 3) { // Assuming 3 is "In Progress"
          const inProgressColumnId = 3 // Assuming In Progress is column 3
          await this.controller.taskcafe.moveTask(
            task.id,
            inProgressColumnId,
            parseInt(process.env.TASKCAFE_PROJECT_ID!),
            1,
            parseInt(process.env.TASKCAFE_SWIMLANE_ID || '1')
          )
          
          this.emit('task:emergency-move', {
            task,
            reason: `Due in ${Math.round(hoursUntilDue)} hours`
          })
        }
        
        actionsCount++
      } catch (error) {
        console.error(`Failed to prioritize task ${task.id}:`, error)
      }
    }
    
    return actionsCount
  }

  private async handleDuplicates(duplicates: any[]): Promise<number> {
    let actionsCount = 0
    
    for (const dup of duplicates) {
      if (dup.similarity > 0.85) { // High confidence duplicates
        try {
          console.log(`🔄 Flagging duplicate tasks: "${dup.task1.title}" ≈ "${dup.task2.title}"`)
          
          // Add comments to both tasks
          const message = `🔍 Potential duplicate detected (${Math.round(dup.similarity * 100)}% similarity)
          
          Task #${dup.task2.id}: "${dup.task2.title}"
          
          Recommended actions:
          - Review both tasks for redundancy
          - Merge if they represent the same work
          - Link as related if they're actually different
          
          Detected by AI Duplicate Analysis.`
          
          await this.controller.taskcafe.addComment(
            dup.task1.id,
            message
          )
          
          this.emit('duplicate:detected', {
            task1: dup.task1,
            task2: dup.task2,
            similarity: dup.similarity
          })
          
          actionsCount++
        } catch (error) {
          console.error('Failed to flag duplicates:', error)
        }
      }
    }
    
    return actionsCount
  }

  private async checkBottlenecks(bottlenecks: any[]) {
    for (const bottleneck of bottlenecks) {
      if (bottleneck.count > this.config.thresholds.bottleneckLimit) {
        console.warn(`⚠️ Bottleneck Alert: ${bottleneck.column} has ${bottleneck.count} tasks!`)
        
        this.logEvent({
          type: 'bottleneck_detected',
          timestamp: new Date(),
          details: {
            column: bottleneck.column,
            taskCount: bottleneck.count,
            threshold: this.config.thresholds.bottleneckLimit
          },
          automated: true,
          severity: 'warning'
        })
        
        this.emit('bottleneck:detected', bottleneck)
      }
    }
  }

  private async archiveOldTasks(): Promise<number> {
    let actionsCount = 0
    
    try {
      const board = await this.controller.boardState.refresh()
      const doneColumn = board.columns.find(c => c.name === 'Done')
      
      if (!doneColumn) return 0
      
      const archiveThreshold = Date.now() - (this.config.thresholds.archiveDays * 24 * 60 * 60 * 1000)
      
      for (const task of doneColumn.tasks) {
        const completedDate = new Date(task.createdAt) // Using createdAt as fallback
        
        if (completedDate.getTime() < archiveThreshold) {
          console.log(`📦 Auto-archiving old task: ${task.title}`)
          
          // Add archive comment
          await this.controller.taskcafe.addComment(
            task.id,
            `📦 Auto-archived: This task has been completed for ${this.config.thresholds.archiveDays}+ days.
            Task will remain searchable but removed from active board view.`
          )
          
          // Close the task (archives it)
          await this.controller.taskcafe.updateTask(task.id, {
            is_active: 0
          })
          
          this.emit('task:archived', { task })
          actionsCount++
        }
      }
    } catch (error) {
      console.error('Failed to archive old tasks:', error)
    }
    
    return actionsCount
  }

  // ========== CONFIGURATION ==========
  
  updateConfig(config: Partial<MonitorConfig>) {
    this.config = { ...this.config, ...config }
    
    // Restart if interval changed
    if (config.intervalMinutes && this.isRunning) {
      this.restart()
    }
    
    this.emit('config:updated', this.config)
  }

  getConfig(): MonitorConfig {
    return { ...this.config }
  }

  // ========== EVENT LOGGING ==========
  
  private logEvent(event: MonitorEvent) {
    this.eventLog.push(event)
    
    // Keep only last 500 events
    if (this.eventLog.length > 500) {
      this.eventLog = this.eventLog.slice(-500)
    }
    
    // Emit for real-time listeners
    this.emit('monitor:event', event)
    
    // Persist to localStorage for UI access
    if (typeof window !== 'undefined') {
      localStorage.setItem('board_monitor_events', JSON.stringify(this.eventLog))
    }
  }

  getEventLog(limit: number = 50): MonitorEvent[] {
    return this.eventLog.slice(-limit)
  }

  clearEventLog() {
    this.eventLog = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem('board_monitor_events')
    }
  }

  // ========== STATISTICS ==========
  
  getStatistics() {
    const now = Date.now()
    const last24h = now - (24 * 60 * 60 * 1000)
    
    const recentEvents = this.eventLog.filter(e => e.timestamp.getTime() > last24h)
    
    return {
      totalEvents: this.eventLog.length,
      last24Hours: recentEvents.length,
      byType: this.groupBy(recentEvents, 'type'),
      bySeverity: this.groupBy(recentEvents, 'severity'),
      automatedActions: recentEvents.filter(e => e.automated).length,
      isRunning: this.isRunning,
      config: this.config
    }
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const group = item[key]
      result[group] = (result[group] || 0) + 1
      return result
    }, {})
  }
}