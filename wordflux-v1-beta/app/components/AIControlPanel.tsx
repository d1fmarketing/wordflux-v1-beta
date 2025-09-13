'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Switch } from './ui/switch'
import { Slider } from './ui/slider'
import { ScrollArea } from './ui/scroll-area'
import { 
  Brain, 
  Activity, 
  Zap, 
  Settings, 
  PlayCircle, 
  PauseCircle,
  BarChart,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
  Bot,
  Target,
  TrendingUp,
  Calendar,
  Users,
  GitBranch,
  RefreshCw
} from 'lucide-react'

interface AIFeatures {
  autoPlanning: boolean
  boardAutomation: boolean
  predictiveAssistant: boolean
  patternLearning: boolean
}

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

interface ActionHistoryItem {
  type: string
  timestamp: Date
  taskTitle?: string
  reason?: string
  description?: string
  tasksCreated?: number
}

export function AIControlPanel() {
  const [features, setFeatures] = useState<AIFeatures>({
    autoPlanning: true,
    boardAutomation: true,
    predictiveAssistant: true,
    patternLearning: true
  })

  const [monitorConfig, setMonitorConfig] = useState<MonitorConfig>({
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
  })

  const [isMonitorRunning, setIsMonitorRunning] = useState(false)
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Load initial state
  useEffect(() => {
    loadState()
    const interval = setInterval(loadState, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [])

  const loadState = async () => {
    try {
      const res = await fetch('/api/ai/status')
      const data = await res.json()
      
      setFeatures(data.features || features)
      setMonitorConfig(data.config || monitorConfig)
      setIsMonitorRunning(data.isRunning || false)
      setEvents(data.events || [])
      setActionHistory(data.actionHistory || [])
      setStatistics(data.statistics || null)
    } catch (error) {
      console.error('Failed to load AI status:', error)
    }
  }

  const toggleFeature = async (feature: keyof AIFeatures) => {
    const newFeatures = { ...features, [feature]: !features[feature] }
    setFeatures(newFeatures)
    
    await fetch('/api/ai/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFeatures)
    })
  }

  const toggleMonitor = async () => {
    const action = isMonitorRunning ? 'stop' : 'start'
    
    await fetch(`/api/ai/monitor/${action}`, { method: 'POST' })
    setIsMonitorRunning(!isMonitorRunning)
  }

  const updateMonitorConfig = async (updates: Partial<MonitorConfig>) => {
    const newConfig = { ...monitorConfig, ...updates }
    setMonitorConfig(newConfig)
    
    await fetch('/api/ai/monitor/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    })
  }

  const runAutoPlan = async () => {
    const description = prompt('Describe your project:')
    if (!description) return
    
    const res = await fetch('/api/ai/auto-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    })
    
    const result = await res.json()
    alert(`Created ${result.tasks.length} tasks in ${result.totalEstimatedHours} hours`)
    loadState()
  }

  const getRecommendations = async () => {
    const res = await fetch('/api/ai/recommendations')
    const recommendations = await res.json()
    
    console.log('AI Recommendations:', recommendations)
    alert(`Next recommended tasks:\n${recommendations.nextTasks.map((t: any) => `- ${t.title}`).join('\n')}`)
  }

  const getEventIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning': return <Info className="h-4 w-4 text-yellow-500" />
      default: return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'auto_plan_project': return <GitBranch className="h-4 w-4" />
      case 'auto_move_stale': return <RefreshCw className="h-4 w-4" />
      case 'auto_prioritize': return <Target className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">AI Control Center</h2>
              <p className="text-sm text-gray-600">GPT-5 Autonomous Board Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isMonitorRunning ? "success" : "secondary"}>
              {isMonitorRunning ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
            <Button 
              onClick={toggleMonitor}
              variant={isMonitorRunning ? "destructive" : "default"}
              size="sm"
            >
              {isMonitorRunning ? (
                <>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Stop AI
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start AI
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">AI Features</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Smart Auto-Planning</label>
                    <Switch 
                      checked={features.autoPlanning}
                      onCheckedChange={() => toggleFeature('autoPlanning')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Board Automation</label>
                    <Switch 
                      checked={features.boardAutomation}
                      onCheckedChange={() => toggleFeature('boardAutomation')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Predictive Assistant</label>
                    <Switch 
                      checked={features.predictiveAssistant}
                      onCheckedChange={() => toggleFeature('predictiveAssistant')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Pattern Learning</label>
                    <Switch 
                      checked={features.patternLearning}
                      onCheckedChange={() => toggleFeature('patternLearning')}
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold">Quick Actions</h3>
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={runAutoPlan}
                  >
                    <GitBranch className="h-4 w-4 mr-2" />
                    Auto-Plan Project
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={getRecommendations}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Get AI Recommendations
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => fetch('/api/ai/analyze-board', { method: 'POST' })}
                  >
                    <BarChart className="h-4 w-4 mr-2" />
                    Analyze Board Health
                  </Button>
                </div>
              </Card>
            </div>

            {statistics && (
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Total Events</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{statistics.totalEvents}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Last 24h</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{statistics.last24Hours}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Automated</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{statistics.automatedActions}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Efficiency</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">87%</p>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="automation" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Automation Rules</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Auto-Move Stale Tasks</label>
                    <Switch 
                      checked={monitorConfig.rules.autoMoveStale}
                      onCheckedChange={(checked) => 
                        updateMonitorConfig({
                          rules: { ...monitorConfig.rules, autoMoveStale: checked }
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">After</span>
                    <input 
                      type="number"
                      className="w-20 px-2 py-1 border rounded"
                      value={monitorConfig.thresholds.staleHours}
                      onChange={(e) => 
                        updateMonitorConfig({
                          thresholds: { ...monitorConfig.thresholds, staleHours: parseInt(e.target.value) }
                        })
                      }
                    />
                    <span className="text-sm text-gray-600">hours</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Smart Prioritization</label>
                    <Switch 
                      checked={monitorConfig.rules.smartPrioritize}
                      onCheckedChange={(checked) => 
                        updateMonitorConfig({
                          rules: { ...monitorConfig.rules, smartPrioritize: checked }
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Urgent if due in</span>
                    <input 
                      type="number"
                      className="w-20 px-2 py-1 border rounded"
                      value={monitorConfig.thresholds.urgentHours}
                      onChange={(e) => 
                        updateMonitorConfig({
                          thresholds: { ...monitorConfig.thresholds, urgentHours: parseInt(e.target.value) }
                        })
                      }
                    />
                    <span className="text-sm text-gray-600">hours</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Detect Duplicates</label>
                  <Switch 
                    checked={monitorConfig.rules.detectDuplicates}
                    onCheckedChange={(checked) => 
                      updateMonitorConfig({
                        rules: { ...monitorConfig.rules, detectDuplicates: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Auto-Archive Old Tasks</label>
                  <Switch 
                    checked={monitorConfig.rules.autoArchive}
                    onCheckedChange={(checked) => 
                      updateMonitorConfig({
                        rules: { ...monitorConfig.rules, autoArchive: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Bottleneck Detection</label>
                  <Switch 
                    checked={monitorConfig.rules.bottleneckDetection}
                    onCheckedChange={(checked) => 
                      updateMonitorConfig({
                        rules: { ...monitorConfig.rules, bottleneckDetection: checked }
                      })
                    }
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Monitor Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Check Interval</label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider 
                      value={[monitorConfig.intervalMinutes]}
                      onValueChange={(value) => 
                        updateMonitorConfig({ intervalMinutes: value[0] })
                      }
                      min={1}
                      max={60}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm w-20">{monitorConfig.intervalMinutes} min</span>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Recent Events</h3>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {events.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      {getEventIcon(event.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{event.type.replace(/_/g, ' ').toUpperCase()}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {event.details && (
                          <p className="text-sm text-gray-600 mt-1">
                            {JSON.stringify(event.details, null, 2)}
                          </p>
                        )}
                        {event.automated && (
                          <Badge variant="outline" className="mt-1">
                            <Bot className="h-3 w-3 mr-1" />
                            Automated
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Action History</h3>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {actionHistory.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      {getActionIcon(action.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{action.type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(action.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {action.taskTitle && (
                          <p className="text-sm text-gray-600">Task: {action.taskTitle}</p>
                        )}
                        {action.reason && (
                          <p className="text-sm text-gray-600">Reason: {action.reason}</p>
                        )}
                        {action.tasksCreated && (
                          <p className="text-sm text-gray-600">Created {action.tasksCreated} tasks</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">AI Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Tasks Auto-Organized</span>
                    <span className="font-medium">47</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Duplicates Detected</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Bottlenecks Resolved</span>
                    <span className="font-medium">8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Time Saved</span>
                    <span className="font-medium">3.2 hrs/week</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-4">Pattern Insights</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Peak Productivity</span>
                    <span className="font-medium">9-11 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Task Velocity</span>
                    <span className="font-medium">5.3/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Common Blockers</span>
                    <span className="font-medium">Dependencies</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Prediction Accuracy</span>
                    <span className="font-medium">89%</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}