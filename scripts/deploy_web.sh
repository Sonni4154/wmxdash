#!/usr/bin/env bash
set -euo pipefail

# go to repo root
cd "$(git rev-parse --show-toplevel)"

echo "[build] cleaning..."
rm -rf apps/web/.next apps/web/out

echo "[build] next build (output: export)..."
pnpm -C apps/web build

echo "[verify] checking build output..."
test -f apps/web/out/index.html || { echo "ERROR: apps/web/out missing"; exit 1; }

echo "[deploy] syncing to /var/www/wmx ..."
rsync -av --delete apps/web/out/ /var/www/wmx/

echo "[nginx] reload..."
sudo nginx -t && sudo systemctl reload nginx

echo "[done] Deployed to https://www.wemakemarin.com/"

