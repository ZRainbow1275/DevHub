import { useCallback, useEffect, useMemo, useState, type LegacyRef } from 'react'
import { Responsive, useContainerWidth, type ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import type { DashboardBreakpoint, DashboardGridItem } from '@shared/schemas/r8-runtime'
import type { FeatureFlagName } from '@shared/feature-flags'
import {
  clampLayoutsForBreakpoint,
  DASHBOARD_BREAKPOINT_WIDTHS,
  DASHBOARD_COLS,
  toReactGridLayouts
} from './dashboard-model'
import {
  getDashboardWidgetConfigDefinition,
  parseDashboardWidgetConfig,
  type DashboardWidgetConfig,
  type DashboardWidgetConfigValue
} from './dashboard-widget-config'
import { WidgetHost } from './WidgetRegistry'
import { PanelDetachButton } from '../popout/PanelDetachButton'

const DASHBOARD_GRID_FLAG: FeatureFlagName = 'R8.B.dashboard.grid'

function normalizeConfigDraft(item: DashboardGridItem): DashboardWidgetConfig {
  return parseDashboardWidgetConfig(item.widgetId, item.config)
}

function DashboardDisabledPanel({
  busy,
  error,
  onEnable
}: {
  busy: boolean
  error: string | null
  onEnable: () => void
}) {
  return (
    <div className="h-full overflow-auto bg-surface-950 p-4" data-testid="dashboard-disabled-page">
      <div className="rounded-lg border border-warning/50 bg-warning/10 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-warning">Dashboard feature disabled</h2>
        <p className="mt-2 text-sm text-text-secondary">
          `R8.B.dashboard.grid` 已通过真实 feature flag 关闭。Dashboard 路由保持存在，但不会挂载 react-grid-layout 或任何 widget 轮询。
        </p>
        <button
          className="mt-4 rounded border border-warning/60 px-4 py-2 text-sm text-warning hover:bg-warning/10 disabled:opacity-60"
          data-testid="dashboard-feature-enable"
          disabled={busy}
          onClick={onEnable}
          type="button"
        >
          启用 Dashboard Grid
        </button>
        {error ? <div className="mt-3 text-xs text-danger" data-testid="dashboard-feature-error">{error}</div> : null}
      </div>
    </div>
  )
}

function DashboardWidgetConfigEditor({
  item,
  saving,
  onClose,
  onSave
}: {
  item: DashboardGridItem
  saving: boolean
  onClose: () => void
  onSave: (widgetInstanceId: string, config: DashboardWidgetConfig) => void
}) {
  const definition = getDashboardWidgetConfigDefinition(item.widgetId)
  const [draft, setDraft] = useState<DashboardWidgetConfig>(() => normalizeConfigDraft(item))

  useEffect(() => {
    setDraft(normalizeConfigDraft(item))
  }, [item])

  const setDraftValue = (key: string, value: DashboardWidgetConfigValue) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="mb-4 rounded-lg border border-accent/50 bg-surface-900 p-4" data-testid="dashboard-widget-config-editor">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[0.05em] text-text-primary">{definition.title}</h3>
          <p className="mt-1 text-xs text-text-muted">实例：{item.i}；配置通过 dashboard:save-layout 持久化。</p>
        </div>
        <button className="rounded border border-surface-600 px-3 py-1.5 text-xs text-text-muted hover:border-accent hover:text-accent" onClick={onClose} type="button">
          关闭
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {definition.fields.map(field => (
          <label className="flex flex-col gap-1.5 rounded border border-surface-700 bg-surface-950/60 p-3" key={field.key}>
            <span className="block text-xs font-semibold tracking-[0.05em] text-text-secondary">{field.label}</span>
            <span className="block text-[11px] text-text-muted">{field.description}</span>
            {field.kind === 'number' ? (
              <input
                className="w-full rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-sm text-text-primary"
                data-testid={`dashboard-config-${field.key}`}
                max={field.max}
                min={field.min}
                onChange={event => setDraftValue(field.key, Number(event.target.value))}
                step={field.step}
                type="number"
                value={Number(draft[field.key] ?? field.defaultValue)}
              />
            ) : field.kind === 'boolean' ? (
              <input
                checked={Boolean(draft[field.key] ?? field.defaultValue)}
                className="h-4 w-4 accent-accent"
                data-testid={`dashboard-config-${field.key}`}
                onChange={event => setDraftValue(field.key, event.target.checked)}
                type="checkbox"
              />
            ) : (
              <select
                className="w-full rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-sm text-text-primary"
                data-testid={`dashboard-config-${field.key}`}
                onChange={event => setDraftValue(field.key, event.target.value)}
                value={String(draft[field.key] ?? field.defaultValue)}
              >
                {(field.options ?? []).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          className="rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
          data-testid="dashboard-config-save"
          disabled={saving}
          onClick={() => onSave(item.i, parseDashboardWidgetConfig(item.widgetId, draft))}
          type="button"
        >
          保存配置
        </button>
      </div>
    </div>
  )
}

export function Dashboard() {
  const {
    layout,
    presets,
    loading,
    error,
    updateFromGrid,
    updateWidgetConfig,
    applyPreset,
    morphWidgetToDrawer
  } = useDashboardLayout()

  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null)
  const [featureBusy, setFeatureBusy] = useState(false)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [activeBreakpoint, setActiveBreakpoint] = useState<DashboardBreakpoint>('md')
  const gridLayouts = useMemo(() => toReactGridLayouts(layout), [layout])
  const displayLayouts = useMemo(
    () => clampLayoutsForBreakpoint(gridLayouts, activeBreakpoint),
    [gridLayouts, activeBreakpoint]
  )
  const widgetItems = layout.layouts.md
  const editingItem = useMemo(
    () => widgetItems.find(item => item.i === editingWidgetId) ?? null,
    [editingWidgetId, widgetItems]
  )
  const { width, containerRef, mounted } = useContainerWidth()

  const handleLayoutChange = useCallback((_current: unknown, allLayouts: ResponsiveLayouts<DashboardBreakpoint>) => {
    void updateFromGrid(allLayouts)
  }, [updateFromGrid])

  const handleBreakpointChange = useCallback((breakpoint: DashboardBreakpoint, _cols: number) => {
    setActiveBreakpoint(breakpoint)
  }, [])

  const refreshFeatureFlag = useCallback(async () => {
    const bridge = window.devhub?.r8?.integrations
    if (!bridge?.getFlag) {
      setFeatureEnabled(true)
      return
    }
    try {
      setFeatureError(null)
      setFeatureEnabled(await bridge.getFlag(DASHBOARD_GRID_FLAG))
    } catch (error) {
      setFeatureError(error instanceof Error ? error.message : String(error))
      setFeatureEnabled(true)
    }
  }, [])

  const setDashboardFeatureFlag = useCallback(async (enabled: boolean) => {
    const bridge = window.devhub?.r8?.integrations
    if (!bridge?.setFlag) {
      setFeatureEnabled(enabled)
      return
    }
    setFeatureBusy(true)
    setFeatureError(null)
    try {
      const result = await bridge.setFlag(DASHBOARD_GRID_FLAG, enabled, 'dashboard-ui')
      setFeatureEnabled(result.value)
    } catch (error) {
      setFeatureError(error instanceof Error ? error.message : String(error))
    } finally {
      setFeatureBusy(false)
    }
  }, [])

  const saveWidgetConfig = useCallback(async (widgetInstanceId: string, config: DashboardWidgetConfig) => {
    setConfigSaving(true)
    try {
      await updateWidgetConfig(widgetInstanceId, config)
      setEditingWidgetId(null)
    } finally {
      setConfigSaving(false)
    }
  }, [updateWidgetConfig])

  useEffect(() => {
    void refreshFeatureFlag()
  }, [refreshFeatureFlag])

  useEffect(() => {
    const handler = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (typeof enabled === 'boolean') setFeatureEnabled(enabled)
    }
    window.addEventListener('devhub:dashboard-feature-flag-change', handler)
    return () => window.removeEventListener('devhub:dashboard-feature-flag-change', handler)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const layoutName = (event as CustomEvent<{ layoutName?: string }>).detail?.layoutName
      if (layoutName) void applyPreset(layoutName)
    }
    window.addEventListener('devhub:dashboard-apply-layout', handler)
    return () => window.removeEventListener('devhub:dashboard-apply-layout', handler)
  }, [applyPreset])

  if (featureEnabled === false) {
    return (
      <DashboardDisabledPanel
        busy={featureBusy}
        error={featureError}
        onEnable={() => { void setDashboardFeatureFlag(true) }}
      />
    )
  }

  if (featureEnabled === null) {
    return (
      <div className="h-full overflow-auto bg-surface-950 p-4" data-testid="dashboard-feature-loading">
        <div className="rounded border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-text-muted">
          正在读取 `R8.B.dashboard.grid` feature flag
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-surface-950 p-4" data-testid="dashboard-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-700 bg-surface-900/80 p-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">R8 Dashboard</h2>
          <p className="mt-1 truncate text-xs text-text-muted">拖拽、缩放和预设持久化使用真实 dashboard IPC；主监控三栏保持不变。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-warning/50 px-3 py-1.5 text-xs uppercase tracking-[0.12em] whitespace-nowrap text-warning hover:bg-warning/10 disabled:opacity-60"
            data-testid="dashboard-feature-disable"
            disabled={featureBusy || featureEnabled === null}
            onClick={() => { void setDashboardFeatureFlag(false) }}
            type="button"
          >
            禁用 Grid
          </button>
          {presets.map(preset => (
            <button
              className={`rounded border px-3 py-1.5 text-xs uppercase tracking-[0.12em] whitespace-nowrap ${layout.name === preset ? 'border-accent text-accent' : 'border-surface-600 text-text-muted hover:border-accent hover:text-accent'}`}
              data-testid={`dashboard-preset-${preset}`}
              key={preset}
              onClick={() => { void applyPreset(preset) }}
              type="button"
            >
              {preset}
            </button>
          ))}
          <PanelDetachButton surface="dashboard" />
        </div>
      </div>

      {featureError ? (
        <div className="mb-3 rounded border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="dashboard-feature-error">
          {featureError}
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger" data-testid="dashboard-error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mb-3 rounded border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-text-muted">
          正在加载 dashboard layout
        </div>
      ) : null}

      {editingItem ? (
        <DashboardWidgetConfigEditor
          item={editingItem}
          onClose={() => setEditingWidgetId(null)}
          onSave={(widgetInstanceId, config) => { void saveWidgetConfig(widgetInstanceId, config) }}
          saving={configSaving}
        />
      ) : null}

      <div ref={containerRef as unknown as LegacyRef<HTMLDivElement>}>
        {mounted ? (
          <Responsive
            breakpoints={DASHBOARD_BREAKPOINT_WIDTHS}
            className="dashboard-grid"
            cols={DASHBOARD_COLS}
            containerPadding={layout.containerPadding}
            dragConfig={{ enabled: true, bounded: false, handle: '.widget-drag-handle', cancel: 'button', threshold: 3 }}
            layouts={displayLayouts}
            margin={layout.margin}
            onBreakpointChange={handleBreakpointChange}
            onLayoutChange={handleLayoutChange}
            resizeConfig={{ enabled: true, handles: ['se'] }}
            rowHeight={layout.rowHeight}
            width={width}
          >
            {widgetItems.map(item => (
              <div data-testid={`dashboard-grid-item-${item.i}`} key={item.i}>
                <WidgetHost
                  item={item}
                  onConfigure={setEditingWidgetId}
                  onMorphToDrawer={(widgetInstanceId, slot) => { void morphWidgetToDrawer(widgetInstanceId, slot) }}
                />
              </div>
            ))}
          </Responsive>
        ) : null}
      </div>
    </div>
  )
}
