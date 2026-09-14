# Caching and revalidation

Next.js caches at several layers. Declare intent on every fetch; never rely on the default.

## Decision table

| Data | Strategy | Code |
|---|---|---|
| Public, rarely changes (marketing, docs) | Static, rebuild on deploy | `fetch(url)` with `export const dynamic = 'force-static'` on the route |
| Public, changes on a schedule (prices, listings) | Time-based revalidation | `fetch(url, { next: { revalidate: 300 } })` |
| Changes after a known mutation (CRUD entities) | Tag-based revalidation | `fetch(url, { next: { tags: ['invoices'] } })` + `revalidateTag('invoices')` in the action |
| Per user, must be fresh (account, cart, permissions) | No caching | `fetch(url, { cache: 'no-store' })` or `export const dynamic = 'force-dynamic'` |
| Database queries via an ORM (no fetch) | Use `unstable_cache` with tags, or mark the route dynamic | `unstable_cache(() => db.invoice.findMany(), ['invoices'], { tags: ['invoices'] })` |

## Tag naming

- Collection: plural noun, `invoices`.
- Single entity: `invoice-${id}`.
- Revalidate both when an entity changes: the list and the detail.

## Route segment config

```ts
export const dynamic = 'force-dynamic'   // never cache this route
export const revalidate = 60             // ISR for every fetch without its own setting
export const runtime = 'nodejs'          // default; 'edge' only for tiny latency-sensitive handlers
```

Set these only at the route level where they apply; do not scatter them in layouts.

## Router cache (client side)

Navigating back to a route can show the client router cache. After a mutation, call `router.refresh()` from the client only when a server action with `revalidatePath` is not possible. Prefer server actions.

## Checklist before merging cache changes

- Every `fetch` in the diff has an explicit cache option.
- Every mutation revalidates the tags of the data it changes.
- Per-user data is never cached at build time.
- `next build` output shows the route as static or dynamic as intended (check the route table in the build log).
