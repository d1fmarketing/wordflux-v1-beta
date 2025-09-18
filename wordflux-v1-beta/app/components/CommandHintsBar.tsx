'use client';

import Button from '../ui/Button';
import { i18n } from '../ui/i18n';

const commandExamples = [
  { text: 'create "Fix login bug" in backlog', display: '+ Criar "Fix login bug" → Backlog' },
  { text: 'move #12 to review', display: '↪ Mover #12 → Review' },
  { text: 'done #15', display: '✓ Marcar #15 Concluído' },
  { text: 'start #8', display: '▶ Iniciar #8' },
  { text: 'board summary', display: '📊 Resumo do quadro' },
];

interface CommandHintsBarProps {
  onSelectCommand: (command: string) => void;
  compact?: boolean;
}

export default function CommandHintsBar({ onSelectCommand, compact = false }: CommandHintsBarProps) {
  return (
    <div style={{
      padding: '8px 0',
      borderTop: '1px solid var(--line)',
      backgroundColor: 'var(--surface-subtle)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '0 12px',
        marginBottom: 8,
      }}>
        {i18n.quickCommands.title}
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '0 12px 8px 12px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0, 0, 35, 0.1) transparent',
      }}>
        {commandExamples.map((cmd, idx) => (
          <Button
            key={idx}
            variant="ghost"
            onClick={() => onSelectCommand(cmd.text)}
            style={{ flexShrink: 0, fontSize: 12 }}
          >
            {cmd.display}
          </Button>
        ))}
      </div>
    </div>
  );
}