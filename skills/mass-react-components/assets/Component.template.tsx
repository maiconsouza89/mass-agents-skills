// Rename ComponentName and ComponentNameProps. Keep one component per file.
import type { ReactNode } from 'react'

export interface ComponentNameProps {
  /** Required data first. */
  title: string
  /** Optional slots and flags after. */
  children?: ReactNode
  isDisabled?: boolean
  /** Callbacks are prefixed with `on` and receive domain values, not events. */
  onSelect?: (title: string) => void
}

export function ComponentName({ title, children, isDisabled = false, onSelect }: ComponentNameProps) {
  const { label, handleSelect } = useComponentName({ title, isDisabled, onSelect })

  return (
    <section aria-label={label}>
      <button type="button" disabled={isDisabled} onClick={handleSelect}>
        {title}
      </button>
      {children}
    </section>
  )
}

/** Behaviour lives in a hook so the component stays declarative and the logic is testable with renderHook. */
function useComponentName({ title, isDisabled, onSelect }: Pick<ComponentNameProps, 'title' | 'isDisabled' | 'onSelect'>) {
  const label = `${title} section`
  const handleSelect = () => {
    if (isDisabled) return
    onSelect?.(title)
  }
  return { label, handleSelect }
}
