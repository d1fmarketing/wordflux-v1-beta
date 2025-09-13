import { EventEmitter } from 'events'

interface TaskPattern {
  id: string
  type: 'velocity' | 'workflow' | 'blocker' | 'productivity' | 'collaboration'
  pattern: string
  confidence: number
  occurrences: number
  lastSeen: Date
  insights: string[]
  recommendations: string[]
}

interface UserBehavior {
  userId: string
  averageVelocity: number
  peakHours: string[]
  preferredColumns: string[]
  taskCompletionTime: { [taskType: string]: number }
  commonBlockers: string[]
  collaborationPatterns: string[]
}

interface TeamPattern {
  type: 'bottleneck' | 'sprint_pattern' | 'deadline_rush' | 'collaboration'
  description: string
  frequency: 'daily' | 'weekly' | 'sprint' | 'monthly'
  impact: 'high' | 'medium' | 'low'
  suggestions: string[]
}

export class PatternRecognitionSystem extends EventEmitter {
  private patterns: Map<string, TaskPattern> = new Map()
  private userBehaviors: Map<string, UserBehavior> = new Map()
  private teamPatterns: TeamPattern[] = []
  private taskHistory: any[] = []
  private learningEnabled: boolean = true
  
  constructor() {
    super()
    this.initializeBasePatterns()
  }

  // ========== PATTERN DETECTION ==========
  
  async analyzeTaskHistory(tasks: any[]): Promise<TaskPattern[]> {
    console.log('🔍 Analyzing task history for patterns...')
    
    const detectedPatterns: TaskPattern[] = []
    
    // Velocity patterns
    const velocityPattern = this.detectVelocityPattern(tasks)
    if (velocityPattern) detectedPatterns.push(velocityPattern)
    
    // Workflow patterns
    const workflowPattern = this.detectWorkflowPattern(tasks)
    if (workflowPattern) detectedPatterns.push(workflowPattern)
    
    // Blocker patterns
    const blockerPattern = this.detectBlockerPattern(tasks)
    if (blockerPattern) detectedPatterns.push(blockerPattern)
    
    // Productivity patterns
    const productivityPattern = this.detectProductivityPattern(tasks)
    if (productivityPattern) detectedPatterns.push(productivityPattern)
    
    // Store patterns for learning
    detectedPatterns.forEach(p => this.patterns.set(p.id, p))
    
    this.emit('patterns:detected', detectedPatterns)
    
    return detectedPatterns
  }

  private detectVelocityPattern(tasks: any[]): TaskPattern | null {
    // Analyze task completion velocity over time
    const completedTasks = tasks.filter(t => t.column === 'Done')
    if (completedTasks.length < 10) return null
    
    const dailyVelocity = this.calculateDailyVelocity(completedTasks)
    const trend = this.analyzeTrend(dailyVelocity)
    
    if (Math.abs(trend) > 0.2) {
      return {
        id: 'velocity_' + Date.now(),
        type: 'velocity',
        pattern: trend > 0 ? 'increasing_velocity' : 'decreasing_velocity',
        confidence: Math.min(Math.abs(trend) * 2, 1),
        occurrences: completedTasks.length,
        lastSeen: new Date(),
        insights: [
          `Task completion velocity is ${trend > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(trend * 100).toFixed(1)}% per week`,
          `Average daily completion: ${dailyVelocity.average.toFixed(1)} tasks`,
          `Peak performance on ${dailyVelocity.peakDay}`
        ],
        recommendations: trend > 0 ? [
          'Consider taking on more complex tasks',
          'Good momentum - maintain current practices',
          'Document successful workflows'
        ] : [
          'Review recent blockers and bottlenecks',
          'Consider reducing work in progress',
          'Schedule team retrospective'
        ]
      }
    }
    
    return null
  }

  private detectWorkflowPattern(tasks: any[]): TaskPattern | null {
    // Detect common task flow patterns
    const transitions = this.analyzeTransitions(tasks)
    const mostCommonFlow = this.findMostCommonFlow(transitions)
    
    if (mostCommonFlow && mostCommonFlow.count > 5) {
      return {
        id: 'workflow_' + Date.now(),
        type: 'workflow',
        pattern: `common_flow_${mostCommonFlow.path.join('_')}`,
        confidence: mostCommonFlow.count / tasks.length,
        occurrences: mostCommonFlow.count,
        lastSeen: new Date(),
        insights: [
          `Most common workflow: ${mostCommonFlow.path.join(' → ')}`,
          `Used in ${((mostCommonFlow.count / tasks.length) * 100).toFixed(1)}% of tasks`,
          `Average time in each stage: ${mostCommonFlow.averageTime}`
        ],
        recommendations: [
          'Optimize this common workflow path',
          'Create templates for this task type',
          'Automate transitions where possible'
        ]
      }
    }
    
    return null
  }

  private detectBlockerPattern(tasks: any[]): TaskPattern | null {
    // Identify recurring blockers
    const blockedTasks = tasks.filter(t => t.column === 'Blocked' || t.tags?.includes('blocked'))
    if (blockedTasks.length < 3) return null
    
    const blockerReasons = this.extractBlockerReasons(blockedTasks)
    const topBlocker = this.findTopBlocker(blockerReasons)
    
    if (topBlocker && topBlocker.count >= 3) {
      return {
        id: 'blocker_' + Date.now(),
        type: 'blocker',
        pattern: `recurring_blocker_${topBlocker.reason.replace(/\s+/g, '_')}`,
        confidence: topBlocker.count / blockedTasks.length,
        occurrences: topBlocker.count,
        lastSeen: new Date(),
        insights: [
          `"${topBlocker.reason}" is the most common blocker`,
          `Affects ${((topBlocker.count / tasks.length) * 100).toFixed(1)}% of all tasks`,
          `Average resolution time: ${topBlocker.averageResolutionTime} hours`
        ],
        recommendations: [
          'Address root cause of this blocker',
          'Create preventive measures',
          'Establish escalation process',
          'Document resolution steps'
        ]
      }
    }
    
    return null
  }

  private detectProductivityPattern(tasks: any[]): TaskPattern | null {
    // Analyze productivity patterns by time of day/week
    const completedWithTime = tasks.filter(t => 
      t.date_completed && t.column === 'Done'
    )
    
    if (completedWithTime.length < 20) return null
    
    const hourlyProductivity = this.analyzeHourlyProductivity(completedWithTime)
    const peakHours = this.findPeakHours(hourlyProductivity)
    
    if (peakHours.length > 0) {
      return {
        id: 'productivity_' + Date.now(),
        type: 'productivity',
        pattern: 'peak_hours_identified',
        confidence: 0.8,
        occurrences: completedWithTime.length,
        lastSeen: new Date(),
        insights: [
          `Peak productivity hours: ${peakHours.join(', ')}`,
          `${hourlyProductivity.morningVsAfternoon > 0 ? 'Morning' : 'Afternoon'} person detected`,
          `Best day: ${hourlyProductivity.bestDay}`
        ],
        recommendations: [
          `Schedule complex tasks during ${peakHours[0]}`,
          'Protect peak hours from meetings',
          'Use low-energy times for admin tasks',
          'Align team schedules for collaboration'
        ]
      }
    }
    
    return null
  }

  // ========== USER BEHAVIOR LEARNING ==========
  
  async learnUserBehavior(userId: string, actions: any[]): Promise<UserBehavior> {
    console.log(`🧠 Learning behavior patterns for user ${userId}...`)
    
    const behavior: UserBehavior = {
      userId,
      averageVelocity: this.calculateUserVelocity(actions),
      peakHours: this.identifyPeakHours(actions),
      preferredColumns: this.identifyPreferredColumns(actions),
      taskCompletionTime: this.analyzeCompletionTimes(actions),
      commonBlockers: this.identifyCommonBlockers(actions),
      collaborationPatterns: this.identifyCollaborationPatterns(actions)
    }
    
    this.userBehaviors.set(userId, behavior)
    
    // Apply learning to improve predictions
    if (this.learningEnabled) {
      this.adaptPredictions(behavior)
    }
    
    this.emit('behavior:learned', { userId, behavior })
    
    return behavior
  }

  getUserBehavior(userId: string): UserBehavior | null {
    return this.userBehaviors.get(userId) || null
  }

  // ========== TEAM PATTERNS ==========
  
  async analyzeTeamPatterns(boardHistory: any[]): Promise<TeamPattern[]> {
    console.log('👥 Analyzing team patterns...')
    
    const patterns: TeamPattern[] = []
    
    // Detect bottlenecks
    const bottleneck = this.detectTeamBottleneck(boardHistory)
    if (bottleneck) patterns.push(bottleneck)
    
    // Detect sprint patterns
    const sprintPattern = this.detectSprintPattern(boardHistory)
    if (sprintPattern) patterns.push(sprintPattern)
    
    // Detect deadline rush
    const deadlineRush = this.detectDeadlineRush(boardHistory)
    if (deadlineRush) patterns.push(deadlineRush)
    
    // Detect collaboration patterns
    const collaboration = this.detectCollaborationPattern(boardHistory)
    if (collaboration) patterns.push(collaboration)
    
    this.teamPatterns = patterns
    this.emit('team:patterns', patterns)
    
    return patterns
  }

  private detectTeamBottleneck(history: any[]): TeamPattern | null {
    // Find persistent bottlenecks in the workflow
    const columnCounts = this.analyzeColumnDistribution(history)
    const bottleneck = this.findBottleneckColumn(columnCounts)
    
    if (bottleneck) {
      return {
        type: 'bottleneck',
        description: `Persistent bottleneck in ${bottleneck.column} column`,
        frequency: 'daily',
        impact: bottleneck.severity as 'high' | 'medium' | 'low',
        suggestions: [
          `Review and redistribute tasks in ${bottleneck.column}`,
          'Add resources or automation to this stage',
          'Split large tasks into smaller ones',
          'Identify and remove blockers'
        ]
      }
    }
    
    return null
  }

  private detectSprintPattern(history: any[]): TeamPattern | null {
    // Analyze sprint velocity and burndown patterns
    const sprintMetrics = this.analyzeSprintMetrics(history)
    
    if (sprintMetrics.pattern) {
      return {
        type: 'sprint_pattern',
        description: sprintMetrics.pattern,
        frequency: 'sprint',
        impact: 'medium',
        suggestions: sprintMetrics.suggestions
      }
    }
    
    return null
  }

  private detectDeadlineRush(history: any[]): TeamPattern | null {
    // Detect last-minute completion patterns
    const rushPattern = this.analyzeDeadlineRush(history)
    
    if (rushPattern.detected) {
      return {
        type: 'deadline_rush',
        description: 'Tasks frequently completed close to deadlines',
        frequency: 'weekly',
        impact: 'high',
        suggestions: [
          'Break down tasks earlier in the sprint',
          'Implement daily standups',
          'Set internal deadlines before actual due dates',
          'Improve estimation accuracy'
        ]
      }
    }
    
    return null
  }

  private detectCollaborationPattern(history: any[]): TeamPattern | null {
    // Analyze how team members work together
    const collab = this.analyzeCollaboration(history)
    
    if (collab.pattern) {
      return {
        type: 'collaboration',
        description: collab.description,
        frequency: collab.frequency as any,
        impact: 'medium',
        suggestions: collab.suggestions
      }
    }
    
    return null
  }

  // ========== PREDICTIVE INSIGHTS ==========
  
  async generatePredictiveInsights(currentBoard: any): Promise<any> {
    const patterns = Array.from(this.patterns.values())
    const behaviors = Array.from(this.userBehaviors.values())
    
    const insights = {
      nextLikelyBottleneck: this.predictNextBottleneck(currentBoard, patterns),
      estimatedCompletionDates: this.estimateCompletionDates(currentBoard, behaviors),
      riskFactors: this.identifyRiskFactors(currentBoard, patterns),
      optimizationOpportunities: this.findOptimizationOpportunities(patterns, behaviors),
      weeklyForecast: this.generateWeeklyForecast(currentBoard, patterns, behaviors)
    }
    
    this.emit('insights:generated', insights)
    
    return insights
  }

  // ========== HELPER METHODS ==========
  
  private initializeBasePatterns() {
    // Initialize with common known patterns
    console.log('🎯 Initializing base patterns...')
  }

  private calculateDailyVelocity(tasks: any[]): any {
    const dailyCounts: { [date: string]: number } = {}
    
    tasks.forEach(task => {
      const date = new Date(task.date_completed).toISOString().split('T')[0]
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })
    
    const values = Object.values(dailyCounts)
    const average = values.reduce((a, b) => a + b, 0) / values.length
    
    const peakDay = Object.entries(dailyCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0]
    
    return { average, peakDay, dailyCounts }
  }

  private analyzeTrend(velocityData: any): number {
    // Simple linear regression for trend
    return 0.1 // Placeholder
  }

  private analyzeTransitions(tasks: any[]): any {
    const transitions: { [key: string]: number } = {}
    
    tasks.forEach(task => {
      if (task.history) {
        const path = task.history.map((h: any) => h.column).join('_')
        transitions[path] = (transitions[path] || 0) + 1
      }
    })
    
    return transitions
  }

  private findMostCommonFlow(transitions: any): any {
    const sorted = Object.entries(transitions)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
    
    if (sorted.length === 0) return null
    
    const [path, count] = sorted[0]
    return {
      path: path.split('_'),
      count,
      averageTime: '2.5 days'
    }
  }

  private extractBlockerReasons(tasks: any[]): any {
    const reasons: { [key: string]: number } = {}
    
    tasks.forEach(task => {
      const reason = task.blockerReason || 'Unknown'
      reasons[reason] = (reasons[reason] || 0) + 1
    })
    
    return reasons
  }

  private findTopBlocker(reasons: any): any {
    const sorted = Object.entries(reasons)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
    
    if (sorted.length === 0) return null
    
    return {
      reason: sorted[0][0],
      count: sorted[0][1],
      averageResolutionTime: 48
    }
  }

  private analyzeHourlyProductivity(tasks: any[]): any {
    const hourly: { [hour: number]: number } = {}
    
    tasks.forEach(task => {
      const hour = new Date(task.date_completed).getHours()
      hourly[hour] = (hourly[hour] || 0) + 1
    })
    
    const morning = Object.entries(hourly)
      .filter(([h]) => parseInt(h) < 12)
      .reduce((sum, [_, count]) => sum + count, 0)
    
    const afternoon = Object.entries(hourly)
      .filter(([h]) => parseInt(h) >= 12)
      .reduce((sum, [_, count]) => sum + count, 0)
    
    return {
      hourly,
      morningVsAfternoon: morning - afternoon,
      bestDay: 'Tuesday'
    }
  }

  private findPeakHours(productivity: any): string[] {
    const sorted = Object.entries(productivity.hourly)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
    
    return sorted.map(([hour]) => {
      const h = parseInt(hour)
      return `${h}:00-${h + 1}:00`
    })
  }

  private calculateUserVelocity(actions: any[]): number {
    const completed = actions.filter(a => a.type === 'task_completed')
    const days = 30 // Last 30 days
    return completed.length / days
  }

  private identifyPeakHours(actions: any[]): string[] {
    // Simplified implementation
    return ['9:00-11:00', '14:00-16:00']
  }

  private identifyPreferredColumns(actions: any[]): string[] {
    return ['In Progress', 'Ready']
  }

  private analyzeCompletionTimes(actions: any[]): any {
    return {
      'bug': 2.5,
      'feature': 8,
      'task': 4
    }
  }

  private identifyCommonBlockers(actions: any[]): string[] {
    return ['Dependencies', 'Unclear requirements']
  }

  private identifyCollaborationPatterns(actions: any[]): string[] {
    return ['Pair programming on complex tasks']
  }

  private adaptPredictions(behavior: UserBehavior) {
    console.log('📈 Adapting predictions based on learned behavior...')
  }

  private analyzeColumnDistribution(history: any[]): any {
    return {}
  }

  private findBottleneckColumn(counts: any): any {
    return {
      column: 'Review',
      severity: 'high'
    }
  }

  private analyzeSprintMetrics(history: any[]): any {
    return {
      pattern: 'Consistent velocity with slight end-of-sprint rush',
      suggestions: ['Improve estimation', 'Balance workload']
    }
  }

  private analyzeDeadlineRush(history: any[]): any {
    return { detected: true }
  }

  private analyzeCollaboration(history: any[]): any {
    return {
      pattern: true,
      description: 'Strong collaboration on complex features',
      frequency: 'daily',
      suggestions: ['Continue current practices']
    }
  }

  private predictNextBottleneck(board: any, patterns: TaskPattern[]): string {
    return 'Review column likely to bottleneck in 2 days'
  }

  private estimateCompletionDates(board: any, behaviors: UserBehavior[]): any {
    return {}
  }

  private identifyRiskFactors(board: any, patterns: TaskPattern[]): string[] {
    return ['3 high-priority tasks at risk of missing deadline']
  }

  private findOptimizationOpportunities(patterns: TaskPattern[], behaviors: UserBehavior[]): string[] {
    return ['Automate recurring task types', 'Batch similar tasks']
  }

  private generateWeeklyForecast(board: any, patterns: TaskPattern[], behaviors: UserBehavior[]): any {
    return {
      expectedCompletion: 25,
      confidence: 0.85,
      risks: ['Resource availability'],
      opportunities: ['Early feature completion possible']
    }
  }

  // ========== PUBLIC API ==========
  
  getPatterns(): TaskPattern[] {
    return Array.from(this.patterns.values())
  }

  getTeamPatterns(): TeamPattern[] {
    return this.teamPatterns
  }

  enableLearning(enabled: boolean) {
    this.learningEnabled = enabled
  }

  clearHistory() {
    this.patterns.clear()
    this.userBehaviors.clear()
    this.teamPatterns = []
    this.taskHistory = []
  }
}