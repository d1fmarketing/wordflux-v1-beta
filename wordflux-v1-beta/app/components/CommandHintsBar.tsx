'use client';

import { useState } from 'react';

const commandExamples = [
  { text: 'create "Fix login bug" in backlog', display: 'Create "Fix login bug" → Backlog', icon: '➕' },
  { text: 'move #12 to review', display: 'Move #12 → Review', icon: '➡️' },
  { text: 'done #15', display: 'Mark #15 Done', icon: '✅' },
  { text: 'start #8', display: 'Start #8 (In Progress)', icon: '🚀' },
  { text: 'update #12 priority: high', display: 'Update #12 priority: high', icon: '⚡' },
  { text: 'tag #12 add urgent', display: 'Tag #12 add urgent', icon: '🏷' },
  { text: 'assign #12 to RJ', display: 'Assign #12 to RJ', icon: '👤' },
  { text: 'comment #10 Ready for review', display: 'Comment #10 Ready for review', icon: '💬' },
  { text: 'list tasks', display: 'List tasks', icon: '📋' },
  { text: 'search authentication', display: 'Search authentication', icon: '🔍' },
  { text: 'board summary', display: 'Board summary', icon: '📊' },
  { text: 'preview: start "landing page hero"', display: 'Preview: start "landing page hero"', icon: '👁' },
];

interface CommandHintsBarProps {
  onSelectCommand: (command: string) => void;
  compact?: boolean;
}

export default function CommandHintsBar({ onSelectCommand, compact = false }: CommandHintsBarProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayedCommands = compact && !showAll 
    ? commandExamples.slice(0, 4) 
    : commandExamples;

  return (
    <div style={{
      padding: '8px 12px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Quick Commands
        </span>
        {compact && commandExamples.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              fontSize: 11,
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {showAll ? 'Show less' : `Show all (${commandExamples.length})`}
          </button>
        )}
      </div>
      
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {displayedCommands.map((cmd, idx) => (
          <button
            key={idx}
            onClick={() => onSelectCommand(cmd.text)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <span>{cmd.icon}</span>
            <span>{cmd.display || cmd.text}</span>
          </button>
        ))}
      </div>
      
      <div style={{
        marginTop: 8,
        fontSize: 11,
        color: '#9ca3af',
      }}>
        💡 <strong>Tips:</strong> Use task IDs (#123) or titles in quotes. 
        Add "preview:" to see what will happen. 
        Type "undo" with token to revert.
      </div>
    </div>
  );
}