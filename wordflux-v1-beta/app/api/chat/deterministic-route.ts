import { NextRequest, NextResponse } from 'next/server';
import { Action, ActionList } from '@/lib/agent/action-schema';
import { parseMessage } from '@/lib/agent/parse';
import { KanboardClient } from '@/lib/kanboard-client/index';
import crypto from 'crypto';
import { detectAutoTags, formatTagsForComment, formatTagsForDisplay } from '@/lib/auto-tagger';
import { userContextManager } from '@/lib/user-context';
import { simplifyConfirmation } from '@/lib/style-guard';

export const dynamic = 'force-dynamic';

const PROJECT_ID = parseInt(process.env.KANBOARD_PROJECT_ID || '1', 10);
const SWIMLANE_ID = parseInt(process.env.KANBOARD_SWIMLANE_ID || '1', 10);

// Initialize Kanboard client
const kbRaw = new KanboardClient({
  url: process.env.KANBOARD_URL!,
  username: process.env.KANBOARD_USERNAME!,
  password: process.env.KANBOARD_PASSWORD!,
});

// Enhanced retry with jitter for all Kanboard calls
function sleep(ms: number) { 
  return new Promise(r => setTimeout(r, ms)); 
}

async function withRetryJitter<T>(
  fn: () => Promise<T>, 
  tries = 5, 
  baseMs = 150
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { 
      return await fn(); 
    } catch (e: any) {
      lastErr = e;
      if (i < tries - 1) {
        const backoff = baseMs * Math.pow(2, i) + Math.floor(Math.random() * baseMs);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

// Proxy wrapper to automatically retry all Kanboard methods
const kb = new Proxy(kbRaw as any, {
  get(target, prop, receiver) {
    const val = Reflect.get(target, prop, receiver);
    if (typeof val !== 'function') return val;
    return (...args: any[]) => withRetryJitter(() => val.apply(target, args), 5, 120);
  }
});

type UndoRecord = {
  token: string;
  actions: { 
    type: string; 
    taskId?: number; 
    fromColumnId?: number; 
    toColumnId?: number; 
    prev?: any 
  }[];
  createdAt: number;
};

// In-memory undo log (in production, use Redis or DB)
const UNDO_LOG: Map<string, UndoRecord> = new Map();

// Clean up old undo records periodically
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  Array.from(UNDO_LOG.entries()).forEach(([token, record]) => {
    if (now - record.createdAt > oneHour) {
      UNDO_LOG.delete(token);
    }
  });
}, 10 * 60 * 1000); // Every 10 minutes

// Legacy withRetry kept for specific high-priority operations
async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 3,
  baseMs = 250
): Promise<T> {
  // Now delegates to withRetryJitter for consistency
  return withRetryJitter(fn, tries, baseMs);
}

async function getColumnsMap(): Promise<Record<string, { id: number; title: string }>> {
  const columns = await kb.getColumns(PROJECT_ID);
  const map: Record<string, { id: number; title: string }> = {};
  
  for (const col of columns) {
    const key = col.title.toLowerCase();
    map[key] = { id: col.id, title: col.title };
    
    // Also map common variations
    if (key.includes('backlog')) {
      map['backlog'] = { id: col.id, title: col.title };
    }
    if (key.includes('ready')) {
      map['ready'] = { id: col.id, title: col.title };
    }
    if (key.includes('progress')) {
      map['in progress'] = { id: col.id, title: col.title };
      map['wip'] = { id: col.id, title: col.title };
    }
    if (key.includes('done')) {
      map['done'] = { id: col.id, title: col.title };
      map['complete'] = { id: col.id, title: col.title };
    }
  }
  
  return map;
}

async function resolveTask(ref: number | string): Promise<any> {
  if (typeof ref === 'number') {
    return await kb.getTask(ref);
  }
  
  // Search by title
  const tasks = await kb.searchTasks(PROJECT_ID, String(ref));
  if (!tasks || tasks.length === 0) {
    throw new Error(`Task not found: "${ref}"`);
  }
  
  // Handle ambiguity
  if (tasks.length > 1) {
    const suggestions = tasks.slice(0, 5).map(t => ({
      id: t.id,
      title: t.title,
      column_id: t.column_id,
      hint: `Use "#${t.id}" or be more specific`
    }));
    
    const error: any = new Error(
      `Found ${tasks.length} tasks matching "${ref}". Did you mean:\n` +
      suggestions.map(s => `  • #${s.id} "${s.title}"`).join('\n')
    );
    error.ambiguous = true;
    error.suggestions = suggestions;
    error.statusCode = 409;
    throw error;
  }
  
  return tasks[0];
}

async function executeAction(
  action: Action,
  undo: UndoRecord,
  columnsByName: Record<string, { id: number; title: string }>,
  request?: Request
): Promise<any> {
  switch (action.type) {
    case 'create_task': {
      // Auto-detect tags from title and description
      const textToAnalyze = `${action.title} ${action.description || ''}`;
      const autoTags = detectAutoTags(textToAnalyze);
      
      // Merge auto-tags with explicitly provided tags
      const allTags = [...(action.tags || [])];
      const autoTagLabels = autoTags.map(t => t.label);
      for (const label of autoTagLabels) {
        if (!allTags.includes(label)) {
          allTags.push(label);
        }
      }
      
      // Create the task with emoji prefix if auto-tagged
      const titleWithEmojis = autoTags.length > 0 
        ? `${formatTagsForDisplay(autoTags)} ${action.title}`
        : action.title;
        
      const taskId = await withRetry(() =>
        kb.createTask(
          PROJECT_ID,
          titleWithEmojis,
          undefined, // column_id will be set via move
          action.description
        )
      ) as number;
      
      // Determine target column (explicit or remembered default)
      let col = undefined;
      let columnName = action.column;
      
      if (!columnName && request) {
        // Try to use remembered default column
        const defaultCol = userContextManager.getDefaultColumn(request);
        if (defaultCol) {
          columnName = defaultCol;
        }
      }
      
      // Default to Backlog if no column specified
      if (!columnName) {
        columnName = 'Backlog';
      }
      
      // Remap Ready -> Backlog for create
      if (columnName && /(ready|up next|queued|planned)/i.test(String(columnName))) { columnName = 'Backlog' }
      // Move to the target column
      col = columnsByName[columnName.toLowerCase()];
      if (col) {
        await kb.moveTaskPosition(PROJECT_ID, taskId, col.id, 1, SWIMLANE_ID);
        
        // Remember this column for next time
        if (request && action.column) {
          userContextManager.setLastUsedColumn(request, col.title);
        }
      }
      
      // Track task creation
      if (request) {
        userContextManager.incrementTaskCount(request);
      }
      
      // Add tags as comment including auto-detected ones
      if (autoTags.length > 0) {
        const tagComment = formatTagsForComment(autoTags);
        await kb.addComment(taskId, tagComment);
      } else if (allTags.length > 0) {
        await kb.addComment(taskId, `🏷 Tags: ${allTags.join(', ')}`);
      }
      
      // Add assignee as comment if specified
      if (action.assignee) {
        await kb.addComment(taskId, `👤 Assigned to: ${action.assignee}`);
      }
      
      // Set priority if specified
      if (action.priority) {
        const priorityMap = { high: 3, normal: 2, low: 1 };
        await kb.updateTask(taskId, { priority: priorityMap[action.priority] });
      }
      
      undo.actions.push({ type: 'create_task', taskId });
      
      return { 
        taskId, 
        title: action.title,
        column: col?.title || action.column || 'Backlog'  // Return canonical name
      };
    }

    case 'move_task': {
      const task = await resolveTask(action.task);
      if (!task) throw new Error(`Task not found: ${action.task}`);
      
      const targetName = /(ready|up next|queued|planned)/i.test(String(action.column)) ? 'Review' : action.column;
      const toColumn = columnsByName[targetName.toLowerCase()];
      if (!toColumn) throw new Error(`Column not found: ${action.column}`);
      
      const fromColumnId = task.column_id;
      
      await withRetry(() =>
        kb.moveTaskPosition(
          PROJECT_ID,
          task.id,
          toColumn.id,
          action.position || 1,
          SWIMLANE_ID
        )
      );
      
      undo.actions.push({
        type: 'move_task',
        taskId: task.id,
        fromColumnId,
        toColumnId: toColumn.id
      });
      
      return {
        taskId: task.id,
        title: task.title,
        from: fromColumnId,
        to: toColumn.title  // Already canonical
      };
    }

    case 'update_task': {
      const task = await resolveTask(action.task);
      if (!task) throw new Error(`Task not found: ${action.task}`);
      
      const prev = {
        title: task.title,
        description: task.description,
        priority: task.priority
      };
      
      const updates: any = {};
      if (action.title) updates.title = action.title;
      if (action.description) updates.description = action.description;
      if (action.priority) {
        const priorityMap = { high: 3, normal: 2, low: 1 };
        updates.priority = priorityMap[action.priority];
      }
      
      if (Object.keys(updates).length > 0) {
        await kb.updateTask(task.id, updates);
      }
      
      // Add tags as comment if provided
      if (action.tags && action.tags.length > 0) {
        await kb.addComment(task.id, `🏷 Added tags: ${action.tags.join(', ')}`);
      }
      
      const changes: any = {};
      if (action.title) changes.title = action.title;
      if (action.description) changes.description = true;
      if (action.priority) changes.priority = action.priority;
      
      undo.actions.push({ type: 'update_task', taskId: task.id, prev });
      
      return { 
        taskId: task.id, 
        updated: Object.keys(updates),
        changes  // Include structured changes
      };
    }

    case 'assign_task': {
      const task = await resolveTask(action.task);
      if (!task) throw new Error(`Task not found: ${action.task}`);
      
      await kb.addComment(task.id, `👤 Assigned to: ${action.assignee}`);
      
      undo.actions.push({ type: 'comment_task', taskId: task.id });
      
      return { taskId: task.id, assignee: action.assignee };
    }

    case 'tag_task': {
      const task = await resolveTask(action.task);
      if (!task) throw new Error(`Task not found: ${action.task}`);
      
      if (action.add && action.add.length > 0) {
        await kb.addComment(task.id, `🏷 Added tags: ${action.add.join(', ')}`);
      }
      if (action.remove && action.remove.length > 0) {
        await kb.addComment(task.id, `🏷 Removed tags: ${action.remove.join(', ')}`);
      }
      
      undo.actions.push({ type: 'comment_task', taskId: task.id });
      
      return { 
        taskId: task.id, 
        added: action.add,
        removed: action.remove 
      };
    }

    case 'comment_task': {
      const task = await resolveTask(action.task);
      if (!task) throw new Error(`Task not found: ${action.task}`);
      
      await kb.addComment(task.id, action.comment);
      
      undo.actions.push({ type: 'comment_task', taskId: task.id });
      
      return { taskId: task.id, commented: true };
    }

    case 'list_tasks': {
      const tasks = await kb.listProjectTasks(PROJECT_ID);
      let filtered = tasks;
      if (action.column) {
        const col = columnsByName[action.column.toLowerCase()];
        if (col) filtered = filtered.filter((t: any) => t.column_id === col.id);
      }
      if ((action as any).filter) {
        const f = String((action as any).filter).toLowerCase();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()/1000; // seconds
        const end = start + 86400;
        if (f === 'today') {
          filtered = filtered.filter((t: any) => t.date_due && t.date_due >= start && t.date_due < end);
        } else if (f === 'overdue') {
          filtered = filtered.filter((t: any) => t.date_due && t.date_due < Math.floor(Date.now()/1000) && t.is_active === 1);
        } else if (f === 'blocked') {
          filtered = filtered.filter((t: any) => {
            const title = String(t.title||'').toLowerCase();
            const cat = String((t as any).category||'').toLowerCase();
            const tags = Array.isArray((t as any).tags)? (t as any).tags.map((x:any)=>String(x).toLowerCase()): [];
            return title.includes('block') || title.includes('stuck') || cat.includes('block') || tags.includes('blocked') || tags.includes('blocker');
          });
        } else if (f === 'mine') {
          // Heuristic: if API exposes owner_id, keep those with an owner
          filtered = filtered.filter((t: any) => t.owner_id && Number(t.owner_id) > 0);
        }
      }
      return {
        count: filtered.length,
        tasks: filtered.slice(0, 20).map((t: any) => ({ id: t.id, title: t.title, column_id: t.column_id }))
      };
    }


    case 'search_tasks': {
      const tasks = await kb.searchTasks(PROJECT_ID, action.query);
      
      return {
        count: tasks.length,
        tasks: tasks.slice(0, 10).map(t => ({
          id: t.id,
          title: t.title,
          column_id: t.column_id
        }))
      };
    }

    case 'undo': {
      const record = UNDO_LOG.get(action.token);
      if (!record) {
        throw new Error('Undo token not found or expired');
      }
      
      // Best-effort undo in reverse order
      for (const act of record.actions.reverse()) {
        try {
          if (act.type === 'create_task' && act.taskId) {
            // Archive/close the task
            await kb.updateTask(act.taskId, { is_active: 0 });
          } else if (act.type === 'move_task' && act.taskId && act.fromColumnId) {
            // Move back to original column
            await kb.moveTaskPosition(PROJECT_ID, act.taskId, act.fromColumnId, 1, SWIMLANE_ID);
          } else if (act.type === 'update_task' && act.taskId && act.prev) {
            // Restore previous values
            await kb.updateTask(act.taskId, act.prev);
          }
          // Comments can't be undone
        } catch (e) {
          console.error('Undo action failed:', e);
        }
      }
      
      UNDO_LOG.delete(action.token);
      
      return { undone: true, actionsReverted: record.actions.length };
    }

    case 'preview': {
      // Return plan without executing
      return {
        preview: true,
        actions: action.actions.map((a: any) => ({
          type: a.type,
          ...a
        }))
      };
    }

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

export async function processMessage(message: string, preview: boolean = false, request?: Request): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Get current columns for mapping
    const columns = await kb.getColumns(PROJECT_ID);
    const columnNames = columns.map(c => c.title);
    
    // Parse message into actions
    const fullMessage = preview ? `preview: ${message}` : message;
    const actions = parseMessage(fullMessage, columnNames);
    
    if (!actions || actions.length === 0) {
      // If deterministic parser can't handle it, return null to fallback to AI
      return null;
    }
    
    // Handle preview mode
    if (actions[0].type === 'preview') {
      return {
        ok: true,
        message: `Preview: ${(actions[0] as any).actions.length} action(s) planned`,
        actions: (actions[0] as any).actions,
        results: [],
        preview: true,
        plan: (actions[0] as any).actions,
        metrics: { deterministic: true, duration_ms: Date.now() - startTime },
        warnings: undefined,
        suggestions: undefined
      };
    }
    
    // Get column mapping
    const columnsByName = await getColumnsMap();
    
    // Create undo record
    const undoToken = crypto.randomBytes(6).toString('hex');
    const undo: UndoRecord = {
      token: undoToken,
      actions: [],
      createdAt: Date.now()
    };
    
    // Execute actions
    const results = [];
    const messages = [];
    
    for (const action of actions) {
      try {
        const result = await executeAction(action, undo, columnsByName, request);
        results.push({ type: action.type, result });
        
        // Generate concise confirmation message (no emojis, past-tense)
        switch (action.type) {
          case 'create_task':
            messages.push(`Created #${result.taskId} "${result.title}" in ${result.column}.`);
            break;
          case 'move_task':
            messages.push(`Moved #${result.taskId} to ${result.to}.`);
            break;
          case 'update_task':
            messages.push(`Updated #${result.taskId}.`);
            break;
          case 'assign_task':
            messages.push(`Assigned #${result.taskId} to ${result.assignee}.`);
            break;
          case 'tag_task':
            if (result.added?.length) {
              messages.push(`Tagged #${result.taskId}: ${result.added.join(', ')}.`);
            }
            if (result.removed?.length) {
              messages.push(`Untagged #${result.taskId}: ${result.removed.join(', ')}.`);
            }
            break;
          case 'comment_task':
            messages.push(`Commented on #${result.taskId}.`);
            break;
          case 'list_tasks':
            messages.push(`${result.count} task${result.count !== 1 ? 's' : ''}:`);
            if (result.tasks.length > 0) {
              const taskList = result.tasks.map((t: any) => `#${t.id} ${t.title}`).join('; ');
              messages.push(taskList);
            }
            break;
          case 'search_tasks':
            messages.push(`${result.count} match${result.count !== 1 ? 'es' : ''}:`);
            if (result.tasks.length > 0) {
              const taskList = result.tasks.map((t: any) => `#${t.id} ${t.title}`).join('; ');
              messages.push(taskList);
            }
            break;
          case 'undo':
            messages.push(`Reverted ${result.actionsReverted} action${result.actionsReverted !== 1 ? 's' : ''}.`);
            break;
        }
      } catch (error: any) {
        messages.push(error.message);
        results.push({ type: action.type, error: error.message });
      }
    }
    
    // If response is a board summary (one or more list_tasks), append concise counts
    try {
      const onlyLists = actions.every((a: any) => a.type === 'list_tasks')
      if (onlyLists) {
        const cols = await kb.getColumns(PROJECT_ID)
        const lang = (request as any)?.headers?.get ? ((request as any).headers.get('accept-language')||'').toLowerCase() : ''
        const isPT = lang.startsWith('pt')
        const all = await kb.listProjectTasks(PROJECT_ID)
        const lowerTitle = (t: any) => String(t.title||'').toLowerCase()
        const cnt = { ready:0, wip:0, done:0, overdue:0 }
        const byColId: Record<number,string> = {}
        for (const c of cols) byColId[c.id] = String(c.title||'')
        const now = Math.floor(Date.now()/1000)
        for (const t of all) {
          const name = lowerTitle({ title: byColId[t.column_id]||'' })
          if (/ready/.test(name)) cnt.ready++
          else if (/(in progress|work in progress|wip|doing|active|current)/.test(name)) cnt.wip++
          else if (/(done|complete|finished|closed|shipped|deployed|live)/.test(name)) cnt.done++
          if (t.date_due && t.date_due < now && t.is_active === 1) cnt.overdue++
        }
        const parts = [] as string[]
        parts.push((isPT?`Prontas ${cnt.ready}`:`Ready ${cnt.ready}`))
        parts.push((isPT?`Em Progresso ${cnt.wip}`:`In Progress ${cnt.wip}`))
        parts.push((isPT?`Concluídas ${cnt.done}`:`Done ${cnt.done}`))
        parts.push((isPT?`Atrasadas ${cnt.overdue}`:`Overdue ${cnt.overdue}`))
                messages.unshift(((isPT ? 'Resumo — ' : 'Summary — ') + parts.join(' • ')))
      }
    } catch {}

    // Store undo record if there were state-changing actions
    if (undo.actions.length > 0) {
      UNDO_LOG.set(undoToken, undo);
    }
    
    return {
      ok: true,
      message: messages.join('\n'),
      actions,
      results,
      undoToken: undo.actions.length > 0 ? undoToken : undefined,
      metrics: { deterministic: true, duration_ms: Date.now() - startTime },
      warnings: undefined,
      suggestions: undefined
    };
  } catch (error: any) {
    console.error('Chat processing error:', error);
    
    // Check for ambiguity errors - return 409 Conflict
    if (error.ambiguous && error.suggestions) {
      return {
        ok: false,
        statusCode: 409,
        message: error.message,
        error: 'Ambiguous Request',
        actions: [],
        results: [],
        metrics: { deterministic: true, duration_ms: Date.now() - startTime },
        warnings: undefined,
        suggestions: error.suggestions,
        disambiguation: true
      };
    }
    
    return {
      ok: false,
      message: error.message || 'Failed to process message.',
      actions: [],
      results: [],
      metrics: { deterministic: true, duration_ms: Date.now() - startTime },
      error: error.message || 'Failed to process message'
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, preview } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Message is required',
          message: 'Please provide a message' 
        },
        { status: 400 }
      );
    }
    
    const result = await processMessage(message, preview);
    
    if (result === null) {
      // Parser couldn't handle it - return indicator to fallback to AI
      return NextResponse.json({
        ok: false,
        fallback: true,
        message: 'Command not recognized. Try using AI mode.'
      });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Internal error',
        message: error?.message || 'Internal error.'
      },
      { status: 500 }
    );
  }
}
