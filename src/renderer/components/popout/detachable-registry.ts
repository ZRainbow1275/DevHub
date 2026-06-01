import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { panelPopoutSurfaceSchema, type PanelPopoutSurface } from '@shared/schemas/r8-runtime'

/**
 * A target the detail / widget / toolbar surfaces hydrate to on open. Encoded
 * into the popout `target` query param (and the drawer runtime args) as
 * `kind:value`, e.g. `pid:1234`, `port:8080`, `hwnd:65792`, `taskId:abc`,
 * `widgetId:widget-process-summary`, `toolbarId:monitor-quick`,
 * `contentId:notifications.top` (the morphed-drawer surface). No Zod/DrawerState
 * schema field is added for this (ADR decision): the target rides as a runtime
 * arg, keeping the popout transport schema-free.
 */
export const DETACH_TARGET_KINDS = ['pid', 'port', 'hwnd', 'taskId', 'widgetId', 'toolbarId', 'contentId'] as const

export type DetachTargetKind = (typeof DETACH_TARGET_KINDS)[number]

export interface DetachTarget {
  kind: DetachTargetKind
  value: string
}

const DETACH_TARGET_KIND_SET = new Set<string>(DETACH_TARGET_KINDS)

/**
 * Props every detachable full-view component accepts. The view sidesteps target
 * serialization by re-fetching its own data through the normal IPC bridge; the
 * optional `initialTarget` only pre-selects the focused item on mount.
 */
export interface DetachableViewProps {
  initialTarget?: DetachTarget | null
}

export type DetachableComponent = LazyExoticComponent<ComponentType<DetachableViewProps>>

export interface DetachableDef {
  /**
   * 'panel' = whole tab-level view; 'detail' = item-scoped view needing a target;
   * 'widget' = a single dashboard widget; 'toolbar' = a self-contained功能栏.
   */
  kind: 'panel' | 'detail' | 'widget' | 'toolbar'
  /** Localized window / drawer title. */
  title: string
  /** Lazily loaded full React view rendered inside the popout / drawer. */
  component: DetachableComponent
  /** Default route hint persisted on the popout record. */
  route: string
  /** Whether the surface expects an `initialTarget` (detail surfaces do). */
  needsTarget: boolean
}

function lazyView(
  loader: () => Promise<{ default: ComponentType<DetachableViewProps> }>
): DetachableComponent {
  return lazy(loader)
}

const ProcessView = lazyView(() => import('../monitor/ProcessView').then(m => ({ default: m.ProcessView })))
const WindowView = lazyView(() => import('../monitor/WindowView').then(m => ({ default: m.WindowView })))
const R8OpsPanel = lazyView(() => import('../monitor/R8OpsPanel').then(m => ({ default: m.R8OpsPanel })))
const Dashboard = lazyView(() => import('../dashboard/Dashboard').then(m => ({ default: m.Dashboard })))
const FullScreenTopologyView = lazyView(() => import('../topology/FullScreenTopologyView').then(m => ({ default: m.FullScreenTopologyView })))
const PortView = lazyView(() => import('../monitor/PortView').then(m => ({ default: m.PortView })))
const AITaskView = lazyView(() => import('../monitor/AITaskView').then(m => ({ default: m.AITaskView })))
const WidgetDetachView = lazyView(() => import('../dashboard/WidgetDetachView').then(m => ({ default: m.WidgetDetachView })))
const MonitorToolbarView = lazyView(() => import('../monitor/MonitorToolbarView').then(m => ({ default: m.MonitorToolbarView })))
const DrawerPopoutView = lazyView(() => import('../drawer/DrawerPopoutView').then(m => ({ default: m.DrawerPopoutView })))

/**
 * Single source of truth mapping every detachable surface to its renderer. The
 * `Record<PanelPopoutSurface, ...>` typing forces exhaustiveness against the Zod
 * enum so adding a surface to the schema fails to compile until it is registered
 * here. Detail surfaces reuse the full tab view (embedded-full-view pattern) and
 * hydrate the focused item from `initialTarget`.
 */
export const DETACHABLE_REGISTRY: Record<PanelPopoutSurface, DetachableDef> = {
  process: { kind: 'panel', title: '系统进程', component: ProcessView, route: '/panel/process', needsTarget: false },
  window: { kind: 'panel', title: '系统窗口', component: WindowView, route: '/panel/window', needsTarget: false },
  dashboard: { kind: 'panel', title: '仪表板', component: Dashboard, route: '/panel/dashboard', needsTarget: false },
  topology: { kind: 'panel', title: '拓扑', component: FullScreenTopologyView, route: '/panel/topology', needsTarget: false },
  'r8-ops': { kind: 'panel', title: 'R8 Ops', component: R8OpsPanel, route: '/panel/r8-ops', needsTarget: false },
  'process-detail': { kind: 'detail', title: '进程详情', component: ProcessView, route: '/panel/process-detail', needsTarget: true },
  'window-detail': { kind: 'detail', title: '窗口详情', component: WindowView, route: '/panel/window-detail', needsTarget: true },
  'port-detail': { kind: 'detail', title: '端口详情', component: PortView, route: '/panel/port-detail', needsTarget: true },
  'ai-task-detail': { kind: 'detail', title: 'AI 任务详情', component: AITaskView, route: '/panel/ai-task-detail', needsTarget: true },
  'dashboard-widget': { kind: 'widget', title: '仪表板 widget', component: WidgetDetachView, route: '/panel/dashboard-widget', needsTarget: true },
  'monitor-toolbar': { kind: 'toolbar', title: '监控功能栏', component: MonitorToolbarView, route: '/panel/monitor-toolbar', needsTarget: true },
  drawer: { kind: 'detail', title: '抽屉浮窗', component: DrawerPopoutView, route: '/panel/drawer', needsTarget: true }
}

const PANEL_POPOUT_SURFACE_SET = new Set<string>(panelPopoutSurfaceSchema.options)

export function isPanelPopoutSurface(value: string | null | undefined): value is PanelPopoutSurface {
  return typeof value === 'string' && PANEL_POPOUT_SURFACE_SET.has(value)
}

export function getDetachableDef(surface: PanelPopoutSurface): DetachableDef {
  return DETACHABLE_REGISTRY[surface]
}

/**
 * Parses a `target` query param / runtime arg of the form `kind:value` into a
 * typed {@link DetachTarget}. Returns null on any malformed / unknown input so
 * the popout degrades to "no initial selection" rather than throwing.
 */
export function parseDetachTarget(raw: string | null | undefined): DetachTarget | null {
  if (!raw) return null
  const separatorIndex = raw.indexOf(':')
  if (separatorIndex <= 0) return null
  const kind = raw.slice(0, separatorIndex)
  const value = raw.slice(separatorIndex + 1)
  if (!value) return null
  if (DETACH_TARGET_KIND_SET.has(kind)) {
    return { kind: kind as DetachTargetKind, value }
  }
  return null
}

/** Serializes a {@link DetachTarget} back into the `kind:value` wire form. */
export function serializeDetachTarget(target: DetachTarget): string {
  return `${target.kind}:${target.value}`
}
