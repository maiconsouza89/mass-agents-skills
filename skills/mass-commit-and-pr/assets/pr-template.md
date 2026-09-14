## Context

Why this change exists: the problem, the ticket, the customer request. Link the issue.

Refs: MS-000

## What changed

- One bullet per meaningful change, in the order a reviewer should read the diff.
- Call out anything surprising, any shortcut taken and why.

## How it was verified

- Commands run and their result (`npm run check` green, specific test names).
- Manual checks performed, with the environment.
- For UI: before and after screenshots or a short recording.

## Risks and rollout

- Blast radius if this is wrong, and how to roll back.
- Feature flag, migration order, or "none" when the change is safe.

## Checklist

- [ ] Tests added or updated for the behaviour in this PR
- [ ] Changelog entry under Unreleased (user-facing changes only)
- [ ] No secrets, credentials or generated files in the diff
- [ ] PR is under about 400 lines or split into a stack
