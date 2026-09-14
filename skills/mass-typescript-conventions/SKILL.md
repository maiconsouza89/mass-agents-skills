---
name: mass-typescript-conventions
description: Applies the Mass Solutions TypeScript conventions (strict compiler options, no any, discriminated unions, typed errors, naming and module boundaries) when writing or refactoring TypeScript. Use when the user says "follow our TypeScript conventions", "type this properly", "remove the any", "make this strict", "set up tsconfig and eslint" or is writing new TypeScript in a Mass Solutions project. Do NOT use for React component structure (use mass-react-components), NestJS module layout (use mass-nestjs-modules) or reviewing a PR (use mass-code-review).
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: language
  tags: [typescript, conventions, strict, types]
---

# Mass TypeScript Conventions

Write TypeScript that the compiler can defend. The type system is the first test suite: if a wrong state is representable, the code is not done.

## Non-negotiables

- `strict: true` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Copy `assets/tsconfig.base.json` into new projects and extend it; do not loosen it per package.
- No `any`. Use `unknown` at the boundary and narrow. `as` casts need a one-line comment saying why the type system cannot prove it.
- No non-null assertions (`!`) outside tests. Handle the null case or restructure so it cannot occur.
- Model state with discriminated unions (`{ status: 'loading' } | { status: 'error'; error: AppError } | { status: 'ready'; data: T }`), never with parallel booleans.
- Errors are typed values. Domain errors extend a base `AppError` with a `code` union; unexpected errors are rethrown, not swallowed.
- Exported functions declare their return type. Internal helpers may infer.
- Module boundaries: `domain` never imports from `infra` or `ui`; `ui` never imports from `infra` directly. Enforce with the ESLint rules in references/eslint-baseline.md.

## Workflow

### 1. Configure

For a new package, copy `assets/tsconfig.base.json` to the repo root and create a package `tsconfig.json` that extends it. Read references/eslint-baseline.md and apply the ESLint rules there when the project has no lint config yet.

### 2. Type the boundaries first

Before writing logic, define the input and output types: request DTOs, database rows, API responses, component props. Validate untrusted input at runtime with `zod` (or `class-validator` in NestJS) and derive the static type from the schema (`z.infer`) so they never drift.

### 3. Write the logic

- Prefer `readonly` arrays and objects for anything crossing a function boundary.
- Use `satisfies` to check object literals against a type without widening.
- Narrow with type guards (`function isPaid(o: Order): o is PaidOrder`) instead of casting.
- Exhaustive switches end with `default: assertNever(value)`.
- Async functions return `Promise<Result>`; do not mix callbacks and promises.
- Name by role and unit: `retryDelayMs`, `customerIds`, `isActive`, `parseInvoice`. Avoid `data`, `info`, `handle`, `util`, `helper`.

### 4. Verify

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
```

Both must be clean before the task is done. Never fix a type error with `any`, `@ts-ignore` or `@ts-expect-error` unless the comment explains a compiler limitation and links an issue.

## Examples

### Example: removing any from an API client

User says: "This fetch wrapper returns any, type it properly."
Actions: 1. Define a `zod` schema for the response. 2. Change the wrapper to `async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T>` that parses with `schema.parse`. 3. Replace call sites, deleting downstream casts. 4. Run `tsc --noEmit`.
Result: no `any`, runtime validation at the boundary, call sites typed by inference.

### Example: booleans to a union

User says: "The order has isPaid, isShipped and isCancelled flags and it is a mess."
Actions: 1. Introduce `type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled'`. 2. Replace the flags with `status`. 3. Convert `if` chains into an exhaustive `switch` with `assertNever`. 4. Add a migration note if the shape is persisted.
Result: impossible states are unrepresentable and every consumer handles every status.

## Troubleshooting

### exactOptionalPropertyTypes breaks existing code

Cause: code assigns `undefined` to optional properties.
Fix: declare `prop?: string | undefined` where undefined is a real value, or omit the key. Do not disable the option.

### A third-party library has poor types

Cause: missing or `any`-heavy declarations.
Fix: write a narrow wrapper module with the types you need and cast once inside it, with a comment. Never let the library's `any` leak past the wrapper.
