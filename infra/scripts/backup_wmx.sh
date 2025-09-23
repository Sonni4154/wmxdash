#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/opt/backups/wmx_${TS}"
mkdir -p "${BACKUP_DIR}"

echo "[*] Writing docker compose config snapshot"
cd /opt/wmx/infra/docker
docker compose config > "${BACKUP_DIR}/compose.resolved.yml"

echo "[*] Copying repo tree (without node_modules caches to keep size sane)"
# If you truly want *everything*, remove the --exclude lines.
tar --exclude='**/node_modules' \
    --exclude='**/.next' \
    -czf "${BACKUP_DIR}/workspace.tgz" \
    -C /opt wmx

echo "[*] Copying important env/config files"
cp -av /opt/wmx/infra/docker/.env "${BACKUP_DIR}/env.docker.env" || true
cp -av /opt/wmx/infra/nginx "${BACKUP_DIR}/nginx" || true

echo "[*] Dumping Postgres logical backup (pg_dump)"
docker compose exec -T db pg_dump -U postgres -d app > "${BACKUP_DIR}/app_${TS}.sql"

echo "[*] Archiving raw Postgres volume (filesystem copy)"
# Find your volume name (often docker_db-data); adjust if different.
VOL_NAME="$(docker volume ls --format '{{.Name}}' | grep -m1 docker_db)"
docker run --rm \
  -v "${VOL_NAME}:/var/lib/postgresql/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  busybox sh -c "tar czf /backup/pgdata_${TS}.tgz /var/lib/postgresql/data"

echo "[*] Writing Docker inventory"
docker image ls > "${BACKUP_DIR}/docker_images.txt"
docker ps -a > "${BACKUP_DIR}/docker_ps_a.txt"

echo "[*] Final tarball"
tar -czf "/opt/backups/wmx_bundle_${TS}.tgz" -C "${BACKUP_DIR}" .
echo "[✓] Backup complete: /opt/backups/wmx_bundle_${TS}.tgz"

