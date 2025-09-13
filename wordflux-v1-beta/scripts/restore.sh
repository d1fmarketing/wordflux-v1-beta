#!/bin/bash
# WordFlux Restore Script - Systematic Recovery

set -euo pipefail

BACKUP_DIR="/home/ubuntu/backups"
PROJECT_DIR="/home/ubuntu/wordflux-v1-beta"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "${1-}" ]; then
  echo -e "${RED}Usage: ./restore.sh <backup-timestamp>${NC}"
  echo "Available backups:"
  ls -1 ${BACKUP_DIR}/wordflux-backup-*.tar.gz 2>/dev/null || true
  exit 1
fi

TIMESTAMP="$1"
BACKUP_FILE="${BACKUP_DIR}/wordflux-backup-${TIMESTAMP}.tar.gz"

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Backup file not found: ${BACKUP_FILE}${NC}"
  exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: Restoring from backup ${TIMESTAMP}${NC}"
echo "This will stop the app, restore DB, files, env and Nginx config."
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

echo -e "${YELLOW}→ Stopping services...${NC}"
pm2 stop wf-v1-beta || true

echo -e "${YELLOW}→ Safety backup of current state...${NC}"
tar -czf "${BACKUP_DIR}/pre-restore-$(date +%Y%m%d_%H%M%S).tar.gz" \
  -C /home/ubuntu \
  --exclude='wordflux-v1-beta/node_modules' \
  --exclude='wordflux-v1-beta/.next' \
  wordflux-v1-beta

if [ -f "${BACKUP_DIR}/db-${TIMESTAMP}.sql.gz" ]; then
  echo -e "${YELLOW}→ Restoring database...${NC}"
  if docker ps --format '{{.Names}}' | grep -q '^wordflux-postgres$'; then
    gunzip -c "${BACKUP_DIR}/db-${TIMESTAMP}.sql.gz" | docker exec -i wordflux-postgres psql -U kanboard kanboard
  else
    echo -e "${RED}⚠ Postgres container not found — skipping DB restore${NC}"
  fi
fi

echo -e "${YELLOW}→ Restoring application files...${NC}"
tar -xzf "$BACKUP_FILE" -C /home/ubuntu

if [ -f "${BACKUP_DIR}/env-${TIMESTAMP}.env" ]; then
  echo -e "${YELLOW}→ Restoring environment...${NC}"
  cp "${BACKUP_DIR}/env-${TIMESTAMP}.env" "${PROJECT_DIR}/.env.local"
fi

if [ -f "${BACKUP_DIR}/nginx-${TIMESTAMP}.conf" ]; then
  echo -e "${YELLOW}→ Restoring Nginx config...${NC}"
  sudo cp "${BACKUP_DIR}/nginx-${TIMESTAMP}.conf" /etc/nginx/sites-available/wordflux
  sudo nginx -t && sudo systemctl reload nginx
fi

echo -e "${YELLOW}→ Rebuilding application...${NC}"
cd ${PROJECT_DIR}
npm install --silent
npm run build --silent

echo -e "${YELLOW}→ Restarting services...${NC}"
pm2 start wf-v1-beta || true

echo -e "${GREEN}✓ Restore completed successfully!${NC}"

