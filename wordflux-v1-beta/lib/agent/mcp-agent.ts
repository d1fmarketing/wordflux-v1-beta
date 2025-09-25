import OpenAI from "openai";
import crypto from "crypto";
import { toolDefs, ToolName } from "./tools";
import { execTool } from "./mcp-exec";
import { broadcast } from "@/lib/events";
import type { Message } from "@/lib/chat/memory";
import { pushUndo, popUndo, getInverseAction } from "@/lib/chat/undo";
import { rangeFor, isInRange, type DueRange } from "./dates";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";

// Intent router for obvious commands - bypass LLM for instant responses
async function intentRouter(userText: string, dryRun: boolean = false, sessionId?: string) {
  const text = userText.toLowerCase().trim();
  const originalText = userText.trim(); // Keep original case for Portuguese patterns

  // Board summary patterns
  if (/^(resumo|summary|board summary|board status|status|resumo r[aá]pido do board|board|quadro)$/.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would get board summary",
        toolsUsed: [{ id: 'router', name: 'get_board_summary', args: {}, dryRun: true }]
      };
    }
    const result = await execTool('get_board_summary', {});
    const cols = result?.columns || [];
    const total = cols.reduce((sum: number, col: any) => sum + (col.count || 0), 0);
    const summary = cols.map((c: any) => `${c.name}: ${c.count}`).join(', ');
    return {
      handled: true,
      reply: `Board: ${summary} (Total: ${total} cards)`,
      toolsUsed: [{ id: 'router', name: 'get_board_summary', args: {} }]
    };
  }

  // Backlog analytics patterns
  if (/^(analyze backlog|backlog analysis|backlog health|analyze|análise do backlog)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would analyze backlog",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'summary' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics?action=summary`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      const health = result.backlog_health;
      const insights = result.insights?.slice(0, 3).join('\n') || '';

      return {
        handled: true,
        reply: `Backlog: ${health.total} cards (${health.stale} stale, ${health.bugs} bugs, ${health.urgent} urgent)\n${insights}`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'summary' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Suggest next task patterns
  if (/^(suggest next|what should i work on|whats? next|próxima tarefa|o que fazer agora)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would suggest next tasks",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'suggest' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics?action=suggest&limit=3`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      const suggestions = result.suggestions || [];
      if (suggestions.length === 0) {
        return {
          handled: true,
          reply: "No priority tasks found. Review your backlog manually.",
          toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'suggest' } }]
        };
      }

      const list = suggestions.map((s: any, i: number) =>
        `${i+1}. ${s.title} (score: ${s.score}) - ${s.recommendation}`
      ).join('\n');

      return {
        handled: true,
        reply: `Priority tasks:\n${list}`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'suggest' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Clean backlog patterns
  if (/^(clean backlog|cleanup old|archive stale|limpar backlog|arquivar antigas)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would clean up backlog",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'cleanup' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics?action=cleanup&days=60&dryRun=true`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      return {
        handled: true,
        reply: `Found ${result.result.archived} cards older than 60 days. Use "archive stale confirm" to archive them.`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'cleanup' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Archive stale confirm patterns
  if (/^(archive stale confirm|cleanup confirm|clean confirm)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would archive stale cards",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'archive-stale' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive-stale', params: { daysOld: 60 } })
      });
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      broadcast('board:update');
      return {
        handled: true,
        reply: result.message || `Archived ${result.archivedCount} stale cards.`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'archive-stale' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Find duplicates patterns
  if (/^(find duplicates|duplicates|find similar|encontrar duplicados)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would find duplicate cards",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'duplicates' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics?action=duplicates&threshold=0.7`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      const duplicates = result.duplicates || [];
      if (duplicates.length === 0) {
        return {
          handled: true,
          reply: "No duplicate cards found.",
          toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'duplicates' } }]
        };
      }

      const list = duplicates.slice(0, 5).map((d: any) =>
        `• "${d.card1.title}" ≈ "${d.card2.title}" (${Math.round(d.similarity * 100)}%)`
      ).join('\n');

      return {
        handled: true,
        reply: `Found ${duplicates.length} potential duplicates:\n${list}`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'duplicates' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Daily summary patterns
  if (/^(daily summary|standup|daily|resumo di[áa]rio|standup di[áa]rio)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would get daily summary",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'daily' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics?action=daily`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      return {
        handled: true,
        reply: result.message || result.daily?.message || "Daily summary generated.",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'daily' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Prioritize bugs patterns
  if (/^(prioritize bugs|bugs to ready|move bugs|priorizar bugs)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would prioritize bugs",
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'prioritize-bugs' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prioritize-bugs' })
      });
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      broadcast('board:update');
      return {
        handled: true,
        reply: result.message || `Moved ${result.movedCount} bugs to Ready.`,
        toolsUsed: [{ id: 'router', name: 'analytics', args: { action: 'prioritize-bugs' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // List automation rules patterns
  if (/^(automation rules|list rules|show rules|automation|regras de automação)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would list automation rules",
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'list' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/automation?action=list`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      const rules = result.rules || [];
      const enabledCount = rules.filter((r: any) => r.enabled).length;

      const list = rules.map((r: any) =>
        `• ${r.name} ${r.enabled ? '✅' : '⭕'} (${r.runCount} runs)`
      ).join('\n');

      return {
        handled: true,
        reply: `Automation Rules (${enabledCount}/${rules.length} enabled):\n${list}\n\nUse "enable <rule-name>" to activate.`,
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'list' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Enable automation patterns (generic or specific)
  if (/^enable (automation|auto-prioritize bugs|urgent to ready|archive old done|review timeout)$/i.test(text)) {
    const ruleMatch = text.match(/^enable (.+)$/i);
    const ruleName = ruleMatch ? ruleMatch[1].toLowerCase() : null;

    // Map friendly names to rule IDs
    const ruleMap: { [key: string]: string } = {
      'automation': 'auto-prioritize-bugs', // Default to first rule
      'auto-prioritize bugs': 'auto-prioritize-bugs',
      'urgent to ready': 'urgent-to-ready',
      'archive old done': 'archive-old-done',
      'review timeout': 'review-timeout'
    };

    const ruleId = ruleName ? ruleMap[ruleName] : null;

    if (dryRun) {
      return {
        handled: true,
        reply: `(dry-run) Would enable ${ruleName} automation`,
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'enable-default', ruleId }, dryRun: true }]
      };
    }

    if (!ruleId) {
      return {
        handled: true,
        reply: "Unknown rule. Available: auto-prioritize bugs, urgent to ready, archive old done, review timeout",
        toolsUsed: []
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable-default', ruleId })
      });
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      return {
        handled: true,
        reply: result.message || `Enabled ${ruleName} automation.`,
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'enable-default', ruleId } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // Run automation patterns
  if (/^(run automation|run rules|execute rules|executar regras)$/i.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would run automation rules",
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'run' }, dryRun: true }]
      };
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/automation?action=run`);
      const result = await response.json();

      if (!result.ok) throw new Error(result.error);

      broadcast('board:update');
      return {
        handled: true,
        reply: result.message || `Processed ${result.result?.processed || 0} cards.`,
        toolsUsed: [{ id: 'router', name: 'automation', args: { action: 'run' } }]
      };
    } catch (err: any) {
      return { handled: false }; // Fall back to LLM
    }
  }

  // List cards patterns
  if (/^(list|listar|show cards|show tasks|list cards|listar tarefas)$/.test(text)) {
    if (dryRun) {
      return {
        handled: true,
        reply: "(dry-run) Would list all cards",
        toolsUsed: [{ id: 'router', name: 'list_cards', args: {}, dryRun: true }]
      };
    }
    const result = await execTool('list_cards', {});
    const cards = Array.isArray(result) ? result : [];
    if (cards.length === 0) return { handled: true, reply: "No cards on the board.", toolsUsed: [{ id: 'router', name: 'list_cards', args: {} }] };
    const list = cards.slice(0, 10).map((c: any) => `• ${c.title} (${c.column})`).join('\n');
    return {
      handled: true,
      reply: `Cards:\n${list}${cards.length > 10 ? `\n... and ${cards.length - 10} more` : ''}`,
      toolsUsed: [{ id: 'router', name: 'list_cards', args: {} }]
    };
  }

  // Extract filters from the query
  const assigneeMatch = originalText.match(/@(\w+)/i);
  const tagMatch = originalText.match(/#([\w-]+)/i);
  const assignee = assigneeMatch ? assigneeMatch[1].toLowerCase() : null;
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;

  // Date-filtered patterns (PT/EN) - supports both word orders
  let dueRange: DueRange | null = null;

  // Tomorrow: "tomorrow's tasks", "tarefas de amanhã"
  if (/\b(tomorrow)(?:'s)?\s*(tasks?)?\b/i.test(text) ||
      /\btarefas?\s+de\s+amanh[ãa]/i.test(originalText)) {
    dueRange = 'tomorrow';
  }
  // Today: "today's tasks", "tarefas de hoje"
  else if (/\b(today)(?:'s)?\s*(tasks?)?\b/i.test(text) ||
           /\b(hoje)\s*(tasks?|tarefas?)?\b/i.test(text) ||
           /\btarefas?\s+de\s+hoje\b/i.test(originalText)) {
    dueRange = 'today';
  }
  // Overdue: "overdue tasks", "tarefas atrasadas"
  else if (/\b(overdue)\s*(tasks?)?\b/i.test(text) ||
           /\btarefas?\s+atrasad[ao]s?\b/i.test(originalText)) {
    dueRange = 'overdue';
  }
  // This week: "this week's tasks", "tarefas desta semana"
  else if (/\b(this week)(?:'s)?\s*(tasks?)?\b/i.test(text) ||
           /\b(esta semana)\s*(tasks?|tarefas?)?\b/i.test(text) ||
           /\btarefas?\s+(da|desta)\s+semana\b/i.test(originalText)) {
    dueRange = 'this-week';
  }
  // Next week: "next week's tasks", "tarefas da próxima semana"
  else if (/\b(next week)(?:'s)?\s*(tasks?)?\b/i.test(text) ||
           /\btarefas?\s+da\s+pr[óo]xima\s+semana\b/i.test(originalText)) {
    dueRange = 'next-week';
  }

  if (dueRange) {
    if (dryRun) {
      return {
        handled: true,
        reply: `(dry-run) Would list ${dueRange} tasks`,
        toolsUsed: [{ id: 'router', name: 'list_cards', args: { dueRange }, dryRun: true }]
      };
    }

    // Get all cards and filter by multiple criteria
    const result = await execTool('list_cards', {});
    const allCards = Array.isArray(result) ? result : (result?.cards || result?.items || []);
    const range = rangeFor(dueRange);

    // Filter cards by due date, assignee, tag, and exclude Done by default
    let filteredCards = allCards.filter((card: any) => {
      // Filter by due date
      const dueDate = card.due_date || card.due || card.dueDate;
      if (!isInRange(dueDate, range)) return false;

      // Exclude Done tasks by default (unless explicitly requested)
      if (!text.includes('with done') && !text.includes('include done') &&
          !text.includes('com concluídas') && !text.includes('incluir concluídas')) {
        if (card.column === 'Done' || card.status === 'done') return false;
      }

      // Filter by assignee if specified
      if (assignee) {
        const cardAssignees = card.assignees || card.assigned || [];
        const hasAssignee = cardAssignees.some((a: any) => {
          const name = typeof a === 'string' ? a : (a.name || a.username || '');
          return name.toLowerCase().includes(assignee);
        });
        if (!hasAssignee) return false;
      }

      // Filter by tag if specified
      if (tag) {
        const cardTags = card.labels || card.tags || [];
        const hasTag = cardTags.some((t: any) => {
          const label = typeof t === 'string' ? t : (t.name || t.label || '');
          return label.toLowerCase().includes(tag);
        });
        if (!hasTag) return false;
      }

      return true;
    });

    // Build reply header with filters
    const headerMap = {
      'tomorrow': 'Tomorrow\'s tasks',
      'today': 'Today\'s tasks',
      'overdue': 'Overdue tasks',
      'this-week': 'This week\'s tasks',
      'next-week': 'Next week\'s tasks'
    };
    let header = headerMap[dueRange];

    // Add filter context to header
    if (assignee) header += ` @${assignee}`;
    if (tag) header += ` #${tag}`;

    if (filteredCards.length === 0) {
      return {
        handled: true,
        reply: `${header}: None`,
        toolsUsed: [{ id: 'router', name: 'list_cards', args: {} }]
      };
    }

    const list = filteredCards.slice(0, 10).map((c: any) =>
      `• ${c.title}${c.column ? ` (${c.column})` : ''}`
    ).join('\n');

    const countText = filteredCards.length > 10
      ? `${header}: ${filteredCards.length} tasks\n`
      : `${header}: ${filteredCards.length}\n`;

    return {
      handled: true,
      reply: countText + list + (filteredCards.length > 10 ? `\n... and ${filteredCards.length - 10} more` : ''),
      toolsUsed: [{ id: 'router', name: 'list_cards', args: {} }]
    };
  }

  // Create card with explicit pattern: "create card/task X in Y"
  const createMatch = text.match(/^(create|criar|add|adicionar)\s+(card|task|tarefa)\s+"([^"]+)"\s+(?:in|na|no|em)\s+(backlog|ready|doing|work in progress|review|done)/i);
  if (createMatch) {
    const title = createMatch[3];
    const column = createMatch[4];
    const normalizedColumn = column.toLowerCase().includes('work') ? 'Work in progress' :
                           column.charAt(0).toUpperCase() + column.slice(1).toLowerCase();

    // Generate idempotency key
    const idempotencyKey = sessionId
      ? crypto.createHash('sha1').update(`${sessionId}:${userText}`).digest('hex').slice(0, 16)
      : undefined;

    const args = {
      title,
      column: normalizedColumn,
      description: '',
      ...(idempotencyKey && { idempotencyKey })
    };

    if (dryRun) {
      return {
        handled: true,
        reply: `(dry-run) Would create card "${title}" in ${normalizedColumn}`,
        toolsUsed: [{ id: 'router', name: 'create_card', args, dryRun: true }]
      };
    }

    const result = await execTool('create_card', args);

    // Track for undo if sessionId provided
    if (sessionId && result?.taskId) {
      const inverse = getInverseAction('create_card', args, result);
      if (inverse) {
        pushUndo(sessionId, {
          name: 'create_card',
          args,
          result,
          inverse
        });
      }
    }

    broadcast('board:update');
    broadcast('card:created', { title, column: normalizedColumn });
    return {
      handled: true,
      reply: `Created "${title}" in ${normalizedColumn}.`,
      toolsUsed: [{ id: 'router', name: 'create_card', args }]
    };
  }

  // Move card patterns: "move #123 to Done" or "move task-name to Review"
  const moveMatch = text.match(/^(move|mover)\s+(#?\d+|"[^"]+"|'[^']+'|[\w\s-]+)\s+(?:to|para|pra)\s+(backlog|ready|doing|work in progress|review|done)/i);
  if (moveMatch) {
    let taskRef = moveMatch[2].replace(/^#/, '').replace(/^["']/, '').replace(/["']$/, '').trim();
    const column = moveMatch[3];
    const normalizedColumn = column.toLowerCase().includes('work') ? 'Work in progress' :
                           column.charAt(0).toUpperCase() + column.slice(1).toLowerCase();

    console.log(`[Router move] taskRef="${taskRef}", checking if numeric: ${/^\d+$/.test(taskRef)}`);

    // Check if taskRef is not a numeric ID (needs title resolution)
    let taskId = taskRef;
    if (!/^\d+$/.test(taskRef)) {
      // Resolve title to ID
      console.log(`[Router move] Resolving title "${taskRef}" to ID...`);
      try {
        const resolved = await execTool('resolve_card_by_title', { title: taskRef });
        console.log(`[Router move] Resolved to:`, resolved);
        if (!resolved?.taskId) {
          console.log(`[Router move] Resolution failed - no taskId found`);
          return { handled: false }; // Let LLM try to handle it
        }
        taskId = resolved.taskId;
        console.log(`[Router move] Using resolved ID: ${taskId}`);
      } catch (err: any) {
        // Title resolution failed, fall back to LLM
        console.log(`[Router move] Resolution error: ${err.message}`);
        return { handled: false };
      }
    }

    if (dryRun) {
      return {
        handled: true,
        reply: `(dry-run) Would move task "${taskRef}" to ${normalizedColumn}`,
        toolsUsed: [{ id: 'router', name: 'move_card', args: { taskId, toColumn: normalizedColumn }, dryRun: true }]
      };
    }

    try {
      await execTool('move_card', { taskId, toColumn: normalizedColumn });
      broadcast('board:update');
      broadcast('card:moved', { taskId, column: normalizedColumn });
      return {
        handled: true,
        reply: `Moved to ${normalizedColumn}.`,
        toolsUsed: [{ id: 'router', name: 'move_card', args: { taskId, toColumn: normalizedColumn } }]
      };
    } catch (err: any) {
      // Fall back to LLM if move fails (e.g., task not found)
      return { handled: false };
    }
  }

  // Not an obvious command - let LLM handle it
  return { handled: false };
}

// Timeout wrapper for LLM calls
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackFn: () => Promise<T>): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
  );

  try {
    return await Promise.race([promise, timeout]);
  } catch (err: any) {
    if (err.message === 'LLM timeout') {
      console.log('[TIMEOUT] LLM call exceeded ' + timeoutMs + 'ms, using fallback');
      return await fallbackFn();
    }
    throw err;
  }
}

const SYSTEM = `
You are the WordFlux board agent.
- For ANY request about tasks/board, ALWAYS call a tool.
- If parameters missing, ASSUME defaults:
  - title: treat a short phrase as the title
  - column: Backlog unless user specifies another
- Reply in ONE sentence after executing, e.g.: "Created 'X' in Backlog." or "Moved to Review."
- NEVER return "Done" without using a tool.
- Keep replies very concise.`.trim();

type ToolCall = { id: string; name: string; args: any };
const parseArgs = (s?: string) => { try { return s ? JSON.parse(s) : {} } catch { return {} } };

// Smart follow-up detection helpers
function lastUserSaidCreate(history: Message[]): boolean {
  const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.content.toLowerCase() || '';
  // Exclude undo commands from being treated as follow-ups
  if (lastUserMsg.match(/^undo( last)?$/i)) return false;
  return /(crie|criar|create).*(tarefa|card|task)|\bcreate a task\b/.test(lastUserMsg);
}

function looksLikeTitle(text: string): boolean {
  const isShort = text.length <= 80;
  const notCommand = !/\b(undo|redo|help|column|coluna|move|mover|sum[aá]rio|resumo|board|list|listar)\b/i.test(text);
  const notQuestion = !/^(what|how|why|when|where|who|qual|como|por que|quando|onde|quem|quantos?)/i.test(text);
  return isShort && notCommand && notQuestion;
}

function extractColumn(text: string): string | null {
  const match = text.match(/\b(?:em|in|to|na|no)\s+(backlog|ready|doing|work in progress|review|done)/i);
  if (match) {
    const col = match[1].toLowerCase();
    if (col.includes('doing') || col.includes('work')) return 'Work in progress';
    if (col.includes('ready')) return 'Ready';
    if (col.includes('review')) return 'Review';
    if (col.includes('done')) return 'Done';
    if (col.includes('backlog')) return 'Backlog';
  }
  return null;
}

export async function runMcpAgent(userText: string, history: Message[] = [], opts?: { dryRun?: boolean, sessionId?: string }) {
  const startTime = Date.now();
  const reqId = crypto.randomBytes(8).toString('hex');
  const dryRun = opts?.dryRun || false;
  const sessionId = opts?.sessionId;

  // Structured telemetry logging
  const logTelemetry = (path: string, toolsUsed: any[] = [], extraMs?: { router?: number; llm?: number; mcp?: number }) => {
    const totalMs = Date.now() - startTime;
    const intent = path.includes('router') ? 'router' : path.includes('llm') ? 'llm' : 'other';
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      reqId,
      sessionId: sessionId || 'none',
      intent,
      toolsUsed: toolsUsed.map(t => t.name || t),
      ms: extraMs ? { ...extraMs, total: totalMs } : { total: totalMs },
      dryRun: !!dryRun,
      path,
      message: userText.substring(0, 100)
    }));
  };

  // Handle undo command FIRST (absolute priority)
  if (/^undo( last)?$/i.test(userText.trim())) {
    if (!sessionId) {
      logTelemetry('undo-no-session', []);
      return { ok: true, reply: "Undo requires a session ID.", toolsUsed: [] };
    }

    const lastAction = popUndo(sessionId);
    if (!lastAction) {
      logTelemetry('undo-empty', []);
      return { ok: true, reply: "Nothing to undo.", toolsUsed: [] };
    }

    if (!lastAction.inverse) {
      logTelemetry('undo-no-inverse', []);
      return { ok: true, reply: `Cannot undo ${lastAction.name} action.`, toolsUsed: [] };
    }

    if (dryRun) {
      const undoTools = [{ id: 'undo', name: lastAction.inverse.name, args: lastAction.inverse.args, dryRun: true }];
      logTelemetry('undo-dry-run', undoTools);
      return {
        ok: true,
        reply: `(dry-run) Would undo: ${lastAction.inverse.name}(${JSON.stringify(lastAction.inverse.args)})`,
        toolsUsed: undoTools
      };
    }

    try {
      await execTool(lastAction.inverse.name, lastAction.inverse.args);
      broadcast('board:update');
      const undoTools = [{ id: 'undo', name: lastAction.inverse.name, args: lastAction.inverse.args }];
      logTelemetry('undo-success', undoTools);
      return {
        ok: true,
        reply: `Undone: ${lastAction.name} action.`,
        toolsUsed: undoTools
      };
    } catch (err: any) {
      logTelemetry('undo-error', []);
      return { ok: false, error: `Failed to undo: ${err.message}`, toolsUsed: [] };
    }
  }

  // Intent router: handle obvious commands without LLM
  try {
    console.log(`[Router check] Checking if "${userText}" is obvious command`);
    const routerResult = await intentRouter(userText, dryRun, sessionId);
    if (routerResult.handled) {
      console.log(`[Router handled] Command handled by router`);
      // Track for undo if sessionId provided and not dry-run
      if (sessionId && !dryRun && routerResult.toolsUsed.length > 0) {
        const tool = routerResult.toolsUsed[0];
        const inverse = getInverseAction(tool.name, tool.args, {});
        pushUndo(sessionId, {
          name: tool.name,
          args: tool.args,
          result: {},
          inverse: inverse || undefined
        });
      }

      logTelemetry('router-path', routerResult.toolsUsed);
      return {
        ok: true,
        reply: routerResult.reply,
        toolsUsed: routerResult.toolsUsed
      };
    }
  } catch (err: any) {
    // Router failed, continue to LLM
    console.log(`[Router error] ${err.message}`);
  }

  // Fast-path: follow-up to "create task" (skip if undo)
  if (lastUserSaidCreate(history) && looksLikeTitle(userText)) {
    const title = userText.trim();
    const column = extractColumn(userText) || 'Backlog';

    // Generate idempotency key
    const idempotencyKey = sessionId
      ? crypto.createHash('sha1').update(`${sessionId}:${userText}`).digest('hex').slice(0, 16)
      : undefined;

    const args = {
      title,
      column,
      description: '',
      ...(idempotencyKey && { idempotencyKey })
    };

    if (dryRun) {
      const tools = [{ id: 'fast-path', name: 'create_card', args, dryRun: true }];
      logTelemetry('fast-path-dry-run', tools);
      return {
        ok: true,
        reply: `(dry-run) Would create card "${title}" in ${column}`,
        toolsUsed: tools
      };
    }

    try {
      const res = await execTool('create_card', args);

      // Track for undo if sessionId provided
      if (sessionId) {
        const inverse = getInverseAction('create_card', args, res);
        pushUndo(sessionId, {
          name: 'create_card',
          args,
          result: res,
          inverse: inverse || undefined
        });
      }

      broadcast('board:update');
      broadcast('card:created', { title, column });
      const tools = [{ id: 'fast-path', name: 'create_card', args }];
      logTelemetry('fast-path-success', tools);
      return {
        ok: true,
        reply: `Created "${title}" in ${column}.`,
        toolsUsed: tools
      };
    } catch (err: any) {
      logTelemetry('fast-path-error', []);
      // Fall through to normal LLM path if fast-path fails
    }
  }
  // Build messages array with history
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    // Include conversation history
    ...history.map(msg => ({
      role: msg.role as any,
      content: msg.content
    })),
    { role: "user", content: userText }
  ];

  // Round 1 — let GPT-5 choose tools (with timeout)
  const llmCall = async () => {
    const comp = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefs as any,
      tool_choice: "auto",
    });
    return comp;
  };

  const timeoutFallback = async () => {
    // On timeout, return a board summary as fallback
    const boardResult = await execTool('get_board_summary', {});
    const cols = boardResult?.columns || [];
    const total = cols.reduce((sum: number, col: any) => sum + (col.count || 0), 0);
    const summary = cols.map((c: any) => `${c.name}: ${c.count}`).join(', ');

    logTelemetry('llm-timeout-fallback', [{ name: 'get_board_summary', args: {} }]);
    return {
      ok: true,
      reply: `Board: ${summary} (Total: ${total} cards)`,
      toolsUsed: [{ id: 'fallback', name: 'get_board_summary', args: {} }]
    };
  };

  let comp;
  try {
    comp = await withTimeout(llmCall(), 12000, async () => {
      // On timeout, throw to trigger fallback
      throw new Error('LLM timeout');
    });
  } catch (err: any) {
    if (err.message === 'LLM timeout') {
      // Return fallback board summary
      const fallbackResult = await timeoutFallback();
      return fallbackResult;
    }
    logTelemetry('llm-error', []);
    return { ok: false, error: `LLM error: ${err.message}`, toolsUsed: [] };
  }

  let msg = comp.choices[0]?.message;

  // Retry once with a hard nudge if no tools
  if (!msg?.tool_calls?.length) {
    comp = await client.chat.completions.create({
      model: MODEL,
      messages: [...messages, { role: "system", content: "You must call at least one tool. If unsure, call get_board_summary." }],
      tools: toolDefs as any,
      tool_choice: "auto",
    });
    msg = comp.choices[0]?.message;
  }

  const calls: ToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
    id: tc.id!,
    name: tc.function?.name!,
    args: parseArgs(tc.function?.arguments)
  }));

  if (!calls.length) {
    logTelemetry('llm-path-no-tools', []);
    return { ok: false, error: "No tool calls generated", toolsUsed: [] as ToolCall[] };
  }

  // If dry-run, return planned actions without executing
  if (dryRun) {
    const toolsUsed = calls.map(call => ({ ...call, dryRun: true }));
    const actions = calls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join(', ');
    logTelemetry('llm-path-dry-run', toolsUsed);
    return {
      ok: true,
      reply: `(dry-run) Would execute: ${actions}`,
      toolsUsed
    };
  }

  // Execute tools serially, feed results back, broadcast SSE
  const toolsUsed: ToolCall[] = [];
  for (const call of calls) {
    // Add idempotency key for create operations
    const finalArgs = call.name === 'create_card' && sessionId
      ? { ...call.args, idempotencyKey: crypto.createHash('sha1').update(`${sessionId}:${call.args.title}`).digest('hex').slice(0, 16) }
      : call.args;

    if (call.name === 'move_card') {
      const args = finalArgs as any
      const hasId = args?.taskId || args?.cardId || args?.id
      const hasTitle = typeof args?.title === 'string' && args.title.trim().length > 0
      if (!hasId && !hasTitle) {
        logTelemetry('llm-path-missing-args', [...toolsUsed, { ...call, args: finalArgs }])
        return {
          ok: false,
          error: 'Preciso do título ou ID do card para mover.',
          toolsUsed
        };
      }
    }

    const out = await execTool(call.name, finalArgs);
    toolsUsed.push({ ...call, args: finalArgs });

    // Track for undo if sessionId provided
    if (sessionId) {
      const inverse = getInverseAction(call.name, finalArgs, out);
      pushUndo(sessionId, {
        name: call.name,
        args: finalArgs,
        result: out,
        inverse: inverse || undefined
      });
    }

    if (["create_card","move_card"].includes(call.name)) {
      broadcast(call.name === "create_card" ? "card:created" : "card:moved", { args: call.args });
      broadcast("board:update");
    }
    // preserve assistant tool_call + provide tool result
    messages.push({ role: "assistant", content: "", tool_calls: [{ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } }] } as any);
    messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) } as any);
  }

  // Final: summarise; no more tools
  const final = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools: toolDefs as any,
    tool_choice: "none",
  });

  const finalReply = final.choices[0]?.message?.content ?? "(no content)";
  logTelemetry('llm-path-success', toolsUsed);
  return {
    ok: true,
    reply: finalReply,
    toolsUsed
  };
}
