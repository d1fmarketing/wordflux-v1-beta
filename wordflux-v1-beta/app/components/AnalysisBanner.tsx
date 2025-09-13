'use client'

import { useEffect, useState } from 'react'

interface AnalysisBannerProps {
  isAnalyzing?: boolean
  summary?: string
  suggestionsCount?: number
  onViewSuggestions?: () => void
}

export function AnalysisBanner({
  isAnalyzing = false,
  summary,
  suggestionsCount = 0,
  onViewSuggestions
}: AnalysisBannerProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (suggestionsCount > 0 && !isAnalyzing) {
      setShowSuggestions(true)
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowSuggestions(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [suggestionsCount, isAnalyzing])

  // Only show banner when actively analyzing
  if (!isAnalyzing && !showSuggestions) return null

  if (isAnalyzing) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          padding: '12px 20px',
          background: 'linear-gradient(90deg, #B00020, #C2185B)',
          color: 'white',
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(176, 0, 32, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideDown 0.3s ease-out'
        }}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'white',
          opacity: 0.9,
          animation: 'pulse 1.2s ease-in-out infinite'
        }} />
        <strong>Analisando seu board...</strong>
        <span style={{ opacity: 0.85, fontSize: 14 }}>
          {summary || 'Buscando padrões e próximas ações'}
        </span>
        <style jsx>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.5); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
          }
          @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // Show suggestions ready notification
  if (showSuggestions && suggestionsCount > 0) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          padding: '10px 16px',
          background: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 12px rgba(0, 0, 35, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid rgba(0, 0, 35, 0.08)',
          animation: 'slideDown 0.3s ease-out'
        }}
      >
        <span style={{ fontSize: 14, color: '#000023', fontWeight: 500 }}>
          {suggestionsCount} {suggestionsCount === 1 ? 'sugestão pronta' : 'sugestões prontas'}
        </span>
        {onViewSuggestions && (
          <button
            onClick={onViewSuggestions}
            style={{
              padding: '4px 12px',
              background: 'linear-gradient(135deg, #B00020, #C2185B)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Ver
          </button>
        )}
        <style jsx>{`
          @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  return null
}