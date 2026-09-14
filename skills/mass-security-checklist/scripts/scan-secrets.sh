#!/usr/bin/env bash
# Scans the working tree (and optionally recent git history) for secret-looking strings.
# Usage: scripts/scan-secrets.sh [path=.] [--history N]   (N = number of recent commits to scan)
set -euo pipefail

target="."
history=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --history) history="${2:-20}"; shift 2 ;;
    *) target="$1"; shift ;;
  esac
done

patterns=(
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{22,}'
  'sk-[A-Za-z0-9_-]{32,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  '(password|passwd|secret|api[_-]?key|token)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{8,}["'"'"']'
)
regex="$(IFS='|'; echo "${patterns[*]}")"
excludes=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.next --exclude-dir=coverage --exclude='*.lock' --exclude='package-lock.json')

found=0
echo "== Working tree: $target =="
if grep -rEIn "${excludes[@]}" "$regex" "$target" 2>/dev/null | grep -Ev '(example|placeholder|dummy|xxx|changeme|<your)' ; then
  found=1
fi

if (( history > 0 )) && git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "== Last $history commits =="
  if git -C "$target" log -p -n "$history" --no-color | grep -En "^\+.*($regex)" | grep -Ev '(example|placeholder|dummy|xxx|changeme|<your)'; then
    found=1
  fi
fi

if (( found )); then
  echo "possible secrets found; rotate them and move to environment variables" >&2
  exit 1
fi
echo "no secret-looking strings found"
