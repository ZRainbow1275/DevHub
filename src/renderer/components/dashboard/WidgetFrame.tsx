import type { ReactNode } from 'react'
import { GridIcon } from '../icons'

export function WidgetFrame({
  title,
  subtitle,
  action,
  children,
  testId
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-surface-700 bg-surface-900/95 shadow-lg shadow-black/20"
      data-testid={testId}
    >
      <div className="widget-drag-handle flex shrink-0 cursor-move items-center justify-between gap-3 border-b border-surface-700 bg-surface-800/80 px-3 py-2" data-testid="widget-drag-handle">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-accent"><GridIcon size={14} /></span>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold tracking-[0.05em] text-text-primary">{title}</h3>
            {subtitle ? <p className="truncate text-[11px] text-text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {children}
      </div>
    </section>
  )
}

export function MetricValue({ value, label, tone = 'text-text-primary' }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-surface-700 bg-surface-950/70 p-3">
      <div className={`truncate text-xl font-bold leading-tight tabular-nums md:text-2xl ${tone}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
    </div>
  )
}

export function EmptyWidgetState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-w-0 items-center justify-center break-words rounded-md border border-dashed border-surface-700 bg-surface-950/40 px-3 text-center text-xs text-text-muted">
      {message}
    </div>
  )
}
