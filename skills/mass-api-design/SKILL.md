---
name: mass-api-design
description: Designs HTTP APIs to the Mass Solutions REST conventions, covering resource naming, status codes, the standard error envelope, pagination, filtering, versioning, idempotency and OpenAPI documentation. Use when the user says "design the API", "REST endpoint", "what should the response look like", "pagination", "error format", "standardize our error responses", "API versioning" or is defining a new HTTP contract. Do NOT use for NestJS file layout or dependency injection (use mass-nestjs-modules), Next.js route handlers as UI glue (use mass-nextjs-app-router) or GraphQL schemas.
license: MIT
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: backend
  tags: [api, rest, http, openapi, pagination]
---

# Mass API Design

An API is a promise to other teams. Design the contract first, document it in OpenAPI, then implement. Consistency across services matters more than local elegance.

## Non-negotiables

- Resources are plural nouns in kebab-case: `/invoices`, `/invoices/{invoiceId}/line-items`. No verbs in paths except for explicit actions modelled as sub-resources (`POST /invoices/{id}/payments`).
- Status codes carry meaning: 200 read or update, 201 create (with `Location`), 204 delete or empty success, 400 validation, 401 unauthenticated, 403 unauthorised, 404 missing, 409 conflict, 422 semantic rule violation, 429 rate limited, 500 only for bugs.
- One error envelope everywhere. Read references/error-format.md and copy the shape exactly; do not invent per-service variants.
- Collections are paginated from day one with cursor pagination. Read references/pagination.md for the request and response contract.
- JSON field names are `camelCase`; timestamps are ISO 8601 UTC strings; money is `{ amountCents: number, currency: string }`; ids are opaque strings.
- Breaking changes require a new major version in the path (`/v2/`). Additive changes (new optional fields) ship in place.
- Unsafe operations that clients may retry accept an `Idempotency-Key` header and return the original result on replay.
- Every endpoint is described in the OpenAPI document (decorators in NestJS, or a hand-written `openapi.yaml`) before it merges.

## Workflow

### 1. Model the resources

List nouns and their relationships. Decide ownership: which service is the source of truth. Draw the URL tree; nested no deeper than two levels.

### 2. Define each operation

For every endpoint write: method and path, auth requirement, request body or query schema, success status and response schema, error cases with codes from references/error-format.md, idempotency, rate limits.

### 3. Write the OpenAPI first

Produce the schema (`components/schemas`) and paths. Review it with the consuming team before implementation; changes are cheap here.

### 4. Implement and test the contract

Implement following the framework skill (`mass-nestjs-modules` or route handlers). Add contract tests that assert status codes, envelope shape and pagination fields for at least the happy path, a validation failure and a not-found.

### 5. Verify

```bash
npx @redocly/cli lint openapi.yaml       # or the project's swagger generation command
```

Confirm every path in the document has a test and every test response validates against the schema.

## Examples

### Example: new collection endpoint

User says: "Design the invoices list endpoint with filters."
Actions: 1. `GET /v1/invoices?status=paid&customerId=...&cursor=...&limit=50`. 2. Response `{ data: Invoice[], pageInfo: { nextCursor, hasNextPage } }` per references/pagination.md. 3. Filters documented as query parameters with enums. 4. 400 for an invalid cursor with code `INVALID_CURSOR`. 5. OpenAPI paths and schemas written; contract tests added.
Result: a documented, paginated, filterable endpoint consistent with every other list in the platform.

### Example: inconsistent errors across services

User says: "Every service returns errors differently; fix ours."
Actions: 1. Adopt the envelope from references/error-format.md. 2. Implement a single exception filter or middleware that maps domain errors and validation errors to it. 3. Update OpenAPI `components/responses`. 4. Add tests for 400, 404 and 409 shapes.
Result: one error shape, clients can handle errors generically.

## Troubleshooting

### Client needs an operation that is not CRUD

Cause: trying to force a verb into a resource.
Fix: model it as an action sub-resource (`POST /orders/{id}/cancellations`) or a state transition via `PATCH` with a validated `status` field. Document which one the platform uses; do not mix.

### Offset pagination requested "because it is simpler"

Cause: consumer wants page numbers.
Fix: cursor pagination is the standard for correctness under concurrent writes; offer `page`-style UX on the client by keeping a cursor stack. Offset is allowed only for admin tools with small tables, documented as such.
