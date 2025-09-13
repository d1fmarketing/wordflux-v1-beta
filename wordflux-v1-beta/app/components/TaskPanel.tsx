'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Task {
  id: number | string
  title: string
  description?: string
  column?: string
  priority?: number
  tags?: string[]
  assignee?: string
  createdAt?: string
  updatedAt?: string
  comments?: any[]
  dependencies?: string[]
}

interface TaskPanelProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (taskId: string | number, updates: Partial<Task>) => Promise<void>
  onAction?: (action: string, taskId: string | number) => Promise<void>
}

export function TaskPanel({ task, isOpen, onClose, onUpdate, onAction }: TaskPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'agent' | 'automations'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState<Task | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task })
      if (activeTab === 'agent') {
        analyzeTask()
      }
    }
  }, [task, activeTab])

  const analyzeTask = async () => {
    if (!task) return

    setIsAnalyzing(true)
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 500))

      // Generate suggestions based on task
      const taskSuggestions = []

      if (!task.description) {
        taskSuggestions.push('Add a description to clarify scope')
      }

      if (!task.assignee) {
        taskSuggestions.push('Assign to a team member')
      }

      if (task.column === 'In Progress' && (!task.updatedAt ||
          new Date().getTime() - new Date(task.updatedAt).getTime() > 86400000)) {
        taskSuggestions.push('Move to Review - task appears stale')
      }

      if (task.priority && task.priority >= 3) {
        taskSuggestions.push('Break down into smaller subtasks')
      }

      setSuggestions(taskSuggestions)

      setAnalysis({
        complexity: task.description ? task.description.length > 100 ? 'High' : 'Medium' : 'Low',
        estimatedHours: Math.ceil((task.title.length + (task.description?.length || 0)) / 20),
        blockingRisk: task.dependencies && task.dependencies.length > 0,
        staleness: task.updatedAt ?
          Math.floor((new Date().getTime() - new Date(task.updatedAt).getTime()) / 86400000) : 0
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (editedTask && onUpdate) {
      await onUpdate(editedTask.id, editedTask)
      setIsEditing(false)
    }
  }

  const executeAction = async (action: string) => {
    if (task && onAction) {
      await onAction(action, task.id)
    }
  }

  if (!isOpen || !task) return null

  return createPortal(
    <div
      className="task-panel-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
    >
      <div
        className="task-panel"
        style={{
          width: 480,
          height: '100%',
          backgroundColor: '#fff9f9',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: 20,
          borderBottom: '1px solid rgba(0, 0, 35, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11,
              color: '#6b7280',
              marginBottom: 4
            }}>
              TASK #{task.id}
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editedTask?.title || ''}
                onChange={(e) => setEditedTask(prev => prev ? {...prev, title: e.target.value} : null)}
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#000023',
                  border: '1px solid rgba(0, 0, 35, 0.2)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  width: '100%'
                }}
              />
            ) : (
              <h2 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#000023',
                margin: 0
              }}>
                {task.title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(0, 0, 35, 0.1)',
          padding: '0 20px'
        }}>
          {(['details', 'agent', 'automations'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #ff6633' : '2px solid transparent',
                color: activeTab === tab ? '#ff6633' : '#6b7280',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'agent' ? '🤖 Agent' : tab === 'automations' ? '⚡ Automations' : '📝 Details'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20
        }}>
          {activeTab === 'details' && (
            <div>
              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 8
                }}>
                  Description
                </label>
                {isEditing ? (
                  <textarea
                    value={editedTask?.description || ''}
                    onChange={(e) => setEditedTask(prev => prev ? {...prev, description: e.target.value} : null)}
                    style={{
                      width: '100%',
                      minHeight: 80,
                      padding: 10,
                      border: '1px solid rgba(0, 0, 35, 0.2)',
                      borderRadius: 6,
                      fontSize: 14,
                      resize: 'vertical'
                    }}
                  />
                ) : (
                  <div style={{
                    padding: 10,
                    backgroundColor: 'rgba(0, 0, 35, 0.02)',
                    borderRadius: 6,
                    fontSize: 14,
                    color: task.description ? '#000023' : '#9ca3af'
                  }}>
                    {task.description || 'No description provided'}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 8
                  }}>
                    Column
                  </label>
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255, 102, 51, 0.1)',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#ff6633'
                  }}>
                    {task.column || 'Unknown'}
                  </div>
                </div>

                <div>
                  <label style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 8
                  }}>
                    Priority
                  </label>
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: task.priority && task.priority >= 3 ?
                      'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 35, 0.05)',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    color: task.priority && task.priority >= 3 ? '#ef4444' : '#000023'
                  }}>
                    {task.priority && task.priority >= 3 ? '🔥 High' : 'Normal'}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 8
                  }}>
                    Tags
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.tags.map((tag, i) => (
                      <span key={i} style={{
                        padding: '4px 10px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#3b82f6',
                        fontWeight: 500
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#ff6633',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Edit Task
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSave}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedTask(task)
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'agent' && (
            <div>
              {isAnalyzing ? (
                <div style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🤔</div>
                  Analyzing task...
                </div>
              ) : (
                <>
                  {/* Analysis */}
                  {analysis && (
                    <div style={{
                      padding: 16,
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      borderRadius: 8,
                      marginBottom: 20
                    }}>
                      <h3 style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#000023',
                        marginBottom: 12
                      }}>
                        Task Analysis
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Complexity</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#000023' }}>
                            {analysis.complexity}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Est. Hours</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#000023' }}>
                            {analysis.estimatedHours}h
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Days Stale</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#000023' }}>
                            {analysis.staleness}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Blocking</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#000023' }}>
                            {analysis.blockingRisk ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  <div>
                    <h3 style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#000023',
                      marginBottom: 12
                    }}>
                      Agent Suggestions
                    </h3>
                    {suggestions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {suggestions.map((suggestion, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 12,
                              backgroundColor: 'rgba(255, 102, 51, 0.05)',
                              border: '1px solid rgba(255, 102, 51, 0.2)',
                              borderRadius: 8,
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{suggestion}</span>
                            <button
                              onClick={() => executeAction(suggestion)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#ff6633',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: 20,
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: 13
                      }}>
                        Task looks good! No immediate actions needed.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'automations' && (
            <div>
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Automation Rules
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Set up rules to automatically move, tag, or update this task based on conditions.
                </div>
                <button
                  style={{
                    marginTop: 16,
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#ff6633',
                    border: '1px solid #ff6633',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Create Automation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}