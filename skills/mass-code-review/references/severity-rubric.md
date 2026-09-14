# Severity rubric

Pick the first level whose definition matches. When in doubt between two levels, pick the lower one and state why in the finding.

| Level | Definition | Merge impact | Evidence required |
|---|---|---|---|
| Blocker | Data loss, security vulnerability, broken authorization, production outage on the happy path, or a change that makes the build or deploy fail. | Must be fixed before merge. | Reproduced: failing test, command output or exact call trace. |
| High | Incorrect behaviour on a realistic input, unhandled error path that users will hit, missing test for a bug fix, breaking change to a public API without a migration note. | Must be fixed before merge unless the author documents a follow-up issue in the PR. | Reproduced or traced through the code with file and line references. |
| Medium | Likely bug on an edge case, misleading abstraction, N+1 or performance regression on a hot path, missing input validation with limited blast radius. | Should be fixed; may merge with a linked follow-up. | Reasoned explanation with the exact input that triggers it. |
| Low | Naming, clarity, small duplication, missing doc comment on an exported symbol, test naming. | Author's discretion. | None beyond the pointer. |

## Rules

- Formatting and import order are never findings; the linter owns them.
- "I would have done it differently" is not a finding unless you can name the concrete problem it causes.
- Three or more Medium findings with the same root cause become one High finding about the root cause.
- A Blocker or High finding without evidence is a Medium finding with a question attached.
- The Verdict follows the highest level: any Blocker or High means "Request changes"; only Medium and Low means "Comment" or "Approve" depending on the count.
