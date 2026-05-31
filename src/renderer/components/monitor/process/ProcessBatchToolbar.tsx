import { memo } from 'react'
import type { ReactNode } from 'react'
import type { ProcessBatchAction } from '@shared/schemas/r8-runtime'
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  FolderIcon,
  KillIcon,
  LightningIcon,
  ProcessIcon,
  TagIcon
} from '../../icons'
import { PROCESS_BATCH_ACTION_LABELS } from './processBatchModel'

interface ProcessBatchToolbarProps {
  selectedCount: number
  totalCount: number
  disabled: boolean
  disabledActions?: Partial<Record<ProcessBatchAction, string>>
  onAction: (action: ProcessBatchAction) => void
  onSelectAll: () => void
  onClearSelection: () => void
}

const ACTIONS: Array<{ action: ProcessBatchAction; icon: ReactNode; danger?: boolean }> = [
  { action: 'kill', icon: <KillIcon size={14} />, danger: true },
  { action: 'focus', icon: <EyeIcon size={14} /> },
  { action: 'inject-text', icon: <LightningIcon size={14} /> },
  { action: 'tag', icon: <TagIcon size={14} /> },
  { action: 'add-watchdog', icon: <AlertIcon size={14} /> },
  { action: 'export-diag', icon: <FolderIcon size={14} /> }
]

export const ProcessBatchToolbar = memo(function ProcessBatchToolbar({
  selectedCount,
  totalCount,
  disabled,
  disabledActions = {},
  onAction,
  onSelectAll,
  onClearSelection
}: ProcessBatchToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <div
      data-testid="process-batch-toolbar"
      className="flex flex-nowrap items-center gap-3 overflow-x-auto border-b border-surface-700/40 bg-surface-900/70 px-5 py-2"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-accent">
        <ProcessIcon size={14} />
        批量进程
      </div>
      <span data-testid="process-selection-counter" className="whitespace-nowrap text-[11px] text-text-muted">
        已选 {selectedCount} / {totalCount}
      </span>
      <button
        data-testid="process-batch-select-all"
        type="button"
        onClick={onSelectAll}
        disabled={disabled || totalCount === 0}
        className="btn-secondary flex items-center gap-1 whitespace-nowrap px-2 py-1 text-[11px]"
      >
        <CheckIcon size={12} />
        全选当前过滤
      </button>
      <button
        data-testid="process-batch-clear"
        type="button"
        onClick={onClearSelection}
        disabled={disabled || !hasSelection}
        className="btn-secondary whitespace-nowrap px-2 py-1 text-[11px]"
      >
        清除选择
      </button>
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {ACTIONS.map(({ action, icon, danger }) => {
          const disabledReason = disabledActions[action]
          const isDisabled = disabled || !hasSelection || Boolean(disabledReason)
          return (
            <button
              key={action}
              data-testid={`process-batch-action-${action}`}
              type="button"
              onClick={() => onAction(action)}
              disabled={isDisabled}
              title={disabledReason ?? PROCESS_BATCH_ACTION_LABELS[action]}
              className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors radius-sm ${
                danger
                  ? 'border-error/40 bg-error/10 text-error hover:bg-error/20'
                  : 'border-surface-700 bg-surface-800 text-text-secondary hover:border-accent/50 hover:text-accent'
              } ${isDisabled ? 'cursor-not-allowed opacity-45 hover:border-surface-700 hover:text-text-secondary' : ''}`}
            >
              {icon}
              {PROCESS_BATCH_ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>
    </div>
  )
})
