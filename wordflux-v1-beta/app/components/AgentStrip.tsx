'use client'

import { INK_900, INK_700, LINE, SURFACE_WHITE, FONT_2XL, WEIGHT_BOLD, BRAND_600, BRAND_700 } from '../ui/tokens'

export function AgentStrip() {

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 56,
      background: SURFACE_WHITE,
      borderBottom: `1px solid ${LINE}`,
      position: 'sticky',
      top: 0,
      zIndex: 5
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${BRAND_600}, ${BRAND_600}99)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          color: 'white'
        }}>
          W
        </div>
        <h1 style={{
          fontSize: FONT_2XL,
          fontWeight: WEIGHT_BOLD,
          letterSpacing: '-0.02em',
          color: INK_900,
          margin: 0
        }}>
          Board
        </h1>
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center'
      }}>
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true
            })
            window.dispatchEvent(event)
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: '#F6F7FA',
            color: INK_700,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.16s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.borderColor = LINE;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F6F7FA';
            e.currentTarget.style.borderColor = LINE;
          }}
        >
          <span style={{ fontSize: 14, opacity: 0.8 }}>⌘</span>K
        </button>

        <button
          style={{
            padding: '8px 12px',
            background: `linear-gradient(135deg, ${BRAND_700}, ${BRAND_600})`,
            color: 'white',
            border: 0,
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'box-shadow 0.16s ease, transform 0.16s ease',
            boxShadow: '0 1px 1px rgba(0,0,0,.04), 0 6px 16px rgba(176,0,32,.18)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 1px 1px rgba(0,0,0,.04), 0 8px 24px rgba(176,0,32,.24)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 1px rgba(0,0,0,.04), 0 6px 16px rgba(176,0,32,.18)';
          }}
          onClick={() => {
            // Trigger create task or open command palette with create task
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true
            })
            window.dispatchEvent(event)
          }}
        >
          + New Task
        </button>
      </div>
    </div>
  )
}