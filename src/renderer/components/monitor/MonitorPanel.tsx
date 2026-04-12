import { useState } from 'react'
import { ProcessView } from './ProcessView'
import { PortView } from './PortView'
import { WindowView } from './WindowView'
import { AITaskView } from './AITaskView'
import { TopologyView } from './TopologyView'
import { ErrorBoundary } from '../ErrorBoundary'
import { ViewErrorFallback } from '../ui/ViewErrorFallback'
import { ProcessIcon, PortIcon, WindowIcon, AIIcon, MonitorIcon, TopologyIcon } from '../icons'

type MonitorTab = 'process' | 'port' | 'window' | 'ai-task' | 'topology'

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
  }
]

export function MonitorPanel() {
  const [activeTab, setActiveTab] = useState<MonitorTab>('process')

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 border-gold" style={{ borderRadius: '2px' }}>
              <MonitorIcon size={16} className="text-gold" />
            </div>
            <div>
              <h2
                className="text-gold font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-2deg)',
                  transformOrigin: 'left center'
                }}
              >
                系统监控
              </h2>
              <p className="text-xs text-text-muted">SYSTEM MONITOR</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1">
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200
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
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden monitor-content panel-container">
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
            <ViewErrorFallback viewName="关系拓扑" error={error} onRetry={resetErrorBoundary} />
          )}>
            <TopologyView />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
