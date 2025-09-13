import { AgentControllerV3 } from '../agent-controller-v3'

interface UserContext {
  userId?: string
  currentTime: Date
  workingHours: { start: number, end: number }
  capacity: number // hours available today
  preferences: {
    focusAreas?: string[]
    avoidAreas?: string[]
    workStyle?: 'deep-focus' | 'multitask' | 'balanced'
  }
}

interface TaskRecommendation {
  task: any
  score: number
  reasoning: string
  estimatedTime: number
  dependencies: string[]
  risks: string[]
}

interface DailyPlan {
  recommendedTasks: TaskRecommendation[]
  totalHours: number
  warnings: string[]
  opportunities: string[]
  focusOrder: string[]
}

interface SprintPlan {
  selectedTasks: any[]
  totalPoints: number
  totalHours: number
  breakdown: {
    features: number
    bugs: number
    techDebt: number
    other: number
  }
  risks: string[]
  criticalPath: string[]
}

interface PatternInsight {
  pattern: string
  confidence: number
  recommendation: string
  evidence: any[]
}

export class AICoach {
  private controller: AgentControllerV3
  private userPatterns: Map<string, any> = new Map()
  private learningData: any[] = []
  
  constructor(controller: AgentControllerV3) {
    this.controller = controller
    this.loadLearningData()
  }

  // ========== NATURAL LANGUAGE QUERIES ==========
  
  async processQuery(query: string, context?: UserContext): Promise<any> {
    const lowerQuery = query.toLowerCase()
    
    // Route to appropriate handler based on query intent
    if (lowerQuery.includes('what should i') || lowerQuery.includes('what to work on')) {
      return await this.getNextTaskRecommendations(context)
    }
    
    if (lowerQuery.includes('plan my day') || lowerQuery.includes('daily plan')) {
      return await this.createDailyPlan(context)
    }
    
    if (lowerQuery.includes('plan my sprint') || lowerQuery.includes('sprint planning')) {
      return await this.planSprint(context)
    }
    
    if (lowerQuery.includes('risky') || lowerQuery.includes('at risk')) {
      return await this.identifyRiskyTasks()
    }
    
    if (lowerQuery.includes('blocked') || lowerQuery.includes('stuck')) {
      return await this.findBlockers()
    }
    
    if (lowerQuery.includes('pattern') || lowerQuery.includes('trend')) {
      return await this.analyzePatterns(context?.userId)
    }
    
    if (lowerQuery.includes('velocity') || lowerQuery.includes('performance')) {
      return await this.analyzeVelocity(context?.userId)
    }
    
    // Default: Use GPT for general query
    return await this.generalQuery(query, context)
  }

  // ========== PREDICTIVE RECOMMENDATIONS ==========
  
  async getNextTaskRecommendations(context?: UserContext): Promise<DailyPlan> {
    console.log('🔮 Generating task recommendations...')
    
    const board = await this.controller.boardState.refresh()
    const now = context?.currentTime || new Date()
    const availableHours = context?.capacity || 8
    
    // Get all potential tasks
    const inProgress = board.columns.find(c => c.name === 'In Progress')?.tasks || []
    const ready = board.columns.find(c => c.name === 'Ready')?.tasks || []
    const backlog = board.columns.find(c => c.name === 'Backlog')?.tasks || []
    
    // Score and rank tasks
    const scoredTasks: TaskRecommendation[] = []
    
    // In Progress tasks get highest priority
    for (const task of inProgress) {
      const score = this.scoreTask(task, {
        isInProgress: true,
        context,
        board
      })
      
      scoredTasks.push({
        task,
        score: score.total,
        reasoning: score.reasoning,
        estimatedTime: this.estimateTaskTime(task),
        dependencies: this.findDependencies(task, board),
        risks: this.identifyTaskRisks(task)
      })
    }
    
    // Ready tasks next
    for (const task of ready) {
      const score = this.scoreTask(task, {
        isInProgress: false,
        context,
        board
      })
      
      scoredTasks.push({
        task,
        score: score.total,
        reasoning: score.reasoning,
        estimatedTime: this.estimateTaskTime(task),
        dependencies: this.findDependencies(task, board),
        risks: this.identifyTaskRisks(task)
      })
    }
    
    // Sort by score
    scoredTasks.sort((a, b) => b.score - a.score)
    
    // Select tasks that fit in available time
    const selectedTasks: TaskRecommendation[] = []
    let totalHours = 0
    
    for (const task of scoredTasks) {
      if (totalHours + task.estimatedTime <= availableHours) {
        selectedTasks.push(task)
        totalHours += task.estimatedTime
      }
    }
    
    // Generate warnings and opportunities
    const warnings = this.generateWarnings(board, selectedTasks)
    const opportunities = this.identifyOpportunities(board, selectedTasks)
    
    // Determine optimal focus order
    const focusOrder = this.determineFocusOrder(selectedTasks, context)
    
    // Learn from this recommendation
    this.recordLearning({
      type: 'daily_plan',
      context,
      recommendations: selectedTasks,
      timestamp: now
    })
    
    return {
      recommendedTasks: selectedTasks,
      totalHours,
      warnings,
      opportunities,
      focusOrder
    }
  }

  private scoreTask(task: any, options: any): { total: number, reasoning: string } {
    let score = 0
    const reasons: string[] = []
    
    // In progress tasks get boost
    if (options.isInProgress) {
      score += 100
      reasons.push('Already in progress')
    }
    
    // Deadline scoring
    if (task.date_due) {
      const hoursUntilDue = (new Date(task.date_due).getTime() - Date.now()) / (1000 * 60 * 60)
      if (hoursUntilDue < 24) {
        score += 90
        reasons.push('Due very soon')
      } else if (hoursUntilDue < 72) {
        score += 60
        reasons.push('Due this week')
      }
    }
    
    // Priority scoring
    if (task.priority) {
      score += (5 - task.priority) * 20
      if (task.priority === 1) reasons.push('Highest priority')
    }
    
    // Blocked tasks scoring
    const blockedTasks = this.findBlockedBy(task, options.board)
    if (blockedTasks.length > 0) {
      score += blockedTasks.length * 15
      reasons.push(`Unblocks ${blockedTasks.length} tasks`)
    }
    
    // User preference scoring
    if (options.context?.preferences) {
      const { focusAreas, avoidAreas } = options.context.preferences
      
      if (focusAreas?.some(area => task.title.toLowerCase().includes(area))) {
        score += 25
        reasons.push('Matches focus area')
      }
      
      if (avoidAreas?.some(area => task.title.toLowerCase().includes(area))) {
        score -= 25
        reasons.push('In avoid area')
      }
    }
    
    // Complexity scoring (prefer simpler tasks in the morning)
    const hour = options.context?.currentTime?.getHours() || 12
    const complexity = this.estimateComplexity(task)
    
    if (hour < 12 && complexity < 3) {
      score += 10
      reasons.push('Good morning task')
    } else if (hour >= 14 && complexity > 3) {
      score += 10
      reasons.push('Good afternoon task')
    }
    
    return {
      total: score,
      reasoning: reasons.join(', ')
    }
  }

  // ========== DAILY PLANNING ==========
  
  async createDailyPlan(context?: UserContext): Promise<DailyPlan> {
    const recommendations = await this.getNextTaskRecommendations(context)
    
    // Add time-based organization
    const morningTasks = recommendations.recommendedTasks.filter(r => 
      this.estimateComplexity(r.task) < 3
    ).slice(0, 2)
    
    const afternoonTasks = recommendations.recommendedTasks.filter(r => 
      this.estimateComplexity(r.task) >= 3
    ).slice(0, 3)
    
    const quickWins = recommendations.recommendedTasks.filter(r => 
      r.estimatedTime <= 0.5
    )
    
    // Generate detailed plan
    const plan: string[] = []
    plan.push('🌅 Morning (High Focus):')
    morningTasks.forEach(t => {
      plan.push(`  • ${t.task.title} (${t.estimatedTime}h)`)
    })
    
    plan.push('\n☀️ Afternoon (Deep Work):')
    afternoonTasks.forEach(t => {
      plan.push(`  • ${t.task.title} (${t.estimatedTime}h)`)
    })
    
    if (quickWins.length > 0) {
      plan.push('\n⚡ Quick Wins (Anytime):')
      quickWins.forEach(t => {
        plan.push(`  • ${t.task.title} (${t.estimatedTime}h)`)
      })
    }
    
    return {
      ...recommendations,
      focusOrder: plan
    }
  }

  // ========== SPRINT PLANNING ==========
  
  async planSprint(context?: UserContext): Promise<SprintPlan> {
    console.log('📅 Planning sprint...')
    
    const board = await this.controller.boardState.refresh()
    const backlog = board.columns.find(c => c.name === 'Backlog')?.tasks || []
    const ready = board.columns.find(c => c.name === 'Ready')?.tasks || []
    
    const availableTasks = [...ready, ...backlog]
    const sprintCapacity = (context?.capacity || 40) * 5 // 5 day sprint
    
    // Score tasks for sprint selection
    const scoredTasks = availableTasks.map(task => ({
      task,
      score: this.scoreForSprint(task, board),
      estimatedHours: this.estimateTaskTime(task),
      type: this.categorizeTask(task)
    }))
    
    // Sort by score
    scoredTasks.sort((a, b) => b.score - a.score)
    
    // Select tasks within capacity
    const selectedTasks: any[] = []
    let totalHours = 0
    const breakdown = {
      features: 0,
      bugs: 0,
      techDebt: 0,
      other: 0
    }
    
    for (const item of scoredTasks) {
      if (totalHours + item.estimatedHours <= sprintCapacity) {
        selectedTasks.push(item.task)
        totalHours += item.estimatedHours
        breakdown[item.type]++
      }
    }
    
    // Identify risks
    const risks = this.identifySprintRisks(selectedTasks, board)
    
    // Find critical path
    const criticalPath = this.findCriticalPath(selectedTasks, board)
    
    return {
      selectedTasks,
      totalPoints: selectedTasks.length,
      totalHours,
      breakdown,
      risks,
      criticalPath
    }
  }

  private scoreForSprint(task: any, board: any): number {
    let score = 0
    
    // Priority
    if (task.priority) {
      score += (5 - task.priority) * 20
    }
    
    // Value (inferred from title/description)
    if (task.title.toLowerCase().includes('feature')) {
      score += 30
    } else if (task.title.toLowerCase().includes('bug')) {
      score += 40
    } else if (task.title.toLowerCase().includes('security')) {
      score += 50
    }
    
    // Dependencies resolved
    const deps = this.findDependencies(task, board)
    if (deps.length === 0) {
      score += 20
    }
    
    // Size (prefer medium tasks)
    const hours = this.estimateTaskTime(task)
    if (hours >= 2 && hours <= 8) {
      score += 15
    }
    
    return score
  }

  // ========== RISK ANALYSIS ==========
  
  async identifyRiskyTasks(): Promise<any[]> {
    const board = await this.controller.boardState.refresh()
    const riskyTasks: any[] = []
    
    for (const column of board.columns) {
      for (const task of column.tasks) {
        const risks = this.identifyTaskRisks(task)
        
        if (risks.length > 0) {
          riskyTasks.push({
            task,
            risks,
            riskLevel: this.calculateRiskLevel(risks),
            mitigations: this.suggestMitigations(risks)
          })
        }
      }
    }
    
    // Sort by risk level
    riskyTasks.sort((a, b) => b.riskLevel - a.riskLevel)
    
    return riskyTasks
  }

  private identifyTaskRisks(task: any): string[] {
    const risks: string[] = []
    
    // Deadline risk
    if (task.date_due) {
      const hoursUntilDue = (new Date(task.date_due).getTime() - Date.now()) / (1000 * 60 * 60)
      if (hoursUntilDue < 24) {
        risks.push('Very tight deadline')
      }
    }
    
    // Stale risk
    if (task.date_modification) {
      const daysSinceUpdate = (Date.now() - new Date(task.date_modification).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate > 7) {
        risks.push('No recent updates')
      }
    }
    
    // Complexity risk
    const complexity = this.estimateComplexity(task)
    if (complexity > 4) {
      risks.push('High complexity')
    }
    
    // No description risk
    if (!task.description || task.description.length < 20) {
      risks.push('Unclear requirements')
    }
    
    return risks
  }

  // ========== PATTERN RECOGNITION ==========
  
  async analyzePatterns(userId?: string): Promise<PatternInsight[]> {
    const patterns: PatternInsight[] = []
    const userData = this.getUserData(userId)
    
    // Velocity pattern
    const velocityTrend = this.analyzeVelocityTrend(userData)
    if (velocityTrend) {
      patterns.push(velocityTrend)
    }
    
    // Time of day pattern
    const timePattern = this.analyzeTimePattern(userData)
    if (timePattern) {
      patterns.push(timePattern)
    }
    
    // Task type pattern
    const typePattern = this.analyzeTaskTypePattern(userData)
    if (typePattern) {
      patterns.push(typePattern)
    }
    
    // Blocker pattern
    const blockerPattern = this.analyzeBlockerPattern(userData)
    if (blockerPattern) {
      patterns.push(blockerPattern)
    }
    
    return patterns
  }

  private analyzeVelocityTrend(userData: any): PatternInsight | null {
    // Analyze completion rate over time
    const recentCompletions = userData.completions || []
    
    if (recentCompletions.length < 10) return null
    
    const lastWeek = recentCompletions.slice(-7)
    const previousWeek = recentCompletions.slice(-14, -7)
    
    const lastWeekAvg = lastWeek.length / 7
    const previousWeekAvg = previousWeek.length / 7
    
    if (lastWeekAvg > previousWeekAvg * 1.2) {
      return {
        pattern: 'Increasing velocity',
        confidence: 0.8,
        recommendation: 'Your productivity is trending up! Consider taking on slightly more complex tasks.',
        evidence: [lastWeekAvg, previousWeekAvg]
      }
    } else if (lastWeekAvg < previousWeekAvg * 0.8) {
      return {
        pattern: 'Decreasing velocity',
        confidence: 0.8,
        recommendation: 'Your completion rate has dropped. Check for blockers or consider smaller tasks.',
        evidence: [lastWeekAvg, previousWeekAvg]
      }
    }
    
    return null
  }

  // ========== HELPER METHODS ==========
  
  private estimateTaskTime(task: any): number {
    // Look for time estimates in description/comments
    const text = (task.title + ' ' + (task.description || '')).toLowerCase()
    
    // Check for explicit estimates
    const hourMatch = text.match(/(\d+)\s*h(ou)?rs?/)
    if (hourMatch) {
      return parseInt(hourMatch[1])
    }
    
    const dayMatch = text.match(/(\d+)\s*days?/)
    if (dayMatch) {
      return parseInt(dayMatch[1]) * 8
    }
    
    // Estimate based on complexity
    const complexity = this.estimateComplexity(task)
    return complexity * 2 // Simple heuristic: 2 hours per complexity point
  }

  private estimateComplexity(task: any): number {
    let complexity = 1
    
    const text = (task.title + ' ' + (task.description || '')).toLowerCase()
    
    // Keywords that indicate complexity
    if (text.includes('refactor') || text.includes('architecture')) complexity += 2
    if (text.includes('integration') || text.includes('api')) complexity += 1
    if (text.includes('ui') || text.includes('frontend')) complexity += 1
    if (text.includes('test') || text.includes('testing')) complexity += 1
    if (text.includes('research') || text.includes('investigate')) complexity += 2
    if (text.includes('bug') || text.includes('fix')) complexity -= 1
    
    return Math.max(1, Math.min(5, complexity))
  }

  private findDependencies(task: any, board: any): string[] {
    // Look for dependency indicators in description/comments
    const deps: string[] = []
    const text = task.description || ''
    
    // Look for task references
    const taskRefs = text.match(/#(\d+)/g) || []
    taskRefs.forEach(ref => {
      deps.push(ref)
    })
    
    // Look for "blocked by" mentions
    const blockedMatch = text.match(/blocked by (.+)/i)
    if (blockedMatch) {
      deps.push(blockedMatch[1])
    }
    
    return deps
  }

  private findBlockedBy(task: any, board: any): any[] {
    const blocked: any[] = []
    
    // Find tasks that mention this task as a dependency
    for (const column of board.columns) {
      for (const otherTask of column.tasks) {
        if (otherTask.id === task.id) continue
        
        const deps = this.findDependencies(otherTask, board)
        if (deps.includes(`#${task.id}`)) {
          blocked.push(otherTask)
        }
      }
    }
    
    return blocked
  }

  private categorizeTask(task: any): 'features' | 'bugs' | 'techDebt' | 'other' {
    const text = (task.title + ' ' + (task.description || '')).toLowerCase()
    
    if (text.includes('feature') || text.includes('add') || text.includes('implement')) {
      return 'features'
    }
    if (text.includes('bug') || text.includes('fix') || text.includes('error')) {
      return 'bugs'
    }
    if (text.includes('refactor') || text.includes('cleanup') || text.includes('tech debt')) {
      return 'techDebt'
    }
    
    return 'other'
  }

  private generateWarnings(board: any, selectedTasks: TaskRecommendation[]): string[] {
    const warnings: string[] = []
    
    // Check for overcommitment
    const totalEstimated = selectedTasks.reduce((sum, t) => sum + t.estimatedTime, 0)
    if (totalEstimated > 8) {
      warnings.push(`⚠️ Estimated ${totalEstimated}h of work - consider reducing scope`)
    }
    
    // Check for missing dependencies
    const hasBlockedTasks = selectedTasks.some(t => t.dependencies.length > 0)
    if (hasBlockedTasks) {
      warnings.push('⚠️ Some tasks have unresolved dependencies')
    }
    
    // Check for deadline conflicts
    const urgentTasks = selectedTasks.filter(t => {
      if (!t.task.date_due) return false
      const hoursUntilDue = (new Date(t.task.date_due).getTime() - Date.now()) / (1000 * 60 * 60)
      return hoursUntilDue < 24
    })
    
    if (urgentTasks.length > 1) {
      warnings.push(`⚠️ ${urgentTasks.length} tasks due within 24 hours`)
    }
    
    return warnings
  }

  private identifyOpportunities(board: any, selectedTasks: TaskRecommendation[]): string[] {
    const opportunities: string[] = []
    
    // Quick wins available
    const quickTasks = board.columns
      .flatMap(c => c.tasks)
      .filter(t => this.estimateTaskTime(t) <= 0.5)
    
    if (quickTasks.length > 3) {
      opportunities.push(`💡 ${quickTasks.length} quick wins available (< 30 min each)`)
    }
    
    // Batch similar tasks
    const categories = new Map<string, number>()
    selectedTasks.forEach(t => {
      const cat = this.categorizeTask(t.task)
      categories.set(cat, (categories.get(cat) || 0) + 1)
    })
    
    categories.forEach((count, cat) => {
      if (count >= 3) {
        opportunities.push(`💡 Batch ${count} ${cat} tasks for efficiency`)
      }
    })
    
    return opportunities
  }

  private determineFocusOrder(tasks: TaskRecommendation[], context?: UserContext): string[] {
    const order: string[] = []
    
    // Group by optimal working time
    const morning = tasks.filter(t => this.estimateComplexity(t.task) < 3)
    const afternoon = tasks.filter(t => this.estimateComplexity(t.task) >= 3)
    
    order.push('Recommended order:')
    morning.forEach((t, i) => {
      order.push(`${i + 1}. ${t.task.title} (Morning - Low complexity)`)
    })
    
    afternoon.forEach((t, i) => {
      order.push(`${morning.length + i + 1}. ${t.task.title} (Afternoon - Deep work)`)
    })
    
    return order
  }

  // ========== DATA PERSISTENCE ==========
  
  private loadLearningData() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai_coach_learning')
      if (stored) {
        this.learningData = JSON.parse(stored)
      }
    }
  }

  private recordLearning(data: any) {
    this.learningData.push(data)
    
    // Keep last 1000 records
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-1000)
    }
    
    // Persist
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_coach_learning', JSON.stringify(this.learningData))
    }
  }

  private getUserData(userId?: string): any {
    const key = userId || 'default'
    return this.userPatterns.get(key) || {
      completions: [],
      workingHours: [],
      taskTypes: [],
      blockers: []
    }
  }

  // ========== ADDITIONAL HELPERS ==========
  
  private async findBlockers(): Promise<any> {
    const board = await this.controller.boardState.refresh()
    const blocked = board.columns.find(c => c.name === 'Blocked')?.tasks || []
    
    return {
      blockedTasks: blocked,
      count: blocked.length,
      suggestions: blocked.map(t => ({
        task: t,
        suggestion: this.suggestUnblocking(t)
      }))
    }
  }

  private suggestUnblocking(task: any): string {
    const title = task.title.toLowerCase()
    
    if (title.includes('review') || title.includes('approval')) {
      return 'Request review from team lead'
    }
    if (title.includes('api') || title.includes('integration')) {
      return 'Check API documentation or contact backend team'
    }
    if (title.includes('design') || title.includes('ui')) {
      return 'Get design approval or clarification'
    }
    
    return 'Add a comment explaining the blocker'
  }

  private calculateRiskLevel(risks: string[]): number {
    let level = 0
    
    risks.forEach(risk => {
      if (risk.includes('tight deadline')) level += 3
      if (risk.includes('complexity')) level += 2
      if (risk.includes('unclear')) level += 2
      if (risk.includes('no recent')) level += 1
    })
    
    return Math.min(10, level)
  }

  private suggestMitigations(risks: string[]): string[] {
    const mitigations: string[] = []
    
    risks.forEach(risk => {
      if (risk.includes('deadline')) {
        mitigations.push('Break into smaller subtasks')
        mitigations.push('Request deadline extension if needed')
      }
      if (risk.includes('complexity')) {
        mitigations.push('Schedule pair programming session')
        mitigations.push('Add detailed technical notes')
      }
      if (risk.includes('unclear')) {
        mitigations.push('Schedule requirements review')
        mitigations.push('Add acceptance criteria')
      }
    })
    
    return Array.from(new Set(mitigations))
  }

  private analyzeTimePattern(userData: any): PatternInsight | null {
    // Analyze when user is most productive
    const completions = userData.completions || []
    if (completions.length < 20) return null
    
    const hourCounts = new Map<number, number>()
    completions.forEach((c: any) => {
      const hour = new Date(c.timestamp).getHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    })
    
    // Find peak hours
    let maxHour = 0
    let maxCount = 0
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count
        maxHour = hour
      }
    })
    
    if (maxCount > completions.length * 0.2) {
      return {
        pattern: `Peak productivity at ${maxHour}:00`,
        confidence: 0.7,
        recommendation: `Schedule important tasks around ${maxHour}:00 when you're most productive`,
        evidence: Array.from(hourCounts.entries())
      }
    }
    
    return null
  }

  private analyzeTaskTypePattern(userData: any): PatternInsight | null {
    const completions = userData.completions || []
    if (completions.length < 15) return null
    
    const typeCounts = new Map<string, number>()
    completions.forEach((c: any) => {
      const type = this.categorizeTask(c.task)
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    })
    
    // Find dominant type
    let dominantType = ''
    let maxCount = 0
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count
        dominantType = type
      }
    })
    
    if (maxCount > completions.length * 0.4) {
      return {
        pattern: `Specializing in ${dominantType}`,
        confidence: 0.6,
        recommendation: `You excel at ${dominantType}. Consider taking on more complex ${dominantType} tasks.`,
        evidence: Array.from(typeCounts.entries())
      }
    }
    
    return null
  }

  private analyzeBlockerPattern(userData: any): PatternInsight | null {
    const blockers = userData.blockers || []
    if (blockers.length < 5) return null
    
    // Find common blocker themes
    const themes = new Map<string, number>()
    blockers.forEach((b: any) => {
      const text = b.reason.toLowerCase()
      if (text.includes('review')) themes.set('review', (themes.get('review') || 0) + 1)
      if (text.includes('api')) themes.set('api', (themes.get('api') || 0) + 1)
      if (text.includes('design')) themes.set('design', (themes.get('design') || 0) + 1)
      if (text.includes('requirements')) themes.set('requirements', (themes.get('requirements') || 0) + 1)
    })
    
    // Find most common blocker
    let commonBlocker = ''
    let maxCount = 0
    themes.forEach((count, theme) => {
      if (count > maxCount) {
        maxCount = count
        commonBlocker = theme
      }
    })
    
    if (maxCount >= 3) {
      return {
        pattern: `Frequently blocked by ${commonBlocker}`,
        confidence: 0.7,
        recommendation: `Consider proactive ${commonBlocker} planning to avoid future blocks`,
        evidence: Array.from(themes.entries())
      }
    }
    
    return null
  }

  private async generalQuery(query: string, context?: UserContext): Promise<any> {
    // Use GPT for general queries
    const board = await this.controller.boardState.refresh()
    
    const prompt = `You are an AI project coach. Answer this query about the board:
"${query}"

Board state:
${JSON.stringify(board, null, 2)}

Context:
${JSON.stringify(context, null, 2)}

Provide actionable advice.`

    // This would call GPT API
    return {
      query,
      response: 'Processing general query...',
      suggestions: []
    }
  }

  private analyzeVelocity(userId?: string): any {
    const userData = this.getUserData(userId)
    const completions = userData.completions || []
    
    // Calculate velocity metrics
    const last7Days = completions.filter((c: any) => 
      Date.now() - new Date(c.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000
    )
    
    const last30Days = completions.filter((c: any) =>
      Date.now() - new Date(c.timestamp).getTime() < 30 * 24 * 60 * 60 * 1000
    )
    
    return {
      daily: last7Days.length / 7,
      weekly: last7Days.length,
      monthly: last30Days.length,
      trend: last7Days.length > (last30Days.length / 30 * 7) ? 'increasing' : 'decreasing'
    }
  }

  private findCriticalPath(tasks: any[], board: any): string[] {
    // Simple critical path - tasks that block the most other tasks
    const path: string[] = []
    
    const taskScores = tasks.map(task => ({
      task,
      blockedCount: this.findBlockedBy(task, board).length
    }))
    
    taskScores.sort((a, b) => b.blockedCount - a.blockedCount)
    
    taskScores.slice(0, 5).forEach(item => {
      path.push(`${item.task.title} (blocks ${item.blockedCount} tasks)`)
    })
    
    return path
  }

  private identifySprintRisks(tasks: any[], board: any): string[] {
    const risks: string[] = []
    
    // Check for too many high complexity tasks
    const complexTasks = tasks.filter(t => this.estimateComplexity(t) > 3)
    if (complexTasks.length > tasks.length * 0.5) {
      risks.push('Over 50% of tasks are high complexity')
    }
    
    // Check for dependency chains
    const hasLongChains = tasks.some(t => {
      const deps = this.findDependencies(t, board)
      return deps.length > 2
    })
    if (hasLongChains) {
      risks.push('Long dependency chains detected')
    }
    
    // Check for unclear requirements
    const unclearTasks = tasks.filter(t => !t.description || t.description.length < 20)
    if (unclearTasks.length > 0) {
      risks.push(`${unclearTasks.length} tasks have unclear requirements`)
    }
    
    return risks
  }
}