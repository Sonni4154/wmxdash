#!/bin/bash
set -e

# Define paths/patterns to strip from git history
BLOAT_PATHS=(
  "node_modules/"
  ".pnpm/"
  "build/"
  "dist/"
  ".next/"
  "coverage/"
  ".cache/"
  ".ignored/"
  "*.map"
  "*.d.ts"
)

# Build filter-repo args
ARGS=""
for p in "${BLOAT_PATHS[@]}"; do
  ARGS+=" --path $p"
done
ARGS+=" --invert-paths"

# Functions
dry_run() {
  echo "Running dry run..."
  git filter-repo $ARGS --dry-run --force | tee dryrun-output.txt
  echo "Dry run output saved to dryrun-output.txt"
}

full_cleanup() {
  echo "Running full cleanup..."
  git filter-repo $ARGS --force | tee cleanup-output.txt
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  echo "Full cleanup done. Output saved to cleanup-output.txt"
  echo "⚠️ Remember: you must force push to overwrite GitHub history:"
  echo "   git push origin --force"
}

both() {
  dry_run
  full_cleanup
}

compare_filtered_files() {
  ORIG=".git/filter-repo/fast-export.original"
  FILT=".git/filter-repo/fast-export.filtered"

  if [ -f "$ORIG" ] && [ -f "$FILT" ]; then
    echo "Comparing $ORIG and $FILT..."
    diff -u "$ORIG" "$FILT" | tee removed-files-diff.txt
    whiptail --msgbox "Differences saved to removed-files-diff.txt" 10 60
  else
    whiptail --msgbox "No filter-repo export files found. Run a dry run first." 10 60
  fi
}

# Menu
OPTION=$(whiptail --title "Git Repo Tools" --menu "Choose an action" 20 78 10 \
"1" "Dry Run Cleanup (preview only)" \
"2" "Full Cleanup (rewrite history)" \
"3" "Dry Run + Full Cleanup" \
"4" "Show files to be removed (diff filtered vs original)" 3>&1 1>&2 2>&3)

case $OPTION in
  1) dry_run ;;
  2) full_cleanup ;;
  3) both ;;
  4) compare_filtered_files ;;
  *) echo "No option chosen, exiting." ;;
esac

