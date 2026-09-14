# DTO validation

DTOs are the trust boundary. Everything from the network is validated and transformed before a service sees it.

## class-validator style (default in existing projects)

```ts
import { IsUUID, IsInt, Min, IsISO8601, IsOptional, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateInvoiceDto {
  @IsUUID()
  customerId!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number

  @IsISO8601()
  dueDate!: string

  @IsOptional()
  @MaxLength(500)
  notes?: string
}
```

Rules:

- Every property has at least one validator; unknown properties are rejected by the global pipe.
- Use `@Type` for numbers and dates that arrive as strings in query params.
- Query DTOs (`ListInvoicesQueryDto`) validate `page`, `pageSize` with bounds (`@Max(100)`).
- Response DTOs are plain classes or interfaces mapped explicitly in the controller; never return ORM entities.

## zod style (new projects)

```ts
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

export const CreateInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  amountCents: z.coerce.number().int().positive(),
  dueDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
})

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
```

Use `ZodValidationPipe` globally instead of `ValidationPipe`. Share schemas with the frontend package when both live in the same monorepo.

## Error envelope for validation failures

The exception filter maps validation errors to the standard shape from `mass-api-design`:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": [{ "field": "amountCents", "message": "must be a positive integer" }]
  }
}
```

## Checklist

- No `any` in DTOs; every field typed and decorated.
- Numbers and dates coerced explicitly.
- Optional fields marked `@IsOptional()` (or `.optional()`), never nullable by accident.
- Arrays validated with `@ValidateNested({ each: true })` plus `@Type`, or `z.array(...)`.
- Secrets never appear in DTO examples or Swagger docs.
