import { AgentControllerV3 } from '../agent-controller-v3'
import { BoardMonitor } from './board-monitor'
import { AICoach } from './ai-coach'
import { PatternRecognitionSystem } from './pattern-recognition'

export class AIStartupService {
  private static instance: AIStartupService
  private controller: AgentControllerV3
  private monitor: BoardMonitor
  private coach: AICoach
  private patternRecognition: PatternRecognitionSystem
  private initialized: boolean = false

  private constructor() {
    this.controller = new AgentControllerV3()
    this.monitor = new BoardMonitor(this.controller)
    this.coach = new AICoach(this.controller)
    this.patternRecognition = new PatternRecognitionSystem()
  }

  static getInstance(): AIStartupService {
    if (!AIStartupService.instance) {
      AIStartupService.instance = new AIStartupService()
    }
    return AIStartupService.instance
  }

  async initialize(): Promise<{
    success: boolean
    services: {
      controller: boolean
      monitor: boolean
      coach: boolean
      patternRecognition: boolean
    }
    errors: string[]
  }> {
    if (this.initialized) {
      return {
        success: true,
        services: {
          controller: true,
          monitor: true,
          coach: true,
          patternRecognition: true
        },
        errors: []
      }
    }

    const errors: string[] = []
    const services = {
      controller: false,
      monitor: false,
      coach: false,
      patternRecognition: false
    }

    try {
      // Initialize controller
      console.log('🚀 Initializing AI Controller...')
      services.controller = true
      
      // Start board monitor
      console.log('🤖 Starting Board Monitor...')
      this.monitor.start()
      services.monitor = true
      
      // Initialize AI coach
      console.log('🧠 Initializing AI Coach...')
      services.coach = true
      
      // Enable pattern recognition
      console.log('🔍 Enabling Pattern Recognition...')
      this.patternRecognition.enableLearning(true)
      services.patternRecognition = true
      
      this.initialized = true
      console.log('✅ All AI services initialized successfully!')
      
    } catch (error) {
      console.error('❌ AI initialization error:', error)
      errors.push(error.message)
    }

    return {
      success: this.initialized,
      services,
      errors
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down AI services...')
    
    if (this.monitor) {
      this.monitor.stop()
    }
    
    if (this.controller) {
      this.controller.stopAutonomousMode()
    }
    
    this.initialized = false
    console.log('✅ AI services shut down')
  }

  getStatus() {
    return {
      initialized: this.initialized,
      monitor: {
        running: this.monitor ? this.monitor.getConfig().enabled : false,
        config: this.monitor ? this.monitor.getConfig() : null,
        statistics: this.monitor ? this.monitor.getStatistics() : null
      },
      controller: {
        features: this.controller ? this.controller.getFeatures() : null,
        actionHistory: this.controller ? this.controller.getActionHistory() : []
      },
      coach: {
        ready: this.coach ? true : false
      },
      patternRecognition: {
        patterns: this.patternRecognition ? this.patternRecognition.getPatterns() : [],
        teamPatterns: this.patternRecognition ? this.patternRecognition.getTeamPatterns() : []
      }
    }
  }

  // Expose services for direct access
  getController() {
    return this.controller
  }

  getMonitor() {
    return this.monitor
  }

  getCoach() {
    return this.coach
  }

  getPatternRecognition() {
    return this.patternRecognition
  }
}

// Global initialization function
export async function initializeAI() {
  const service = AIStartupService.getInstance()
  return await service.initialize()
}

// Global status function
export function getAIStatus() {
  const service = AIStartupService.getInstance()
  return service.getStatus()
}

// Global shutdown function
export async function shutdownAI() {
  const service = AIStartupService.getInstance()
  return await service.shutdown()
}