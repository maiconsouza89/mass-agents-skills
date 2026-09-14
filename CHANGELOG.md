# Changelog

All notable changes to the catalog and the `mass-skills` CLI. Skill-level versions live in each `SKILL.md`.

## Unreleased

## 0.1.0

Initial release.

- Catalog of twelve skills for TypeScript, React, Next.js and NestJS teams: `mass-skill-architect`, `mass-code-review`, `mass-typescript-conventions`, `mass-react-components`, `mass-nextjs-app-router`, `mass-nestjs-modules`, `mass-api-design`, `mass-testing-strategy`, `mass-commit-and-pr`, `mass-security-checklist`, `mass-web-performance`, `mass-web-accessibility`.
- Validator enforcing the metadata contract, the description formula, token budgets, secret scanning, script hygiene and per-skill trigger evals.
- Registry generator with per-file sha256, content hashes and token counts; README catalog table.
- Offline trigger evaluator reporting precision, recall and F1 per skill.
- `mass-skills` CLI: list, search, install (copy or symlink, transitive `requires.skills`), remove, update, doctor, with a lockfile and hash-verified downloads from GitHub.
- Static catalog site generated from the registry and `DESIGN.md`, deployed to GitHub Pages.
- Claude Code plugin marketplace manifests.
- CI (validate, test, build), Pages deploy, weekly stale-skill issue, tag-based release.
