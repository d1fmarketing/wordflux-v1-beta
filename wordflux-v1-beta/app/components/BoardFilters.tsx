'use client'

import { useState, useRef, useEffect } from 'react'
import {
  INK_900, INK_700, INK_500, LINE, SURFACE_WHITE,
  FONT_MD, WEIGHT_MEDIUM, WEIGHT_SEMIBOLD,
  RADIUS_MD, SHADOW_MODAL, BRAND_600
} from '../ui/tokens'

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
        <button
          ref={buttonRef}
          onClick={() => setShowPopover(!showPopover)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            background: activeCount > 0 ? BRAND_600 : SURFACE_WHITE,
            color: activeCount > 0 ? 'white' : INK_700,
            cursor: 'pointer',
            fontWeight: WEIGHT_MEDIUM,
            transition: 'all 0.16s ease',
            position: 'relative'
          }}
        >
          Filters {activeCount > 0 && `(${activeCount})`}
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
      padding: '8px 0',
      position: 'relative'
    }}>
      <input
        type="text"
        placeholder="Search title or tag…"
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

      <button
        ref={buttonRef}
        onClick={() => setShowPopover(!showPopover)}
        style={{
          padding: '8px 12px',
          fontSize: FONT_MD,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          background: activeCount > 0 ? `linear-gradient(135deg, ${BRAND_600}, ${BRAND_600}dd)` : '#F6F7FA',
          color: activeCount > 0 ? 'white' : INK_700,
          cursor: 'pointer',
          fontWeight: WEIGHT_SEMIBOLD,
          transition: 'all 0.16s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
        onMouseEnter={(e) => {
          if (activeCount === 0) {
            e.currentTarget.style.background = '#F3F4F6'
          }
        }}
        onMouseLeave={(e) => {
          if (activeCount === 0) {
            e.currentTarget.style.background = '#F6F7FA'
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.8 }}>
          <path d="M2 4.5h12M4 8h8M6 11.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Filters
        {activeCount > 0 && (
          <span style={{
            background: activeCount > 0 ? 'rgba(255,255,255,0.2)' : BRAND_600,
            color: activeCount > 0 ? 'white' : 'white',
            padding: '2px 6px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: WEIGHT_SEMIBOLD
          }}>
            {activeCount}
          </span>
        )}
      </button>

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
            Filter by
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={filters.urgent || false}
                onChange={() => toggleFilter('urgent')}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: `1px solid ${LINE}`,
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_900
              }}>
                🔥 Urgent
              </span>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={filters.mine || false}
                onChange={() => toggleFilter('mine')}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: `1px solid ${LINE}`,
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_900
              }}>
                👤 Mine
              </span>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={filters.today || false}
                onChange={() => toggleFilter('today')}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: `1px solid ${LINE}`,
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_900
              }}>
                📅 Due Today
              </span>
            </label>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => {
                setFilters({ query: filters.query })
                onChange({ query: filters.query })
              }}
              style={{
                marginTop: 12,
                padding: '6px 10px',
                fontSize: 12,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                background: SURFACE_WHITE,
                color: INK_700,
                cursor: 'pointer',
                fontWeight: WEIGHT_MEDIUM,
                width: '100%',
                transition: 'all 0.16s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F3F4F6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = SURFACE_WHITE
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default BoardFilters