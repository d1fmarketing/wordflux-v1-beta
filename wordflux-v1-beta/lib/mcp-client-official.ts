import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

interface McpCache {
  client: Client | null;
  transport: StdioClientTransport | null;
  handlersBound: boolean;
}

const globalCache: McpCache = (globalThis as any).__WF_MCP_CLIENT__ || ((globalThis as any).__WF_MCP_CLIENT__ = {
  client: null,
  transport: null,
  handlersBound: false
});

const USE_DOCKER_MCP = process.env.USE_DOCKER_MCP !== 'false'; // Default to true
const MCP_SERVER_PATH = path.resolve(process.cwd(), 'mcp/server.js');

function createEnv(): Record<string, string> {
  const baseEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      baseEnv[key] = value;
    }
  }

  if (!baseEnv.TASKCAFE_URL) baseEnv.TASKCAFE_URL = 'http://localhost:3333';
  if (!baseEnv.TASKCAFE_USERNAME) baseEnv.TASKCAFE_USERNAME = 'admin';
  if (!baseEnv.TASKCAFE_PASSWORD) baseEnv.TASKCAFE_PASSWORD = 'admin123';

  return baseEnv;
}

function bindTransportHandlers(transport: StdioClientTransport) {
  if (globalCache.handlersBound) return;

  const stderr = transport.stderr;
  if (stderr) {
    stderr.on('data', chunk => {
      console.error('[mcp-server]', chunk.toString());
    });
  }

  transport.onclose = () => {
    globalCache.client = null;
    globalCache.transport = null;
    globalCache.handlersBound = false;
  };

  transport.onerror = error => {
    console.error('[mcp-transport] error', error);
  };

  process.on('exit', () => {
    if (globalCache.transport) {
      void globalCache.transport.close();
    }
  });

  globalCache.handlersBound = true;
}

async function ensureTransport(): Promise<StdioClientTransport> {
  if (globalCache.transport) {
    return globalCache.transport;
  }

  let transport: StdioClientTransport;

  if (USE_DOCKER_MCP) {
    // Use Docker container for MCP server
    console.log('[MCP] Using Docker container: taskcafe-mcp');
    transport = new StdioClientTransport({
      command: 'docker',
      args: [
        'run', '-i', '--rm',
        '-e', `TASKCAFE_URL=${process.env.TASKCAFE_URL || 'http://52.4.68.118:3333'}`,
        '-e', `TASKCAFE_USERNAME=${process.env.TASKCAFE_USERNAME || 'admin'}`,
        '-e', `TASKCAFE_PASSWORD=${process.env.TASKCAFE_PASSWORD || 'admin123'}`,
        '-e', `TASKCAFE_PROJECT_ID=${process.env.TASKCAFE_PROJECT_ID || '0fb053f0-9b4c-4edd-8ca1-607882bc2360'}`,
        'taskcafe-mcp'
      ],
      env: createEnv(),
      stderr: 'pipe'
    });
  } else {
    // Use local Node.js server
    console.log('[MCP] Using local Node.js server');
    transport = new StdioClientTransport({
      command: process.execPath || 'node',
      args: [MCP_SERVER_PATH],
      env: createEnv(),
      stderr: 'pipe'
    });
  }

  bindTransportHandlers(transport);
  globalCache.transport = transport;

  return transport;
}

export async function getMCPClient(): Promise<Client> {
  if (globalCache.client) {
    return globalCache.client;
  }

  const transport = await ensureTransport();
  const client = new Client(
    {
      name: 'wordflux-chat',
      version: '1.0.0'
    }
  );

  await client.connect(transport);
  console.log('MCP Client connected to server');

  globalCache.client = client;
  return client;
}

export async function callMCPTool(name: string, args: Record<string, any> = {}) {
  const client = await getMCPClient();
  const result = await (client as any).callTool({
    name,
    arguments: args
  });

  const content = result?.content;
  if (Array.isArray(content) && content[0]?.type === 'text') {
    return content[0].text as string;
  }
  return 'No response';
}

export async function listMCPTools() {
  const client = await getMCPClient();
  const result = await (client as any).listTools({});

  return result?.tools || [];
}
