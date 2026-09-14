# Error envelope

Every non-2xx JSON response uses this exact shape.

```json
{
  "error": {
    "code": "INVOICE_NOT_FOUND",
    "message": "Invoice inv_123 was not found.",
    "details": [
      { "field": "amountCents", "message": "must be a positive integer" }
    ],
    "requestId": "req_8f3a...",
    "docs": "https://docs.mass.example/errors#INVOICE_NOT_FOUND"
  }
}
```

| Field | Required | Rule |
|---|---|---|
| `code` | yes | `UPPER_SNAKE_CASE`, stable, machine-readable; clients branch on it |
| `message` | yes | Human-readable, safe to show to end users, no stack traces or SQL |
| `details` | no | List of `{ field?, message, code? }`; used for validation errors |
| `requestId` | yes | Correlation id from the request logger, so support can find the trace |
| `docs` | no | Link to the error catalogue entry |

## Standard codes

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body or query failed schema validation; `details` lists fields |
| 400 | `INVALID_CURSOR` | Pagination cursor cannot be decoded |
| 401 | `UNAUTHENTICATED` | Missing or invalid credentials |
| 403 | `FORBIDDEN` | Authenticated but not allowed |
| 404 | `<RESOURCE>_NOT_FOUND` | Resource does not exist or is not visible to the caller |
| 409 | `<RESOURCE>_CONFLICT` | Uniqueness or version conflict (optimistic locking) |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key with a different payload |
| 422 | `<RULE>_VIOLATED` | Business rule failed, e.g. `INVOICE_ALREADY_PAID` |
| 429 | `RATE_LIMITED` | Include `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Never expose the cause; log it with the requestId |

## Rules

- Never return a bare string or an array as an error body.
- 404 for resources the caller may not know exist (do not leak existence with 403).
- Validation errors list every failing field in one response, not one at a time.
- `message` is stable enough for clients to display but never something they should parse.
- Log the full error server-side with `requestId`; the client gets the envelope only.

## OpenAPI component

```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, requestId]
          properties:
            code: { type: string, example: VALIDATION_FAILED }
            message: { type: string }
            requestId: { type: string }
            docs: { type: string, format: uri }
            details:
              type: array
              items:
                type: object
                required: [message]
                properties:
                  field: { type: string }
                  message: { type: string }
                  code: { type: string }
```
