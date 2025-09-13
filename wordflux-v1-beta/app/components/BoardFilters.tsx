'use client'

import { useState } from 'react'

interface FilterState {
  query?: string
  urgent?: boolean
  mine?: boolean
  today?: boolean
}

interface BoardFiltersProps {
  onChange: (filters: FilterState) => void
  compact?: boolean
}

export function BoardFilters({ onChange, compact = false }: BoardFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({})
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onChange(newFilters)
  }

  const toggleFilter = (filterName: string) => {
    const newActiveFilters = new Set(activeFilters)
    if (newActiveFilters.has(filterName)) {
      newActiveFilters.delete(filterName)
      updateFilter(filterName, false)
    } else {
      newActiveFilters.add(filterName)
      updateFilter(filterName, true)
    }
    setActiveFilters(newActiveFilters)
  }

  if (compact) {
    return (
      <div style={{ 
        padding: '8px 12px', 
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => toggleFilter('urgent')}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: 'none',
            borderRadius: 8,
            background: activeFilters.has('urgent')
              ? 'linear-gradient(135deg, #ff6633, #ff3366)'
              : 'rgba(255, 102, 51, 0.08)',
            color: activeFilters.has('urgent') ? 'white' : '#ff3366',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('urgent')
              ? '0 2px 8px rgba(255, 51, 102, 0.3)'
              : 'none'
          }}
        >
          🔥 Urgent
        </button>
        <button
          onClick={() => toggleFilter('mine')}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: 'none',
            borderRadius: 8,
            background: activeFilters.has('mine')
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
              : 'rgba(59, 130, 246, 0.08)',
            color: activeFilters.has('mine') ? 'white' : '#3b82f6',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('mine')
              ? '0 2px 8px rgba(59, 130, 246, 0.3)'
              : 'none'
          }}
        >
          👤 Mine
        </button>
        <button
          onClick={() => toggleFilter('today')}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: 'none',
            borderRadius: 8,
            background: activeFilters.has('today')
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'rgba(16, 185, 129, 0.08)',
            color: activeFilters.has('today') ? 'white' : '#10b981',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('today')
              ? '0 2px 8px rgba(16, 185, 129, 0.3)'
              : 'none'
          }}
        >
          📅 Today
        </button>
      </div>
    )
  }

  return (
    <div style={{ 
      marginBottom: 12, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 16,
      padding: '8px 0'
    }}>
      <input
        type="text"
        placeholder="Search title or tag…"
        style={{
          border: '1px solid rgba(0, 0, 35, 0.08)',
          borderRadius: 10,
          padding: '8px 14px',
          fontSize: 14,
          width: 240,
          background: 'white',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 35, 0.05)',
          outline: 'none',
          transition: 'all 0.2s ease',
          fontWeight: 500
        }}
        onChange={(e) => updateFilter('query', e.target.value)}
      />
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => toggleFilter('urgent')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 10,
            background: activeFilters.has('urgent')
              ? 'linear-gradient(135deg, #ff6633, #ff3366)'
              : 'white',
            color: activeFilters.has('urgent') ? 'white' : '#ff3366',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('urgent')
              ? '0 4px 12px rgba(255, 51, 102, 0.3)'
              : '0 2px 8px rgba(0, 0, 35, 0.06)'
          }}
        >
          🔥 Urgent
        </button>
        <button
          onClick={() => toggleFilter('mine')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 10,
            background: activeFilters.has('mine')
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
              : 'white',
            color: activeFilters.has('mine') ? 'white' : '#3b82f6',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('mine')
              ? '0 4px 12px rgba(59, 130, 246, 0.3)'
              : '0 2px 8px rgba(0, 0, 35, 0.06)'
          }}
        >
          👤 Mine
        </button>
        <button
          onClick={() => toggleFilter('today')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 10,
            background: activeFilters.has('today')
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'white',
            color: activeFilters.has('today') ? 'white' : '#10b981',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: activeFilters.has('today')
              ? '0 4px 12px rgba(16, 185, 129, 0.3)'
              : '0 2px 8px rgba(0, 0, 35, 0.06)'
          }}
        >
          📅 Due Today
        </button>
      </div>
    </div>
  )
}

export default BoardFilters