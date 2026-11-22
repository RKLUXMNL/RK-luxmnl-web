#!/bin/sh
set -eu

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="rkluxmnl-${STAMP}.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --file="/tmp/${FILE}"
aws s3 cp "/tmp/${FILE}" "s3://${BACKUP_BUCKET}/${FILE}" --endpoint-url "$S3_ENDPOINT"
rm -f "/tmp/${FILE}"
echo "Backup uploaded: ${FILE}"
