import { useMemo } from 'react'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import type { DetachableViewProps } from '../popout/detachable-registry'
import { EmptyWidgetState, WidgetFrame } from './WidgetFrame'
import { WidgetHost } from './WidgetRegistry'

/**
 * Standalone single-widget view rendered inside a `dashboard-widget` popout (or
 * any embedded-full-view host). The focused widget instance id rides in the
 * detach target as `widgetId:<instanceId>`; the view re-fetches the dashboard
 * layout through the normal IPC bridge and renders just that widget, reusing the
 * same `WidgetHost` / `WidgetRegistry` render path as the in-grid dashboard. No
 * data is serialized across the window boundary — the widget self-subscribes.
 */
export function WidgetDetachView({ initialTarget }: DetachableViewProps): React.JSX.Element {
  const { layout, loading, error } = useDashboardLayout()
  const widgetInstanceId = initialTarget?.kind === 'widgetId' ? initialTarget.value : null

  const item = useMemo(
    () => layout.layouts.md.find(candidate => candidate.i === widgetInstanceId) ?? null,
    [layout.layouts.md, widgetInstanceId]
  )

  if (error) {
    return (
      <div className="h-full bg-surface-950 p-4">
        <WidgetFrame title="widget" subtitle={widgetInstanceId ?? ''}>
          <EmptyWidgetState message={error} />
        </WidgetFrame>
      </div>
    )
  }

  if (!widgetInstanceId) {
    return (
      <div className="h-full bg-surface-950 p-4">
        <WidgetFrame title="widget">
          <EmptyWidgetState message="未指定要悬浮的 widget。" />
        </WidgetFrame>
      </div>
    )
  }

  if (loading && !item) {
    return (
      <div className="h-full bg-surface-950 p-4">
        <WidgetFrame title="widget" subtitle={widgetInstanceId}>
          <EmptyWidgetState message="正在加载 widget" />
        </WidgetFrame>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="h-full bg-surface-950 p-4">
        <WidgetFrame title="widget" subtitle={widgetInstanceId}>
          <EmptyWidgetState message={`当前布局未包含 widget ${widgetInstanceId}`} />
        </WidgetFrame>
      </div>
    )
  }

  return (
    <div className="h-full bg-surface-950 p-4" data-testid="widget-detach-view">
      <WidgetHost
        item={item}
        onConfigure={() => undefined}
        onMorphToDrawer={() => undefined}
        detachable={false}
      />
    </div>
  )
}

export default WidgetDetachView
