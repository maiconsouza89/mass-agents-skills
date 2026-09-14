---
name: mass-nestjs-modules
description: Creates and refactors NestJS modules following the Mass Solutions layout, with thin controllers, validated DTOs, application services, repositories behind interfaces, exception filters and dependency injection rules. Use when the user says "create a NestJS module", "add an endpoint in Nest", "new controller", "new service", "where does this logic go in Nest" or is working in a NestJS codebase. Do NOT use for REST contract decisions such as pagination or error envelope shape (use mass-api-design), TypeScript typing rules (use mass-typescript-conventions) or writing tests (use mass-testing-strategy).
license: MIT
compatibility: Targets NestJS 10 or newer with class-validator or zod for DTO validation.
metadata:
  owner: "@maiconsouza89"
  version: 1.0.0
  reviewed: 2026-09-14
  category: backend
  tags: [nestjs, backend, modules, dependency-injection]
  requires:
    skills: [mass-typescript-conventions, mass-api-design]
---

# Mass NestJS Modules

One module per bounded feature. Controllers translate HTTP into calls; services hold the use case; repositories hide persistence. Nothing skips a layer.

## Non-negotiables

- Layout per feature: `invoices/invoices.module.ts`, `invoices.controller.ts`, `invoices.service.ts`, `dto/`, `entities/` (or `domain/`), `repositories/`. Read references/module-layout.md for the full tree and naming.
- Controllers are thin: parse and validate input (DTO), call one service method, map the result to the response. No business rules, no direct repository calls.
- Every controller input is a DTO validated by the global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Read references/dto-validation.md when writing DTOs.
- Services depend on repository interfaces (`InvoiceRepository` token), not on TypeORM or Prisma directly, so they can be unit-tested with fakes.
- Expected failures are domain exceptions (`InvoiceNotFoundError`) mapped to HTTP by a single exception filter; services never throw `HttpException`.
- Modules export only what other modules need (usually the service). No circular module imports; use events or a shared module when two features need each other.
- Configuration comes through `ConfigService` with a validated schema at bootstrap, never from `process.env` inside services.

## Workflow

### 1. Scaffold

Start from `assets/module.template.ts` or the Nest CLI (`nest g module invoices && nest g controller invoices && nest g service invoices`), then move files into the layout from references/module-layout.md.

### 2. Define the contract

Write DTOs for each endpoint (`CreateInvoiceDto`, `InvoiceResponseDto`) and the domain types. Follow `mass-api-design` for URL, status codes and error envelope.

### 3. Implement inside out

1. Domain entity or type with invariants.
2. Repository interface plus one implementation (`PrismaInvoiceRepository`).
3. Service method per use case; transactions handled in the service through a `UnitOfWork` or the ORM transaction API.
4. Controller endpoint mapping DTO to service call.
5. Register providers in the module; bind the repository interface to the implementation with a token.

### 4. Test

Unit-test the service with an in-memory repository fake. Write one e2e test per endpoint with `@nestjs/testing` and `supertest` hitting the real validation pipe and filter. Follow `mass-testing-strategy` for layout.

### 5. Verify

```bash
npx nest build && npx jest --testPathPattern invoices
```

Hit the endpoint once with an invalid body and confirm a 400 with the standard error envelope.

## Examples

### Example: new feature module

User says: "Create an invoices module with create and get by id."
Actions: 1. Scaffold the tree. 2. `CreateInvoiceDto` with `class-validator` decorators, `InvoiceResponseDto`. 3. `Invoice` entity with `markPaid()` invariant. 4. `InvoiceRepository` interface and Prisma implementation. 5. `InvoicesService.create` and `findById` throwing `InvoiceNotFoundError`. 6. Controller with `POST /invoices` (201) and `GET /invoices/:id` (200/404). 7. Unit tests with a fake repository; e2e test for both endpoints.
Result: module registered in `AppModule`, tests green, 404 returns the standard error envelope.

### Example: fat controller

User says: "The orders controller has 300 lines of business logic."
Actions: 1. Identify use cases per endpoint. 2. Move each into an `OrdersService` method; move persistence into a repository. 3. Replace `throw new NotFoundException` with domain errors handled by the filter. 4. Add unit tests for the extracted service before deleting the old code paths.
Result: controller under 60 lines, service tested in isolation, same HTTP behaviour.

## Troubleshooting

### Nest cannot resolve dependencies of a provider

Cause: the provider's dependency is not exported by its module, or the injection token differs from the provided one.
Fix: export the provider from its module and import that module; for interface tokens use the same `Symbol` or string constant in `provide` and `@Inject()`.

### Validation pipe accepts unknown fields

Cause: `ValidationPipe` registered without `whitelist` and `forbidNonWhitelisted`.
Fix: register it globally in `main.ts` with both flags and `transform: true`.
