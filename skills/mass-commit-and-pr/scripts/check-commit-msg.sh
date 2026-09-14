#!/usr/bin/env bash
# Validates a commit message against the Mass Solutions Conventional Commits rules.
# Usage: scripts/check-commit-msg.sh <file-with-message>   or   echo "msg" | scripts/check-commit-msg.sh
# Can be wired as a commit-msg git hook: scripts/check-commit-msg.sh "$1"
set -euo pipefail

if [[ $# -ge 1 && -f "$1" ]]; then
  message="$(cat "$1")"
else
  message="$(cat)"
fi

summary="$(printf '%s\n' "$message" | sed -n '1p')"
second="$(printf '%s\n' "$message" | sed -n '2p')"
errors=()

types='feat|fix|chore|docs|refactor|test|perf|ci|build|revert'
if ! printf '%s' "$summary" | grep -Eq "^(${types})(\([a-z0-9._/-]+\))?!?: [a-z]"; then
  errors+=("summary must match 'type(scope): lowercase imperative summary' with type in: ${types//|/, }")
fi
if (( ${#summary} > 72 )); then
  errors+=("summary is ${#summary} characters; maximum is 72")
fi
if printf '%s' "$summary" | grep -Eq '\.$'; then
  errors+=("summary must not end with a period")
fi
if [[ -n "$second" ]]; then
  errors+=("second line must be blank to separate summary from body")
fi
if printf '%s' "$summary" | grep -Eiq '^(wip|fixup|squash|temp|tmp)\b'; then
  errors+=("temporary commit summary; squash before opening the PR")
fi

if (( ${#errors[@]} > 0 )); then
  echo "commit message rejected:" >&2
  for error in "${errors[@]}"; do echo "  - $error" >&2; done
  exit 1
fi
echo "commit message ok"
