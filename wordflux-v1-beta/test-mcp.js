const { spawn } = require('child_process');

// Test the MCP server by sending a tools/list request
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
});

docker.on('close', (code) => {
  console.log('Output:', output);
  console.log('Error output:', errorOutput);
  console.log('Exit code:', code);
});

// Send MCP request to list tools
const request = JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/list",
  id: 1
}) + '\n';

docker.stdin.write(request);
docker.stdin.end();