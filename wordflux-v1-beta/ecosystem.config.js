module.exports = {
  apps: [
    {
      name: 'wordflux-v1-beta',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/wordflux-v1-beta',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
        BOARD_BACKEND: 'taskcafe',
        TASKCAFE_URL: 'http://127.0.0.1:3333',
        TASKCAFE_USERNAME: 'admin',
        TASKCAFE_PASSWORD: 'admin123',
        TASKCAFE_AUTH_COOKIE: 'authToken=1492c944-4c4b-4c91-8f39-15b14431249a'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true
    },
    {
      name: 'wordflux-mcp-gateway',
      script: '/home/ubuntu/wordflux-v1-beta/scripts/run-mcp-gateway-sse.sh',
      interpreter: '/bin/bash',
      cwd: '/home/ubuntu/wordflux-v1-beta',
      env: {
        MCP_GATEWAY_PORT: 8811
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: 'logs/mcp-gateway-error.log',
      out_file: 'logs/mcp-gateway-out.log',
      time: true
    }
  ]
}
