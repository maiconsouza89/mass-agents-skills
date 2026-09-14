# SKILL.md template

Copy the structure; delete sections that do not apply rather than leaving them empty.

```markdown
---
name: mass-<topic>
description: <What it does>. Use when the user says "<trigger>", "<trigger>" or asks to <paraphrase>. Do NOT use for <neighbour> (use mass-<other>) or <unrelated>.
license: MIT
metadata:
  owner: "@handle"
  version: 1.0.0
  reviewed: YYYY-MM-DD
  category: <category id>
  tags: [<tag>, <tag>]
---

# <Title>

One or two sentences: the outcome this skill guarantees and the standard it enforces.

## Non-negotiables

- Three to six rules the agent must never break, each with a short reason.

## Workflow

### 1. <Verb phrase>

Concrete steps. Commands in fenced blocks. Name the file to read when detail is needed, for example:
"Read references/<file>.md when <condition>."

### 2. <Verb phrase>

### 3. Verify

The command or check that proves the work is done.

## Examples

### Example: <common scenario>

User says: "<realistic request>"
Actions: 1. <step> 2. <step> 3. <step>
Result: <specific artifact or state>

### Example: <edge case or refusal>

## Troubleshooting

### <Error message or symptom>

Cause: <why>
Fix: <what to do>
```

## Companion files

```
skills/mass-<topic>/
├── SKILL.md
├── evals/triggers.yaml      # required, not installed
├── references/*.md          # long checklists, tables, templates; each mentioned in SKILL.md
├── scripts/*.sh|*.mjs       # deterministic checks; shebang + chmod +x
└── assets/*                 # files the agent copies into projects (templates, configs)
```

## evals/triggers.yaml

```yaml
positive:
  - "<request the skill must handle>"
  - "<paraphrase with different vocabulary>"
  - "<informal or partial request>"
negative:
  - prompt: "<request a neighbouring skill handles>"
    expect: mass-<neighbour>
  - prompt: "<unrelated coding request>"
  - prompt: "<generic non-coding question>"
```
