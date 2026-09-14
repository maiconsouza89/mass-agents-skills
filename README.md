# Mass Solutions Agent Skills

The internal skills catalog of Mass Solutions for AI coding agents. Every skill is a validated `SKILL.md` package that teaches an agent one repeatable workflow the way we do it here: TypeScript conventions, React and Next.js patterns, NestJS modules, API design, testing, security, performance, delivery and skill authoring itself.

Skills follow the open [Agent Skills](https://agentskills.io) format, so the same folder installs into Claude Code, Cursor, GitHub Copilot, Windsurf, Codex, Gemini CLI, Cline and OpenCode.

Browse the catalog at **https://maiconsouza89.github.io/mass-agents-skills/**.

## Install

### Claude Code plugin marketplace

```
/plugin marketplace add maiconsouza89/mass-agents-skills
/plugin install mass-solutions-skills@mass-solutions
```

### CLI (any supported agent)

```bash
# straight from GitHub, no npm publish required
npx github:maiconsouza89/mass-agents-skills list
npx github:maiconsouza89/mass-agents-skills install mass-code-review mass-testing-strategy -a claude-code cursor

# or, once published to npm
npx @mass-solutions/agent-skills install mass-code-review -a auto
```

`-a` accepts agent ids, `all`, or `auto` (agents detected in the project or home directory). Add `--global` to install under your home directory instead of the current project, and `--symlink` to keep one copy in `.mass-skills/` linked into every agent folder.

Other commands: `search <query>`, `update [--check]`, `remove <skills...>`, `doctor` (finds drift, outdated and unmanaged skills). Every install is recorded in `.mass-skills.lock.json` and every file is verified against the sha256 in `skills-registry.json`.

### Manual

Copy `skills/<name>/` into your agent's skills directory (for example `.claude/skills/`). The `evals/` folder is not needed at runtime.

## Catalog

<!-- catalog:start -->

### Meta

Skills that create, review and maintain other skills in this catalog.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-skill-architect`](skills/mass-skill-architect/SKILL.md) | Designs, writes and refactors skills for the Mass Solutions catalog so they pass the validator, trigger accurately and stay within token budgets. | @maiconsouza89 | ~1964 |

### Quality

Code review, testing strategy and everything that keeps the codebase healthy.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-code-review`](skills/mass-code-review/SKILL.md) | Reviews a pull request or branch of TypeScript, React, Next.js or NestJS code and delivers one consolidated, evidence-backed review with severity-ranked findings. | @maiconsouza89 | ~1422 |
| [`mass-testing-strategy`](skills/mass-testing-strategy/SKILL.md) | Writes and organises tests for TypeScript, React, Next.js and NestJS projects using the Mass Solutions test pyramid, with Vitest or Jest for unit and integration tests, Testing Library for components and Playwright for end-to-end flows. | @maiconsouza89 | ~1252 |

### Language

TypeScript conventions and language-level rules shared by every Mass Solutions project.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-typescript-conventions`](skills/mass-typescript-conventions/SKILL.md) | Applies the Mass Solutions TypeScript conventions (strict compiler options, no any, discriminated unions, typed errors, naming and module boundaries) when writing or refactoring TypeScript. | @maiconsouza89 | ~1181 |

### Frontend

React, Next.js, accessibility and UI patterns.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-nextjs-app-router`](skills/mass-nextjs-app-router/SKILL.md) | Guides Next.js App Router work at Mass Solutions, deciding between server and client components, route handlers, server actions, caching and revalidation, metadata and loading or error boundaries. | @maiconsouza89 | ~1294 |
| [`mass-react-components`](skills/mass-react-components/SKILL.md) | Structures React components the Mass Solutions way, covering file layout, props typing, hooks rules, state placement, composition over configuration and colocated tests. | @maiconsouza89 | ~1170 |
| [`mass-web-accessibility`](skills/mass-web-accessibility/SKILL.md) | Makes React and Next.js interfaces meet WCAG 2.2 AA by fixing semantics, keyboard navigation, focus management, forms, colour contrast and ARIA, and verifies with axe. | @maiconsouza89 | ~1117 |

### Backend

NestJS, API design and server-side conventions.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-api-design`](skills/mass-api-design/SKILL.md) | Designs HTTP APIs to the Mass Solutions REST conventions, covering resource naming, status codes, the standard error envelope, pagination, filtering, versioning, idempotency and OpenAPI documentation. | @maiconsouza89 | ~1235 |
| [`mass-nestjs-modules`](skills/mass-nestjs-modules/SKILL.md) | Creates and refactors NestJS modules following the Mass Solutions layout, with thin controllers, validated DTOs, application services, repositories behind interfaces, exception filters and dependency injection rules. | @maiconsouza89 | ~1315 |

### Workflow

Git, commits, pull requests and delivery process.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-commit-and-pr`](skills/mass-commit-and-pr/SKILL.md) | Produces commits, branches and pull requests that follow the Mass Solutions delivery conventions, with Conventional Commits messages, branch naming, small reviewable PRs, a filled PR template and changelog entries. | @maiconsouza89 | ~1144 |

### Security

Secure coding checklists and threat-aware reviews.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-security-checklist`](skills/mass-security-checklist/SKILL.md) | Runs a security pass over Node, Next.js and NestJS code against the Mass Solutions OWASP-based checklist, covering authentication, authorisation, input validation, secrets handling, security headers, dependencies and logging, and reports concrete findings with fixes. | @maiconsouza89 | ~1229 |

### Performance

Web performance, Core Web Vitals and bundle hygiene.

| Skill | What it does | Owner | Tokens |
|---|---|---|---|
| [`mass-web-performance`](skills/mass-web-performance/SKILL.md) | Measures and improves web performance in React and Next.js applications, targeting Core Web Vitals (LCP, INP, CLS), bundle size, render performance and image or font loading, always with before and after numbers. | @maiconsouza89 | ~1059 |

<!-- catalog:end -->

## How this catalog differs from a generic skills repo

- **Every skill has an owner, a version and a review date.** The validator rejects skills without them and a weekly job opens an issue listing skills not reviewed in 90 days.
- **Descriptions follow one formula** (`what` + `Use when` + `Do NOT use`) and are tested offline: `npm run eval:triggers` scores every skill's positive and negative prompts against the whole catalog and reports precision and recall.
- **Token budgets are enforced.** A `SKILL.md` over about 3000 tokens gets a warning, over 6000 fails. Long material lives in `references/` with explicit read conditions.
- **Dependencies are declared.** `metadata.requires.skills` installs together; `metadata.requires.tools` is checked on install.
- **Category is metadata, not a folder name.** Recategorising never moves files or breaks links.
- **Installs are verified.** Per-file sha256 in the registry, a content hash per skill, a lockfile, and `doctor` to detect local edits.
- **Portable by construction.** Only Agent Skills standard keys are allowed at the top level of the frontmatter; Claude Code-only keys are rejected so the same skill works in every agent.

## Repository layout

```
skills/                 the catalog (one folder per skill) plus _categories.json, _deprecated.yaml, _evals/
skills-registry.json    generated index with hashes and token counts (npm run registry)
tools/                  validate-skills, generate-registry, eval-triggers, staleness-report, new-skill
src/core                shared library (frontmatter, hashing, description formula, agents)
src/cli                 the mass-skills installer
site/                   static catalog website, built from the registry and DESIGN.md
schemas/                JSON Schemas for frontmatter, registry and lockfile
.claude-plugin/         Claude Code marketplace and plugin manifests
```

## Development

```bash
npm ci
npm run check          # typecheck, validate, registry:check, tests, trigger evals
npm run new-skill -- mass-my-skill --category frontend --tags react
npm run registry -- --readme
npm run build          # CLI to dist/, site to site/dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the skill lifecycle and [SECURITY.md](SECURITY.md) for what the validator and installer guarantee.

## License

Code and skills are released under the [MIT License](LICENSE). Vendored skills keep the license declared in their `metadata.source`.
