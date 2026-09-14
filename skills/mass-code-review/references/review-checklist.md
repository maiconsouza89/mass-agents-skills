# Review checklist

Ordered by how often each item has caused incidents in Mass Solutions projects. Go top to bottom for every PR; skip items that cannot apply to the changed files.

## 1. Correctness and data

- Nullability: every `?.`, `!`, `as` and `?? default` in the diff. Does the default silently hide a bug?
- Error paths: what happens when the awaited call rejects? Is the error caught, logged with context, and turned into the right HTTP status or UI state?
- Async: missing `await`, promises created in loops without `Promise.all`, race conditions on shared state, unhandled rejections in event handlers.
- Boundaries: input validated at the edge (DTO, zod schema, form) before it reaches business logic? Output typed and serialised deliberately (dates, decimals, bigint)?
- Data migrations: reversible, idempotent, safe with the previous code version still running.
- Time and money: timezone-aware dates, integer cents or Decimal for currency, no float math on money.

## 2. Security

- Authorization checked on every new route, resolver or server action, not only authentication.
- No secrets, tokens or internal URLs in code, tests or fixtures.
- User input never reaches `dangerouslySetInnerHTML`, raw SQL, shell commands or file paths without sanitisation.
- New dependencies: known, maintained, licence compatible, pinned.

## 3. Tests

- Does a test fail without this change? If not, the behaviour is unprotected.
- Tests assert behaviour, not implementation (no asserting on mock call counts when the output can be checked).
- Edge cases from section 1 have a test each: empty, null, error, concurrency.
- Test names read as sentences describing the behaviour.

## 4. Design and TypeScript

- Follow `mass-typescript-conventions`: no `any`, discriminated unions over boolean flags, explicit return types on exported functions.
- New abstractions earn their place: three call sites or a clear boundary. Otherwise inline.
- Module boundaries respected (frontend does not import from server-only modules, domain does not import from infrastructure).
- Naming reveals intent; no `data`, `info`, `handle`, `util` names for new symbols.

## 5. Frontend specifics (React / Next.js)

- Server vs client component boundary is deliberate; no `use client` on components that only render.
- Effects: is `useEffect` needed, or is this derived state? Cleanup present for subscriptions and timers.
- Lists keyed by stable ids, not indexes.
- Loading, empty and error states exist for every async UI.
- Accessibility basics: labels on inputs, buttons for actions, links for navigation, focus visible.

## 6. Backend specifics (NestJS / Node)

- DTO validation with `class-validator` or zod on every controller input.
- Services do not depend on request objects; controllers stay thin.
- Database queries: N+1 in loops, missing indexes for new filters, transactions around multi-write operations.
- Logging includes correlation ids and never logs PII or secrets.

## 7. Performance

- Unbounded queries and lists (pagination present?).
- Expensive work inside render or inside hot loops.
- New client bundles: large libraries imported wholesale, images without `next/image`.

## 8. Operability

- Feature flag or safe rollout for risky behaviour changes.
- Observability: new failure modes emit a log or metric someone will see.
- Docs and changelog updated when public behaviour changes.
