'use client'

export function AgentStrip() {

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      background: 'linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255, 249, 249, 0.95) 100%)',
      borderBottom: '1px solid rgba(255, 102, 51, 0.06)',
      boxShadow: '0 2px 16px rgba(0, 0, 35, 0.04)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 4,
          height: 28,
          background: 'linear-gradient(180deg, #ff6633 0%, #ff3366 100%)',
          borderRadius: 2
        }} />
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#000023',
          margin: 0
        }}>
          Kanban Board
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
            padding: '12px 16px',
            backgroundColor: 'white',
            color: 'rgba(0, 0, 35, 0.6)',
            border: '1px solid rgba(0, 0, 35, 0.08)',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 35, 0.04)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 102, 51, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 102, 51, 0.3)';
            e.currentTarget.style.color = '#ff3366';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 35, 0.08)';
            e.currentTarget.style.color = 'rgba(0, 0, 35, 0.6)';
          }}
        >
          <span style={{ fontSize: 16 }}>⌘</span>K
        </button>

        {/* Optional: Add primary CTA button */}
        <button
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #B00020, #C2185B)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 3px 12px rgba(176, 0, 32, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(176, 0, 32, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 3px 12px rgba(176, 0, 32, 0.2)';
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
          + Nova Tarefa
        </button>
      </div>
    </div>
  )
}