# End-to-end tests with Playwright

## When

Only for journeys whose failure a customer would notice within an hour: authentication, the main creation flow, payment, anything with money or legal effect. Everything else is covered at a lower level.

## Layout

```
e2e/
├── playwright.config.ts
├── fixtures/
│   ├── auth.ts          # signs in a seeded test user via API, stores storageState
│   └── data.ts          # creates entities through the API, never through the UI
└── journeys/
    ├── signup.spec.ts
    └── checkout.spec.ts
```

## Rules

- Locate by role and accessible name (`getByRole('button', { name: 'Pay now' })`). No CSS selectors, no test ids unless the element has no accessible role (which is an accessibility finding).
- Never `waitForTimeout`. Use web-first assertions (`await expect(locator).toBeVisible()`), which retry until the condition holds.
- Seed state through the API or database in fixtures; the UI is exercised only for the journey under test.
- Each spec is independent and can run in parallel; unique data per test (suffix with `test.info().testId`).
- Run against a production-like build (`next build && next start`), not the dev server.
- Record trace on first retry (`trace: 'on-first-retry'`); keep retries at 1 in CI so flakiness stays visible.
- Tag accessibility checks with `@a11y` and run `@axe-core/playwright` inside the critical journeys.

## Skeleton

```ts
import { test, expect } from '../fixtures/auth'

test('customer pays an invoice with a saved card', async ({ page, api }) => {
  const invoice = await api.createInvoice({ amountCents: 4200 })
  await page.goto(`/invoices/${invoice.id}`)
  await page.getByRole('button', { name: 'Pay now' }).click()
  await page.getByRole('radio', { name: 'Visa ending 4242' }).check()
  await page.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(page.getByRole('status')).toHaveText('Paid')
  await expect(page.getByRole('heading', { name: 'Invoice paid' })).toBeVisible()
})
```

## Debugging a failure

1. Open the trace (`npx playwright show-trace trace.zip`).
2. Check whether the failure is timing (assert on state, not on time), data (seed collision) or a real regression.
3. Fix the cause; never add a retry or a sleep.
