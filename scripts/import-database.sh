#!/bin/bash
# Script to import database backup into VPS PostgreSQL container
# Run this on your VPS after transferring the backup file

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/import-database.sh <backup_file.sql.gz>"
    echo "Example: ./scripts/import-database.sh backups/gobering_backup_20241228.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=== Gobering Database Import ==="
echo "Backup file: $BACKUP_FILE"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-gobering}"
POSTGRES_DB="${POSTGRES_DB:-gobering}"

echo "1. Ensuring PostgreSQL container is running..."
docker compose up -d postgres
sleep 5

echo "2. Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
    echo "   Waiting..."
    sleep 2
done

echo "3. Decompressing backup..."
TEMP_FILE="/tmp/gobering_restore.sql"
gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

echo "4. Importing database..."
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$TEMP_FILE"

echo "5. Cleaning up..."
rm -f "$TEMP_FILE"

echo ""
echo "=== Import Complete ==="
echo "Database has been restored successfully."
echo ""
echo "Next steps:"
echo "1. Start the application: docker compose up -d"
echo "2. Check logs: docker compose logs -f app"
