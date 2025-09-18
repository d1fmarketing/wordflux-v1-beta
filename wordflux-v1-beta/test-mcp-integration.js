// Test MCP Docker integration directly
const { spawn } = require('child_process');

async function testMCPDocker() {
  console.log('Testing MCP Docker integration...');

  const docker = spawn('docker', [
    'run', '-i', '--rm',
    '-e', 'TASKCAFE_URL=http://52.4.68.118:3333',
    '-e', 'TASKCAFE_USERNAME=admin',
    '-e', 'TASKCAFE_PASSWORD=admin123',
    '-e', 'TASKCAFE_PROJECT_ID=0fb053f0-9b4c-4edd-8ca1-607882bc2360',
    'taskcafe-mcp'
  ]);

  let output = '';
  let errorOutput = '';

  docker.stdout.on('data', (data) => {
    output += data.toString();
  });

  docker.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log('STDERR:', data.toString());
  });

  docker.on('error', (error) => {
    console.error('Docker error:', error);
  });

  docker.on('close', (code) => {
    console.log('Docker process closed with code:', code);

    // Parse output
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const json = JSON.parse(line);
        console.log('Response:', JSON.stringify(json, null, 2));
      } catch (e) {
        // Not JSON
      }
    });
  });

  // Test list_cards in Review
  const request = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "list_cards",
      arguments: {
        column: "Review"
      }
    },
    id: 1
  }) + '\n';

  console.log('Sending request to list cards in Review...');
  docker.stdin.write(request);
  docker.stdin.end();
}

testMCPDocker().catch(console.error);