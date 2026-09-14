---
name: mass-good-skill
description: Checks that a sample skill passes every validator rule and documents the expected layout. Use when the user says "validate the fixture", "run the good fixture" or asks to check the sample skill. Do NOT use for real projects (use mass-code-review).
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-10
  category: meta
  tags: [fixture, testing]
  requires:
    tools: [git]
---

# Good Skill

Fixture used by the validator tests.

## Instructions

1. Read references/guide.md when you need the long version.
2. Run scripts/check.sh to verify.

## Examples

User says: "validate the fixture"
Result: the validator reports zero errors.
