# 0) Go to the repo root
cd /opt/wmx
pwd   # should print /opt/wmx

# 1) Make sure this is a Git repo; if not, initialize and point at GitHub
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
  git checkout -b main
  git remote add origin git@github.com:Sonni4154/wmxdash.git  # or use https if you prefer
fi

# 2) Verify remote is correct (should show Sonni4154/wmxdash)
git remote -v

# 3) Fetch the latest and ensure you're tracking main
git fetch origin
# If the remote has a main branch, track it (won't blow away your local work)
git checkout -B main origin/main || git checkout -B main

# 4) Create a feature branch for these changes
git checkout -b feat/qbo-integration-hardening

# 5) Ensure we NEVER commit secrets
#    Add .env to .gitignore if not present
grep -qxF 'infra/docker/.env' .gitignore || echo 'infra/docker/.env' >> .gitignore
grep -qxF '.env' .gitignore || echo '.env' >> .gitignore

# 6) Bring the PR doc into the repo (adjust the path if you downloaded elsewhere)
#    Example assumes you downloaded to ~/Downloads
mkdir -p docs
if [ -f ~/Downloads/pr-qbo-hardening.md ]; then
  mv -f ~/Downloads/pr-qbo-hardening.md docs/pr-qbo-hardening.md
fi

# 7) Stage all changes
git add -A

# 8) Double-check we didn't stage secrets; if we did, unstage them
git restore --staged infra/docker/.env 2>/dev/null || true

# 9) Commit
git commit -m "QBO integration hardening: dockerized build, migrations bootstrap, ESM-safe node-quickbooks, normalized fetchers, admin refresh, sync endpoints, tests, and docs"

# 10) Push the branch up
git push -u origin feat/qbo-integration-hardening

