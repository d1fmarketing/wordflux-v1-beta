#!/bin/bash
set -euo pipefail

LOG_DIR="/home/ubuntu/logs"
mkdir -p "$LOG_DIR"

# Build a temp file for crontab to avoid duplicates
TMP_CRON=$(mktemp)
crontab -l 2>/dev/null > "$TMP_CRON" || true

ensure_line() {
  local line="$1"
  grep -Fq "$line" "$TMP_CRON" || echo "$line" >> "$TMP_CRON"
}

ensure_line "# WordFlux Automated Tasks"
ensure_line "0 2 * * * /home/ubuntu/wordflux-v1-beta/scripts/backup.sh >> /home/ubuntu/logs/backup.log 2>&1"
ensure_line "*/5 * * * * node /home/ubuntu/wordflux-v1-beta/scripts/health-monitor.js >> /home/ubuntu/logs/health-monitor.log 2>&1"
ensure_line "0 0 * * 0 certbot renew --quiet --post-hook 'systemctl reload nginx'"

crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "✅ Cron jobs configured:"
crontab -l

