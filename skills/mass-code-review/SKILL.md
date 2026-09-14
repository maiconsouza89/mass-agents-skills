---
name: mass-code-review
description: Reviews a pull request or branch of TypeScript, React, Next.js or NestJS code and delivers one consolidated, evidence-backed review with severity-ranked findings. Use when the user says "review this PR", "code review", "check my branch before merge", "review my changes" or pastes a pull request URL. Do NOT use for writing tests (use mass-testing-strategy), fixing CI failures, or general refactoring without a review request.
license: MIT
compatibility: Works best with git and the GitHub CLI (gh) available; falls back to a local diff review without gh.
allowed-tools: Bash(git:*) Bash(gh:*) Read Grep Glob
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: quality
  tags: [review, pull-request, quality, github]
  requires:
    skills: [mass-typescript-conventions]
    tools: [git, gh]
---

# Mass Code Review

Produce a review a senior engineer would sign: every finding points at a file and line, states what breaks and how to reproduce it, and carries a severity. Praise is optional, evidence is not.

## Non-negotiables

- Never report a finding you have not verified by reading the surrounding code. A guess costs the author more time than silence.
- One consolidated review, not a stream of comments. Group by severity, blockers first.
- Findings must be actionable: file, line, what is wrong, why it matters, what to do. Read references/severity-rubric.md to assign the level; do not invent your own scale.
- Do not restate the diff, do not comment on formatting that a linter enforces, do not ask the author to "consider" things without saying what you would do.
- Respect scope: review what the PR changes and what it breaks. Pre-existing issues go in a separate "Out of scope" list, at most three items.

## Workflow

### 1. Collect context

Run scripts/pr-context.sh to print the PR metadata, changed files and the diff (it uses `gh` when available and falls back to `git diff` against the base branch). Read the PR description and linked issue. Write down, in one sentence, what the change is supposed to accomplish; every finding is judged against that intent.

### 2. Read the change, then the neighbourhood

- Read every changed file in full, not just the hunks. Follow each changed function to its callers with Grep.
- For each hunk ask: what input makes this wrong? What happens on the error path? Is the behaviour covered by a test that would fail without this change?
- Apply the checklist in references/review-checklist.md. It is ordered by how often each item causes production incidents at Mass Solutions; go top to bottom.

### 3. Verify before you write

For anything you intend to mark High or Blocker, reproduce it: run the test suite, write a small failing test, or trace the exact call path. Note the command and output in the finding. If you cannot verify, downgrade to Medium and say what you could not confirm.

### 4. Write the review

Use this structure:

```
## Summary
One paragraph: what the PR does, whether it is safe to merge, and the single most important issue.

## Findings
### Blocker
- `path/file.ts:42` - <what is wrong>. <why it matters>. Fix: <specific change>. Evidence: <command or test>.
### High
### Medium
### Low

## Out of scope (pre-existing)
- up to three items, one line each

## Verdict
Approve | Request changes | Comment, with one sentence of justification.
```

### 5. Deliver

With `gh` available and the user's consent, post it as one review: `gh pr review <number> --request-changes --body-file review.md` (or `--approve` / `--comment`). Otherwise print the review in the chat. Never post inline comments one by one.

## Examples

### Example: standard PR review

User says: "Review PR 128 before I merge it."
Actions: 1. `scripts/pr-context.sh 128`. 2. Read the changed NestJS service and its controller; grep for other callers of the changed method. 3. Notice the new `findOne` throws on missing rows while the previous version returned null; the controller has no exception filter for it. 4. Write a small test that hits the 404 path and confirm it now returns 500. 5. File it as High with the test output as evidence, plus two Low findings from the checklist.
Result: one review posted with `gh pr review 128 --request-changes`, Verdict "Request changes: unhandled NotFound turns into 500".

### Example: local branch, no gh

User says: "Check my branch before I open the PR."
Actions: 1. `scripts/pr-context.sh` with no argument diffs against `main`. 2. Same reading and verification steps. 3. Print the review in the chat, Verdict included.
Result: a review the author can act on before opening the PR.

### Example: review request that is really a test request

User says: "Review this and add the missing tests."
Actions: Do the review. For the tests, hand off to mass-testing-strategy explicitly: "Findings above; the missing tests are a separate task, I will follow the testing skill for them."
Result: review delivered; tests written under the testing conventions, not improvised.

## Troubleshooting

### gh is not authenticated

Cause: `gh auth status` fails.
Fix: ask the user to run `gh auth login`; meanwhile continue with the local diff so the review is not blocked.

### The diff is huge (over ~1500 lines)

Cause: a feature branch with many commits or a generated file.
Fix: exclude generated files (`git diff --stat` shows them), review commit by commit, and say in the Summary which parts got a lighter pass.

### The PR has no description

Cause: intent unknown, findings cannot be judged.
Fix: infer the intent from commits and the linked issue, state your assumption in the Summary, and ask the author to confirm it.
