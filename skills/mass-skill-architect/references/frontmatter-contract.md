# Frontmatter contract

Every `SKILL.md` in the catalog starts with this block. The validator (`tools/validate-skills.ts`) enforces each rule; the JSON Schema lives in `schemas/skill-frontmatter.schema.json`.

```yaml
---
name: mass-example-skill
description: One line following the description formula.
license: MIT
compatibility: Requires the gh CLI and git.          # optional, at most 500 characters
allowed-tools: Bash(gh:*) Read Grep                  # optional, Claude Code pre-approval; stripped for other agents
metadata:
  owner: "@maiconsouza89"                            # @github-handle or team:slug
  version: 1.0.0                                     # semver, quoted or plain
  reviewed: 2026-09-14                               # ISO date of the last human review
  category: quality                                  # key from skills/_categories.json
  tags: [review, pull-request]                       # 1 to 8 kebab-case tags, unique
  requires:                                          # optional
    skills: [mass-typescript-conventions]            # installed together by the CLI
    tools: [gh, node]                                # checked with `which`, reported as warnings
    mcp: []                                          # MCP servers the skill expects
  source:                                            # optional, only for vendored skills
    url: https://github.com/org/repo
    ref: v1.2.0
    license: CC-BY-4.0
---
```

## Rules by field

| Field | Rule | Validator id |
|---|---|---|
| `name` | kebab-case, 3 to 64 chars, equals folder, never contains `claude` or `anthropic` | F01, F02 |
| `name` | starts with `mass-` unless `metadata.source` is present | F03 (warning) |
| `description` | single line, no `<` `>`, 80 to 1024 chars, follows the formula, 2 or more quoted triggers | F04, F05, F06, F07 |
| `license` | present; use `MIT` for skills written here | F08 (warning) |
| `compatibility` | string, at most 500 chars | F16 |
| `metadata.owner` | `@handle` or `team:slug`; the owner approves changes and receives staleness reports | F09 |
| `metadata.version` | semver; patch for wording, minor for new steps, major for changed trigger scope | F10 |
| `metadata.reviewed` | ISO date, not in the future; warning after 90 days | F11, F12 |
| `metadata.category` | must exist in `skills/_categories.json` | F13 |
| `metadata.tags` | 1 to 8 unique kebab-case strings | F14 |
| `metadata.requires` | lists of strings; skills must exist, must not be deprecated, no self-reference | F15 |
| `metadata.source` | https url, ref and license, all required when present | F16 |

## Top-level keys that are rejected

`disable-model-invocation`, `user-invocable`, `paths`, `argument-hint`, `arguments`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `shell`, `disallowed-tools`.

They only work in Claude Code. The catalog installs into Cursor, Copilot, Windsurf, Codex, Gemini, Cline and OpenCode as well, so the behaviour must be described in the body instead.

## Body and files

- Body starts with a level-1 heading.
- `SKILL.md` under about 3000 tokens (B02 warning), hard stop at 6000 (B01 error). All markdown in the folder under 20000 tokens (B03 warning).
- Every path mentioned (`references/…`, `scripts/…`, `assets/…`, markdown links) must exist (B05). Every file in those folders must be mentioned (B06 warning).
- `scripts/*` start with `#!` and are executable (X01, X02). No binary files anywhere (X03).
- No secrets (Z01), no `curl | sh` style commands (Z02 warning), no prompt-injection phrasing (Z03 warning).
- `evals/triggers.yaml` with 3 or more positive and 3 or more negative prompts, no TODOs (E01).
