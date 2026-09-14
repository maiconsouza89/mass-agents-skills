# Contributing

This catalog is maintained by Mass Solutions engineers. Anyone in the company can propose or change a skill; the skill's owner approves the change.

## Skill lifecycle

1. **Propose.** Open a [skill proposal issue](.github/ISSUE_TEMPLATE/skill-proposal.yml) with the outcome, three real trigger phrases, the negatives and an owner. Check first that no existing skill covers the same triggers (`npm run eval:triggers` will show overlap too).
2. **Scaffold.** `npm run new-skill -- mass-<name> --category <id> --owner @you --tags a,b` creates the folder with a `SKILL.md` template and `evals/triggers.yaml`.
3. **Write.** Use the `mass-skill-architect` skill in your agent, or follow its references by hand: `skills/mass-skill-architect/references/`. Keep `SKILL.md` under about 3000 tokens; move long material to `references/`.
4. **Check.** `npm run check` runs typecheck, the validator, the registry check, tests and trigger evals. Fix every error and read every warning.
5. **Regenerate.** `npm run registry -- --readme` updates `skills-registry.json` and the README table. Commit both.
6. **PR.** Fill the pull request template. CI runs the same `check`. The owner named in `metadata.owner` reviews.

## Metadata contract

Every `SKILL.md` frontmatter must have:

| Field | Value |
|---|---|
| `name` | equals the folder, kebab-case, prefixed `mass-` (vendored skills declare `metadata.source` instead) |
| `description` | one line: `[What it does]. Use when "trigger", "trigger" or ... Do NOT use for ... (use mass-other).` |
| `license` | `MIT` for skills written here |
| `metadata.owner` | `@github-handle` or `team:slug` |
| `metadata.version` | semver |
| `metadata.reviewed` | ISO date of the last human review |
| `metadata.category` | key from `skills/_categories.json` |
| `metadata.tags` | 1 to 8 kebab-case tags |
| `metadata.requires` | optional `skills`, `tools`, `mcp` lists |
| `metadata.source` | optional `url`, `ref`, `license` for vendored content |

Only the Agent Skills standard keys (`name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`) are allowed at the top level. Claude Code-only keys are rejected so every skill works in every agent.

## Versioning and review rules

- Patch bump for wording and typo fixes, minor bump for new steps or references, major bump when the trigger scope changes.
- Every content change sets `metadata.reviewed` to the date of the change.
- Skills not reviewed for 90 days appear in the weekly "Stale skills review" issue. Owners re-read them, fix drift and bump `reviewed`.
- To retire a skill, delete the folder and add an entry to `skills/_deprecated.yaml` with the alternatives. The CLI refuses to install deprecated names and points to the alternatives.

## Vendoring a third-party skill

Copy the skill into `skills/<name>/`, keep its license, declare `metadata.source` with the upstream URL, ref and license, and adapt the description to the formula. Vendored skills keep their upstream name (no `mass-` prefix).

## Tooling

```bash
npm run validate -- <skill>       # one skill
npm run validate -- --json        # machine-readable
node tools/eval-triggers.ts --strict --min-f1 0.8
npm run staleness
npm run build && npm run dev:site # preview the catalog site
```

## AI assistance

Using an agent to draft a skill is expected. Disclose it in the PR and make sure you can defend every instruction: the agent following the skill later will not have your context.
