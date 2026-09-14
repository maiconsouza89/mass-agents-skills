# Component patterns

Pick the simplest pattern that fits. Escalate only when the simpler one starts leaking.

## 1. Presentational component (default)

Pure function of props. No data fetching, no global state. Most components should be this.

```tsx
export interface PriceTagProps {
  amountCents: number
  currency: string
}

export function PriceTag({ amountCents, currency }: PriceTagProps) {
  return <span className={styles.price}>{formatMoney(amountCents, currency)}</span>
}
```

## 2. Custom hook for behaviour

When logic exceeds a few lines or is reused, move it into a hook and keep the component declarative.

```tsx
function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    const id = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  return remaining
}
```

Rules: hooks return plain values and callbacks, never JSX. Name them `useThing`. Test them with `renderHook`.

## 3. Composition with slots

Replace configuration props with rendered children.

```tsx
// Instead of <Card title="X" showFooter footerText="Y" />
<Card>
  <Card.Header>X</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>Y</Card.Footer>
</Card>
```

Use when a component keeps growing boolean props, or when consumers need to control layout of parts.

## 4. Compound components with context

For parts that must coordinate (tabs, accordions, selects): the parent holds state in a context, children read it.

```tsx
const TabsContext = createContext<{ active: string; setActive: (id: string) => void } | null>(null)

export function Tabs({ defaultTab, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab)
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>
}

Tabs.Tab = function Tab({ id, children }: TabProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs.Tab must be used inside Tabs')
  return <button role="tab" aria-selected={ctx.active === id} onClick={() => ctx.setActive(id)}>{children}</button>
}
```

## 5. Container at the edge

Data fetching and mutations happen in a page, a route loader, a server component, or a thin container that renders a presentational component. Containers have no styling and little markup.

## Deciding where state lives

| Question | Answer |
|---|---|
| Only this component reads and writes it? | `useState` here |
| Two siblings need it? | Lift to the parent |
| Needed across routes or deep trees, rarely changes? | Context (auth, theme, feature flags) |
| Server data? | Query cache (TanStack Query) or server components; never copied into `useState` |
| URL-addressable (filters, pagination, selected tab)? | URL search params |
| Form state? | The form library the project already uses, uncontrolled where possible |

## Anti-patterns

- `useEffect` that sets state from props: derive it instead.
- Passing `setState` down more than one level: pass an intent callback (`onSelect`) instead.
- Index as key on lists that reorder or delete.
- Components that accept both `children` and `render` props for the same slot.
- Global stores for local UI state (open/closed, hovered).
