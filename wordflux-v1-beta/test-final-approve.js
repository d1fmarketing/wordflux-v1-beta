// Test final MCP approve functionality
const { spawn } = require('child_process');

async function testFinalApprove() {
  console.log('Testing Docker MCP approve for "Final MCP Test Card"...');

  const docker = spawn('docker', [
    'run', '-i', '--rm',
    '-e', 'TASKCAFE_URL=http://52.4.68.118:3333',
    '-e', 'TASKCAFE_USERNAME=admin',
    '-e', 'TASKCAFE_PASSWORD=admin123',
    '-e', 'TASKCAFE_PROJECT_ID=0fb053f0-9b4c-4edd-8ca1-607882bc2360',
    'taskcafe-mcp'
  ]);

  let output = '';

  docker.stdout.on('data', (data) => {
    output += data.toString();
  });

  docker.stderr.on('data', (data) => {
    console.log('[MCP Server]', data.toString().trim());
  });

  docker.on('close', (code) => {
    console.log('Process exited with code:', code);

    // Parse output
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const json = JSON.parse(line);
        console.log('\nResult:', JSON.stringify(json, null, 2));
      } catch (e) {
        // Not JSON
      }
    });
  });

  // Approve the card
  const request = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "approve_card",
      arguments: {
        search: "Final MCP Test Card"
      }
    },
    id: 1
  }) + '\n';

  console.log('Sending approve request...');
  docker.stdin.write(request);
  docker.stdin.end();
}

testFinalApprove().catch(console.error);