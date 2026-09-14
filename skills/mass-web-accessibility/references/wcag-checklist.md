# WCAG 2.2 AA checklist for React applications

Work through each section for every screen in scope. Success criteria numbers are given for reference.

## Perceivable

- 1.1.1 Non-text content: meaningful `alt` on images, `alt=""` on decorative ones, SVG icons `aria-hidden="true"` unless they carry meaning.
- 1.3.1 Info and relationships: headings in order (`h1` once per page, no skipped levels), lists as `ul`/`ol`, tables with `th` and `scope`, form groups with `fieldset`/`legend`.
- 1.3.2 Meaningful sequence: DOM order matches visual order; do not reorder with CSS in ways that break reading order.
- 1.3.5 Identify input purpose: `autocomplete` attributes on name, email, address, phone fields.
- 1.4.1 Use of colour: status shown with text or icon in addition to colour.
- 1.4.3 Contrast minimum: 4.5:1 for normal text, 3:1 for large text (24px or 19px bold).
- 1.4.4 Resize text: layout survives 200% zoom without loss of content.
- 1.4.10 Reflow: no horizontal scrolling at 320px width.
- 1.4.11 Non-text contrast: 3:1 for UI component boundaries and focus indicators.
- 1.4.12 Text spacing: content survives increased line-height and letter-spacing.
- 1.4.13 Content on hover or focus: tooltips are dismissible, hoverable and persistent.

## Operable

- 2.1.1 Keyboard: every function available via keyboard.
- 2.1.2 No keyboard trap: focus can always leave a component (modals excluded while open, but Escape closes them).
- 2.2.1 Timing adjustable: session timeouts warn and allow extension.
- 2.3.1 Three flashes: nothing flashes more than three times per second.
- 2.4.1 Bypass blocks: "Skip to content" link as the first focusable element.
- 2.4.2 Page titled: unique `<title>` per route (Next.js `metadata`).
- 2.4.3 Focus order: logical, follows reading order.
- 2.4.4 Link purpose: link text makes sense out of context ("View invoice 123", not "Click here").
- 2.4.6 Headings and labels: descriptive.
- 2.4.7 Focus visible: visible focus indicator on every focusable element.
- 2.4.11 Focus not obscured: sticky headers or footers do not hide the focused element.
- 2.5.3 Label in name: the accessible name contains the visible label text.
- 2.5.7 Dragging movements: drag-and-drop has a keyboard or button alternative.
- 2.5.8 Target size: interactive targets at least 24x24 CSS pixels.

## Understandable

- 3.1.1 Language of page: `<html lang="...">` set, per-route when the language changes.
- 3.2.1 On focus: focusing an element does not change context.
- 3.2.2 On input: changing a control does not submit or navigate without warning.
- 3.3.1 Error identification: errors described in text and associated with the field.
- 3.3.2 Labels or instructions: every input has a visible label; formats explained.
- 3.3.3 Error suggestion: tell the user how to fix it.
- 3.3.7 Redundant entry: do not ask for the same information twice in one flow.
- 3.3.8 Accessible authentication: no cognitive tests; allow paste and password managers.

## Robust

- 4.1.2 Name, role, value: custom widgets expose role, name and state through ARIA; prefer headless libraries that implement the WAI-ARIA patterns.
- 4.1.3 Status messages: async results (saved, loading, error counts) announced through `aria-live` or `role="status"`.

## React specifics

- Use `useId` for label/input associations.
- Manage focus after route changes and dialog open/close (`autoFocus` on the first meaningful element, restore focus on close).
- Announce route changes in single-page navigations with a live region when the framework does not.
- Respect `prefers-reduced-motion` in animations.

## Tooling

- `vitest-axe` (or `jest-axe`) in component tests.
- `@axe-core/playwright` in end-to-end tests for critical flows.
- Lighthouse accessibility score in CI as a regression guard, not as the definition of done.
