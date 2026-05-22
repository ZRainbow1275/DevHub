import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ToolDetectResult, ToolDetectionState } from '@shared/schemas/r8-runtime'
import { RefreshIcon, TerminalIcon } from '../../components/icons'

const TOOL_ORDER: ToolDetectResult['tool'][] = ['codex', 'claude', 'gemini', 'cursor', 'copilot']
type ToolName = ToolDetectResult['tool']

function emptyTool(tool: ToolDetectResult['tool']): ToolDetectResult {
  const checkedAt = Date.now()
  return {
    tool,
    found: false,
    version: null,
    path: null,
    detectStrategy: 'not-found',
    recommendedParser: null,
    capabilities: [],
    errors: ['not scanned'],
    error: 'not scanned',
    checkedAt,
    detectedAt: checkedAt
  }
}

function formatTime(ts: number | null): string {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleTimeString()
}

export function ToolDetectPanel() {
  const [state, setState] = useState<ToolDetectionState | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathDrafts, setPathDrafts] = useState<Partial<Record<ToolName, string>>>({})
  const [savingTool, setSavingTool] = useState<ToolName | null>(null)
  const [overrideMessages, setOverrideMessages] = useState<Partial<Record<ToolName, string>>>({})

  const rows = useMemo(() => {
    const byTool = new Map((state?.results ?? []).map(result => [result.tool, result]))
    return TOOL_ORDER.map(tool => byTool.get(tool) ?? emptyTool(tool))
  }, [state])

  const scan = useCallback(async (force: boolean) => {
    setScanning(true)
    try {
      const next = await window.devhub.r8.cli.detectAll({ force })
      setState(next)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setScanning(false)
    }
  }, [])

  const setDraftForTool = (tool: ToolName, path: string) => {
    setPathDrafts(prev => ({ ...prev, [tool]: path }))
  }

  const setMessageForTool = (tool: ToolName, message: string) => {
    setOverrideMessages(prev => ({ ...prev, [tool]: message }))
  }

  const saveOverride = async (tool: ToolName) => {
    const path = (pathDrafts[tool] ?? '').trim()
    if (!path) {
      setMessageForTool(tool, '请输入真实可执行文件路径')
      return
    }

    setSavingTool(tool)
    try {
      const saved = await window.devhub.r8.cli.setToolOverride(tool, path, 'settings-panel')
      setMessageForTool(tool, `已保存覆盖路径：${saved.path}`)
      const next = await window.devhub.r8.cli.detectAll({ force: true })
      setState(next)
      setError(null)
    } catch (reason) {
      setMessageForTool(tool, reason instanceof Error ? reason.message : String(reason))
    } finally {
      setSavingTool(null)
    }
  }

  const clearOverride = async (tool: ToolName) => {
    setSavingTool(tool)
    try {
      const cleared = await window.devhub.r8.cli.clearToolOverride(tool, 'settings-panel')
      setDraftForTool(tool, '')
      setMessageForTool(tool, cleared.cleared ? '已清除覆盖路径' : '当前没有覆盖路径')
      const next = await window.devhub.r8.cli.detectAll({ force: true })
      setState(next)
      setError(null)
    } catch (reason) {
      setMessageForTool(tool, reason instanceof Error ? reason.message : String(reason))
    } finally {
      setSavingTool(null)
    }
  }

  useEffect(() => {
    void scan(false)
    return window.devhub.r8.cli.onDetectionEvent?.(setState)
  }, [scan])

  useEffect(() => {
    setPathDrafts(prev => {
      let changed = false
      const next = { ...prev }
      for (const result of rows) {
        if (next[result.tool] === undefined) {
          next[result.tool] = result.path ?? ''
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [rows])

  return (
    <div className="space-y-3 rounded-lg border border-surface-700 bg-surface-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-accent" />
          <div>
            <div className="text-sm font-semibold text-text-primary">AI CLI 检测</div>
            <div className="text-xs text-text-muted">
              {state ? `上次扫描 ${formatTime(state.lastFullScanAt)} · ${state.scanDurationMs}ms` : '尚未扫描'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary flex items-center gap-2"
          disabled={scanning}
          onClick={() => { void scan(true) }}
        >
          <RefreshIcon size={14} />
          {scanning ? '扫描中...' : '重新扫描'}
        </button>
      </div>

      {error && <div className="rounded border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning">{error}</div>}

      <div className="grid gap-2">
        {rows.map(result => {
          const draft = pathDrafts[result.tool] ?? result.path ?? ''
          const saving = savingTool === result.tool
          return (
            <div key={result.tool} className="grid gap-2 rounded border border-surface-800 bg-surface-950 px-3 py-2 md:grid-cols-[96px_96px_1fr]">
              <div className="font-mono text-xs uppercase text-text-primary">{result.tool}</div>
              <div className={result.found ? 'text-xs font-semibold text-success' : 'text-xs text-text-muted'}>
                {result.found ? '可用' : '未检测到'}
              </div>
              <div className="min-w-0 text-xs text-text-muted">
                <div className="truncate">{result.version ?? result.error ?? result.errors[0] ?? '无版本信息'}</div>
                <div className="truncate">策略 {result.detectStrategy} · 解析 {result.recommendedParser ?? 'N/A'} · 路径 {result.path ?? 'N/A'}</div>
              </div>
              <div className="grid gap-1 md:col-span-3">
                <label className="text-[11px] font-medium text-text-muted" htmlFor={`tool-detect-path-${result.tool}`}>
                  真实可执行路径覆盖
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id={`tool-detect-path-${result.tool}`}
                    data-testid={`tool-detect-path-${result.tool}`}
                    className="input flex-1 font-mono text-xs"
                    value={draft}
                    placeholder="例如 C:\\Program Files\\DevHub\\tool.exe"
                    onChange={event => setDraftForTool(result.tool, event.target.value)}
                  />
                  <button
                    type="button"
                    data-testid={`tool-detect-save-${result.tool}`}
                    className="btn-secondary whitespace-nowrap"
                    disabled={saving || scanning}
                    onClick={() => { void saveOverride(result.tool) }}
                  >
                    {saving ? '保存中...' : '保存并重扫'}
                  </button>
                  <button
                    type="button"
                    data-testid={`tool-detect-clear-${result.tool}`}
                    className="btn-secondary whitespace-nowrap"
                    disabled={saving || scanning}
                    onClick={() => { void clearOverride(result.tool) }}
                  >
                    清除覆盖
                  </button>
                </div>
                {overrideMessages[result.tool] && (
                  <div data-testid={`tool-detect-message-${result.tool}`} className="text-[11px] text-text-muted">
                    {overrideMessages[result.tool]}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
