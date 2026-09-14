# Choosing the test level

| Behaviour to protect | Level | Tooling | Location |
|---|---|---|---|
| Pure function, domain rule, reducer, formatter | Unit | Vitest or Jest | colocated `x.test.ts` |
| Service with collaborators behind interfaces | Unit with fakes | Vitest or Jest | colocated |
| React component rendering and interaction | Component | Testing Library + `userEvent` | colocated `X.test.tsx` |
| Custom hook | Component | `renderHook` | colocated |
| Repository or query | Integration | real database (Testcontainers), transaction per test | `tests/integration/` |
| HTTP endpoint: validation, status, envelope | Integration (contract) | `supertest` against the Nest app or Next route handler | `tests/integration/` |
| Server action or route handler with auth | Integration | app test harness with a signed-in test user | `tests/integration/` |
| Critical user journey across pages | End-to-end | Playwright against a running app | `e2e/` |
| Third-party API client | Unit with recorded responses | `msw` or fixture files; one smoke test against a sandbox, tagged and excluded from the default run | colocated + `tests/smoke/` |

## Rules of thumb

- If the test needs the network, a database or a browser, it is not a unit test; put it where CI can run it with the right infrastructure.
- If the test needs more than three mocks, the code has a design problem; introduce an interface and a fake.
- If two tests at different levels assert the same thing, keep the lower one.
- End-to-end tests count: aim for under ten per application, each covering a journey a customer would notice breaking.

## Fakes over mocks

```ts
class InMemoryInvoiceRepository implements InvoiceRepository {
  readonly items = new Map<string, Invoice>()
  async findById(id: string) { return this.items.get(id) ?? null }
  async save(invoice: Invoice) { this.items.set(invoice.id, invoice) }
}
```

A fake behaves like the real thing for the purposes of the test and can be reused across tests. A mock (`vi.fn()`) records calls and returns canned values; use it only for boundaries where the call itself is the behaviour.

## Factories

```ts
export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return { id: 'inv_test', customerId: 'cus_test', amountCents: 1000, status: 'pending', createdAt: new Date('2026-01-01T00:00:00Z'), ...overrides }
}
```

One factory per aggregate in `tests/factories/`. Defaults are valid; tests override only what matters to them.

## Time and randomness

Inject a `Clock` and an `IdGenerator` into services; tests pass fixed implementations. Use `vi.useFakeTimers()` only for code that genuinely schedules timers.
