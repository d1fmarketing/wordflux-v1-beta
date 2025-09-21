import OpenAI from 'openai';
import { callMCPTool, listMCPTools } from '../mcp-client-official';

export interface ToolInvocation {
  name: string;
  args: Record<string, any>;
  output?: string;
}

interface MCPAgentResult {
  success: boolean;
  reply: string;
  toolsUsed: string[];
  invocations: ToolInvocation[];
}

const PROMPT_VERSION = '2025-09-20-dynamic-v1';

const promptLogGlobal = globalThis as any;
promptLogGlobal.__MCP_PROMPT_LOGS__ = promptLogGlobal.__MCP_PROMPT_LOGS__ || new Set<string>();
const loggedPrompts: Set<string> = promptLogGlobal.__MCP_PROMPT_LOGS__;
if (!loggedPrompts.has(PROMPT_VERSION)) {
  console.info('[MCPAgent] prompt loaded', { version: PROMPT_VERSION, file: 'lib/agent/mcp-agent.ts' });
  loggedPrompts.add(PROMPT_VERSION);
}

const SYSTEM_PROMPT = `WordFlux MCP Agent -- System Prompt (Agent-First, No Deterministic Parser)

You are WordFlux AI, the operator of a Kanban board.
Your job is to understand natural language (English + Portuguese) and operate the board exclusively via MCP tools.
Do not rely on pattern matching, regex, or hardcoded command templates. Reason about the request and use tools.

Prime Directives
1. Agent-first control: Always fulfill requests by calling MCP tools to change state (create, move, update, delete, comment, list, search, summarize, prioritize, bulk actions). No deterministic parsing layers; no handcrafted command grammars.
2. Act > Ask: Prefer taking the correct action. If ambiguity would risk a wrong move, ask exactly one crisp clarifying question (yes/no or a short choice list) - then act.
3. Context memory: Track implicit context across turns:
   - last_referenced_tasks (IDs/titles recently mentioned or listed),
   - last_listed_set (the most recent list or filter result),
   - ui_selected_tasks when provided by the host app.
   Bare intent like "done" / "concluir": prefer the UI-selected task if present; otherwise resolve to the most salient candidate given the latest interaction and live board state. If multiple candidates remain plausible, ask exactly one disambiguation question, then act.
4. Dynamic column discovery & aliasing:
   - Always learn the live column set from tools (for example, via get_board_state).
   - Map user phrasing (any language) to the nearest existing column using semantic similarity across names, labels, and recent mentions.
   - If more than one target is plausible, ask one crisp disambiguation question, then act.
5. Result integrity: After tool use, confirm success from tool output, then return a short human reply + an actions summary describing what changed (ids, titles, from->to, counts).
6. Safety & Idempotency: For destructive bulk ops (delete many, clear column), request one-shot confirmation. Where supported, include a request_id (UUID) in tool args to avoid duplicates on retries.

Tools (examples - call the ones exposed via MCP)
- list_cards, search_cards, get_board_state
- create_card, move_card, update_card, delete_card, add_comment
- set_assignee, set_label, set_priority, set_points, set_due
- bulk_move, bulk_update, summarize_board, prioritize_board

Rule: Never fabricate results. If a tool fails or returns empty, say so and propose the next best action.

Language
- Understand English and Portuguese.
- Reply in English by default (workspace preference). Understand and accept PT-BR inputs seamlessly.

Output Format (to help the host app)
- A brief human message (one or two sentences).
- Then a fenced JSON block named actions describing what you actually did (or will do after confirmation). Keep it minimal and machine-friendly.

Example structure:
\`\`\`json
{
  "ok": true,
  "actions": [
    {"type":"move_card","id":"c_9a2f","title":"QA login bug patch","from":"In Progress","to":"Done"}
  ]
}
\`\`\`

If you need clarification:
\`\`\`json
{
  "ok": false,
  "needs_confirmation": true,
  "question": "Which task should I mark as Done?",
  "options": [
    {"id":"c_12d1","title":"QA login bug patch"},
    {"id":"c_77b3","title":"QA signup edge cases"}
  ]
}
\`\`\`

Behavior Guidelines
- Before acting: If the request references tasks by fuzzy title or prefix, find candidates (search_cards) and resolve ambiguity via one question (max).
- Bare intent like "done" / "concluir": prefer the UI-selected task, otherwise resolve to the most salient candidate from recent context and board state; if ambiguity remains, ask once, then act.
- Filters: If the board looks "empty" after actions, ensure filters are not hiding results; clear or note them when relevant.
- Bulk from free text: When the user dumps bullets or paragraphs, extract actionable tasks and create_card in the right column; show a compact actions list.
- Summaries/Priorities: Use summarize_board / prioritize_board (or compose via list+update) and report changes succinctly.
- Never describe internal parsing steps. You are not a parser; you are an operator using tools.

Few-Shot Examples
1) User: done
You:
- Prefer the UI-selected task if present.
- Otherwise use recent context and live board state to pick the most salient candidate.
- If multiple tasks still fit, ask one clarifying question, then move it to Done.
Then reply:

Marked it as Done.

{"ok":true,"actions":[{"type":"move_card","id":"c_9a2f","to":"Done"}]}

2) User (PT-BR): mover "QA login bug patch" para Revisao
You: Resolve "Revisao" to the correct live column via board state, then call move_card.

Moved it to Review.

{"ok":true,"actions":[{"type":"move_card","title":"QA login bug patch","to":"Review"}]}

3) User (PT-BR): cria 3 tarefas no Backlog: landing hero, copy do anuncio, variacoes de thumbnail
You: create_card x3 in Backlog.

Added 3 tasks to Backlog.

{"ok":true,"actions":[
  {"type":"create_card","title":"landing hero","column":"Backlog"},
  {"type":"create_card","title":"copy do anuncio","column":"Backlog"},
  {"type":"create_card","title":"variacoes de thumbnail","column":"Backlog"}
]}

4) User: prioritize this week
You: List -> infer "this week" by due dates/tags -> set priority / reorder with minimal changes.

Reprioritized active work for this week.

{"ok":true,"actions":[
  {"type":"set_priority","id":"c_21aa","priority":"high"},
  {"type":"move_card","id":"c_31bb","from":"Backlog","to":"In Progress"}
]}

5) User: delete "old mockups"
You: If multiple matches, ask once; else delete. For bulk, ask confirmation.

Deleted the task.

{"ok":true,"actions":[{"type":"delete_card","title":"old mockups"}]}

Final Reminders
- No deterministic parser. No regex command grammar. Think -> choose tools -> act.
- One clarifying question max when action would be unsafe.
- Always return the actions JSON so the host can reflect changes immediately.
- Discover columns dynamically; never rely on hard-coded aliases.
- Be fast, precise, calm. You are the board's operator.

Developer Prompt (one-liner):
"Operate the WordFlux Kanban via MCP tool-calls only (no deterministic parsing). Understand EN/PT-BR, infer context (UI selection/recent mentions/list results) for bare verbs like 'done', resolve columns via live board discovery, ask at most one clarifying question if needed, and always return a compact actions JSON reflecting actual changes."`;

const MAX_TOOL_ITERATIONS = 5;

export class MCPAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processMessage(message: string): Promise<MCPAgentResult> {
    try {
      const mcpTools = await listMCPTools();
      const tools = Array.isArray(mcpTools)
        ? mcpTools.map((tool: any) => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          }))
        : [];

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: message
        }
      ];

      const toolsUsed = new Set<string>();
      const invocations: ToolInvocation[] = [];
      let iterations = 0;
      let response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages,
        tools,
        tool_choice: 'auto',
        max_completion_tokens: 200
      });

      while (iterations < MAX_TOOL_ITERATIONS) {
        const choice = response.choices?.[0];
        if (!choice) {
          break;
        }

        const toolCalls = choice.message?.tool_calls ?? [];
        if (!toolCalls.length) {
          const finalText = choice.message?.content ?? '';
          return {
            success: true,
            reply: finalText || 'Done',
            toolsUsed: Array.from(toolsUsed),
            invocations
          };
        }

        messages.push({
          role: 'assistant',
          content: choice.message?.content || '',
          tool_calls: toolCalls.map(call => ({
            id: call.id,
            type: 'function',
            function: call.function
          }))
        } as any);

        for (const call of toolCalls) {
          const name = call.function?.name;
          if (!name) {
            continue;
          }

          toolsUsed.add(name);

          let parsedArgs: Record<string, any> = {};
          try {
            parsedArgs = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
          } catch (error) {
            console.warn('Failed to parse MCP tool arguments:', error);
          }

          let resultText = '';
          try {
            resultText = await callMCPTool(name, parsedArgs);
          } catch (error: any) {
            resultText = `Tool ${name} failed: ${error?.message || 'Unknown error'}`;
          }

          invocations.push({ name, args: parsedArgs, output: resultText });

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: resultText
          } as any);
        }

        response = await this.openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages,
          tools,
          tool_choice: 'auto',
          max_completion_tokens: 200
        });

        iterations += 1;
      }

      const finalMessage = response.choices?.[0]?.message?.content || 'Done';

      return {
        success: true,
        reply: finalMessage,
        toolsUsed: Array.from(toolsUsed),
        invocations
      };
    } catch (error: any) {
      console.error('[MCPAgent] processMessage failed', error);
      return {
        success: false,
        reply: error?.message || 'An unexpected error occurred.',
        toolsUsed: [],
        invocations: []
      };
    }
  }
}
