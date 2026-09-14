---
name: mass-commit-and-pr
description: Produces commits, branches and pull requests that follow the Mass Solutions delivery conventions, with Conventional Commits messages, branch naming, small reviewable PRs, a filled PR template and changelog entries. Use when the user says "commit this", "write a commit message", "open a PR", "create a pull request", "name the branch" or "get this ready to merge". Do NOT use for reviewing someone else's PR (use mass-code-review), fixing CI failures or release versioning of npm packages.
license: MIT
compatibility: Uses git and, when available, the GitHub CLI (gh).
allowed-tools: Bash(git:*) Bash(gh:*)
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: workflow
  tags: [git, commits, pull-requests, conventional-commits]
  requires:
    tools: [git, gh]
---

# Mass Commit and PR

A pull request is a story a reviewer can read in ten minutes: a focused branch, commits that each build and pass tests, and a description that says what changed, why, and how it was verified.

## Non-negotiables

- Branch names: `<type>/<ticket>-<short-slug>`, e.g. `feat/MS-142-invoice-pdf`, `fix/MS-201-null-customer`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`.
- Commit messages follow Conventional Commits: `type(scope): imperative summary` under 72 characters, blank line, body explaining why (not what), footer with `Refs: MS-142` or `Closes #12` and `BREAKING CHANGE:` when applicable. Run scripts/check-commit-msg.sh before committing.
- Each commit builds and passes tests on its own; no "wip" or "fix typo" commits in the final history. Squash locally before opening the PR.
- Never commit secrets, generated artifacts already ignored, or unrelated formatting changes.
- PRs stay under about 400 changed lines. Larger work is split into a stack of PRs, each mergeable alone.
- The PR description uses `assets/pr-template.md`: context, what changed, how it was verified, risks and rollout, screenshots for UI.
- User-facing changes add a line to `CHANGELOG.md` under Unreleased.
- Ask before pushing, force-pushing or opening the PR unless the user already said to proceed.

## Workflow

### 1. Inspect

```bash
git status && git diff --stat && git log --oneline -10
```

Group the changes by intent. If there is more than one intent, plan more than one commit or more than one PR.

### 2. Stage deliberately

Stage by hunk (`git add -p`) when a file mixes intents. Verify nothing sensitive is staged (`git diff --cached --name-only`, then look for `.env`, keys, dumps).

### 3. Commit

Write the message, validate it with scripts/check-commit-msg.sh, commit. Example:

```
feat(invoices): generate PDF on demand from the detail page

Customers asked for a downloadable copy. Rendering happens server-side
with the existing template engine so numbers match the on-screen values.

Refs: MS-142
```

### 4. Prepare the PR

Rebase onto the base branch, run the full check the repo defines (`npm run check` or equivalent), squash fixups. Fill the template from `assets/pr-template.md`. Title equals the main commit summary.

```bash
gh pr create --title "feat(invoices): generate PDF on demand" --body-file pr.md --base main
```

### 5. Verify

CI green, description complete, reviewers assigned per CODEOWNERS, changelog updated when user-facing.

## Examples

### Example: commit a mixed working tree

User says: "Commit this."
Actions: 1. `git status` shows a bug fix in the service plus a renamed util used elsewhere. 2. Two commits: `refactor(utils): rename formatMoney to formatCurrency` then `fix(invoices): round totals before tax`. 3. Validate both messages with the script.
Result: two self-contained commits, each passing tests.

### Example: open a PR for a large branch

User says: "Open a PR for my branch, it has 1800 changed lines."
Actions: 1. Map the changes into three independent slices (schema migration, service, UI). 2. Propose a stack: PR 1 migration, PR 2 service depending on 1, PR 3 UI depending on 2. 3. Create the first with the template and note the stack in the description.
Result: reviewable PRs instead of one nobody reads properly.

## Troubleshooting

### Commit message rejected by the script

Cause: missing type, summary over 72 characters, or capitalised summary.
Fix: use `type(scope): lowercase imperative summary`; move detail to the body.

### gh pr create fails with authentication error

Cause: `gh` not logged in.
Fix: ask the user to run `gh auth login`; provide the title and body so they can open the PR manually meanwhile.
