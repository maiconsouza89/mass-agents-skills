# OWASP-based checklist for Node, Next.js and NestJS

Walk every category for each entry point in scope. Trace the input to the sink before reporting.

## A01 Broken access control

- Object-level authorisation: does every read/update/delete check that the record belongs to the caller or that the caller has the role? Test: user A requests user B's resource id.
- Function-level authorisation: admin routes guarded by a server-side check, not by hiding the link.
- Server actions and route handlers verify the session inside the function; middleware alone is not enough.
- Mass assignment: DTOs whitelist fields; `role`, `ownerId`, `price` never come from the client.
- CORS: explicit allowed origins, no `*` with credentials.

## A02 Cryptographic failures

- TLS everywhere; HSTS enabled.
- Passwords hashed with argon2id or bcrypt; no MD5/SHA for passwords.
- Tokens and reset codes random, hashed at rest, expiring.
- Sensitive data at rest encrypted where required (PII, card data never stored; use the PSP's tokens).
- No custom crypto; use `node:crypto` primitives with standard modes.

## A03 Injection

- SQL: parameterised queries or the ORM's query builder; never string concatenation. Prisma `$queryRaw` with tagged templates only.
- NoSQL: reject query operators in user input (`$gt`) via schema validation.
- Command injection: no `exec` with user input; use `execFile` with argument arrays.
- Path traversal: resolve and verify paths stay under the allowed root before reading files.
- XSS: no `dangerouslySetInnerHTML` with user content; sanitise with a maintained library if unavoidable; CSP as defence in depth.
- SSRF: user-supplied URLs are validated against an allowlist of hosts; block private IP ranges.

## A04 Insecure design

- Rate limits on login, signup, password reset, OTP, and any expensive endpoint.
- Account enumeration: identical responses for existing and non-existing accounts on login and reset.
- Business logic abuse: quantity limits, price recomputed server-side, coupons single-use enforced in the database.

## A05 Security misconfiguration

- Security headers: CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- Debug endpoints, GraphQL playground, Swagger UI disabled or authenticated in production.
- Error responses use the standard envelope; no stack traces to clients.
- Default credentials and example configs removed.

## A06 Vulnerable and outdated components

- `npm audit --audit-level=high` clean; lockfile committed; Dependabot or Renovate enabled.
- Security-sensitive libraries (auth, crypto, parsers) maintained and pinned.

## A07 Identification and authentication failures

- Sessions rotated on login and privilege change; logout invalidates server-side.
- Cookies `HttpOnly`, `Secure`, `SameSite`.
- MFA available for admin roles.
- Password policy: minimum length 12, breached-password check, no forced composition rules.

## A08 Software and data integrity failures

- Webhooks verify signatures before processing; replay protection with timestamps.
- CI pulls dependencies from the lockfile; no `curl | sh` in build scripts.
- Serialised data from clients (JSON only) validated; no `eval`, no unsafe deserialisation.

## A09 Security logging and monitoring failures

- Auth events (login success/failure, password change, role change) logged with correlation ids.
- No secrets or PII in logs; redact tokens and emails where not needed.
- Alerts on spikes of 401/403/429 and on failed webhook signatures.

## A10 Server-side request forgery

- Outbound requests built from user input go through an allowlist and a resolver that rejects private ranges and redirects to them.

## Next.js specifics

- Server-only code imports `server-only`; secrets never in `NEXT_PUBLIC_` variables.
- Server actions authenticate and authorise inside the action.
- `next.config.js` `headers()` sets the security headers for every route.
- Image and redirect allowlists configured; open redirects rejected.

## NestJS specifics

- Global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`.
- Guards for authentication and roles on every controller; `@Public()` explicit and rare.
- `helmet` and rate limiting (`@nestjs/throttler`) enabled in `main.ts`.
