import { useState, useEffect, useCallback } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { ProjectList } from './components/project/ProjectList'
import { AddProjectDialog } from './components/project/AddProjectDialog'
import { LogPanel } from './components/log/LogPanel'
import { MonitorPanel } from './components/monitor'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { CloseConfirmDialog } from './components/ui/CloseConfirmDialog'
import { ToastProvider, useToast } from './components/ui/Toast'
import { HeroStats } from './components/ui/HeroStats'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useProjects } from './hooks/useProjects'
import { LogIcon, MonitorIcon } from './components/icons'

type MainView = 'logs' | 'monitor'

function AppContent() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [mainView, setMainView] = useState<MainView>('logs')
  const { selectedProject, selectedProjectId, addProject } = useProjects()
  const { showToast } = useToast()

  const handleAddProject = useCallback(async (path: string) => {
    try {
      await addProject(path)
      showToast('success', '项目添加成功')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '添加项目失败')
      throw error
    }
  }, [addProject, showToast])

  // 监听窗口关闭确认事件 - window.devhub 在非 Electron 环境下不存在
  useEffect(() => {
    if (!window.devhub?.window?.onCloseConfirm) return

    const unsubscribe = window.devhub.window.onCloseConfirm(() => {
      setShowCloseConfirm(true)
    })
    return unsubscribe
  }, [])

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-text-primary overflow-hidden">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar onSettingsClick={() => setShowSettings(true)} />

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Split View */}
          <div className="flex-1 flex overflow-hidden">
            {/* Project List (Left Panel) */}
            <div className="w-[340px] border-r-2 border-surface-700 overflow-hidden bg-surface-900/50 relative flex flex-col">
              {/* Diagonal decoration */}
              <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />
              {/* Hero Stats */}
              <HeroStats />
              {/* Project List */}
              <div className="flex-1 overflow-hidden">
                <ProjectList onAddProject={() => setShowAddDialog(true)} />
              </div>
            </div>

            {/* Log Panel (Right Panel) */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              {/* View Toggle Header */}
              <div className="flex-shrink-0 px-4 py-2 border-b-2 border-surface-700 bg-surface-900 flex items-center gap-1 relative z-10">
                {/* Diagonal decoration */}
                <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

                <ViewToggleButton
                  active={mainView === 'logs'}
                  onClick={() => setMainView('logs')}
                  icon={<LogIcon size={16} />}
                  label="日志"
                />
                <ViewToggleButton
                  active={mainView === 'monitor'}
                  onClick={() => setMainView('monitor')}
                  icon={<MonitorIcon size={16} />}
                  label="监控"
                />

                {/* Active indicator line */}
                <div
                  className="absolute bottom-0 h-0.5 bg-accent transition-all duration-300"
                  style={{
                    left: mainView === 'logs' ? '16px' : '92px',
                    width: '64px'
                  }}
                />
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-hidden relative">
                {/* Diagonal decoration */}
                <div className="absolute inset-0 deco-diagonal opacity-3 pointer-events-none" />

                {mainView === 'logs' ? (
                  <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">日志面板出错，请刷新</div>}>
                    <LogPanel
                      projectId={selectedProjectId}
                      projectName={selectedProject?.name || ''}
                    />
                  </ErrorBoundary>
                ) : (
                  <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">监控面板出错，请刷新</div>}>
                    <MonitorPanel />
                  </ErrorBoundary>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Add Project Dialog */}
      <AddProjectDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddProject}
      />

      {/* Settings Panel */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Close Confirm Dialog */}
      <CloseConfirmDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
      />
    </div>
  )
}

// View Toggle Button Component with Soviet styling
function ViewToggleButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 relative z-10
        border-l-2
        ${active
          ? 'bg-accent/15 text-accent border-accent'
          : 'text-text-secondary hover:bg-surface-800 hover:text-text-primary border-transparent hover:border-surface-500'
        }
      `}
      style={{ borderRadius: '2px' }}
    >
      <span className={active ? 'text-accent' : 'text-text-muted'}>{icon}</span>
      <span
        className="uppercase tracking-wide"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px'
        }}
      >
        {label}
      </span>
    </button>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  )
}
