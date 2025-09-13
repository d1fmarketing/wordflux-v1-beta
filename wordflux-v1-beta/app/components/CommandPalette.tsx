'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Command {
  id: string
  title: string
  description?: string
  icon?: string
  action: () => void | Promise<void>
  category?: string
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (command: string) => Promise<void>
  suggestions?: Command[]
}

export function CommandPalette({ isOpen, onClose, onExecute, suggestions = [] }: CommandPaletteProps) {
  const [input, setInput] = useState('')
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Natural language command patterns
  const parseNaturalCommand = useCallback((text: string): Command[] => {
    const commands: Command[] = []
    const lower = text.toLowerCase().trim()

    // Create task patterns
    if (lower.startsWith('create ') || lower.startsWith('add ') || lower.startsWith('new ')) {
      const match = text.match(/(?:create|add|new)\s+["']([^"']+)["'](?:\s+(?:in|to|->)\s+(\w+))?/i)
      if (match) {
        commands.push({
          id: 'create-task',
          title: `Create "${match[1]}"${match[2] ? ` in ${match[2]}` : ''}`,
          description: 'Create new task',
          icon: '➕',
          action: () => onExecute(text)
        })
      }
    }

    // Move task patterns
    if (lower.includes('move ') || lower.includes('->')) {
      const match = text.match(/move\s+#?(\d+)\s+(?:to|->)\s+(\w+)/i)
      if (match) {
        commands.push({
          id: 'move-task',
          title: `Move #${match[1]} to ${match[2]}`,
          description: 'Move task to column',
          icon: '➡️',
          action: () => onExecute(text)
        })
      }
    }

    // Complete/Done patterns
    if (lower.startsWith('done ') || lower.startsWith('complete ') || lower.startsWith('finish ')) {
      const match = text.match(/#?(\d+)/i)
      if (match) {
        commands.push({
          id: 'complete-task',
          title: `Mark #${match[1]} as done`,
          description: 'Complete task',
          icon: '✅',
          action: () => onExecute(text)
        })
      }
    }

    // Assign patterns
    if (lower.includes('assign ')) {
      const match = text.match(/assign\s+(?:@)?(\w+)\s+to\s+#?(\d+)/i)
      if (match) {
        commands.push({
          id: 'assign-task',
          title: `Assign @${match[1]} to #${match[2]}`,
          description: 'Assign task to user',
          icon: '👤',
          action: () => onExecute(text)
        })
      }
    }

    // Tag patterns
    if (lower.includes('tag ')) {
      const match = text.match(/tag\s+#?(\d+)\s+(?:as|with)?\s*(.+)/i)
      if (match) {
        commands.push({
          id: 'tag-task',
          title: `Tag #${match[1]} with "${match[2]}"`,
          description: 'Add tag to task',
          icon: '🏷️',
          action: () => onExecute(text)
        })
      }
    }

    // Query patterns
    if (lower.startsWith('what') || lower.startsWith('show') || lower.startsWith('list')) {
      commands.push({
        id: 'query',
        title: text,
        description: 'Query board state',
        icon: '🔍',
        action: () => onExecute(text)
      })
    }

    // Undo pattern
    if (lower.startsWith('undo')) {
      commands.push({
        id: 'undo',
        title: 'Undo last action',
        description: 'Revert previous change',
        icon: '↩️',
        action: () => onExecute(text)
      })
    }

    // If no pattern matched, offer to send as-is
    if (commands.length === 0 && text.length > 0) {
      commands.push({
        id: 'execute',
        title: text,
        description: 'Execute command',
        icon: '⚡',
        action: () => onExecute(text)
      })
    }

    return commands
  }, [onExecute])

  // Filter commands based on input
  useEffect(() => {
    if (!input) {
      setFilteredCommands(suggestions)
      return
    }

    const naturalCommands = parseNaturalCommand(input)
    const filtered = suggestions.filter(cmd =>
      cmd.title.toLowerCase().includes(input.toLowerCase()) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(input.toLowerCase()))
    )

    setFilteredCommands([...naturalCommands, ...filtered])
    setSelectedIndex(0)
  }, [input, suggestions, parseNaturalCommand])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            handleExecute(filteredCommands[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setInput('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleExecute = async (command: Command) => {
    setIsProcessing(true)
    try {
      await command.action()
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="command-palette-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh'
      }}
    >
      <div
        ref={containerRef}
        className="command-palette"
        style={{
          width: '90%',
          maxWidth: 600,
          backgroundColor: '#fff9f9',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid rgba(0, 0, 35, 0.1)'
        }}
      >
        <div style={{
          padding: 20,
          borderBottom: '1px solid rgba(0, 0, 35, 0.1)'
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command or describe what you want to do..."
            disabled={isProcessing}
            style={{
              width: '100%',
              fontSize: 18,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#000023'
            }}
          />
        </div>

        <div style={{
          maxHeight: 400,
          overflowY: 'auto',
          padding: 8
        }}>
          {filteredCommands.length === 0 ? (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: '#6b7280',
              fontSize: 14
            }}>
              {input ? 'No matching commands' : 'Start typing to see suggestions'}
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                onClick={() => handleExecute(cmd)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: index === selectedIndex ? 'rgba(255, 102, 51, 0.1)' : 'transparent',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span style={{ fontSize: 20 }}>{cmd.icon || '⚡'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#000023'
                  }}>
                    {cmd.title}
                  </div>
                  {cmd.description && (
                    <div style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginTop: 2
                    }}>
                      {cmd.description}
                    </div>
                  )}
                </div>
                {index === selectedIndex && (
                  <span style={{
                    fontSize: 12,
                    color: '#6b7280',
                    padding: '2px 8px',
                    backgroundColor: 'rgba(0, 0, 35, 0.05)',
                    borderRadius: 4
                  }}>
                    Enter
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(0, 0, 35, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#6b7280'
        }}>
          <div>
            <kbd style={{ padding: '2px 4px', backgroundColor: 'rgba(0, 0, 35, 0.05)', borderRadius: 3 }}>↑↓</kbd> Navigate
            {' '}
            <kbd style={{ padding: '2px 4px', backgroundColor: 'rgba(0, 0, 35, 0.05)', borderRadius: 3 }}>Enter</kbd> Execute
            {' '}
            <kbd style={{ padding: '2px 4px', backgroundColor: 'rgba(0, 0, 35, 0.05)', borderRadius: 3 }}>Esc</kbd> Close
          </div>
          {isProcessing && (
            <span style={{ color: '#ff6633' }}>Processing...</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}