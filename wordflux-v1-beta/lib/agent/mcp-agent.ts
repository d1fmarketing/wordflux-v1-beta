import OpenAI from 'openai';
import { callMCPTool, listMCPTools } from '../mcp-client-official';

interface MCPAgentResult {
  success: boolean;
  reply: string;
  toolsUsed: string[];
}

export class MCPAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processMessage(message: string): Promise<MCPAgentResult> {
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

    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a board assistant. Use the available tools to help the user manage their tasks. Be concise.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 200
    });

    const choice = response.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    const results: string[] = [];

    for (const call of toolCalls) {
      const name = call.function?.name;
      if (!name) continue;

      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch (error) {
        console.warn('Failed to parse MCP tool arguments:', error);
      }

      try {
        const result = await callMCPTool(name, parsedArgs);
        results.push(result);
      } catch (error: any) {
        results.push(`❌ Tool ${name} failed: ${error?.message || 'Unknown error'}`);
      }
    }

    const reply = results.length > 0
      ? results.join('\n')
      : choice?.message?.content || 'Done';

    return {
      success: true,
      reply,
      toolsUsed: toolCalls.map(call => call.function?.name).filter((name): name is string => Boolean(name))
    };
  }
}
