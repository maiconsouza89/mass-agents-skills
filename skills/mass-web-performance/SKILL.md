---
name: mass-web-performance
description: Measures and improves web performance in React and Next.js applications, targeting Core Web Vitals (LCP, INP, CLS), bundle size, render performance and image or font loading, always with before and after numbers. Use when the user says "the page is slow", "improve performance", "LCP", "INP", "bundle size", "Lighthouse score" or "why does this re-render". Do NOT use for backend query performance without a UI symptom, component structure (use mass-react-components) or caching semantics in the App Router (use mass-nextjs-app-router).
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: performance
  tags: [performance, core-web-vitals, lighthouse, bundle]
  requires:
    tools: [npx]
---

# Mass Web Performance

Measure, change one thing, measure again. A performance claim without a before and after number is an opinion.

## Non-negotiables

- Targets on a mid-range mobile device over simulated 4G: LCP under 2.5 s, INP under 200 ms, CLS under 0.1, initial JavaScript under 200 KB compressed per route. Read references/core-web-vitals.md for how each metric is measured and the usual culprits.
- Every PR that claims a performance improvement includes the measurement method and the numbers, before and after.
- Images go through `next/image` with explicit sizes; fonts through `next/font` with `display: swap`; third-party scripts through `next/script` with a non-blocking strategy.
- No new dependency over 20 KB compressed in a client bundle without a bundle analysis attached.
- Client components stay leaves; heavy or rarely used UI is code-split with `next/dynamic`.
- Lists longer than a couple hundred rows are virtualised; expensive derived values are memoised only after profiling shows they matter.

## Workflow

### 1. Measure

```bash
npx lighthouse http://localhost:3000/route --preset=desktop --only-categories=performance --output=json --output-path=./before.json
ANALYZE=true npx next build                     # with @next/bundle-analyzer configured
```

Use field data first when available (Vercel Speed Insights, web-vitals reporting); lab data second. Record LCP element, INP interaction and CLS sources, not just scores.

### 2. Diagnose

Match the symptom to the table in references/core-web-vitals.md. For INP and re-render problems, use the React Profiler to find components rendering without prop changes. For bundle size, read the analyzer treemap and list the top five modules.

### 3. Fix one thing

Apply the smallest change that addresses the diagnosed cause: split a bundle, defer a script, size an image, move fetching to the server, memoise a hot path, virtualise a list.

### 4. Measure again

Repeat step 1 with the same method. Keep the change only if the target metric improved without regressing the others.

### 5. Guard

Add a budget: `lighthouse-ci` assertion or a bundle size check in CI so the gain survives the next feature.

## Examples

### Example: slow landing page

User says: "The landing page has an LCP of 4.8 seconds."
Actions: 1. Lighthouse: LCP element is the hero image, loaded from a CMS at full size, no priority. 2. Switch to `next/image` with `priority`, `sizes` and the CMS loader. 3. Preconnect to the CMS host. 4. Re-measure: LCP 1.9 s.
Result: one change, numbers in the PR, budget added with lighthouse-ci.

### Example: laggy input

User says: "Typing in the search box lags."
Actions: 1. INP shows 450 ms on keypress. 2. Profiler: the whole results table re-renders on each keystroke because the filter runs in the parent. 3. Debounce the query, memoise the filtered list, move the table behind `React.memo` with stable props. 4. Re-measure: INP 80 ms.
Result: responsive input, profiler screenshots before and after in the PR.

## Troubleshooting

### Lighthouse scores vary between runs

Cause: local machine noise.
Fix: run 3 to 5 times and compare medians, or use the CI runner with fixed throttling. Report the median.

### Bundle analyzer shows a large library used in one place

Cause: static import at the top of a shared module.
Fix: `next/dynamic` or a lazy `import()` at the usage site; confirm the library supports tree-shaking or import the sub-path.
