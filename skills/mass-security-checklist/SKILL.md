---
name: mass-security-checklist
description: Runs a security pass over Node, Next.js and NestJS code against the Mass Solutions OWASP-based checklist, covering authentication, authorisation, input validation, secrets handling, security headers, dependencies and logging, and reports concrete findings with fixes. Use when the user says "security review", "is this secure", "check for vulnerabilities", "OWASP", "we are handling passwords or tokens here" or before shipping anything that touches auth, payments or personal data. Do NOT use for general code review without a security focus (use mass-code-review), accessibility (use mass-web-accessibility) or infrastructure hardening outside the application code.
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: security
  tags: [security, owasp, secrets, authentication]
  requires:
    tools: [git, npm]
---

# Mass Security Checklist

Assume every input is hostile and every secret will leak if it can. The goal of this pass is a short list of verified findings with the exact fix, not a lecture.

## Non-negotiables

- Authorisation is checked server-side on every request that reads or changes data belonging to someone, using the caller's identity from the session or token, never from request parameters.
- Secrets live in the environment or a secret manager. Never in code, tests, fixtures, logs, error messages or client bundles. Run scripts/scan-secrets.sh on every pass.
- All input is validated with a schema at the boundary (DTO, zod) and encoded on output. Raw SQL uses parameters; shell commands are never built from user input; HTML is never rendered from user strings without sanitisation.
- Passwords are hashed with `argon2id` or `bcrypt` (cost 12 or higher). Tokens are random (`crypto.randomBytes(32)`), stored hashed, expire, and are rotated on privilege change.
- Sessions and cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`, short lived; CSRF protection on state-changing form posts that rely on cookies.
- Security headers set at the edge or in middleware: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Dependencies: `npm audit --audit-level=high` clean, lockfile committed, no unmaintained packages for security-sensitive functions.
- Logs contain correlation ids and never contain passwords, tokens, card numbers or full personal records.

## Workflow

### 1. Scope

List the entry points touched by the change: routes, server actions, webhooks, jobs, and the data they read or write. Identify which involve auth, money or personal data; those get the full checklist.

### 2. Automated pass

```bash
scripts/scan-secrets.sh                      # secrets in the working tree and recent history
npm audit --audit-level=high
npx eslint . --max-warnings 0                # with security plugin rules when configured
```

### 3. Manual pass

Read references/owasp-web.md and walk each category against the entry points from step 1. For every suspected issue, trace the exact path from input to sink before reporting it.

### 4. Report

Use the severity rubric from `mass-code-review` (Blocker, High, Medium, Low). Each finding: location, attack scenario in one sentence, fix with code, and how to verify the fix. Group Blockers first.

### 5. Verify fixes

Re-run the automated pass, add a test for each fixed issue (for example, a request without a token returns 401, a user cannot read another user's invoice), and confirm headers with `curl -I`.

## Examples

### Example: new endpoint handling personal data

User says: "Security review of the new customer export endpoint."
Actions: 1. Entry point: `GET /v1/customers/export`. 2. Finding: authorisation checks `role === 'admin'` from a query parameter (Blocker) with the exact line. 3. Finding: export writes to a public bucket path (High). 4. Finding: request logs include the full export payload (Medium). 5. Fixes with code; tests for 403 and for log redaction.
Result: three verified findings with fixes, none speculative.

### Example: secret in the repository

User says: "Is this secure?" about a config file.
Actions: 1. scripts/scan-secrets.sh flags an API key in `config/prod.ts` and in git history. 2. Report as Blocker: rotate the key now, move it to the environment, purge history only if the repo is private and the team agrees.
Result: key rotated, config reads from `process.env` through the validated config schema, scan clean.

## Troubleshooting

### npm audit reports issues in dev-only dependencies

Cause: transitive vulnerabilities in build tooling.
Fix: report as Low unless the tool runs on untrusted input; update or override with a note in the PR.

### CSP breaks inline scripts

Cause: third-party widget or inline handler.
Fix: use nonces or hashes, move scripts to files, allowlist specific hosts. Never set `unsafe-inline` for scripts as the permanent fix.
