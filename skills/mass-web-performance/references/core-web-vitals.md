# Core Web Vitals reference

## Metrics and targets

| Metric | Measures | Good | Common causes at Mass Solutions projects |
|---|---|---|---|
| LCP (Largest Contentful Paint) | Time until the largest visible element renders | under 2.5 s | Hero image without `priority`, render-blocking fonts, client-side fetching for above-the-fold data, slow server response (TTFB over 800 ms) |
| INP (Interaction to Next Paint) | Latency of the slowest interaction | under 200 ms | Whole-page re-renders on input, synchronous heavy work in handlers, large DOM, third-party scripts on the main thread |
| CLS (Cumulative Layout Shift) | Unexpected movement of content | under 0.1 | Images without dimensions, fonts swapping without size-adjust, late-injected banners, ads or embeds |
| TTFB (Time to First Byte) | Server response time | under 800 ms | Uncached dynamic rendering, slow database queries, cold serverless functions |

## Diagnosis table

| Symptom | Look at | Likely fix |
|---|---|---|
| LCP element is an image | Network panel priority, `next/image` usage | `priority`, correct `sizes`, modern format via the loader, preconnect to the image host |
| LCP element is text | Font loading | `next/font`, `display: swap`, subset the font, preload |
| LCP waits on data | Where fetching happens | Move to server components; stream with `Suspense` for slow parts |
| INP high on typing | React Profiler flame chart | Debounce, memoise, split state so only the input re-renders |
| INP high on click | Long tasks in the Performance panel | Move work off the handler (`startTransition`, web worker), reduce DOM size |
| CLS from images | Elements without width/height | Always set dimensions or `aspect-ratio` |
| CLS from fonts | Fallback font metrics | `next/font` with `adjustFontFallback` |
| Large first load JS | Bundle analyzer | Dynamic imports, remove duplicate libraries, sub-path imports |

## Measurement methods

- Field: `web-vitals` library reporting to analytics, or Vercel Speed Insights. Use p75 over 28 days.
- Lab: Lighthouse with mobile preset and simulated throttling; run several times and take the median.
- Profiling: Chrome Performance panel for long tasks; React Profiler for render counts and durations.

## Budgets

Set in `lighthouserc.js`:

```js
module.exports = {
  ci: {
    collect: { url: ['http://localhost:3000/'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-byte-weight': ['warn', { maxNumericValue: 1_000_000 }],
        'unused-javascript': ['warn', { maxNumericValue: 150_000 }],
      },
    },
  },
}
```

## Quick wins checklist

- `next/image` with `sizes` for every content image; `priority` on the LCP image only.
- `next/font` for all fonts; no `@import` of Google Fonts in CSS.
- `next/script` with `strategy="lazyOnload"` or `afterInteractive` for analytics and chat widgets.
- Route-level code splitting: no shared "kitchen sink" component barrel imported everywhere.
- Server components for data-heavy views; client leaves for interaction.
- Virtualise long lists (`@tanstack/react-virtual`).
- Cache API responses appropriately (see `mass-nextjs-app-router`).
