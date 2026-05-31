import { useEffect, useState } from 'react'
import { ProcessView } from './ProcessView'
import { PortView } from './PortView'
import { WindowView } from './WindowView'
import { AITaskView } from './AITaskView'
import { R8OpsPanel } from './R8OpsPanel'
import { FullScreenTopologyView } from '../topology/FullScreenTopologyView'
import { ErrorBoundary } from '../ErrorBoundary'
import { ViewErrorFallback } from '../ui/ViewErrorFallback'
import { ProcessIcon, PortIcon, WindowIcon, AIIcon, MonitorIcon, GearIcon, TopologyIcon } from '../icons'
import { useT } from '../../hooks/useT'

type MonitorTab = 'process' | 'port' | 'window' | 'ai-task' | 'topology' | 'r8-ops'

const TABS: { id: MonitorTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'process',
    label: '进程',
    icon: <ProcessIcon size={16} />
  },
  {
    id: 'port',
    label: '端口',
    icon: <PortIcon size={16} />
  },
  {
    id: 'window',
    label: '窗口',
    icon: <WindowIcon size={16} />
  },
  {
    id: 'ai-task',
    label: 'AI 任务',
    icon: <AIIcon size={16} />
  },
  {
    id: 'topology',
    label: '拓扑',
    icon: <TopologyIcon size={16} />
  },
  {
    id: 'r8-ops',
    label: 'R8 运营',
    icon: <GearIcon size={16} />
  }
]

function initialMonitorTab(): MonitorTab {
  const params = new URLSearchParams(window.location.search)
  return params.get('surface') === 'monitor' ? 'r8-ops' : 'process'
}

export function MonitorPanel() {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState<MonitorTab>(() => initialMonitorTab())

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: MonitorTab }>).detail
      if (detail?.tab && TABS.some(tab => tab.id === detail.tab)) {
        setActiveTab(detail.tab)
      }
    }
    window.addEventListener('devhub:monitor-navigate', handler)
    return () => window.removeEventListener('devhub:monitor-navigate', handler)
  }, [])

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-950" data-testid="monitor-panel">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center justify-between gap-3 relative z-10">
          {/* Title */}
          <div className="flex items-center gap-3 min-w-0 max-w-[30%]">
            <div className="w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 border-gold radius-sm flex-shrink-0">
              <MonitorIcon size={16} className="text-gold" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-gold font-bold uppercase tracking-wider truncate whitespace-nowrap text-sm"
                style={{
                  fontFamily: 'var(--font-display)',
                  transform: 'rotate(-2deg)',
                  transformOrigin: 'left center'
                }}
              >
                {t('monitor.system.title', '系统监控')}
              </h2>
              <p className="text-xs text-text-muted hidden md:block truncate">{t('monitor.system.subtitle', 'SYSTEM MONITOR')}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            className="flex flex-nowrap items-center gap-1 overflow-x-auto min-w-0 flex-1"
            data-testid="monitor-tab-list"
            style={{ scrollbarWidth: 'none' }}
          >
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                data-testid={`monitor-tab-${tab.id}`}
                data-active={activeTab === tab.id}
                className={`
                  flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium transition-all duration-200
                  whitespace-nowrap min-w-max flex-shrink-0
                  ${activeTab === tab.id
                    ? 'bg-accent/15 text-accent border-l-2 border-accent'
                    : 'text-text-secondary hover:bg-surface-800 hover:text-text-primary border-l-2 border-transparent'
                  }
                `}
                style={{
                  borderRadius: '2px',
                  animationDelay: `${index * 50}ms`
                }}
              >
                <span className="inline-flex min-[960px]:hidden">{tab.icon}</span>
                <span className="hidden min-[960px]:inline min-[1280px]:hidden">{tab.label}</span>
                <span className="hidden min-[1280px]:inline-flex min-[1280px]:items-center min-[1280px]:gap-2">
                  {tab.icon}
                  <span>{tab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden monitor-content panel-container">
        {activeTab === 'process' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="进程监控" error={error} onRetry={resetErrorBoundary} />
          )}>
            <ProcessView />
          </ErrorBoundary>
        )}
        {activeTab === 'port' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="端口监控" error={error} onRetry={resetErrorBoundary} />
          )}>
            <PortView />
          </ErrorBoundary>
        )}
        {activeTab === 'window' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="窗口管理" error={error} onRetry={resetErrorBoundary} />
          )}>
            <WindowView />
          </ErrorBoundary>
        )}
        {activeTab === 'ai-task' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="AI 任务" error={error} onRetry={resetErrorBoundary} />
          )}>
            <AITaskView />
          </ErrorBoundary>
        )}
        {activeTab === 'topology' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="全局拓扑" error={error} onRetry={resetErrorBoundary} />
          )}>
            <FullScreenTopologyView />
          </ErrorBoundary>
        )}
        {activeTab === 'r8-ops' && (
          <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => (
            <ViewErrorFallback viewName="R8 运营" error={error} onRetry={resetErrorBoundary} />
          )}>
            <R8OpsPanel />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
