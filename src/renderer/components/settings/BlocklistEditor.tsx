import { useMemo, useState } from 'react'
import { DEFAULT_SUSPICIOUS_PORTS, SECURITY_TIER_LIMITS } from '@shared/port-security'
import { PlusIcon, RefreshIcon, TrashIcon } from '../icons'
import { useBlocklist } from '../../hooks/useBlocklist'

function parsePortInput(value: string): number | null {
  const port = Number(value.trim())
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return port
}

export function BlocklistEditor() {
  const { entries, isLoading, error, addEntry, removeEntry, resetDefaults } = useBlocklist(true)
  const [portText, setPortText] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const userEntries = useMemo(() => entries.filter(entry => entry.source === 'user'), [entries])
  const defaultCount = entries.filter(entry => entry.source === 'default').length

  const handleAdd = async () => {
    const port = parsePortInput(portText)
    if (port === null) {
      setFormError('请输入 1-65535 之间的端口号')
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      await addEntry({ port, reason: reason.trim() || 'settings', confirmedBy: 'settings-blocklist' })
      setPortText('')
      setReason('')
    } catch (addError) {
      setFormError(addError instanceof Error ? addError.message : String(addError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    setFormError(null)
    try {
      await resetDefaults('settings-blocklist')
      setShowResetConfirm(false)
    } catch (resetError) {
      setFormError(resetError instanceof Error ? resetError.message : String(resetError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section data-testid="settings-blocklist" className="space-y-3">
      <div>
        <div className="text-sm font-bold text-text-primary">端口安全黑名单</div>
        <div className="text-xs text-text-muted">
          默认 {defaultCount || DEFAULT_SUSPICIOUS_PORTS.length} 个可疑端口，用户最多 {SECURITY_TIER_LIMITS.USER_BLOCKLIST_MAX} 条。
        </div>
      </div>

      <div className="grid grid-cols-[minmax(80px,7rem)_minmax(0,1fr)_auto] gap-2">
        <input
          data-testid="blocklist-port-input"
          type="number"
          min={1}
          max={65535}
          value={portText}
          onChange={event => setPortText(event.target.value)}
          placeholder="端口"
          className="input-sm min-w-0"
        />
        <input
          data-testid="blocklist-reason-input"
          type="text"
          maxLength={200}
          value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="原因"
          className="input-sm min-w-0"
        />
        <button
          data-testid="blocklist-add-button"
          type="button"
          disabled={isSaving}
          onClick={handleAdd}
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <PlusIcon size={14} />
          添加
        </button>
      </div>

      {(formError || error) && (
        <div className="border-l-2 border-error bg-error/10 px-3 py-2 text-xs text-error radius-sm">
          {formError ?? error}
        </div>
      )}

      <div className="max-h-40 space-y-2 overflow-y-auto border border-surface-700 bg-surface-900 p-2 radius-sm">
        {isLoading ? (
          <div className="text-xs text-text-muted">正在加载端口黑名单...</div>
        ) : userEntries.length === 0 ? (
          <div className="text-xs text-text-muted">暂无用户自定义端口。</div>
        ) : (
          userEntries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between gap-3 bg-surface-800 px-2 py-1.5 radius-sm">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-text-primary">{entry.port ? `:${entry.port}` : entry.ip}</div>
                <div className="truncate text-[10px] text-text-muted">{entry.reason || 'user'}</div>
              </div>
              <button
                type="button"
                onClick={() => removeEntry({ id: entry.id, confirmedBy: 'settings-blocklist' })}
                className="btn-icon-sm text-error/70 hover:text-error flex-shrink-0"
                title="删除用户黑名单项"
              >
                <TrashIcon size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] text-text-muted">重启后通过 electron-store 自动恢复用户条目。</div>
        {!showResetConfirm ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setShowResetConfirm(true)}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <RefreshIcon size={13} />
            重置用户项
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleReset} className="px-3 py-1.5 bg-error text-white text-xs radius-sm">确认重置</button>
            <button type="button" onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 bg-surface-700 text-text-secondary text-xs radius-sm">取消</button>
          </div>
        )}
      </div>
    </section>
  )
}
