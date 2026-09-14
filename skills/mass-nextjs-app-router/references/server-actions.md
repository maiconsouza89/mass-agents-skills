# Server actions

Server actions are the mutation path for App Router projects. They run on the server, are called from forms or event handlers, and are the only place that should call `revalidateTag` or `revalidatePath`.

## Template

```ts
// app/(dashboard)/invoices/actions.ts
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { invoiceService } from '@/application/invoices'

const CreateInvoiceInput = z.object({
  customerId: z.string().uuid(),
  amountCents: z.coerce.number().int().positive(),
  dueDate: z.coerce.date(),
})

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createInvoice(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = CreateInvoiceInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    await invoiceService.create({ ...parsed.data, createdBy: user.id })
  } catch (error) {
    return { ok: false, error: toUserMessage(error) }
  }
  revalidateTag('invoices')
  return { ok: true }
}
```

## Form wiring

```tsx
'use client'

import { useActionState } from 'react'
import { createInvoice, type ActionResult } from './actions'

export function InvoiceForm() {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(createInvoice, null)
  return (
    <form action={action}>
      <label>Amount <input name="amountCents" type="number" required aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.amountCents)} /></label>
      {state && !state.ok && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={isPending}>{isPending ? 'Saving' : 'Create invoice'}</button>
    </form>
  )
}
```

## Rules

- Authenticate and authorise inside the action; the client is untrusted even when the form is hidden.
- Validate with `zod`; never trust `FormData` shapes.
- Return typed results; never throw for expected failures (validation, permissions).
- Redirect with `redirect()` after successful creates when the UX calls for it; it must be called outside `try/catch`.
- Keep actions thin: parse, authorise, call the application service, revalidate.
- One action per mutation; do not build a generic `dispatch(type, payload)` action.

## Testing

Unit-test the application service, not the action. Test the action end to end with Playwright through the real form when it matters.
