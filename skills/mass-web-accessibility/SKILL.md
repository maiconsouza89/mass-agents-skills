---
name: mass-web-accessibility
description: Makes React and Next.js interfaces meet WCAG 2.2 AA by fixing semantics, keyboard navigation, focus management, forms, colour contrast and ARIA, and verifies with axe. Use when the user says "accessibility", "a11y", "screen reader", "keyboard navigation", "does not work with the keyboard", "add a11y tests", "WCAG", "audit this form" or "make this accessible". Do NOT use for general component structure (use mass-react-components), visual performance (use mass-web-performance) or SEO.
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: frontend
  tags: [accessibility, a11y, wcag, react]
  requires:
    tools: [npx]
---

# Mass Web Accessibility

Accessibility is a correctness requirement: if a user cannot complete the task with a keyboard and a screen reader, the feature is broken. Fix semantics first; ARIA is the last resort.

## Non-negotiables

- Native elements before ARIA: `<button>` for actions, `<a href>` for navigation, `<label>` for inputs, headings in order. A `<div onClick>` is a bug.
- Every interactive element is reachable and operable by keyboard, with a visible focus ring. Never `outline: none` without a replacement.
- Every image has `alt` (empty for decorative). Every icon-only button has an accessible name.
- Forms: each input has a label, errors are announced (`aria-describedby` plus `role="alert"` region), required fields are marked programmatically.
- Colour contrast at least 4.5:1 for text and 3:1 for large text and UI components. Never convey state by colour alone.
- Dialogs trap focus, restore it on close, and close on Escape. Use the project's dialog primitive; do not hand-roll one.
- Automated checks pass: `axe` reports zero violations in tests and the CI Lighthouse accessibility score does not drop.

## Workflow

### 1. Audit

Run the automated pass first, then the manual one. Read references/wcag-checklist.md and go through it for the screens in scope.

```bash
npx @axe-core/cli http://localhost:3000/route     # quick page audit
npx playwright test --grep @a11y                   # project a11y suite when it exists
```

Manual pass: unplug the mouse, Tab through the screen, operate every control, then repeat with VoiceOver or NVDA reading.

### 2. Fix by priority

1. Blockers: keyboard traps, missing names on controls, forms that cannot be submitted, dialogs that cannot be closed.
2. Semantics: wrong elements, heading order, landmark regions (`main`, `nav`, `header`, `footer`).
3. Announcements: live regions for async results, error messages linked to fields.
4. Visuals: contrast, focus styles, motion (`prefers-reduced-motion`), text resize to 200%.

### 3. Lock it in

Add an axe assertion to the component test (`expect(await axe(container)).toHaveNoViolations()` with `vitest-axe`), and a Playwright check for the flow when it is a critical path (login, checkout).

### 4. Verify

Re-run the automated pass and the keyboard walk. Record what was tested in the PR description.

## Examples

### Example: inaccessible form

User says: "Audit the signup form for accessibility."
Actions: 1. axe reports inputs without labels and low-contrast placeholder text. 2. Add `<label htmlFor>` for each input, move hints from placeholder to visible helper text linked with `aria-describedby`. 3. Wrap error summary in `role="alert"`, link each field error. 4. Confirm Tab order and Enter submits. 5. Add `vitest-axe` assertion to `SignupForm.test.tsx`.
Result: zero axe violations, keyboard-only signup works, test prevents regressions.

### Example: custom dropdown

User says: "Our dropdown does not work with the keyboard."
Actions: 1. Replace the hand-rolled dropdown with the project's headless primitive (Radix or React Aria) that implements the listbox pattern. 2. Keep the visual styles. 3. Verify Arrow keys, Home/End, type-ahead and Escape.
Result: WAI-ARIA compliant listbox with no custom keyboard code to maintain.

## Troubleshooting

### axe flags "elements must have sufficient color contrast" on disabled controls

Cause: disabled elements are exempt in WCAG but the rule still reports them when the disabled state is only visual.
Fix: use the real `disabled` attribute or `aria-disabled="true"`.

### Screen reader reads a button as "clickable"

Cause: a `div` or `span` with an onClick.
Fix: use `<button type="button">`; if styling is the obstacle, reset button styles in the design system.
