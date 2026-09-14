#!/usr/bin/env bash
# Scaffolds a new catalog skill from inside any checkout of mass-agents-skills.
# Usage: scripts/scaffold.sh <mass-skill-name> <category> [@owner] [tag,tag]
set -euo pipefail

name="${1:-}"
category="${2:-}"
owner="${3:-@maiconsouza89}"
tags="${4:-$category}"

if [[ -z "$name" || -z "$category" ]]; then
  echo "usage: scripts/scaffold.sh <mass-skill-name> <category> [@owner] [tag,tag]" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [[ ! -f "$root/tools/new-skill.ts" ]]; then
  echo "run this from a checkout of mass-agents-skills (tools/new-skill.ts not found)" >&2
  exit 1
fi

node "$root/tools/new-skill.ts" "$name" --category "$category" --owner "$owner" --tags "$tags"
