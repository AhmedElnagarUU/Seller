#!/usr/bin/env bash
# Nightly MongoDB backup to the R2 backup bucket (docs/11-deployment.md section 6).
set -euo pipefail

if [ "$#" -ne 1 ] || [ "$1" != "production" ]; then
  echo "Usage: ./deploy/backup.sh production"
  exit 2
fi

app_env_file="/srv/themestore/production.env"
backup_env_file="/srv/themestore/backup.env"
today="$(date +%F)"
temp_file="$(mktemp)"
trap 'rm -f "${temp_file}"' EXIT

MONGODB_URI="$(grep -E '^MONGODB_URI=' "${app_env_file}" | head -n 1 | cut -d= -f2-)"
MONGODB_URI="${MONGODB_URI%\"}"
MONGODB_URI="${MONGODB_URI#\"}"
set -a
# shellcheck disable=SC1090
source "${backup_env_file}"
set +a

docker run --rm mongo:8.0.4 mongodump --uri="${MONGODB_URI}" --archive --gzip > "${temp_file}"

docker run --rm \
  -e AWS_ACCESS_KEY_ID="${R2_BACKUP_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${R2_BACKUP_SECRET_ACCESS_KEY}" \
  -e AWS_DEFAULT_REGION=auto \
  -v "${temp_file}:/backup.archive.gz:ro" \
  amazon/aws-cli:2.27.49 \
  s3 cp /backup.archive.gz "s3://${R2_BACKUP_BUCKET}/mongo/${today}.archive.gz" --endpoint-url "${R2_BACKUP_ENDPOINT}"

echo "Backup done ${today}"
