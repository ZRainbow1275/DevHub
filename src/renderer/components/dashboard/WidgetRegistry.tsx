import { lazy, Suspense, type ComponentType } from 'react'
import type { DashboardGridItem, DashboardWidgetId } from '@shared/schemas/r8-runtime'
import { EmptyWidgetState, WidgetFrame } from './WidgetFrame'

export interface DashboardWidgetProps {
  item: DashboardGridItem
}

interface WidgetEntry {
  title: string
  subtitle: string
  Component: ComponentType<DashboardWidgetProps>
}

const ProcessSummaryWidget = lazy(() => import('./widgets/ProcessSummaryWidget'))
const PortSummaryWidget = lazy(() => import('./widgets/PortSummaryWidget'))
const WindowSummaryWidget = lazy(() => import('./widgets/WindowSummaryWidget'))
const AiTaskQueueWidget = lazy(() => import('./widgets/AiTaskQueueWidget'))
const SystemResourceWidget = lazy(() => import('./widgets/SystemResourceWidget'))
const NotificationsWidget = lazy(() => import('./widgets/NotificationsWidget'))
const TopologyMiniWidget = lazy(() => import('./widgets/TopologyMiniWidget'))
const TreemapMiniWidget = lazy(() => import('./widgets/TreemapMiniWidget'))

export const WIDGET_REGISTRY: Record<DashboardWidgetId, WidgetEntry | undefined> = {
  'process-summary': { title: '进程汇总', subtitle: '实时 scanner processes', Component: ProcessSummaryWidget },
  'port-summary': { title: '端口汇总', subtitle: '实时 scanner ports', Component: PortSummaryWidget },
  'window-summary': { title: '窗口汇总', subtitle: '实时 scanner windows', Component: WindowSummaryWidget },
  'ai-task-queue': { title: 'AI 任务', subtitle: '实时 scanner aiTasks', Component: AiTaskQueueWidget },
  'system-resource': { title: '系统资源', subtitle: '实时 systemSummary', Component: SystemResourceWidget },
  notifications: { title: '通知', subtitle: 'R8 status aggregate', Component: NotificationsWidget },
  'topology-mini': { title: '拓扑缩略', subtitle: '进程/端口/窗口关系', Component: TopologyMiniWidget },
  'treemap-mini': { title: '进程 Treemap', subtitle: 'CPU/RSS 排序', Component: TreemapMiniWidget },
  'sparkline-cpu': undefined,
  'sparkline-rss': undefined,
  'recent-uri': undefined,
  favorites: undefined,
  custom: undefined
}

export function WidgetHost({
  item,
  onConfigure,
  onMorphToDrawer
}: {
  item: DashboardGridItem
  onConfigure: (widgetInstanceId: string) => void
  onMorphToDrawer: (widgetInstanceId: string, slot: 'right' | 'bottom') => void
}) {
  const entry = WIDGET_REGISTRY[item.widgetId]
  if (!entry) {
    return (
      <WidgetFrame title="未知 widget" subtitle={item.widgetId} testId={`widget-${item.widgetId}`}>
        <EmptyWidgetState message={`WidgetRegistry 未注册 ${item.widgetId}`} />
      </WidgetFrame>
    )
  }
  const { Component } = entry
  return (
    <WidgetFrame
      action={
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <button
            className="rounded border border-surface-600 px-2 py-1 text-[11px] whitespace-nowrap text-text-muted hover:border-accent hover:text-accent"
            data-testid={`widget-configure-${item.i}`}
            onClick={() => onConfigure(item.i)}
            type="button"
          >
            设置
          </button>
          <button
            className="rounded border border-surface-600 px-2 py-1 text-[11px] whitespace-nowrap text-text-muted hover:border-accent hover:text-accent"
            data-testid={`widget-morph-right-${item.i}`}
            onClick={() => onMorphToDrawer(item.i, 'right')}
            type="button"
          >
            右侧
          </button>
          <button
            className="rounded border border-surface-600 px-2 py-1 text-[11px] whitespace-nowrap text-text-muted hover:border-accent hover:text-accent"
            data-testid={`widget-morph-bottom-${item.i}`}
            onClick={() => onMorphToDrawer(item.i, 'bottom')}
            type="button"
          >
            底部
          </button>
        </div>
      }
      subtitle={entry.subtitle}
      testId={`widget-${item.widgetId}`}
      title={entry.title}
    >
      <Suspense fallback={<EmptyWidgetState message="正在加载 widget" />}>
        <Component item={item} />
      </Suspense>
    </WidgetFrame>
  )
}
