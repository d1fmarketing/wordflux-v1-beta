module.exports = {
  apps: [{
    name: 'wordflux-v1-beta',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/wordflux-v1-beta',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
}