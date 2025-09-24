# from repo root
git checkout -b feat/qbo-integration-hardening

# make sure we’re not committing secrets
git status
# (double-check that infra/docker/.env is NOT staged; if it is, run:)
git restore --staged infra/docker/.env
echo -e "\n# Never commit envs\ninfra/docker/.env" >> .gitignore

# add everything we changed
git add \
  infra/docker/docker-compose.yml \
  infra/docker/Dockerfile \
  apps/server/tsconfig.json \
  apps/server/src/index.ts \
  apps/server/src/qbo.ts \
  apps/server/src/qboRoutes.ts \
  apps/server/src/qboClient.ts \
  apps/server/tests/api.spec.ts \
  sql/*.sql

# optional: if we created a migrations service or scripts folder, add those too
git add apps/server/scripts/migrate.ts

git commit -m "QBO integration hardening: Dockerized build, migrations bootstrap, ESM-safe node-quickbooks, normalized fetchers, admin refresh, healthchecks, and sync endpoints"

# push branch
git push -u origin feat/qbo-integration-hardening

