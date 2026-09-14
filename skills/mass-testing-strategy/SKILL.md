---
name: mass-testing-strategy
description: Writes and organises tests for TypeScript, React, Next.js and NestJS projects using the Mass Solutions test pyramid, with Vitest or Jest for unit and integration tests, Testing Library for components and Playwright for end-to-end flows. Use when the user says "write tests", "add tests", "add unit tests", "test coverage", "how should I test this", "add an e2e test" or "the tests are flaky". Do NOT use for reviewing a PR (use mass-code-review), accessibility-only checks (use mass-web-accessibility) or performance measurement (use mass-web-performance).
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: quality
  tags: [testing, vitest, playwright, testing-library]
---

# Mass Testing Strategy

Tests exist to fail when behaviour breaks and to stay green when implementation changes. Test through public interfaces, name tests as sentences, and keep the pyramid shape: many unit, some integration, few end-to-end.

## Non-negotiables

- Every bug fix ships with a test that fails before the fix. Every new behaviour ships with a test that describes it.
- Test names are sentences: `it('rejects an invoice with a zero amount')`. No `test1`, no `works`.
- Assert on outcomes, not on implementation: outputs, rendered text, HTTP responses, database rows. Mock call counts only when the call is the behaviour (an email sent, a webhook fired).
- Mock at the boundary only: network, clock, randomness, third-party SDKs. Never mock the module under test's own collaborators inside the same package; use fakes through interfaces instead.
- No shared mutable state between tests; each test builds its own fixtures with factories.
- Flaky tests are fixed or deleted the same day, never retried into green.
- Layout: colocated `*.test.ts(x)` for unit and component tests; `tests/integration/` for tests that touch a database or HTTP server; `e2e/` for Playwright. Read references/unit-vs-integration.md when unsure which level a test belongs to.

## Workflow

### 1. Choose the level

Use the decision table in references/unit-vs-integration.md. Default to the lowest level that can observe the behaviour. Reserve end-to-end for critical user journeys (signup, checkout, payment) and read references/e2e-playwright.md before writing one.

### 2. Write the test first when fixing a bug

Reproduce with a failing test, then fix. Paste the failing assertion in the PR description.

### 3. Structure each test

Arrange with factories (`buildInvoice({ status: 'paid' })`), act through the public API, assert one behaviour per test. Prefer `it.each` for input tables over copy-pasted tests.

### 4. Components

Render with Testing Library, query by role and accessible name, interact with `userEvent`, assert what the user sees. No snapshots, no `container.querySelector` unless there is no accessible alternative (which is itself a finding for `mass-web-accessibility`).

### 5. Backend

Unit-test services with in-memory repository fakes. Integration-test repositories against a real database in a container (Testcontainers) or the project's test database, wrapped in a transaction rolled back per test. Contract-test controllers with `supertest` through the real validation and error handling.

### 6. Verify

```bash
npx vitest run --coverage        # or npx jest --coverage
npx playwright test              # only when e2e files changed
```

Coverage is a smell detector, not a target: look for untested branches in the diff, not for a percentage.

## Examples

### Example: tests for a service

User says: "Write unit tests for the checkout service."
Actions: 1. Read the service's public methods and the domain rules. 2. Create `checkout.service.test.ts` next to it with an in-memory `OrderRepository` fake and a fixed clock. 3. One `describe` per method, tests named as sentences: creates an order with computed totals, rejects an empty cart, applies a coupon once, emits `OrderPlaced`. 4. `it.each` for the tax table.
Result: focused tests that run in milliseconds and read as a specification.

### Example: flaky end-to-end test

User says: "The checkout e2e test fails randomly in CI."
Actions: 1. Read the failure: it clicks before the button is enabled. 2. Replace `waitForTimeout` with role-based locators and `expect(locator).toBeEnabled()`. 3. Seed test data through the API in `beforeEach` instead of the UI. 4. Run it 20 times locally with `--repeat-each 20`.
Result: deterministic test, no retries configured.

## Troubleshooting

### Tests pass alone but fail together

Cause: shared state (module-level variables, a shared database row, a global mock not reset).
Fix: isolate fixtures per test, `vi.restoreAllMocks()` in `afterEach`, transactions per test for the database.

### Component test cannot find the element

Cause: querying by text that is split across elements, or the element has no accessible role.
Fix: query by role and name; if there is no role, fix the markup rather than the test.
