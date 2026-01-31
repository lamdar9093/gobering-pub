#!/bin/bash
# Script to export database from Replit for migration to VPS
# Run this on Replit before migrating

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="gobering_backup_${TIMESTAMP}.sql"

echo "=== Gobering Database Export ==="
echo "Timestamp: $TIMESTAMP"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "1. Creating backup directory..."
mkdir -p backups

echo "2. Exporting database..."
pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --format=plain \
    > "backups/$BACKUP_FILE"

echo "3. Compressing backup..."
gzip "backups/$BACKUP_FILE"

FINAL_FILE="backups/${BACKUP_FILE}.gz"
SIZE=$(du -h "$FINAL_FILE" | cut -f1)

echo ""
echo "=== Export Complete ==="
echo "File: $FINAL_FILE"
echo "Size: $SIZE"
echo ""
echo "Next steps:"
echo "1. Download this file: $FINAL_FILE"
echo "2. Transfer to your VPS"
echo "3. Run: ./scripts/import-database.sh <backup_file>"
