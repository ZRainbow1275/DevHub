import type { ReactNode } from 'react'

export function FocusRing({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`a11y-focus-ring ${className}`.trim()}>
      {children}
    </span>
  )
}
