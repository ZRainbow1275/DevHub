import { Suspense, lazy, useEffect } from 'react'
import type { PanelPopoutSurface } from '@shared/schemas/r8-runtime'
import { ErrorBoundary } from '../ErrorBoundary'

const ProcessView = lazy(() => import('../monitor/ProcessView').then(m => ({ default: m.ProcessView })))
const WindowView = lazy(() => import('../monitor/WindowView').then(m => ({ default: m.WindowView })))
const R8OpsPanel = lazy(() => import('../monitor/R8OpsPanel').then(m => ({ default: m.R8OpsPanel })))
const Dashboard = lazy(() => import('../dashboard/Dashboard').then(m => ({ default: m.Dashboard })))
const FullScreenTopologyView = lazy(() => import('../topology/FullScreenTopologyView').then(m => ({ default: m.FullScreenTopologyView })))

export function readPanelPopoutSurface(): PanelPopoutSurface | null {
  const value = new URLSearchParams(window.location.search).get('r8PanelPopout')
  if (value === 'process' || value === 'window' || value === 'dashboard' || value === 'topology' || value === 'r8-ops') return value
  return null
}

const SURFACE_TITLES: Record<PanelPopoutSurface, string> = {
  process: '系统进程',
  window: '系统窗口',
  dashboard: '仪表板',
  topology: '拓扑',
  'r8-ops': 'R8 Ops'
}

export function PanelPopoutShell({ surface }: { surface: PanelPopoutSurface }): React.JSX.Element {
  useEffect(() => {
    document.title = `DevHub - ${SURFACE_TITLES[surface]}`
  }, [surface])

  return (
    <ErrorBoundary fallback={<div className="flex h-screen items-center justify-center text-text-muted">面板加载失败</div>}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-text-muted">加载中...</div>}>
        <div className="h-screen w-screen overflow-hidden bg-surface-950" data-r8c-panel-popout={surface}>
          <PanelPopoutContent surface={surface} />
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

function PanelPopoutContent({ surface }: { surface: PanelPopoutSurface }): React.JSX.Element {
  if (surface === 'process') return <ProcessView />
  if (surface === 'window') return <WindowView />
  if (surface === 'r8-ops') return <R8OpsPanel />
  if (surface === 'dashboard') return <Dashboard />
  if (surface === 'topology') return <FullScreenTopologyView />
  return <div className="p-4 text-text-muted">未知面板：{surface}</div>
}
