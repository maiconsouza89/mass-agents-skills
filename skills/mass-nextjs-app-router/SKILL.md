---
name: mass-nextjs-app-router
description: Guides Next.js App Router work at Mass Solutions, deciding between server and client components, route handlers, server actions, caching and revalidation, metadata and loading or error boundaries. Use when the user says "add a page", "add a route", "server component or client component", "the page shows old data after an update", "stale data after mutation", "set up caching" or is working inside a Next.js app directory. Do NOT use for generic React component structure (use mass-react-components), REST API contract design (use mass-api-design) or Core Web Vitals tuning (use mass-web-performance).
license: MIT
compatibility: Targets Next.js 15 or newer with the App Router.
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: frontend
  tags: [nextjs, app-router, server-components, caching]
  requires:
    skills: [mass-react-components]
---

# Mass Next.js App Router

Default to the server. Every component is a server component until it needs browser state, browser APIs or event handlers; then push `'use client'` to the smallest leaf that needs it.

## Non-negotiables

- `'use client'` goes on leaves, never on pages or layouts. Pass server-fetched data down as props.
- Data fetching happens in server components, route handlers or server actions. No `useEffect` plus `fetch` for initial data.
- Every `fetch` and every data access declares its caching intent explicitly: `cache: 'no-store'`, `next: { revalidate: N }` or `next: { tags: [...] }`. Read references/caching-and-revalidation.md before touching cache settings; guessing here is how stale data ships.
- Mutations use server actions with input validated by `zod` and end with `revalidatePath` or `revalidateTag`. Read references/server-actions.md when writing one.
- Each route segment that fetches has `loading.tsx` and `error.tsx`. Not-found states use `notFound()`.
- Metadata is defined with `export const metadata` or `generateMetadata`, never with manual `<head>` tags.
- Secrets and server-only modules import `server-only`; anything imported by a client component must be safe to ship to the browser.

## Workflow

### 1. Map the route

Decide the segment structure (`app/(dashboard)/invoices/[id]/page.tsx`), which layouts are shared, and where the data boundaries sit. Prefer route groups for layout sharing over deep nesting.

### 2. Split server and client

List the interactive pieces (forms, toggles, charts). Each becomes a client leaf receiving data through props. Everything else stays on the server.

### 3. Fetch and cache

Fetch in the page or a server component near where the data is used; parallelise independent fetches with `Promise.all`. Declare the caching strategy for each fetch using the decision table in references/caching-and-revalidation.md.

### 4. Mutate

Implement server actions in `actions.ts` next to the route, validate input, call the application service, revalidate, return a typed result (`{ ok: true } | { ok: false; error: string }`). Wire forms with `useActionState` for pending and error UI.

### 5. Verify

```bash
npx next build          # catches server/client boundary mistakes and missing metadata
npx next lint
```

Then load the route, mutate, and confirm the list reflects the change without a manual refresh.

## Examples

### Example: new list page with a create form

User says: "Add an invoices page with a form to create an invoice."
Actions: 1. `app/(dashboard)/invoices/page.tsx` as a server component fetching invoices with `next: { tags: ['invoices'] }`. 2. `InvoiceForm.tsx` as a client leaf using `useActionState`. 3. `actions.ts` with `createInvoice` validating via `zod`, calling the service, `revalidateTag('invoices')`. 4. `loading.tsx` with a skeleton, `error.tsx` with a retry button. 5. `generateMetadata` with the page title.
Result: server-rendered list, form works without JavaScript, list updates after submit.

### Example: stale data after mutation

User says: "After I update a customer the detail page still shows the old name."
Actions: 1. Find the fetch: it has no cache option, so it is cached by default. 2. Tag it `next: { tags: [`customer-${id}`] }`. 3. In the update action call `revalidateTag(`customer-${id}`)`. 4. Verify in the browser.
Result: fresh data after the mutation without disabling caching globally.

## Troubleshooting

### "You're importing a component that needs useState" error

Cause: a hook used in a server component, or a client component imported into a server file without `'use client'` at the leaf.
Fix: add `'use client'` to the leaf component file only.

### Server action returns but the UI does not update

Cause: missing `revalidatePath` or `revalidateTag`, or the fetch is cached under a different tag.
Fix: align the tag on the fetch and the revalidation call; check the decision table in references/caching-and-revalidation.md.

### Environment variable is undefined in the browser

Cause: variable not prefixed `NEXT_PUBLIC_`, or it is a secret that must stay on the server.
Fix: keep secrets server-side behind a server action or route handler; only expose non-secret values with the prefix.
