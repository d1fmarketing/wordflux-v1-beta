import { Action, ActionList } from './action-schema';

type ColumnMap = Record<string, string>; // normalizedName -> actual column label

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Maps synonyms to canonical board column names
export function buildColumnMap(columns: string[]): ColumnMap {
  const map: ColumnMap = {};
  
  for (const col of columns) {
    const key = normalize(col);
    map[key] = col;
    
    // Common synonyms for standard Kanban columns
    if (/todo|backlog/.test(key)) {
      map['todo'] = col;
      map['todos'] = col;
      map['backlog'] = col;
      map['to do'] = col;
      map['to-do'] = col;
      map['inbox'] = col;
      map['new'] = col;
      map['ideas'] = col;
      map['analysis'] = col;
      map['planning'] = col;
      map['intake'] = col;
      map['icebox'] = col;
    }
    if (/ready/.test(key)) {
      map['ready'] = col;
      map['ready to start'] = col;
      map['up next'] = col;
      map['next'] = col;
      map['queued'] = col;
      map['planned'] = col;
    }
    if (/in progress|doing|progress|wip|work in progress/.test(key)) {
      map['in progress'] = col;
      map['inprogress'] = col;
      map['doing'] = col;
      map['progress'] = col;
      map['wip'] = col;
      map['work in progress'] = col;
      map['working'] = col;
      map['active'] = col;
      map['current'] = col;
      map['dev'] = col;
      map['coding'] = col;
      map['building'] = col;
      map['implementing'] = col;
      map['ongoing'] = col;
      map['started'] = col;
    }
    if (/review|qa|verify|testing/.test(key)) {
      map['review'] = col;
      map['reviewing'] = col;
      map['qa'] = col;
      map['qc'] = col;
      map['verify'] = col;
      map['verifying'] = col;
      map['testing'] = col;
      map['test'] = col;
      map['validation'] = col;
      map['checking'] = col;
      map['staging'] = col;
      map['uat'] = col;
      map['verification'] = col;
    }
    if (/done|complete|finished/.test(key)) {
      map['done'] = col;
      map['complete'] = col;
      map['completed'] = col;
      map['finished'] = col;
      map['closed'] = col;
      map['resolved'] = col;
      map['shipped'] = col;
      map['deployed'] = col;
      map['live'] = col;
      map['released'] = col;
      map['published'] = col;
      map['archived'] = col;
    }
    if (/block/.test(key)) {
      map['blocked'] = col;
      map['blocking'] = col;
      map['stuck'] = col;
      map['waiting'] = col;
      map['on hold'] = col;
      map['onhold'] = col;
      map['paused'] = col;
    }
  }
  
  return map;
}

function parseId(ref: string): number | undefined {
  const match = ref.match(/#?(\d+)\b/);  // Better boundary matching
  return match ? Number(match[1]) : undefined;
}

function extractQuoted(text: string): string | null {
  const singleQuote = text.match(/'([^']+)'/);
  if (singleQuote) return singleQuote[1];
  
  const doubleQuote = text.match(/"([^"]+)"/);
  if (doubleQuote) return doubleQuote[1];
  
  return null;
}

export function parseMessage(msg: string, columns: string[]): Action[] {
  // First, normalize quotes and punctuation without changing case
  const cleanedMsg = msg
    .trim()
    .replace(/[""]/g, '"')  // Smart quotes to regular
    .replace(/['']/g, "'")
    .replace(/[.。!?]+$/g, '')  // Remove trailing punctuation
    .replace(/^[.。!?]+/g, '')  // Remove leading punctuation
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/,\s*$/g, '')  // Remove trailing commas
    .replace(/;\s*$/g, '');  // Remove trailing semicolons
  
  // Extract quoted text BEFORE lowercasing to preserve original case
  const quotedPattern = /["']([^"']+)["']/g;
  const quotedTexts: string[] = [];
  let match;
  while ((match = quotedPattern.exec(cleanedMsg)) !== null) {
    quotedTexts.push(match[1]);
  }
  
  // Now lowercase for command matching
  const normalized = cleanedMsg.toLowerCase().trim();
  
  const isPreview = normalized.startsWith('preview:');
  const body = isPreview ? normalized.slice(8).trim() : normalized;
  const colMap = buildColumnMap(columns);
  const actions: Action[] = [];

  // Handle undo command
  {
    const match = body.match(/^undo\s+([A-Za-z0-9\-_]+)/i);
    if (match) {
      return [{ type: 'undo', token: match[1] }];
    }
  }

  // Create task: "create task 'Fix login' in backlog" or "add 'Fix login' to ready"
  {
    const patterns = [
      /^(create|add)\s+(task\s+)?["'](.+?)["']\s+(in|to)\s+(.+)$/i,
      /^(create|add)\s+(task\s+)?(.+?)\s+(in|to)\s+(.+)$/i,
      /^(create|add)\s+["'](.+?)["']$/i,
      /^(create|add)\s+task\s+(.+)$/i,
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        let title: string;
        let column: string | undefined;
        
        if (match.length === 6) {
          // Pattern with column - use preserved quoted text if available
          if (quotedTexts.length > 0) {
            title = quotedTexts[0]; // Use original case-preserved text
          } else {
            title = match[3];
          }
          const columnKey = normalize(match[5]);
          column = colMap[columnKey] || match[5];
        } else if (match.length === 3) {
          // Pattern without column - use preserved quoted text if available
          if (quotedTexts.length > 0) {
            title = quotedTexts[0]; // Use original case-preserved text
          } else {
            title = match[2];
          }
          column = 'Backlog'; // Default column
        } else {
          continue;
        }
        
        // Extract tags and priority from title
        const tags: string[] = [];
        const tagMatch = title.match(/\s+#(\w+)/g);
        if (tagMatch) {
          tags.push(...tagMatch.map(t => t.trim().slice(1)));
          title = title.replace(/\s+#\w+/g, '');
        }
        
        // Only extract priority if title wasn't from quoted text
        // (preserve exact quoted titles)
        let priority: 'low' | 'normal' | 'high' | undefined;
        if (quotedTexts.length === 0) {
          // Only remove priority keywords if title wasn't quoted
          if (/\b(urgent|high\s*priority|critical)\b/i.test(title)) {
            priority = 'high';
            title = title.replace(/\b(urgent|high\s*priority|critical)\b/gi, '').trim();
          }
        } else {
          // Still detect priority but don't modify quoted title
          if (/\b(urgent|high\s*priority|critical)\b/i.test(title)) {
            priority = 'high';
          }
        }
        
        actions.push({ 
          type: 'create_task', 
          title: title.trim(),
          column,
          tags: tags.length > 0 ? tags : undefined,
          priority
        });
        break;
      }
    }
  }

  // Quick commands: "done #12", "start #12", "ready #12"
  if (actions.length === 0) {
    const quickPatterns = [
      { pattern: /^(done|finish)\s+#(\d+)$/i, column: 'done' },
      { pattern: /^start\s+#(\d+)$/i, column: 'in progress' },
      { pattern: /^ready\s+#(\d+)$/i, column: 'ready' },
      { pattern: /^(done|finish)\s+["'](.+?)["']$/i, column: 'done' },
      { pattern: /^start\s+["'](.+?)["']$/i, column: 'in progress' },
      { pattern: /^ready\s+["'](.+?)["']$/i, column: 'ready' },
    ];
    
    for (const { pattern, column } of quickPatterns) {
      const match = body.match(pattern);
      if (match) {
        const taskRef = match[2] || match[1];
        const maybeId = parseId(taskRef);
        actions.push({
          type: 'move_task',
          task: maybeId || taskRef,
          column
        });
        break;
      }
    }
  }
  
  // Move task: "move #12 to review" or "move 'auth bug' to in progress"
  if (actions.length === 0) {
    const patterns = [
      /^move\s+#(\d+)\s+to\s+(.+)$/i,
      /^move\s+["'](.+?)["']\s+to\s+(.+)$/i,
      /^move\s+(.+?)\s+to\s+(.+)$/i,
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        let taskRef = match[1];
        
        // If it's the quoted pattern and we have preserved text, use it
        if (pattern.source.includes('["\'"]') && quotedTexts.length > 0) {
          taskRef = quotedTexts[0]; // Use original case-preserved text
        }
        
        const maybeId = parseId(taskRef);
        const task = maybeId || taskRef;
        const columnKey = normalize(match[2]);
        const column = colMap[columnKey] || match[2];
        
        actions.push({ type: 'move_task', task, column });
        break;
      }
    }
  }

  // Update task: "update #15 title: New title" or "update #15 priority: high"
  if (actions.length === 0) {
    const match = body.match(/^update\s+(.+?)\s+(title|desc|description|priority)\s*:\s*(.+)$/i);
    if (match) {
      const taskRef = match[1];
      const task = parseId(taskRef) || taskRef;
      const field = match[2].toLowerCase();
      const value = match[3].trim();
      
      const action: any = { type: 'update_task', task };
      
      if (field.startsWith('title')) {
        action.title = value;
      } else if (field.startsWith('desc')) {
        action.description = value;
      } else if (field === 'priority') {
        if (/high|urgent|critical/i.test(value)) {
          action.priority = 'high';
        } else if (/low/i.test(value)) {
          action.priority = 'low';
        } else {
          action.priority = 'normal';
        }
      }
      
      actions.push(action);
    }
  }


  // Set due dates: "set due <when> for #ids" or PT: "coloque prazo <quando> para #ids"
  if (actions.length === 0) {
    let m = body.match(/^(set|coloc(a|e)|defin(a|ir))\s+(due|prazo)\s+(.+?)\s+(for|para)\s+(.+)$/i);
    if (m) {
      const when = m[5].trim();
      const idsRaw = m[7];
      const ids = Array.from(idsRaw.matchAll(/#?(\d+)/g)).map(x=>Number(x[1]));
      if (ids.length>0) actions.push({ type: 'set_due', when, ids });
    }
  }
  // Set due for first N in column: "set due <when> for first N in Backlog" or PT "nos 3 primeiros do Backlog"
  if (actions.length === 0) {
    let m = body.match(/^(set|coloc(a|e)|defin(a|ir))\s+(due|prazo)\s+(.+?)\s+(for\s+first\s+(\d+)\s+in\s+(.+)|nos?\s+(\d+)\s+primeiros?\s+do\s+(.+))$/i);
    if (m) {
      const when = m[5].trim();
      const first = Number(m[7] || m[9] || 0);
      const column = (m[8] || m[10] || '').trim();
      if (first>0 && column) actions.push({ type: 'set_due', when, first, column });
    }
  }
  // Quick urgent: "mark #id urgent" / "marcar #id urgente" / "tirar urgente #id"
  if (actions.length === 0) {
    let m = body.match(/^mark\s+#(\d+)\s+urgent$/i) || body.match(/^marc(ar|ar)\s+#(\d+)\s+urgent(e)?$/i);
    if (m) { const id = Number(m[1] || m[2]); actions.push({ type: 'update_task', task: id, priority: 'high' }); }
  }
  if (actions.length === 0) {
    let m = body.match(/^(remove|tirar)\s+urgent(e)?\s+#(\d+)$/i);
    if (m) { const id = Number(m[3]); actions.push({ type: 'update_task', task: id, priority: 'normal' }); }
  }

  if (actions.length === 0) {
    if (/^(undo|undo last|desfazer|voltar)$/i.test(body.trim())) {
      actions.push({ type: 'undo_last' })
    }
  }

  if (actions.length === 0) {
    if (/^tidy( board| quadro)?$/i.test(body.trim())) {
      actions.push({ type: 'tidy_board' })
    }
  }

  // Tag task: "tag #21 add urgent, ai" or "tag #21 remove urgent"
  if (actions.length === 0) {
    const match = body.match(/^tag\s+(.+?)\s+(add|remove)\s+(.+)$/i);
    if (match) {
      const taskRef = match[1];
      const task = parseId(taskRef) || taskRef;
      const operation = match[2].toLowerCase();
      const tags = match[3].split(/[,\s]+/).filter(Boolean);
      
      actions.push({
        type: 'tag_task',
        task,
        add: operation === 'add' ? tags : [],
        remove: operation === 'remove' ? tags : []
      });
    }
  }

  // Assign task: "assign #42 to RJ" or "assign 'login bug' to renan"
  if (actions.length === 0) {
    const patterns = [
      /^assign\s+#(\d+)\s+to\s+(.+)$/i,
      /^assign\s+["'](.+?)["']\s+to\s+(.+)$/i,
      /^assign\s+(.+?)\s+to\s+(.+)$/i,
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        const taskRef = match[1];
        const task = parseId(taskRef) || taskRef;
        const assignee = match[2].trim();
        
        actions.push({ type: 'assign_task', task, assignee });
        break;
      }
    }
  }

  // Comment on task: "comment #10 Needs design review"
  if (actions.length === 0) {
    const patterns = [
      /^comment\s+#(\d+)\s+(.+)$/i,
      /^comment\s+["'](.+?)["']\s+(.+)$/i,
      /^comment\s+(.+?)\s+:\s*(.+)$/i,
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        const taskRef = match[1];
        const task = parseId(taskRef) || taskRef;
        const comment = match[2].trim();
        
        actions.push({ type: 'comment_task', task, comment });
        break;
      }
    }
  }

  // List tasks: "list tasks" or "list in progress"
  if (actions.length === 0) {
    const match = body.match(/^list\s*(tasks)?\s*(.*)$/i);
    if (match) {
      const filter = match[2].trim();
      if (filter) {
        const columnKey = normalize(filter);
        const column = colMap[columnKey] || filter;
        actions.push({ type: 'list_tasks', column });
      } else {
        actions.push({ type: 'list_tasks' });
      }
    }
  }

  // Search tasks: "search login bug" or "find authentication"

  // Natural filters: "blocked", "overdue", "due today", "today", "my tasks"
  if (actions.length === 0) {
    if (/^blocked$/.test(body) || /what'?s?\s+blocked/.test(body)) {
      actions.push({ type: 'list_tasks', filter: 'blocked' });
    } else if (/^(overdue|past\s+due)$/.test(body)) {
      actions.push({ type: 'list_tasks', filter: 'overdue' });
    } else if (/^(due\s+today|today)$/.test(body)) {
      actions.push({ type: 'list_tasks', filter: 'today' });
    } else if (/^(my\s+tasks|mine)$/.test(body)) {
      actions.push({ type: 'list_tasks', filter: 'mine' });
    }
  }
  if (actions.length === 0) {
    const match = body.match(/^(search|find)\s+(.+)$/i);
    if (match) {
      actions.push({ type: 'search_tasks', query: match[2].trim() });
    }
  }


  // Summarize specific scope: "summarize ready", "summarize overdue", "summarize my tasks"
  if (actions.length === 0) {
    const m = body.match(/^(summary|summarize|resumo|resumir)\s+(.+)$/i);
    if (m) {
      const scope = m[2].trim().toLowerCase();
      if (/(overdue|past\s+due|atrasad)/.test(scope)) {
        actions.push({ type: 'list_tasks', filter: 'overdue' });
      } else if (/(today|hoje)/.test(scope)) {
        actions.push({ type: 'list_tasks', filter: 'today' });
      } else if (/(mine|my\s+tasks|minhas)/.test(scope)) {
        actions.push({ type: 'list_tasks', filter: 'mine' });
      } else if (/(blocked|bloquead|stuck)/.test(scope)) {
        actions.push({ type: 'list_tasks', filter: 'blocked' });
      } else {
        const columnKey = normalize(scope);
        const column = colMap[columnKey] || m[2];
        actions.push({ type: 'list_tasks', column });
      }
    }
  }

  // Quick commands
  if (actions.length === 0) {
    const lowerBody = body.toLowerCase();
    
    // Board status commands
    if (/^(board\s+)?(status|summary|overview)$/.test(lowerBody)) {
      actions.push({ type: 'list_tasks', column: 'Work in progress' });
      actions.push({ type: 'list_tasks', column: 'Ready' });
      actions.push({ type: 'list_tasks', filter: 'overdue' });
    }
    
    // Quick done command: "done #123" or "done 'task title'"
    const doneMatch = body.match(/^done\s+(.+)$/i);
    if (doneMatch) {
      const taskRef = doneMatch[1];
      const task = parseId(taskRef) || taskRef;
      actions.push({ type: 'move_task', task, column: 'Done' });
    }
    
    // Quick start command: "start #123"
    const startMatch = body.match(/^start\s+(.+)$/i);
    if (startMatch) {
      const taskRef = startMatch[1];
      const task = parseId(taskRef) || taskRef;
      actions.push({ type: 'move_task', task, column: 'Work in progress' });
    }
    
    // What's next
    if (/^(what'?s?\s+next|next\s+task)/.test(lowerBody)) {
      actions.push({ type: 'list_tasks', column: 'Ready' });
    }
    
    // What's in progress
    if (/^(what'?s?\s+in\s+progress|wip|current)/.test(lowerBody)) {
      actions.push({ type: 'list_tasks', column: 'Work in progress' });
    }
  }

  // If preview mode, wrap actions
  if (isPreview && actions.length > 0) {
    return [{ type: 'preview', actions }];
  }

  // Validate actions if any were parsed
  if (actions.length > 0) {
    try {
      return ActionList.parse(actions);
    } catch (error) {
      console.error('Action validation failed:', error);
      return [];
    }
  }

  return actions;
}
