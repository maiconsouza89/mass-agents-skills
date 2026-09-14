#!/usr/bin/env bash
# Prints everything a reviewer needs before reading code:
# PR metadata (when gh is available), changed files with stats, and the full diff.
# Usage: scripts/pr-context.sh [pr-number-or-url] [base-branch]
set -euo pipefail

target="${1:-}"
base="${2:-}"

have_gh() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }

if [[ -n "$target" ]] && have_gh; then
  echo "== Pull request =="
  gh pr view "$target" --json number,title,author,baseRefName,headRefName,url,body,additions,deletions,changedFiles \
    --template '#{{.number}} {{.title}}
author: {{.author.login}}   base: {{.baseRefName}}   head: {{.headRefName}}
url: {{.url}}
+{{.additions}} -{{.deletions}} in {{.changedFiles}} files

{{.body}}
'
  echo
  echo "== Changed files =="
  gh pr diff "$target" --name-only
  echo
  echo "== Diff =="
  gh pr diff "$target"
  exit 0
fi

if [[ -z "$base" ]]; then
  if git show-ref --verify --quiet refs/remotes/origin/main; then base="origin/main"
  elif git show-ref --verify --quiet refs/heads/main; then base="main"
  elif git show-ref --verify --quiet refs/remotes/origin/master; then base="origin/master"
  else base="HEAD~1"
  fi
fi

merge_base="$(git merge-base "$base" HEAD 2>/dev/null || echo "$base")"
echo "== Local branch review =="
echo "branch: $(git rev-parse --abbrev-ref HEAD)   base: $base ($merge_base)"
[[ -n "$target" ]] && echo "note: gh is unavailable or not authenticated; reviewing the local diff instead of $target"
echo
echo "== Commits =="
git log --oneline "$merge_base"..HEAD
echo
echo "== Changed files =="
git diff --stat "$merge_base"...HEAD
echo
echo "== Diff =="
git diff "$merge_base"...HEAD
