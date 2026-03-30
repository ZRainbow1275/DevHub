import { useState, useEffect, useCallback } from 'react'
import { SearchIcon, CloseIcon, CheckIcon, FolderIcon } from '../icons'

interface DiscoveredProject {
  path: string
  name: string
  scripts: string[]
}

interface AutoDiscoveryDialogProps {
  isOpen: boolean
  projects: DiscoveredProject[]
  onImport: (projects: DiscoveredProject[]) => void
  onClose: () => void
}

export function AutoDiscoveryDialog({ isOpen, projects, onImport, onClose }: AutoDiscoveryDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)

  // Select all by default when projects arrive
  useEffect(() => {
    if (projects.length > 0) {
      setSelected(new Set(projects.map(p => p.path)))
    }
  }, [projects])

  const handleToggle = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(projects.map(p => p.path)))
  }, [projects])

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  const handleImport = useCallback(async () => {
    const toImport = projects.filter(p => selected.has(p.path))
    if (toImport.length === 0) return

    setIsImporting(true)
    try {
      onImport(toImport)
    } finally {
      setIsImporting(false)
    }
  }, [projects, selected, onImport])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-discovery-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-2xl mx-4 shadow-elevated max-h-[85vh] flex flex-col relative"
        style={{ borderRadius: '4px' }}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-accent/20 flex items-center justify-center border-l-3 border-accent"
              style={{ borderRadius: '2px' }}
            >
              <SearchIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2
                id="auto-discovery-dialog-title"
                className="text-gold font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-1deg)',
                  transformOrigin: 'left center'
                }}
              >
                发现项目
              </h2>
              <p className="text-xs text-text-muted">AUTO DISCOVERY</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-sm text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 relative z-10">
          <p className="text-sm text-text-secondary mb-4">
            首次启动检测到以下项目，请选择要导入的项目：
          </p>

          {/* Select All / Deselect All */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-sm text-text-muted bg-surface-800 px-2 py-1 border-l-2 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              {selected.size} / {projects.length} 已选择
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 text-xs text-text-secondary bg-surface-800 hover:bg-surface-700 transition-colors border-l-2 border-surface-600"
                style={{ borderRadius: '2px' }}
              >
                全选
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-3 py-1 text-xs text-text-secondary bg-surface-800 hover:bg-surface-700 transition-colors border-l-2 border-surface-600"
                style={{ borderRadius: '2px' }}
              >
                全不选
              </button>
            </div>
          </div>

          {/* Project List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {projects.map((project, index) => {
              const isSelected = selected.has(project.path)
              return (
                <button
                  key={project.path}
                  onClick={() => handleToggle(project.path)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all animate-card-stagger border-l-3 ${
                    isSelected
                      ? 'bg-accent/10 border-accent'
                      : 'bg-surface-800 border-surface-600 hover:border-surface-500'
                  }`}
                  style={{ borderRadius: '2px', animationDelay: `${index * 30}ms` }}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent'
                        : 'border-surface-500 bg-surface-900'
                    }`}
                    style={{ borderRadius: '2px' }}
                  >
                    {isSelected && <CheckIcon size={12} className="text-white" />}
                  </div>

                  {/* Project Info */}
                  <div className="flex-shrink-0">
                    <FolderIcon size={18} className={isSelected ? 'text-accent' : 'text-text-muted'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-text-primary truncate">{project.name}</h4>
                    <p className="text-xs text-text-muted truncate font-mono">{project.path}</p>
                    {project.scripts.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {project.scripts.slice(0, 4).map((script) => (
                          <span
                            key={script}
                            className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-text-tertiary"
                            style={{ borderRadius: '2px' }}
                          >
                            {script}
                          </span>
                        ))}
                        {project.scripts.length > 4 && (
                          <span className="text-[10px] text-text-muted">+{project.scripts.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-surface-700 relative z-10">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            跳过
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || selected.size === 0}
            className="px-4 py-2.5 bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-accent"
            style={{ borderRadius: '2px' }}
          >
            {isImporting ? '导入中...' : `导入选中 (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
