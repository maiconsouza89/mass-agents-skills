---
name: mass-react-components
description: Structures React components the Mass Solutions way, covering file layout, props typing, hooks rules, state placement, composition over configuration and colocated tests. Use when the user says "create a component", "split this component", "refactor this React code", "where should this state live" or is adding UI in a React or Next.js project. Do NOT use for Next.js routing, caching or server components (use mass-nextjs-app-router), accessibility audits (use mass-web-accessibility) or performance profiling (use mass-web-performance).
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: frontend
  tags: [react, components, hooks, frontend]
  requires:
    skills: [mass-typescript-conventions]
---

# Mass React Components

Build components that are small, typed, composable and boring to test. A component does one visual job; behaviour lives in hooks; data fetching lives at the edge.

## Non-negotiables

- One component per file, named export, file name equals component name (`InvoiceRow.tsx`). Colocate `InvoiceRow.test.tsx` and, when needed, `InvoiceRow.module.css`.
- Props are an explicit `interface InvoiceRowProps`; no `React.FC`, no spreading unknown props into DOM elements.
- Derive, do not store: if a value can be computed from props or other state, compute it in render (memoise only when measured).
- `useEffect` is for synchronising with external systems (subscriptions, DOM APIs, timers). It is not for transforming data or reacting to state changes.
- State lives at the lowest common owner. Lift only when two siblings need it; reach for context only for truly global concerns (auth, theme, i18n).
- Compose with children and slots (`<Card header={...}>`) instead of boolean prop explosions (`isCompact`, `hasBorder`, `showFooter`).
- Server data goes through the project's data layer (TanStack Query or Next.js server components), never `fetch` inside a component.

## Workflow

### 1. Name the responsibility

Write one sentence: "This component renders X given Y." If the sentence needs "and", split the component. Read references/component-patterns.md when choosing between container/presentational, compound components, render slots or a custom hook.

### 2. Design the props

- Required props first, optional last, callbacks prefixed `on` (`onSelect`), booleans prefixed `is`/`has`/`can`.
- Accept the minimum: pass `invoice` not `invoices` plus `index`.
- Never accept `className` and `style` unless the component is a layout primitive.

### 3. Write it

Start from `assets/Component.template.tsx`. Keep JSX flat: extract sub-components before the third level of nesting. Move any logic longer than five lines into a `useInvoiceRow()` hook in the same file or a `hooks/` sibling.

### 4. Test behaviour

Use Testing Library: render, interact through roles and labels, assert on what the user sees. No snapshot tests, no testing of internal state. Follow `mass-testing-strategy` for file layout and naming.

### 5. Verify

```bash
npx tsc --noEmit && npx eslint src --max-warnings 0 && npx vitest run <ComponentName>
```

## Examples

### Example: new component

User says: "Create a component that shows an invoice line with amount and a pay button."
Actions: 1. Sentence: "Renders one invoice line with its amount and a pay action." 2. Props: `invoice: Invoice`, `onPay: (id: InvoiceId) => void`, `isPaying?: boolean`. 3. Copy the template, render amount with the shared `formatMoney`, disable the button while `isPaying`. 4. Test: renders amount, calls `onPay` with the id, disables while paying.
Result: `InvoiceRow.tsx` and `InvoiceRow.test.tsx`, both green.

### Example: oversized component

User says: "OrderPage.tsx is 600 lines, split it."
Actions: 1. List the responsibilities (fetching, filters, table, totals, modal). 2. Move fetching to the page/loader, filters into `OrderFilters`, table into `OrderTable` with `OrderRow`, totals into `OrderSummary`, modal into `OrderDetailsDialog`. 3. Extract `useOrderFilters()` for the filter state. 4. Keep `OrderPage` as composition only.
Result: five focused files, each under 150 lines, existing tests still passing plus new tests for the extracted hook.

## Troubleshooting

### Effect runs twice or loops

Cause: effect depends on an object recreated each render, or sets state it also reads.
Fix: derive the value instead, or move the object creation into `useMemo` only if it is an external-sync dependency.

### Prop drilling three levels deep

Cause: state lifted too high.
Fix: move state down to the lowest common owner, or use composition (pass the rendered child instead of the data).
