import { spawn, ChildProcess } from 'child_process';

interface MCPRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: number;
}

interface MCPResponse {
  result?: any;
  error?: any;
  jsonrpc: string;
  id: number;
}

export class MCPDockerClient {
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();

  async callTool(toolName: string, args: any = {}): Promise<any> {
    const docker = spawn('docker', [
      'run', '-i', '--rm',
      '-e', `TASKCAFE_URL=${process.env.TASKCAFE_URL || 'http://52.4.68.118:3333'}`,
      '-e', `TASKCAFE_USERNAME=${process.env.TASKCAFE_USERNAME || 'admin'}`,
      '-e', `TASKCAFE_PASSWORD=${process.env.TASKCAFE_PASSWORD || 'admin123'}`,
      '-e', `TASKCAFE_PROJECT_ID=${process.env.TASKCAFE_PROJECT_ID || '0fb053f0-9b4c-4edd-8ca1-607882bc2360'}`,
      'taskcafe-mcp'
    ]);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      docker.stdout.on('data', (data) => {
        output += data.toString();
      });

      docker.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      docker.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP server exited with code ${code}: ${errorOutput}`));
          return;
        }

        try {
          // Parse the JSON response
          const lines = output.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const response = JSON.parse(line) as MCPResponse;
              if (response.error) {
                reject(new Error(response.error.message || 'MCP error'));
              } else if (response.result) {
                // Extract the text content from the response
                if (response.result.content && Array.isArray(response.result.content)) {
                  const textContent = response.result.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('\n');
                  resolve({
                    success: !response.result.isError,
                    message: textContent,
                    raw: response.result
                  });
                } else {
                  resolve(response.result);
                }
              }
            } catch (e) {
              // Not JSON, continue
            }
          }

          // If we didn't find a valid response
          reject(new Error('No valid response from MCP server'));
        } catch (error) {
          reject(error);
        }
      });

      docker.on('error', (error) => {
        reject(error);
      });

      // Send the request
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: ++this.requestId
      };

      docker.stdin.write(JSON.stringify(request) + '\n');
      docker.stdin.end();
    });
  }

  async listTools(): Promise<any[]> {
    const docker = spawn('docker', [
      'run', '-i', '--rm',
      '-e', `TASKCAFE_URL=${process.env.TASKCAFE_URL || 'http://52.4.68.118:3333'}`,
      '-e', `TASKCAFE_USERNAME=${process.env.TASKCAFE_USERNAME || 'admin'}`,
      '-e', `TASKCAFE_PASSWORD=${process.env.TASKCAFE_PASSWORD || 'admin123'}`,
      '-e', `TASKCAFE_PROJECT_ID=${process.env.TASKCAFE_PROJECT_ID || '0fb053f0-9b4c-4edd-8ca1-607882bc2360'}`,
      'taskcafe-mcp'
    ]);

    return new Promise((resolve, reject) => {
      let output = '';

      docker.stdout.on('data', (data) => {
        output += data.toString();
      });

      docker.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP server exited with code ${code}`));
          return;
        }

        try {
          const lines = output.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const response = JSON.parse(line) as MCPResponse;
              if (response.result && response.result.tools) {
                resolve(response.result.tools);
                return;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
          resolve([]);
        } catch (error) {
          reject(error);
        }
      });

      // Send the request
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: ++this.requestId
      };

      docker.stdin.write(JSON.stringify(request) + '\n');
      docker.stdin.end();
    });
  }
}

// Export singleton instance
export const mcpDockerClient = new MCPDockerClient();