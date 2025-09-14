'use client'

import { useState, useRef, useEffect } from 'react'
import {
  INK_900, INK_700, INK_500, LINE, SURFACE_WHITE,
  FONT_MD, WEIGHT_MEDIUM, WEIGHT_SEMIBOLD,
  RADIUS_MD, SHADOW_MODAL, BRAND_600
} from '../ui/tokens'
import Button from '../ui/Button'
import { i18n } from '../ui/i18n'

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
  const [showPopover, setShowPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Count active filters
  const activeCount = [filters.urgent, filters.mine, filters.today].filter(Boolean).length

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onChange(newFilters)
  }

  const toggleFilter = (filterName: string) => {
    updateFilter(filterName, !filters[filterName as keyof FilterState])
  }

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false)
      }
    }

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

  if (compact) {
    // Compact mode for small spaces
    return (
      <div style={{
        padding: '8px 12px',
        borderTop: `1px solid ${LINE}`,
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }}>
        <Button
          ref={buttonRef as any}
          variant={activeCount > 0 ? 'primary' : 'secondary'}
          aria-pressed={activeCount > 0}
          onClick={() => setShowPopover(!showPopover)}
          style={{ fontSize: 12 }}
        >
          Filters {activeCount > 0 && `(${activeCount})`}
        </Button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'relative'
    }}>
      <input
        type="search"
        placeholder={i18n.filters.searchPlaceholder}
        style={{
          border: `1px solid ${LINE}`,
          borderRadius: RADIUS_MD,
          padding: '8px 14px',
          fontSize: FONT_MD,
          width: 240,
          background: SURFACE_WHITE,
          outline: 'none',
          transition: 'all 0.16s ease',
          fontWeight: WEIGHT_MEDIUM
        }}
        onChange={(e) => updateFilter('query', e.target.value)}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = BRAND_600
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(194, 24, 91, .18)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = LINE
          e.currentTarget.style.boxShadow = 'none'
        }}
      />

      <Button
        ref={buttonRef as any}
        variant={activeCount > 0 ? 'primary' : 'secondary'}
        aria-pressed={activeCount > 0}
        onClick={() => setShowPopover(!showPopover)}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.8 }}>
          <path d="M2 4.5h12M4 8h8M6 11.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {i18n.filters.title}
        {activeCount > 0 && (
          <span style={{
            background: activeCount > 0 ? 'rgba(255,255,255,0.2)' : BRAND_600,
            color: 'white',
            padding: '2px 6px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: WEIGHT_SEMIBOLD
          }}>
            {activeCount}
          </span>
        )}
      </Button>

      {/* Filters Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 260,
            background: SURFACE_WHITE,
            border: `1px solid ${LINE}`,
            borderRadius: RADIUS_MD,
            padding: 16,
            minWidth: 200,
            boxShadow: SHADOW_MODAL,
            zIndex: 10
          }}
        >
          <div style={{
            fontSize: 12,
            fontWeight: WEIGHT_SEMIBOLD,
            color: INK_500,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {i18n.filters.filterBy}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button
              variant={filters.urgent ? 'primary' : 'ghost'}
              aria-pressed={filters.urgent || false}
              onClick={() => toggleFilter('urgent')}
              style={{ justifyContent: 'flex-start' }}
            >
              🔥 {i18n.filters.urgent}
            </Button>

            <Button
              variant={filters.mine ? 'primary' : 'ghost'}
              aria-pressed={filters.mine || false}
              onClick={() => toggleFilter('mine')}
              style={{ justifyContent: 'flex-start' }}
            >
              👤 {i18n.filters.mine}
            </Button>

            <Button
              variant={filters.today ? 'primary' : 'ghost'}
              aria-pressed={filters.today || false}
              onClick={() => toggleFilter('today')}
              style={{ justifyContent: 'flex-start' }}
            >
              📅 {i18n.filters.today}
            </Button>
          </div>

          {activeCount > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilters({ query: filters.query })
                onChange({ query: filters.query })
              }}
              style={{ width: '100%', marginTop: 12 }}
            >
              {i18n.filters.clear}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default BoardFilters
