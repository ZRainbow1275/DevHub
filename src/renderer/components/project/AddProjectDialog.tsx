import React, { useState, useCallback, useEffect } from 'react'
import {
  FolderIcon,
  SearchIcon,
  LightningIcon,
  ChevronLeftIcon,
  CloseIcon,
  PlusIcon,
  AlertIcon
} from '../icons'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ProjectTypeBadge } from './ProjectTypeBadge'
import type { ProjectType } from '@shared/types'

interface AddProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (path: string) => Promise<void>
}

interface ScanResult {
  path: string
  name: string
  scripts: string[]
  projectType?: ProjectType
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function AddProjectDialog({ isOpen, onClose, onAdd }: AddProjectDialogProps) {
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [showScanResults, setShowScanResults] = useState(false)

  const handleBrowse = async () => {
    if (!isElectron) return
    const selectedPath = await window.devhub.dialog.openDirectory()
    if (selectedPath) {
      setPath(selectedPath)
      setError(null)
    }
  }

  const handleScan = async () => {
    if (!isElectron) return
    setIsScanning(true)
    setError(null)
    setScanResults([])
    setShowScanResults(true)

    try {
      const results = await window.devhub.projects.scan()
      setScanResults(results)
      if (results.length === 0) {
        setError('未发现任何项目')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setIsScanning(false)
    }
  }

  const handleSmartDiscover = async () => {
    if (!isElectron) return
    setIsScanning(true)
    setError(null)
    setScanResults([])
    setShowScanResults(true)

    try {
      const results = await window.devhub.projects.discover()
      setScanResults(results)
      if (results.length === 0) {
        setError('未发现任何项目')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '智能发现失败')
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanDirectory = async () => {
    if (!isElectron) return
    const selectedPath = await window.devhub.dialog.openDirectory()
    if (!selectedPath) return

    setIsScanning(true)
    setError(null)
    setScanResults([])
    setShowScanResults(true)

    try {
      const results = await window.devhub.projects.scanDirectory(selectedPath)
      setScanResults(results)
      if (results.length === 0) {
        setError('该目录下未发现项目')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setIsScanning(false)
    }
  }

  const handleSelectScanResult = async (result: ScanResult) => {
    setIsLoading(true)
    setError(null)
    try {
      await onAdd(result.path)
      setScanResults((prev) => prev.filter((r) => r.path !== result.path))
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加项目失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!path.trim()) {
      setError('请输入项目路径')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onAdd(path.trim())
      setPath('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加项目失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const items = e.dataTransfer.items
    if (items.length > 0) {
      const item = items[0]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const filePath = 'path' in file ? (file as { path: string }).path : undefined
          if (filePath) {
            setPath(filePath)
            setError(null)
          }
        }
      }
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(() => {
    setShowScanResults(false)
    setScanResults([])
    setPath('')
    setError(null)
    setIsLoading(false)
    setIsDragging(false)
    setIsScanning(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-project-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-2xl mx-4 shadow-elevated max-h-[85vh] flex flex-col relative radius-md"
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-accent/20 flex items-center justify-center border-l-3 border-accent radius-sm"
            >
              <PlusIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2
                id="add-project-dialog-title"
                className="text-gold font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-1deg)',
                  transformOrigin: 'left center'
                }}
              >
                添加项目
              </h2>
              <p className="text-xs text-text-muted">ADD PROJECT</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn-icon-sm text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 relative z-10">
          {!showScanResults ? (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed p-8 text-center transition-all duration-200 ${
                  isDragging
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-600 hover:border-surface-500 hover:bg-surface-800/30'
                } radius-md`}
              >
                <div
                  className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center border-l-3 ${
                    isDragging ? 'border-accent bg-accent/20' : 'border-surface-600 bg-surface-800'
                  } radius-md`}
                >
                  <FolderIcon size={32} className={isDragging ? 'text-accent' : 'text-text-muted'} />
                </div>
                <p className="text-text-secondary mb-2">拖拽项目文件夹到此处</p>
                <p className="text-text-muted text-sm">或</p>
              </div>

              {/* Path Input */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => {
                    setPath(e.target.value)
                    setError(null)
                  }}
                  placeholder="输入项目路径..."
                  className="flex-1 px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent radius-sm"
                />
                <button
                  onClick={handleBrowse}
                  className="px-4 py-2.5 bg-surface-800 text-text-secondary hover:bg-surface-700 transition-colors border-l-2 border-surface-600 radius-sm"
                >
                  浏览
                </button>
              </div>

              {/* Scan Buttons */}
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleSmartDiscover}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white font-medium hover:bg-accent-600 transition-colors border-l-3 border-accent radius-sm"
                  >
                    <LightningIcon size={18} />
                    智能发现
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleScan}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-800 text-text-secondary hover:bg-surface-700 transition-colors border-l-2 border-surface-600 radius-sm"
                  >
                    <SearchIcon size={16} />
                    常规扫描
                  </button>
                  <button
                    onClick={handleScanDirectory}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-800 text-text-secondary hover:bg-surface-700 transition-colors border-l-2 border-surface-600 radius-sm"
                  >
                    <FolderIcon size={16} />
                    扫描目录
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-text-muted text-center">
                支持 npm/pnpm/yarn/Python/Rust/Go/Java 等多生态系统项目自动发现
              </p>
            </>
          ) : (
            <>
              {/* Scan Results View */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setShowScanResults(false)}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeftIcon size={16} />
                  返回
                </button>
                <span
                  className="text-sm text-text-muted bg-surface-800 px-2 py-1 border-l-2 border-surface-600 radius-sm"
                >
                  {isScanning ? '扫描中...' : `发现 ${scanResults.length} 个项目`}
                </span>
              </div>

              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <LoadingSpinner size="md" className="mb-4" />
                  <p className="text-text-secondary">正在扫描项目...</p>
                </div>
              ) : scanResults.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {scanResults.map((result, index) => (
                    <div
                      key={result.path}
                      className="flex items-center justify-between p-3 bg-surface-800 border-l-3 border-surface-600 hover:border-accent transition-all animate-card-stagger"
                      style={{ borderRadius: '2px', animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-text-primary truncate">{result.name}</h4>
                          {result.projectType && <ProjectTypeBadge type={result.projectType} />}
                        </div>
                        <p className="text-xs text-text-muted truncate font-mono">{result.path}</p>
                        {result.scripts.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {result.scripts.slice(0, 4).map((script) => (
                              <span
                                key={script}
                                className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-text-tertiary radius-sm"
                              >
                                {script}
                              </span>
                            ))}
                            {result.scripts.length > 4 && (
                              <span className="text-[10px] text-text-muted">+{result.scripts.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleSelectScanResult(result)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-sm bg-accent text-white hover:bg-accent-600 transition-colors disabled:opacity-50 border-l-2 border-accent radius-sm"
                      >
                        添加
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {/* Error */}
          {error && (
            <div
              className="mt-3 flex items-center gap-2 p-3 bg-error/10 border-l-3 border-error text-error text-sm radius-sm"
            >
              <AlertIcon size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showScanResults && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-surface-700 relative z-10">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors radius-sm"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2.5 bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-accent radius-sm"
            >
              {isLoading ? '添加中...' : '添加项目'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
