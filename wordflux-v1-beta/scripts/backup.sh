#!/bin/bash
# WordFlux Backup Script - Systematic & Safe
# Runs daily at 2 AM via cron

set -euo pipefail

# Configuration
BACKUP_DIR="/home/ubuntu/backups"
PROJECT_DIR="/home/ubuntu/wordflux-v1-beta"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="wordflux-backup-${TIMESTAMP}"
RETENTION_DAYS=7

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[$(date)] Starting WordFlux backup...${NC}"

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

# 1. Backup database (TaskCafe SQLite)
echo -e "${YELLOW}→ Backing up TaskCafe database...${NC}"
# TaskCafe uses SQLite internally
KB_CONTAINER=${KB_CONTAINER:-wordflux-TaskCafe}

if docker ps --format '{{.Names}}' | grep -q "^${KB_CONTAINER}$"; then
  # Copy SQLite database from container
  if docker cp ${KB_CONTAINER}:/var/www/app/data/db.sqlite "${BACKUP_DIR}/TaskCafe-${TIMESTAMP}.sqlite"; then
    # Compress the database
    gzip "${BACKUP_DIR}/TaskCafe-${TIMESTAMP}.sqlite"
    echo -e "${GREEN}✓ TaskCafe database backup complete (${KB_CONTAINER})${NC}"
  else
    echo -e "${RED}⚠ TaskCafe database backup failed${NC}"
    rm -f "${BACKUP_DIR}/TaskCafe-${TIMESTAMP}.sqlite" || true
  fi
else
  echo -e "${RED}⚠ TaskCafe container not running — skipping DB backup${NC}"
fi

# 2. Backup environment files
echo -e "${YELLOW}→ Backing up environment files...${NC}"
if [ -f "${PROJECT_DIR}/.env.local" ]; then
  cp "${PROJECT_DIR}/.env.local" "${BACKUP_DIR}/env-${TIMESTAMP}.env"
else
  echo -e "${RED}⚠ .env.local not found — skipping env backup${NC}"
fi

# 3. Backup application code (exclude caches)
echo -e "${YELLOW}→ Backing up application code...${NC}"
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
  -C /home/ubuntu \
  --exclude='wordflux-v1-beta/node_modules' \
  --exclude='wordflux-v1-beta/.next' \
  --exclude='wordflux-v1-beta/logs' \
  wordflux-v1-beta

# 4. Backup Nginx config
echo -e "${YELLOW}→ Backing up Nginx configuration...${NC}"
if [ -f /etc/nginx/sites-available/wordflux ]; then
  cp /etc/nginx/sites-available/wordflux "${BACKUP_DIR}/nginx-${TIMESTAMP}.conf"
else
  echo -e "${RED}⚠ /etc/nginx/sites-available/wordflux not found — skipping Nginx config backup${NC}"
fi

# 5. Create manifest file
echo -e "${YELLOW}→ Creating backup manifest...${NC}"
APP_VERSION=$(cd "${PROJECT_DIR}" && git describe --tags --always 2>/dev/null || echo "unknown")
cat > "${BACKUP_DIR}/manifest-${TIMESTAMP}.txt" << EOF
Backup Date: $(date)
Application Version: ${APP_VERSION}
Files Included:
- TaskCafe Database: TaskCafe-${TIMESTAMP}.sqlite.gz (if created)
- Environment: env-${TIMESTAMP}.env (if created)
- Application: ${BACKUP_NAME}.tar.gz
- Nginx Config: nginx-${TIMESTAMP}.conf (if created)
EOF

# 6. Clean old backups (keep last 7 days)
echo -e "${YELLOW}→ Cleaning old backups (keeping ${RETENTION_DAYS} days)...${NC}"
find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete || true

# 7. Verify backup integrity
echo -e "${YELLOW}→ Verifying backup integrity...${NC}"
if tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Backup integrity verified${NC}"
else
  echo -e "${RED}✗ Backup integrity check failed!${NC}"
  exit 1
fi

# 8. Report backup size
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo -e "${GREEN}[$(date)] Backup completed successfully!${NC}"
echo -e "Backup size: ${BACKUP_SIZE}"
echo -e "Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Optional: S3 upload (uncomment and configure)
# aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" s3://your-bucket/backups/
