/**
 * UserMemory - Stores user context and preferences for the WordFlux agent
 * This is a simple in-memory implementation that can be extended to use
 * Redis, SQLite, or other persistence layers in the future
 */

interface UserPreferences {
  defaultAssignee?: string
  frequentLabels: string[]
  workingHours?: { start: number; end: number }
  language?: 'en' | 'pt'
  timezone?: string
}

interface CommandHistory {
  timestamp: Date
  command: string
  success: boolean
}

export class UserMemory {
  private currentUser: string = 'admin'
  private preferences: UserPreferences = {
    frequentLabels: [],
    language: 'en'
  }
  private commandHistory: CommandHistory[] = []
  private maxHistorySize = 20
  private sessionContext: Map<string, any> = new Map()
  
  // Label frequency tracking
  private labelUsage: Map<string, number> = new Map()
  
  // Assignee mappings
  private assigneeMappings: Map<string, string> = new Map([
    ['me', 'admin'],
    ['eu', 'admin'],
    ['myself', 'admin'],
    ['mim', 'admin']
  ])

  constructor() {
    this.loadFromEnvironment()
  }

  /**
   * Initialize from environment variables if available
   */
  private loadFromEnvironment() {
    if (process.env.DEFAULT_USER) {
      this.currentUser = process.env.DEFAULT_USER
      this.assigneeMappings.set('me', process.env.DEFAULT_USER)
      this.assigneeMappings.set('eu', process.env.DEFAULT_USER)
    }
    
    if (process.env.DEFAULT_LANGUAGE) {
      this.preferences.language = process.env.DEFAULT_LANGUAGE as 'en' | 'pt'
    }
  }

  /**
   * Get the current user context for the agent
   */
  getContext(): string {
    const contextParts = []
    
    // User info
    contextParts.push(`Current user: ${this.currentUser}`)
    
    // Language preference
    contextParts.push(`Language: ${this.preferences.language}`)
    
    // Frequent labels
    if (this.preferences.frequentLabels.length > 0) {
      contextParts.push(`Frequent labels: ${this.preferences.frequentLabels.join(', ')}`)
    }
    
    // Recent commands
    const recentCommands = this.getRecentCommands(5)
    if (recentCommands.length > 0) {
      contextParts.push(`Recent commands: ${recentCommands.map(c => c.command).join('; ')}`)
    }
    
    // Session context
    if (this.sessionContext.size > 0) {
      const sessionData = Array.from(this.sessionContext.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
      contextParts.push(`Session: ${sessionData}`)
    }
    
    return contextParts.join('\n')
  }

  /**
   * Add a command to history
   */
  addCommand(command: string, success: boolean = true) {
    this.commandHistory.push({
      timestamp: new Date(),
      command,
      success
    })
    
    // Trim history to max size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistorySize)
    }
    
    // Extract and track labels from command
    this.extractLabels(command)
    
    // Update language preference based on command
    this.detectLanguage(command)
  }

  /**
   * Get recent commands from history
   */
  getRecentCommands(count: number = 5): CommandHistory[] {
    return this.commandHistory.slice(-count)
  }

  /**
   * Set the current user
   */
  setCurrentUser(username: string) {
    this.currentUser = username
    this.assigneeMappings.set('me', username)
    this.assigneeMappings.set('eu', username)
  }

  /**
   * Get the current user
   */
  getCurrentUser(): string {
    return this.currentUser
  }

  /**
   * Resolve assignee references (me, eu, etc)
   */
  resolveAssignee(assignee: string): string {
    const lower = assignee.toLowerCase()
    return this.assigneeMappings.get(lower) || assignee
  }

  /**
   * Track label usage
   */
  trackLabelUsage(label: string) {
    const count = this.labelUsage.get(label) || 0
    this.labelUsage.set(label, count + 1)
    
    // Update frequent labels
    this.updateFrequentLabels()
  }

  /**
   * Update frequently used labels
   */
  private updateFrequentLabels() {
    // Sort labels by usage
    const sortedLabels = Array.from(this.labelUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label]) => label)
    
    this.preferences.frequentLabels = sortedLabels
  }

  /**
   * Extract labels from command text
   */
  private extractLabels(command: string) {
    // Look for common label patterns
    const labelPatterns = [
      /label[s]?\s+(\w+)/gi,
      /tag[s]?\s+(\w+)/gi,
      /\[(\w+)\]/g,
      /#(\w+)/g
    ]
    
    for (const pattern of labelPatterns) {
      let match
      // Reset the regex for each use
      pattern.lastIndex = 0
      while ((match = pattern.exec(command)) !== null) {
        if (match[1]) {
          this.trackLabelUsage(match[1])
        }
      }
    }
  }

  /**
   * Detect language from command
   */
  private detectLanguage(command: string) {
    const portugueseWords = [
      'criar', 'mover', 'deletar', 'mostrar', 'atribuir', 
      'concluir', 'tarefa', 'para', 'em', 'com', 'hoje',
      'amanhã', 'urgente', 'pronto', 'feito'
    ]
    
    const englishWords = [
      'create', 'move', 'delete', 'show', 'assign',
      'complete', 'task', 'to', 'in', 'with', 'today',
      'tomorrow', 'urgent', 'ready', 'done'
    ]
    
    const lowerCommand = command.toLowerCase()
    
    let ptCount = 0
    let enCount = 0
    
    for (const word of portugueseWords) {
      if (lowerCommand.includes(word)) ptCount++
    }
    
    for (const word of englishWords) {
      if (lowerCommand.includes(word)) enCount++
    }
    
    // Update language preference if there's a clear preference
    if (ptCount > enCount && ptCount >= 2) {
      this.preferences.language = 'pt'
    } else if (enCount > ptCount && enCount >= 2) {
      this.preferences.language = 'en'
    }
  }

  /**
   * Get language preference
   */
  getLanguage(): 'en' | 'pt' {
    return this.preferences.language || 'en'
  }

  /**
   * Set session context value
   */
  setSessionContext(key: string, value: any) {
    this.sessionContext.set(key, value)
  }

  /**
   * Get session context value
   */
  getSessionContext(key: string): any {
    return this.sessionContext.get(key)
  }

  /**
   * Clear session context
   */
  clearSession() {
    this.sessionContext.clear()
  }

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences }
  }

  /**
   * Update user preferences
   */
  updatePreferences(updates: Partial<UserPreferences>) {
    this.preferences = {
      ...this.preferences,
      ...updates
    }
  }

  /**
   * Suggest next actions based on history and time
   */
  suggestNextActions(): string[] {
    const hour = new Date().getHours()
    const isPortuguese = this.preferences.language === 'pt'
    
    // Get last successful command
    const lastCommand = this.commandHistory
      .filter(c => c.success)
      .slice(-1)[0]
    
    // Context-aware suggestions
    if (lastCommand) {
      const cmd = lastCommand.command.toLowerCase()
      
      if (cmd.includes('create') || cmd.includes('criar')) {
        return isPortuguese
          ? ['Mover para Ready', 'Atribuir a alguém', 'Adicionar label']
          : ['Move to Ready', 'Assign to someone', 'Add label']
      }
      
      if (cmd.includes('move') || cmd.includes('mover')) {
        return isPortuguese
          ? ['Criar nova tarefa', 'Ver tarefas em progresso', 'Resumo do board']
          : ['Create new task', 'Show tasks in progress', 'Board summary']
      }
      
      if (cmd.includes('assign') || cmd.includes('atribuir')) {
        return isPortuguese
          ? ['Definir data de entrega', 'Adicionar pontos', 'Mover para WIP']
          : ['Set due date', 'Add story points', 'Move to WIP']
      }
    }
    
    // Time-based defaults
    if (hour >= 9 && hour < 12) {
      return isPortuguese
        ? ['Resumo diário', 'Mostrar urgentes', 'O que vence hoje?']
        : ['Daily summary', 'Show urgent tasks', "What's due today?"]
    } else if (hour >= 17 && hour < 19) {
      return isPortuguese
        ? ['Feito hoje', 'Mover para Done', 'Tarefas de amanhã']
        : ['Done today', 'Move to done', "Tomorrow's tasks"]
    } else {
      return isPortuguese
        ? ['Resumo do board', 'Limpar Done', 'Planejar amanhã']
        : ['Board summary', 'Clear done', 'Plan tomorrow']
    }
  }

  /**
   * Export memory state (for persistence)
   */
  export(): string {
    return JSON.stringify({
      currentUser: this.currentUser,
      preferences: this.preferences,
      commandHistory: this.commandHistory,
      labelUsage: Array.from(this.labelUsage.entries()),
      assigneeMappings: Array.from(this.assigneeMappings.entries())
    })
  }

  /**
   * Import memory state (from persistence)
   */
  import(data: string) {
    try {
      const parsed = JSON.parse(data)
      
      this.currentUser = parsed.currentUser || 'admin'
      this.preferences = parsed.preferences || { frequentLabels: [] }
      this.commandHistory = parsed.commandHistory || []
      
      if (parsed.labelUsage) {
        this.labelUsage = new Map(parsed.labelUsage)
      }
      
      if (parsed.assigneeMappings) {
        this.assigneeMappings = new Map(parsed.assigneeMappings)
      }
    } catch (error) {
      console.error('Failed to import memory:', error)
    }
  }
}