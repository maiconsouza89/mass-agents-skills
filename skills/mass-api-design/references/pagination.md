# Pagination, filtering and sorting

## Request

```
GET /v1/invoices?status=paid&customerId=cus_1&sort=-createdAt&limit=50&cursor=eyJpZCI6...
```

| Parameter | Rule |
|---|---|
| `limit` | Integer 1 to 100, default 25. Values above 100 return 400 `VALIDATION_FAILED`. |
| `cursor` | Opaque base64url string from a previous `pageInfo.nextCursor`. Never constructed by clients. |
| `sort` | Comma-separated fields, `-` prefix for descending. Only whitelisted fields; unknown field is a 400. Default `-createdAt`. |
| filters | One query parameter per field; enums for status-like fields; ranges as `createdAtFrom` / `createdAtTo` (ISO 8601). |

## Response

```json
{
  "data": [{ "id": "inv_1", "...": "..." }],
  "pageInfo": {
    "nextCursor": "eyJpZCI6...",
    "hasNextPage": true,
    "limit": 50
  }
}
```

- `data` is always an array, empty when nothing matches.
- `nextCursor` is `null` on the last page.
- No `totalCount` by default: counting is expensive and racy. Provide `GET /v1/invoices/count?status=paid` when a product screen truly needs it, and document its staleness.

## Cursor implementation

Encode the sort key plus the primary key of the last row, e.g. `{ "createdAt": "2026-09-14T10:00:00Z", "id": "inv_99" }`, base64url. Query with a keyset condition (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3 + 1`), fetch one extra row to compute `hasNextPage`.

Cursors are signed or at least versioned so a changed sort order rejects old cursors with `INVALID_CURSOR`.

## Filtering rules

- Whitelist filterable fields in the OpenAPI document; reject unknown query parameters with 400.
- Multi-value filters use repeated parameters (`status=paid&status=pending`), not comma lists.
- Free-text search is a dedicated `q` parameter with documented behaviour, never a wildcard on arbitrary fields.

## OpenAPI snippet

```yaml
components:
  parameters:
    Limit:
      name: limit
      in: query
      schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
    Cursor:
      name: cursor
      in: query
      schema: { type: string }
  schemas:
    PageInfo:
      type: object
      required: [nextCursor, hasNextPage, limit]
      properties:
        nextCursor: { type: string, nullable: true }
        hasNextPage: { type: boolean }
        limit: { type: integer }
```
