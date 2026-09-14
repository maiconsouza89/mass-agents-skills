# Description formula

The description is the only part of a skill an agent sees before deciding to load it. Every catalog description follows:

```
[What it does, with the outcome]. Use when the user says "trigger one", "trigger two" or asks to [paraphrase]. Do NOT use for [adjacent task] (use mass-other-skill) or [unrelated task].
```

The validator checks the literal words `Use when` and `Do NOT use`, a "what" part of at least 20 characters, and at least two quoted trigger phrases.

## Writing the three parts

1. **What it does.** Name the artifact or outcome, not the topic. "Reviews a pull request and posts one consolidated GitHub review with severity labels" is better than "Helps with code review".
2. **Use when.** Quote phrases people actually type, including informal ones. Lean slightly generous: agents under-trigger more often than they over-trigger. Mention file types when relevant ("when editing `*.tsx` files").
3. **Do NOT use.** List the neighbouring skills by name. This is what keeps two skills from fighting over the same prompt, and the trigger evaluator uses it to explain false positives.

## Good

```
Reviews a pull request for TypeScript, React and NestJS code and posts one consolidated GitHub review with severity-ranked findings. Use when the user says "review this PR", "code review", "check my branch before merge" or pastes a pull request URL. Do NOT use for writing tests (use mass-testing-strategy), fixing CI or general refactoring.
```

Why it works: outcome first, four realistic triggers, two named neighbours.

## Bad

```
Helps with code quality. Use when needed. Do NOT use otherwise.
```

Why it fails: no outcome, no quoted triggers, negatives say nothing. It would pass a naive keyword check and still be useless, which is why the catalog also runs `tools/eval-triggers.ts`.

```
Reviews code. Use when the user asks for a review, a refactor, tests, documentation or performance work. Do NOT use for deployment.
```

Why it fails: it claims five neighbouring skills' territory. The overlap check (C02) will warn and the eval will show false positives.

## Checklist before you commit

- Read it aloud: does the first sentence say what you get?
- Would each quoted phrase appear in a real Slack message from the team?
- Does every `Do NOT use` item name the skill that should win?
- Is it on a single line in the YAML (no `>` or `|` block scalars)?
