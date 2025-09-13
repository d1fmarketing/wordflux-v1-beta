'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

export interface Suggestion {
  id: string
  action: string
  reason?: string
  confidence?: number
  execute: () => Promise<void>
}

interface AnalyzeDrawerProps {
  isOpen: boolean
  suggestions: Suggestion[]
  onClose: () => void
  onApply: (selectedIds: string[]) => Promise<void>
}

export function AnalyzeDrawer({ isOpen, suggestions, onClose, onApply }: AnalyzeDrawerProps) {
  const [selected, setSelected] = useState<string[]>(suggestions.map(s => s.id))
  const [isApplying, setIsApplying] = useState(false)

  const handleToggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(sid => sid !== id)
        : [...prev, id]
    )
  }

  const handleApply = async () => {
    if (selected.length === 0) return

    setIsApplying(true)
    try {
      await onApply(selected)
      onClose()
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div style={{
        width: 420,
        height: '100%',
        backgroundColor: '#fff',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#111827',
            margin: 0
          }}>
            Mudanças sugeridas ({suggestions.length})
          </h2>
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

        {/* Suggestions List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px'
        }}>
          {suggestions.length === 0 ? (
            <div style={{
              padding: 40,
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              Nenhuma sugestão no momento
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestions.map(suggestion => (
                <label
                  key={suggestion.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 12,
                    backgroundColor: selected.includes(suggestion.id) ? '#f9fafb' : 'transparent',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(suggestion.id)}
                    onChange={() => handleToggle(suggestion.id)}
                    style={{
                      marginTop: 2,
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#111827',
                      marginBottom: 4
                    }}>
                      {suggestion.action}
                    </div>
                    {suggestion.reason && (
                      <div style={{
                        fontSize: 12,
                        color: '#6b7280'
                      }}>
                        {suggestion.reason}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: 16,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 12
        }}>
          <button
            onClick={onClose}
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
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={selected.length === 0 || isApplying}
            style={{
              flex: 1,
              padding: '10px 16px',
              backgroundColor: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: selected.length === 0 || isApplying ? 'not-allowed' : 'pointer',
              opacity: selected.length === 0 || isApplying ? 0.5 : 1
            }}
          >
            {isApplying ? 'Aplicando...' : `Aplicar ${selected.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}