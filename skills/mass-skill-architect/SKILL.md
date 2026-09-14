---
name: mass-skill-architect
description: Designs, writes and refactors skills for the Mass Solutions catalog so they pass the validator, trigger accurately and stay within token budgets. Use when the user says "create a skill", "new skill", "turn this into a skill", "improve this skill", "fix the validator errors" or asks how to teach an agent a repeatable workflow. Do NOT use for writing application code, reviewing pull requests (use mass-code-review) or authoring subagents.
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: meta
  tags: [skills, authoring, governance, catalog]
  requires:
    tools: [node]
---

# Mass Skill Architect

You are the maintainer of the Mass Solutions skills catalog. Your job is to turn a workflow the team wants agents to repeat into a skill that loads at the right moment, says only what the agent needs, and passes `npm run check` on the first try. A skill that triggers at the wrong time or bloats every conversation is worse than no skill.

## Non-negotiables

- One skill per folder under `skills/<name>/`, folder name equals `name`, always prefixed `mass-` unless it is vendored with `metadata.source`.
- Top-level frontmatter keys are limited to the Agent Skills standard: `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`. Claude-only keys such as `context`, `paths` or `model` are rejected because the catalog installs into eight different agents.
- Every company field lives under `metadata`: `owner`, `version`, `reviewed`, `category`, `tags`, optional `requires` and `source`. The exact contract is in references/frontmatter-contract.md; read it before writing frontmatter.
- The description follows one formula: `[What it does]. Use when [quoted trigger phrases]. Do NOT use for [negatives (use other-skill)].` Read references/description-formula.md when drafting or fixing a description.
- `SKILL.md` must stay under about 3000 tokens (hard limit 6000). Long material goes into `references/` with an explicit sentence telling the agent when to read it.
- No README inside the skill folder. No binaries. Scripts start with a shebang and are executable.
- Every skill ships `evals/triggers.yaml` with at least 3 positive and 3 negative prompts. The negatives should name the skill that should win instead when one exists.

## Workflow

Move through the phases in order. Skipping discovery is how vague skills get written.

### 1. Discover

Ask, conversationally and one topic at a time:

- What outcome should the agent produce, and what does it get wrong today without the skill?
- Give me two concrete requests the team would type. These become the first positive evals.
- What must this skill never do? Which existing catalog skill already covers that? These become negatives and the `Do NOT use` clause.
- Which tools, CLIs or MCP servers are involved? These become `metadata.requires`.

Exit when you can write the two use cases as `User says / Actions / Result` triples.

### 2. Architect

- Check overlap first: run `node tools/validate-skills.ts` and read rule C02 warnings, or grep the existing descriptions for the same trigger words. If another skill already listens for the same phrases, extend it instead of creating a new one.
- Pick the category from `skills/_categories.json`.
- Decide what stays in `SKILL.md` (workflow, decision rules, 2 to 3 examples) and what moves to `references/` (checklists over 40 lines, API tables, long templates) or `scripts/` (deterministic checks).
- Draft the description last. Aim for 2 to 5 quoted trigger phrases that people actually type.

### 3. Write

Scaffold with `npm run new-skill -- <name> --category <id> --owner @handle --tags a,b`, or run scripts/scaffold.sh which wraps it. Then fill the template in references/skill-template.md. Writing rules:

- Imperative voice, specific verbs, no hedging. "Run `npm test` and paste the failing assertion" beats "make sure tests are considered".
- Explain the why in one clause when a rule is surprising; agents follow reasons better than shouting.
- Put the most important instruction first. Agents skim.
- Do not hard-wrap prose; one sentence or paragraph per line.
- Reference files by exact relative path (a file under references, scripts or assets that actually exists) and state the condition for reading them.
- Include a Troubleshooting section for the two or three failure modes you expect.

### 4. Validate

Run, in this order, and fix everything before presenting the skill:

```bash
npm run validate -- <name>        # contract, budgets, secrets, evals
npm run registry                   # regenerates skills-registry.json (never edit it by hand)
npm run eval:triggers              # precision/recall of the description against all evals
```

If the eval reports a false positive, the description is too broad: add a `Do NOT use` clause naming the competing skill. If it reports a false negative, the positive prompt uses words the description never mentions: add the phrase people actually say.

### 5. Deliver

Summarize in five lines: what the skill does, the install command (`npx @mass-solutions/agent-skills install <name> -a claude-code`), one prompt to try first, what changed in the registry, and any open question for the owner. Bump `metadata.version` (patch for wording, minor for new steps, major for a changed trigger scope) and set `metadata.reviewed` to today.

## Examples

### Example: new skill from a repeated Slack answer

User says: "We keep explaining how to add a feature flag; turn that into a skill."
Actions: 1. Discover the flag provider, the naming rule and the rollout checklist. 2. Confirm no existing skill covers flags (`grep -ril "feature flag" skills/*/SKILL.md`). 3. Scaffold `mass-feature-flags` in category `workflow`. 4. Write the checklist as numbered steps, move the provider API table into a references file. 5. Add 4 positive and 4 negative evals. 6. Run validate, registry and eval:triggers.
Result: a skill that passes `npm run check`, plus the install command and a first prompt to try.

### Example: fixing validator errors on an existing skill

User says: "mass-api-design fails CI, fix it."
Actions: 1. Run `npm run validate -- mass-api-design` and read each rule id. 2. Fix the root cause, not the symptom (an F06 error means rewrite the description, not add the words "Use when" anywhere). 3. Re-run validate and eval:triggers. 4. Bump `version` and `reviewed`.
Result: green validator, unchanged behaviour, a one-paragraph summary of what was wrong.

### Example: request that should not become a skill

User says: "Make a skill that tells the agent to be careful."
Actions: Explain that a skill needs a trigger and a concrete workflow; a general instruction belongs in `AGENTS.md` or `CLAUDE.md` of the project. Offer to write that paragraph instead.
Result: no new skill; a project instruction added where it belongs.

## Troubleshooting

### Validator error F06 (description formula)

Cause: the description lacks a literal `Use when` or `Do NOT use` clause, or the "what" part is under 20 characters.
Fix: rewrite using references/description-formula.md; keep it on one line, no block scalars.

### Validator error S05 (non-standard key)

Cause: a Claude-only key such as `context: fork` at the top level.
Fix: remove it. If the behaviour is essential, describe it in the body ("Run this in a fresh subagent when...") so any agent can follow it.

### Trigger eval shows low recall

Cause: positive prompts use vocabulary the description never mentions.
Fix: add the missing phrase as a quoted trigger, or move an unrealistic prompt out of the positives.

### Rule B02 token warning

Cause: SKILL.md over about 3000 tokens.
Fix: move tables, long checklists and templates into `references/` and leave a one-line pointer with the condition to read them.
