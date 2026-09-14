# Module layout

```
src/
├── main.ts                          # bootstrap: global pipe, filter, config validation
├── app.module.ts
├── common/
│   ├── filters/domain-exception.filter.ts
│   ├── errors/domain.error.ts       # base DomainError { code, status }
│   └── config/config.schema.ts      # zod or Joi schema for env vars
└── invoices/
    ├── invoices.module.ts
    ├── invoices.controller.ts
    ├── invoices.service.ts
    ├── dto/
    │   ├── create-invoice.dto.ts
    │   ├── update-invoice.dto.ts
    │   └── invoice-response.dto.ts
    ├── domain/
    │   ├── invoice.entity.ts
    │   └── invoice.errors.ts        # InvoiceNotFoundError extends DomainError
    ├── repositories/
    │   ├── invoice.repository.ts    # interface + INVOICE_REPOSITORY token
    │   └── prisma-invoice.repository.ts
    └── __tests__/
        ├── invoices.service.spec.ts
        └── invoices.e2e-spec.ts
```

## Naming

| Thing | Convention | Example |
|---|---|---|
| Module folder | plural noun, kebab-case | `invoices/` |
| Class | PascalCase with role suffix | `InvoicesController`, `InvoicesService` |
| DTO | verb + noun + `Dto` | `CreateInvoiceDto` |
| Domain error | noun + condition + `Error` | `InvoiceNotFoundError` |
| Repository token | `UPPER_SNAKE` constant | `INVOICE_REPOSITORY` |
| Endpoint methods | verb describing the use case | `create`, `findById`, `markPaid` |

## Layer rules

| Layer | May import | Must not import |
|---|---|---|
| Controller | DTOs, service | repositories, ORM, other controllers |
| Service | domain, repository interfaces, other services via injection | HTTP classes, ORM clients |
| Domain | nothing from Nest or the ORM | anything outside `domain/` and shared types |
| Repository implementation | ORM client, domain | services, controllers |

## Bootstrap essentials (`main.ts`)

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
app.useGlobalFilters(new DomainExceptionFilter())
app.enableShutdownHooks()
```

## Cross-module communication

- Need data from another feature: inject its exported service.
- Need to react to something that happened: emit a domain event (`EventEmitter2` or the message broker), handle it in the other module.
- Two modules need each other: extract the shared concept into its own module; never use `forwardRef` as a permanent solution.
