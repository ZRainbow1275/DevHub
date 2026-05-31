import { useEffect, memo, useState, useCallback, useMemo, useRef, type MouseEvent } from 'react'
import { PanelDetachButton } from '../popout/PanelDetachButton'
import { useWindows } from '../../hooks/useWindows'
import { useAITasks } from '../../hooks/useAITasks'
import { useBatchSelection, type WindowSelectionGesture } from '../../hooks/useBatchSelection'
import { useAliasStore } from '../../stores/aliasStore'
import { usePortStore } from '../../stores/portStore'
import { WindowInfo, WindowGroup, WindowLayout, AITask, AIToolType, AIWindowAlias, AIMonitorState, AI_MONITOR_STATE_INFO, WindowFavoriteRecord, WindowOperationKind } from '@shared/types-extended'
import { WINDOW_OPERATION_CATALOG } from '@shared/window-operations-catalog'
import { WINDOW_BATCH_LIMITS, type WindowBatchAction, type WindowBatchProgress, type WindowBatchRequest } from '@shared/schemas/r8-runtime'
import { AIWindowAliasBadge } from './AIWindowAlias'
import { ProcessCardErrorBoundary } from './ProcessCardErrorBoundary'
import { useToast } from '../ui/Toast'
import { LayoutPreview } from './LayoutPreview'
import { AttachedGraphView } from './attached/AttachedGraphView'
import { AttachedFlowView } from './attached/AttachedFlowView'
import { ThumbnailWall } from './window/ThumbnailWall'
import { LassoSelect } from './window/LassoSelect'
import { createWindowBatchRequest, runSequentialWindowBatch, summarizeWindowBatchProgress } from './window/windowBatchModel'
import { BatchProgressToast } from './window/BatchProgressToast'
import { BatchConfirmDialog } from './window/BatchConfirmDialog'
import { WindowModuleTour, WINDOW_MODULE_TOUR_STORAGE_KEY } from './window/WindowModuleTour'
import { redactWindowTitle } from './window/windowTitleRedaction'
import { MisreportButton } from '../../views/monitor/MisreportButton'
import { SignalDiagnosticPanel } from '../../views/monitor/SignalDiagnosticPanel'
import { CardEdgeGraphBadge } from './CardEdgeGraphBadge'
import { openWindowInGlobalTopology } from '../../utils/globalTopologyNavigation'
import { useT } from '../../hooks/useT'

import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import { TruncatedText } from '../ui/TruncatedText'
import {
  WindowIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  RefreshIcon,
  PlusIcon,
  CloseIcon,
  EyeIcon,
  TrashIcon,
  CopyIcon,
  ExternalLinkIcon,
  InfoIcon,
  KillIcon,
  PencilIcon,
  ChevronIcon,
  CheckIcon,
  CodeIcon,
  GlobeIcon,
  TerminalIcon,
  AlertIcon,
  ProcessIcon,
  AIIcon,
  MinimizeIcon,
  MaximizeIcon,
  LayoutIcon,
  DownloadIcon,
  GearIcon,
  NetworkIcon
} from '../icons'

const AI_TOOL_DISPLAY_NAMES: Record<AIToolType, string> = {
  'codex': 'Codex CLI',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'cursor': 'Cursor',
  'opencode': 'OpenCode',
  'aider': 'Aider',
  'windsurf': 'Windsurf',
  'continue-dev': 'Continue',
  'cline': 'Cline',
  'other': 'AI Tool',
}

function getAIToolDisplayName(toolType: AIToolType): string {
  return AI_TOOL_DISPLAY_NAMES[toolType] ?? 'AI Tool'
}

function buildWindowNavigationEvent(detail: Record<string, unknown>) {
  return new CustomEvent('devhub:monitor-navigate', { detail })
}

function toWindowSelectionGesture(event: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>, toggle = true): WindowSelectionGesture {
  return {
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    toggle
  }
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function formatWindowInjectionTarget(win: WindowInfo): string {
  return `HWND ${win.hwnd} / ${redactWindowTitle(win.title || win.processName)}`
}

function parseWindowRectInput(input: string): WindowInfo['rect'] | null {
  const parts = input.split(',').map(part => Number.parseInt(part.trim(), 10))
  if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) return null
  const [x, y, width, height] = parts
  if (width < 100 || height < 80) return null
  return { x, y, width, height }
}

function getWindowOperationIcon(kind: WindowOperationKind): React.ReactNode {
  const iconClass = kind === 'close' || kind === 'kill-process' ? 'text-error' : 'text-current'
  switch (kind) {
    case 'focus':
      return <EyeIcon size={14} className={iconClass} />
    case 'minimize':
      return <MinimizeIcon size={14} className={iconClass} />
    case 'maximize':
      return <MaximizeIcon size={14} className={iconClass} />
    case 'restore':
      return <RefreshIcon size={14} className={iconClass} />
    case 'move-resize':
      return <LayoutIcon size={14} className={iconClass} />
    case 'toggle-always-on-top':
      return <GearIcon size={14} className={iconClass} />
    case 'set-opacity':
      return <GearIcon size={14} className={iconClass} />
    case 'screenshot':
      return <DownloadIcon size={14} className={iconClass} />
    case 'copy-title':
      return <CopyIcon size={14} className={iconClass} />
    case 'jump-process':
      return <ProcessIcon size={14} className={iconClass} />
    case 'jump-port':
      return <GlobeIcon size={14} className={iconClass} />
    case 'jump-ai-task':
      return <AIIcon size={14} className={iconClass} />
    case 'open-working-dir':
      return <FolderIcon size={14} className={iconClass} />
    case 'open-project':
      return <ExternalLinkIcon size={14} className={iconClass} />
    case 'toggle-favorite':
      return <InfoIcon size={14} className={iconClass} />
    case 'set-title':
      return <PencilIcon size={14} className={iconClass} />
    case 'send-safe-keys':
      return <TerminalIcon size={14} className={iconClass} />
    case 'close':
      return <CloseIcon size={14} className={iconClass} />
    case 'kill-process':
      return <KillIcon size={14} className={iconClass} />
  }
}

interface WindowOperationContext {
  hasPort: boolean
  hasAITask: boolean
  hasProject: boolean
  isFavorite: boolean
}

interface WindowOperationPanelProps {
  windowInfo: WindowInfo
  context: WindowOperationContext
  compact?: boolean
  onRun: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
}

const WindowOperationPanel = memo(function WindowOperationPanel({
  windowInfo,
  context,
  compact = false,
  onRun
}: WindowOperationPanelProps) {
  const canRun = useCallback((kind: WindowOperationKind): boolean => {
    if (kind === 'jump-port') return context.hasPort
    if (kind === 'jump-ai-task') return context.hasAITask
    if (kind === 'open-project') return context.hasProject
    return true
  }, [context.hasAITask, context.hasPort, context.hasProject])

  return (
    <div
      className={`grid gap-1 ${compact ? 'grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]'}`}
      onClick={(event) => event.stopPropagation()}
      data-testid={`window-operation-panel-${windowInfo.hwnd}`}
    >
      {WINDOW_OPERATION_CATALOG.map((operation) => {
        const enabled = canRun(operation.kind)
        const isFavorite = operation.kind === 'toggle-favorite' && context.isFavorite
        return (
          <button
            key={operation.kind}
            type="button"
            disabled={!enabled}
            title={enabled ? operation.description : `${operation.description}，当前窗口缺少必要关联数据`}
            data-testid={`window-op-${operation.kind}`}
            onClick={() => enabled && onRun(operation.kind, windowInfo)}
            className={`
              flex items-center gap-2 min-w-0 px-2 py-1.5 text-xs font-medium text-left transition-all border-l-2 radius-sm
              ${operation.danger
                ? 'bg-error/10 text-error border-error/50 hover:bg-error hover:text-white'
                : isFavorite
                  ? 'bg-warning/15 text-warning border-warning/50 hover:bg-warning/25'
                  : 'bg-surface-800/60 text-text-secondary border-surface-600 hover:bg-surface-700 hover:text-text-primary hover:border-accent'
              }
              ${enabled ? '' : 'opacity-45 cursor-not-allowed hover:bg-surface-800/60'}
            `}
          >
            <span className="flex-shrink-0">{getWindowOperationIcon(operation.kind)}</span>
            <span className="truncate">{isFavorite ? '取消收藏' : operation.label}</span>
          </button>
        )
      })}
    </div>
  )
})

// ============================================
// Process Group data structure for "group by process" view
// ============================================
interface ProcessGroupData {
  pid: number
  processName: string
  windows: WindowInfo[]
}

// ============================================
// Process Group Card - collapsible group header + child windows
// ============================================
interface ProcessGroupCardProps {
  group: ProcessGroupData
  isExpanded: boolean
  onToggleExpand: () => void
  selectedHwnd: number | null
  selectedWindows: Set<number>
  getOperationContext: (windowInfo: WindowInfo) => WindowOperationContext
  onSelectWindow: (hwnd: number) => void
  onFocusWindow: (hwnd: number) => void
  onToggleCheck: (hwnd: number, gesture?: WindowSelectionGesture) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
  index: number
}

const ProcessGroupCard = memo(function ProcessGroupCard({
  group,
  isExpanded,
  onToggleExpand,
  selectedHwnd,
  selectedWindows,
  getOperationContext,
  onSelectWindow,
  onFocusWindow,
  onToggleCheck,
  onRunOperation,
  index
}: ProcessGroupCardProps) {
  return (
    <div
      className="monitor-card relative overflow-hidden animate-card-stagger border-l-info"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

      {/* Group Header */}
      <div
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-800/30 transition-colors cursor-pointer relative z-10"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-1 hover:bg-surface-700/50 transition-colors radius-sm"
          >
            <ChevronIcon
              size={16}
              className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>

          <div
            className="w-10 h-10 bg-info/20 flex items-center justify-center border-l-3 border-info radius-sm"
          >
            <ProcessIcon size={20} className="text-info" />
          </div>

          <div>
            <span className="text-sm font-semibold text-text-primary">{group.processName}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs text-text-muted bg-surface-800 px-2 py-0.5 border-l-2 border-info radius-sm"
              >
                PID: {group.pid}
              </span>
              <span
                className="text-xs text-text-muted bg-surface-800 px-2 py-0.5 border-l-2 border-surface-600 radius-sm"
              >
                {group.windows.length} 个窗口
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Child Windows */}
      {isExpanded && group.windows.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {group.windows.map((w) => {
            const typeInfo = getWindowTypeInfo(w.processName)
            const isSelected = selectedHwnd === w.hwnd
            const isChecked = selectedWindows.has(w.hwnd)

            return (
              <div
                key={w.hwnd}
                data-window-selection-hwnd={w.hwnd}
                onClick={() => onSelectWindow(w.hwnd)}
                onDoubleClick={() => onFocusWindow(w.hwnd)}
                className={`
                  group flex items-center gap-3 p-2.5 cursor-pointer
                  border-l-2 transition-all duration-200
                  ${isSelected
                    ? 'bg-surface-800 border-l-accent'
                    : 'border-surface-600 hover:bg-surface-800/50 hover:border-l-surface-500'
                  }
                 radius-sm`}
              >
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <div
                    onClick={(event) => onToggleCheck(w.hwnd, toWindowSelectionGesture(event))}
                    className={`
                      w-4 h-4 flex items-center justify-center border-2 transition-all cursor-pointer
                      ${isChecked
                        ? 'bg-accent border-accent'
                        : 'border-surface-500 hover:border-accent'
                      }
                     radius-sm`}
                  >
                    {isChecked && <CheckIcon size={10} className="text-white" />}
                  </div>
                </div>

                {/* Status */}
                <span
                  className={`w-2 h-2 flex-shrink-0 ${
                    w.isMinimized ? 'bg-warning' : 'bg-success'
                  } radius-sm`}
                />

                {/* Icon */}
                <div className={`w-7 h-7 bg-surface-700 flex items-center justify-center border-l-2 ${typeInfo.borderColor} radius-sm`}>
                  {typeInfo.icon}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <TruncatedText
                    text={w.title}
                    className="text-xs text-text-secondary"
                    maxChars={40}
                    enableMarquee
                  />
                </div>

                {/* Size */}
                <span className="text-xs text-text-tertiary font-mono flex-shrink-0">
                  {w.rect?.width ?? 0}x{w.rect?.height ?? 0}
                </span>

                {w.isMinimized && (
                  <span className="status-badge bg-warning/10 text-warning text-xs flex-shrink-0">
                    最小化
                  </span>
                )}

                {w.isSystemWindow && (
                  <span className="status-badge bg-surface-600 text-text-muted text-xs flex-shrink-0">
                    系统
                  </span>
                )}

                {/* Focus button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onFocusWindow(w.hwnd)
                  }}
                  className="btn-icon-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="聚焦窗口"
                >
                  <EyeIcon size={14} />
                </button>
                {isSelected && (
                  <div className="basis-full pt-2 pl-14">
                    <WindowOperationPanel
                      windowInfo={w}
                      context={getOperationContext(w)}
                      compact
                      onRun={onRunOperation}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

// ============================================
// Window Type Icon Mapping
// ============================================
const getWindowTypeInfo = (processName: string): { icon: React.ReactNode; borderColor: string } => {
  const name = processName.toLowerCase()
  if (name.includes('code') || name.includes('ide')) {
    return { icon: <CodeIcon size={20} className="text-info" />, borderColor: 'border-info' }
  }
  if (name.includes('chrome') || name.includes('firefox') || name.includes('edge')) {
    return { icon: <GlobeIcon size={20} className="text-gold" />, borderColor: 'border-gold' }
  }
  if (name.includes('terminal') || name.includes('cmd') || name.includes('powershell')) {
    return { icon: <TerminalIcon size={20} className="text-success" />, borderColor: 'border-success' }
  }
  if (name.includes('explorer')) {
    return { icon: <FolderIcon size={20} className="text-warning" />, borderColor: 'border-warning' }
  }
  return { icon: <WindowIcon size={20} className="text-text-secondary" />, borderColor: 'border-surface-600' }
}

// ============================================
// Window Card - Cards View (Soviet Style)
// ============================================
interface WindowCardProps {
  window: WindowInfo
  isSelected: boolean
  isChecked: boolean
  isTopmost: boolean
  operationContext: WindowOperationContext
  onSelect: () => void
  onShowGraph: () => void
  onFocus: () => void
  onToggleCheck: (gesture?: WindowSelectionGesture) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
  index: number
}

const WindowCard = memo(function WindowCard({
  window,
  isSelected,
  isChecked,
  isTopmost,
  operationContext,
  onSelect,
  onShowGraph,
  onFocus,
  onToggleCheck,
  onRunOperation,
  index
}: WindowCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const typeInfo = getWindowTypeInfo(window.processName)

  return (
    <div
      data-testid={`window-card-${window.hwnd}`}
      data-window-instance-key={`${window.processName}:${window.pid}:${window.hwnd}`}
      data-window-selection-hwnd={window.hwnd}
      data-window-topmost={String(isTopmost)}
      onClick={onSelect}
      onDoubleClick={onFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        monitor-card group relative p-4 cursor-pointer animate-card-stagger
        ${isSelected
          ? 'ring-1 ring-accent/50 border-l-accent'
          : ''
        }
      `}
      style={{ animationDelay: `${index * 30}ms`, minHeight: '88px' }}
    >
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none radius-sm" />
      <CardEdgeGraphBadge
        testId={`window-card-graph-badge-${window.hwnd}`}
        graphEntry="window-card-attached-topology"
        scopeKind="window"
        targetId={window.hwnd}
        ariaLabel={`查看窗口 ${window.hwnd} 关系图`}
        onClick={onShowGraph}
      />

      {/* Checkbox */}
      <div
        className="absolute top-3 left-3 z-10"
        data-testid={`window-card-checkbox-${window.hwnd}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck(toWindowSelectionGesture(e))
        }}
      >
        <div
          className={`
            w-5 h-5 flex items-center justify-center border-2 transition-all cursor-pointer
            ${isChecked
              ? 'bg-accent border-accent'
              : 'border-surface-500 hover:border-accent'
            }
           radius-sm`}
        >
          {isChecked && <CheckIcon size={12} className="text-white" />}
        </div>
      </div>

      <div className="flex items-start gap-4 ml-6">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-12 h-12 bg-surface-700 flex items-center justify-center border-l-3 ${typeInfo.borderColor} radius-sm`}
        >
          {typeInfo.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 flex-shrink-0 ${
                window.isMinimized ? 'bg-warning animate-pulse' : 'bg-success'
              } radius-sm`}
            />
            <TruncatedText
              text={redactWindowTitle(window.title)}
              className="text-sm font-semibold text-text-primary"
              maxChars={40}
              enableMarquee
              testId="window-title-cell"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted min-w-0">
            <span
              data-window-field="processName"
              className="font-mono bg-surface-800 px-2 py-0.5 border-l-2 border-surface-600 radius-sm min-w-0 truncate"
            >
              {window.processName}
            </span>
            <span data-window-field="pid" className="text-text-tertiary font-mono whitespace-nowrap">PID: {window.pid}</span>
            <span data-window-field="hwnd" className="text-text-tertiary font-mono whitespace-nowrap">HWND: {window.hwnd}</span>
          </div>

          {/* Size Info */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="text-xs text-text-tertiary font-mono bg-surface-800/50 px-2 py-0.5 border-l-2 border-surface-600 radius-sm"
            >
              {window.rect?.width ?? 0} × {window.rect?.height ?? 0}
            </span>
            {window.isMinimized && (
              <span className="status-badge bg-warning/20 text-warning border-warning/30">
                最小化
              </span>
            )}
            {window.isSystemWindow && (
              <span className="status-badge bg-surface-600/50 text-text-muted border-surface-500/30">
                系统窗口
              </span>
            )}
            <span
              data-testid={`window-card-topmost-${window.hwnd}`}
              data-window-field="alwaysOnTop"
              data-window-topmost={String(isTopmost)}
              className={`status-badge ${isTopmost ? 'bg-warning/20 text-warning border-warning/30' : 'bg-surface-600/40 text-text-muted border-surface-500/30'}`}
            >
              {isTopmost ? '置顶' : '未置顶'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={`
          flex items-center gap-1 transition-all duration-200
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFocus()
            }}
            className="btn-icon-sm bg-accent/20 text-accent hover:bg-accent hover:text-white"
            title="聚焦窗口"
          >
            <EyeIcon size={16} />
          </button>
        </div>
      </div>

      {isSelected && (
        <div className="mt-4 relative z-10">
          <WindowOperationPanel
            windowInfo={window}
            context={operationContext}
            onRun={onRunOperation}
          />
        </div>
      )}
    </div>
  )
})

// ============================================
// Window Item - List View (Soviet Style)
// ============================================
interface WindowItemProps {
  window: WindowInfo
  isSelected: boolean
  isChecked: boolean
  isTopmost: boolean
  operationContext: WindowOperationContext
  onSelect: () => void
  onFocus: () => void
  onToggleCheck: (gesture?: WindowSelectionGesture) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
  index: number
}

const WindowItem = memo(function WindowItem({
  window,
  isSelected,
  isChecked,
  isTopmost,
  operationContext,
  onSelect,
  onFocus,
  onToggleCheck,
  onRunOperation,
  index
}: WindowItemProps) {
  const typeInfo = getWindowTypeInfo(window.processName)

  return (
    <div
      data-testid={`window-list-row-${window.hwnd}`}
      data-window-instance-key={`${window.processName}:${window.pid}:${window.hwnd}`}
      data-window-selection-hwnd={window.hwnd}
      data-window-topmost={String(isTopmost)}
      onClick={onSelect}
      onDoubleClick={onFocus}
      className={`
        group flex items-center gap-3 p-3 cursor-pointer
        border-l-3 transition-all duration-200 animate-card-stagger
        ${isSelected
          ? 'bg-surface-800 border-l-accent'
          : 'border-transparent hover:bg-surface-800/50 hover:border-l-surface-600'
        }
      `}
      style={{ borderRadius: '2px', animationDelay: `${index * 20}ms` }}
    >
      {/* Checkbox */}
      <div data-testid={`window-list-checkbox-${window.hwnd}`} onClick={(e) => e.stopPropagation()}>
        <div
          onClick={(event) => onToggleCheck(toWindowSelectionGesture(event))}
          className={`
            w-4 h-4 flex items-center justify-center border-2 transition-all cursor-pointer
            ${isChecked
              ? 'bg-accent border-accent'
              : 'border-surface-500 hover:border-accent'
            }
           radius-sm`}
        >
          {isChecked && <CheckIcon size={10} className="text-white" />}
        </div>
      </div>

      {/* Status */}
      <span
        className={`w-2 h-2 flex-shrink-0 ${
          window.isMinimized ? 'bg-warning' : 'bg-success'
        } radius-sm`}
      />

      {/* Icon */}
      <div className={`w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 ${typeInfo.borderColor} radius-sm`}>
        {typeInfo.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TruncatedText
            text={redactWindowTitle(window.title)}
            className="text-sm font-medium text-text-primary"
            maxChars={40}
            enableMarquee
          />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span data-window-field="processName" className="text-xs text-text-muted">{window.processName}</span>
          <span data-window-field="pid" className="text-xs text-text-tertiary font-mono">PID: {window.pid}</span>
          <span data-window-field="hwnd" className="text-xs text-text-tertiary font-mono">HWND: {window.hwnd}</span>
        </div>
      </div>

      {/* Size & Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-text-tertiary font-mono">
          {window.rect?.width ?? 0}×{window.rect?.height ?? 0}
        </span>
        {window.isMinimized && (
          <span className="status-badge bg-warning/10 text-warning text-xs">
            最小化
          </span>
        )}
        {window.isSystemWindow && (
          <span className="status-badge bg-surface-600/50 text-text-muted text-xs">
            系统
          </span>
        )}
        <span
          data-testid={`window-list-topmost-${window.hwnd}`}
          data-window-field="alwaysOnTop"
          data-window-topmost={String(isTopmost)}
          className={`status-badge text-xs ${isTopmost ? 'bg-warning/20 text-warning border-warning/30' : 'bg-surface-600/40 text-text-muted border-surface-500/30'}`}
        >
          {isTopmost ? '置顶' : '未置顶'}
        </span>
      </div>

      {/* Focus Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onFocus()
        }}
        className="btn-icon-sm opacity-0 group-hover:opacity-100 transition-opacity"
        title="聚焦窗口"
      >
        <EyeIcon size={16} />
      </button>

      {isSelected && (
        <div className="basis-full pt-2">
          <WindowOperationPanel
            windowInfo={window}
            context={operationContext}
            compact
            onRun={onRunOperation}
          />
        </div>
      )}
    </div>
  )
})

// ============================================
// Window Group Card (Soviet Style)
// ============================================
interface WindowGroupCardProps {
  group: WindowGroup
  isSelected: boolean
  onSelect: () => void
  onFocusGroup: () => void
  onMinimizeGroup: () => void
  onCloseGroup: () => void
  onRename: (newName: string) => unknown
  onRemove: () => void
  index: number
}

const WindowGroupCard = memo(function WindowGroupCard({
  group,
  isSelected,
  onSelect,
  onFocusGroup,
  onMinimizeGroup,
  onCloseGroup,
  onRename,
  onRemove,
  index
}: WindowGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(group.name)

  useEffect(() => {
    if (!isRenaming) setRenameDraft(group.name)
  }, [group.name, isRenaming])

  return (
    <>
      <div
        className={`
          monitor-card relative overflow-hidden animate-card-stagger
          ${isSelected ? 'ring-1 ring-accent/50 border-l-accent' : 'border-l-purple-500'}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

        {/* Header */}
        <div
          onClick={onSelect}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-800/30 transition-colors cursor-pointer relative z-10"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="p-1 hover:bg-surface-700/50 transition-colors radius-sm"
            >
              <ChevronIcon
                size={16}
                className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>

            <div
              className="w-10 h-10 bg-purple-500/20 flex items-center justify-center border-l-3 border-purple-500 radius-sm"
            >
              <FolderIcon size={20} className="text-purple-400" />
            </div>

            <div className="min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="w-40 px-2 py-1 bg-surface-800 border border-surface-600 text-sm text-text-primary focus:outline-none focus:border-accent radius-sm"
                    autoFocus
                  />
                  <button
                    className="btn-icon-sm bg-success/10 text-success hover:bg-success hover:text-white"
                    title="保存分组名称"
                    onClick={(e) => {
                      e.stopPropagation()
                      const nextName = renameDraft.trim()
                      if (nextName && nextName !== group.name) onRename(nextName)
                      setIsRenaming(false)
                    }}
                  >
                    <CheckIcon size={14} />
                  </button>
                  <button
                    className="btn-icon-sm bg-surface-700 text-text-muted hover:bg-surface-600"
                    title="取消重命名"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenameDraft(group.name)
                      setIsRenaming(false)
                    }}
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold text-text-primary">{group.name}</span>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs text-text-muted bg-surface-800 px-2 py-0.5 border-l-2 border-purple-500 radius-sm"
                >
                  {group.windows.length} 个窗口
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={`
            flex items-center gap-2 transition-all duration-200
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
          `}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFocusGroup()
              }}
              className="btn-icon-sm bg-accent/20 text-accent hover:bg-accent hover:text-white"
              title="聚焦全部"
            >
              <GridIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMinimizeGroup()
              }}
              className="btn-icon-sm bg-warning/10 text-warning/70 hover:bg-warning hover:text-white"
              title="全部最小化"
            >
              <WindowIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCloseGroup()
              }}
              className="btn-icon-sm bg-orange-500/10 text-orange-400/70 hover:bg-orange-500 hover:text-white"
              title="关闭全部窗口"
            >
              <CloseIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setRenameDraft(group.name)
                setIsRenaming(true)
              }}
              className="btn-icon-sm bg-info/10 text-info/70 hover:bg-info hover:text-white"
              title="重命名分组"
            >
              <GearIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              className="btn-icon-sm bg-error/10 text-error/70 hover:bg-error hover:text-white"
              title="删除分组"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {/* Windows List */}
        {isExpanded && group.windows.length > 0 && (
          <div className="px-4 pb-4 space-y-1.5">
            {group.windows.map((window) => (
              <div
                key={window.hwnd}
                className="flex items-center gap-2 p-2 bg-surface-800/30 hover:bg-surface-800/50 transition-colors border-l-2 border-surface-600 radius-sm"
              >
                <span className="w-1.5 h-1.5 bg-success radius-sm" />
                <TruncatedText
                  text={redactWindowTitle(window.title)}
                  className="text-xs text-text-secondary flex-1"
                  maxChars={40}
                  enableMarquee
                />
                <span className="text-xs text-text-muted font-mono">
                  {window.processName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除分组"
        message={`确定要删除窗口分组 "${group.name}" 吗？`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onRemove()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
})

// ============================================
// Layout Card (Soviet Style)
// ============================================
interface LayoutCardProps {
  layout: WindowLayout
  onRestore: () => void
  onRemove: () => void
  index: number
  showPreview?: boolean
}

const LayoutCard = memo(function LayoutCard({ layout, onRestore, onRemove, index, showPreview = true }: LayoutCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <div
        className="monitor-card group p-4 border-l-cyan-500 animate-card-stagger"
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none radius-sm" />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 bg-cyan-500/20 flex items-center justify-center border-l-3 border-cyan-500 radius-sm"
            >
              <GridIcon size={24} className="text-cyan-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary">{layout.name}</h4>
              {layout.description && (
                <p className="text-xs text-text-muted mt-0.5 max-w-xs">{layout.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-xs bg-surface-800 text-text-tertiary px-2 py-0.5 border-l-2 border-cyan-500 radius-sm"
                >
                  {layout.groups.length} 个分组
                </span>
                <span className="text-xs text-text-muted">
                  创建于 {new Date(layout.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>

          {/* Layout preview thumbnail */}
          {showPreview && layout.groups.length > 0 && (
            <LayoutPreview
              windows={layout.groups.flatMap(g =>
                g.windows.map(w => ({
                  title: w.titlePattern,
                  processName: w.processName,
                  rect: w.rect
                }))
              )}
            />
          )}

          {/* Actions */}
          <div className={`
            flex items-center gap-2 transition-all duration-200
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
          `}>
            <button
              onClick={onRestore}
              className="px-3 py-1.5 text-xs font-medium bg-success/20 text-success hover:bg-success hover:text-white transition-all duration-200 radius-sm"
            >
              恢复布局
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-icon-sm bg-error/10 text-error/70 hover:bg-error hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除布局"
        message={`确定要删除布局 "${layout.name}" 吗？`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onRemove()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
})

// ============================================
// Empty State (Soviet Style)
// ============================================
const EmptyState = memo(function EmptyState({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center relative">
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

      <div
        className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-surface-600 radius-md"
      >
        {icon}
      </div>
      <p
        className="text-text-secondary font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}
      >
        {title}
      </p>
      <p className="text-xs text-text-muted mt-1">{description}</p>
    </div>
  )
})

// ============================================
// AI Window Card - Pinned section for AI tools
// ============================================
interface AIWindowCardProps {
  window: WindowInfo
  task?: AITask
  displayName: string
  monitorState: AIMonitorState
  isSelected: boolean
  isChecked: boolean
  operationContext: WindowOperationContext
  onSelect: () => void
  onShowGraph: () => void
  onFocus: () => void
  onToggleCheck: (gesture?: WindowSelectionGesture) => void
  onRename: (newName: string) => void
  onMinimize: () => void
  onMaximize: () => void
  onRestore: () => void
  onClose: () => void
  onSetTopmost?: (hwnd: number, topmost: boolean) => void
  onSetOpacity?: (hwnd: number, opacity: number) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
  index: number
}

const AIWindowCard = memo(function AIWindowCard({
  window: win,
  task,
  displayName,
  monitorState,
  isSelected,
  isChecked,
  operationContext,
  onSelect,
  onShowGraph,
  onFocus,
  onToggleCheck,
  onRename,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
  onSetTopmost,
  onSetOpacity,
  onRunOperation,
  index
}: AIWindowCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isTopmost, setIsTopmost] = useState(false)
  const [opacity, setOpacity] = useState(100)
  const [showOpacitySlider, setShowOpacitySlider] = useState(false)

  const stateInfo = AI_MONITOR_STATE_INFO[monitorState] || AI_MONITOR_STATE_INFO.idle
  const stateColorMap: Record<string, string> = {
    gray: 'bg-gray-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }
  const dotColor = stateColorMap[stateInfo.color] || 'bg-gray-500'
  const isActive = monitorState === 'initializing' || monitorState === 'thinking' || monitorState === 'receiving-input' || monitorState === 'coding' || monitorState === 'compiling' || monitorState === 'validating'

  const { aliases } = useAliasStore()
  const hasAlias = aliases.some(a => a.alias === displayName && !a.autoGenerated)

  const avgCpu = task?.metrics.cpuHistory.length
    ? (task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length)
    : 0
  const feedbackKind = monitorState === 'idle' ? 'false-idle' : 'false-thinking'
  const feedbackExpectedState = monitorState === 'idle' ? 'running' : 'idle'

  const handleTopmostToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !isTopmost
    setIsTopmost(next)
    onSetTopmost?.(win.hwnd, next)
  }, [isTopmost, onSetTopmost, win.hwnd])

  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setOpacity(val)
    onSetOpacity?.(win.hwnd, val)
  }, [onSetOpacity, win.hwnd])

  return (
    <div
      data-testid={`window-card-${win.hwnd}`}
      data-window-selection-hwnd={win.hwnd}
      onClick={onSelect}
      onDoubleClick={onFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowOpacitySlider(false) }}
      className={`
        monitor-card group relative p-4 cursor-pointer animate-card-stagger
        border-l-3
        ${isSelected
          ? 'ring-1 ring-accent/50 border-l-accent'
          : 'border-l-blue-500'
        }
      `}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none radius-sm" />
      <CardEdgeGraphBadge
        testId={`window-card-graph-badge-${win.hwnd}`}
        graphEntry="window-card-attached-topology"
        scopeKind="window"
        targetId={win.hwnd}
        ariaLabel={`查看窗口 ${win.hwnd} 关系图`}
        onClick={onShowGraph}
      />

      <div
        className="absolute left-3 top-3 z-10"
        data-testid={`window-card-checkbox-${win.hwnd}`}
        onClick={(event) => {
          event.stopPropagation()
          onToggleCheck(toWindowSelectionGesture(event))
        }}
      >
        <div
          className={`flex h-5 w-5 cursor-pointer items-center justify-center border-2 transition-all radius-sm ${
            isChecked ? 'bg-accent border-accent' : 'border-surface-500 bg-surface-950/80 hover:border-accent'
          }`}
        >
          {isChecked && <CheckIcon size={12} className="text-white" />}
        </div>
      </div>

      <div className="flex items-start gap-4 relative z-10">
        {/* AI Icon with status indicator */}
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 bg-blue-500/20 flex items-center justify-center border-l-3 border-blue-500 radius-sm"
          >
            <AIIcon size={20} className="text-blue-400" />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 w-3 h-3 ${dotColor} border-2 border-surface-900 ${isActive ? 'animate-pulse' : ''}`}
            style={{ borderRadius: '50%' }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
            {/* Inline alias badge with edit */}
            <AIWindowAliasBadge
              displayName={displayName}
              hasAlias={hasAlias}
              task={task}
              hwnd={win.hwnd}
              workingDir={task?.projectId}
              windowTitle={redactWindowTitle(win.title)}
              onRename={onRename}
            />

            {/* AI badge */}
            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 font-medium radius-sm flex-shrink-0">
              AI
            </span>

            {/* Monitor state badge */}
            <span
              className="text-xs px-1.5 py-0.5 font-medium flex-shrink-0 whitespace-nowrap"
              style={{
                borderRadius: '2px',
                color: `var(--color-${stateInfo.color === 'gray' ? 'text-muted' : stateInfo.color === 'green' ? 'success' : stateInfo.color === 'red' ? 'error' : stateInfo.color === 'orange' ? 'warning' : stateInfo.color === 'yellow' ? 'warning' : 'info'}, currentColor)`,
                backgroundColor: `${stateColorMap[stateInfo.color]?.replace('bg-', 'rgba(') || 'rgba(128,128,128,'}0.15)`
              }}
            >
              {stateInfo.label}
            </span>
            {task && (
              <MisreportButton
                instanceId={task.id}
                kind={feedbackKind}
                expectedTaskState={feedbackExpectedState}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted min-w-0">
            <span className="font-mono bg-surface-800 px-2 py-0.5 border-l-2 border-blue-500 radius-sm min-w-0 truncate">
              {win.processName}
            </span>
            <span className="text-text-tertiary font-mono whitespace-nowrap">PID: {win.pid}</span>
            {task && (
              <span className="text-text-tertiary font-mono whitespace-nowrap">CPU: {avgCpu.toFixed(1)}%</span>
            )}
          </div>

          {/* Window title */}
          <div className="mt-1">
            <TruncatedText
              text={redactWindowTitle(win.title)}
              className="text-xs text-text-tertiary"
              maxChars={40}
              enableMarquee
            />
          </div>

          {/* Opacity slider (shown on demand) */}
          {showOpacitySlider && (
            <div
              className="flex items-center gap-2 mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] text-text-muted w-10 flex-shrink-0">透明度</span>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={opacity}
                onChange={handleOpacityChange}
                className="flex-1 h-1 accent-blue-400"
                title={`透明度: ${opacity}%`}
              />
              <span className="text-[10px] font-mono text-text-muted w-8 text-right">{opacity}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`
          flex flex-col items-end gap-1 transition-all duration-200 flex-shrink-0
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
        `}>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onFocus() }}
              className="btn-icon-sm bg-accent/20 text-accent hover:bg-accent hover:text-white"
              title="聚焦"
            >
              <EyeIcon size={14} />
            </button>
            <button
              onClick={handleTopmostToggle}
              className={`btn-icon-sm transition-colors ${isTopmost ? 'bg-warning/30 text-warning' : 'bg-surface-700 text-text-muted hover:text-warning'}`}
              title={isTopmost ? '取消置顶' : '窗口置顶'}
            >
              <LayoutIcon size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowOpacitySlider(v => !v) }}
              className={`btn-icon-sm transition-colors ${showOpacitySlider ? 'bg-info/30 text-info' : 'bg-surface-700 text-text-muted hover:text-info'}`}
              title="调整透明度"
            >
              <GearIcon size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {win.isMinimized ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRestore() }}
                className="btn-icon-sm bg-success/10 text-success/70 hover:bg-success hover:text-white"
                title="恢复"
              >
                <MaximizeIcon size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onMinimize() }}
                  className="btn-icon-sm bg-warning/10 text-warning/70 hover:bg-warning hover:text-white"
                  title="最小化"
                >
                  <MinimizeIcon size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMaximize() }}
                  className="btn-icon-sm bg-info/10 text-info/70 hover:bg-info hover:text-white"
                  title="最大化"
                >
                  <MaximizeIcon size={14} />
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="btn-icon-sm bg-error/10 text-error/70 hover:bg-error hover:text-white"
              title="关闭"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="mt-4 relative z-10">
          <WindowOperationPanel
            windowInfo={win}
            context={operationContext}
            onRun={onRunOperation}
          />
          {task && <SignalDiagnosticPanel instanceId={task.id} />}
        </div>
      )}
    </div>
  )
})

// ============================================
// Batch Operations Toolbar
// ============================================
interface BatchToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onFocusAll: () => void
  onTile: () => void
  onCascade: () => void
  onStack: () => void
  onRestorePrevious: () => void
  onToggleTopmostAll: () => void
  onScreenshotAll: () => void
  onMinimizeAll: () => void
  onRestoreAll: () => void
  onCloseAll: () => void
  onClearSelection: () => void
}

interface PendingWindowBatchConfirm {
  confirmText: string
  kind: 'close' | 'inject'
  message: string
  targetSummary: string
  title: string
  variant: 'danger' | 'warning'
  onCancel?: () => void
  onConfirm: () => Promise<void> | void
}

type WindowBatchHandler = (hwnd: number, request: WindowBatchRequest) => Promise<unknown> | unknown
type WindowBatchPatch = Partial<Pick<WindowBatchRequest, 'args' | 'confirmed' | 'dryRun'>>
type WindowBatchOptions = { delayMs?: number }

interface WindowBatchRetryContext {
  action: WindowBatchAction
  actionLabel: string
  handler: WindowBatchHandler
  options: WindowBatchOptions
  patch: WindowBatchPatch
}

const BatchToolbar = memo(function BatchToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onFocusAll,
  onTile,
  onCascade,
  onStack,
  onRestorePrevious,
  onToggleTopmostAll,
  onScreenshotAll,
  onMinimizeAll,
  onRestoreAll,
  onCloseAll,
  onClearSelection
}: BatchToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2 gap-y-2 px-4 py-2 bg-surface-800 border-b border-surface-700 animate-fade-in"
    >
      <span className="text-xs text-text-muted whitespace-nowrap">
        已选择 {selectedCount} 个窗口
      </span>
      {selectedCount < totalCount && (
      <button
        onClick={onSelectAll}
        data-testid="window-batch-select-all"
        className="text-xs text-accent hover:text-accent/80 transition-colors whitespace-nowrap"
      >
          全选
        </button>
      )}
      <div className="h-4 w-px bg-surface-600" />
      <button
        onClick={onFocusAll}
        data-testid="window-batch-action-focus"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all radius-sm"
        title="依次聚焦选中窗口"
      >
        <EyeIcon size={12} />
        批量聚焦
      </button>
      <button
        onClick={onTile}
        data-testid="window-batch-action-tile"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-info/10 text-info hover:bg-info hover:text-white transition-all radius-sm"
        title="平铺选中窗口"
      >
        <GridIcon size={12} />
        批量平铺
      </button>
      <button
        onClick={onCascade}
        data-testid="window-batch-action-cascade"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-info/10 text-info hover:bg-info hover:text-white transition-all radius-sm"
        title="层叠选中窗口"
      >
        <LayoutIcon size={12} />
        批量层叠
      </button>
      <button
        onClick={onStack}
        data-testid="window-batch-action-stack"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all radius-sm"
        title="堆叠选中窗口 (相同位置)"
      >
        <WindowIcon size={12} />
        批量堆叠
      </button>
      <button
        onClick={onRestorePrevious}
        data-testid="window-batch-action-restore-previous"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-success/10 text-success hover:bg-success hover:text-white transition-all radius-sm"
        title="恢复上次布局前位置"
      >
        <RefreshIcon size={12} />
        撤销布局
      </button>
      <button
        onClick={onToggleTopmostAll}
        data-testid="window-batch-action-topmost"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all radius-sm"
        title="切换选中窗口置顶"
      >
        <GearIcon size={12} />
        批量置顶
      </button>
      <button
        onClick={onScreenshotAll}
        data-testid="window-batch-action-screenshot"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-info/10 text-info hover:bg-info hover:text-white transition-all radius-sm"
        title="依次截图选中窗口"
      >
        <DownloadIcon size={12} />
        批量截图
      </button>
      <button
        onClick={onMinimizeAll}
        data-testid="window-batch-action-minimize"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-warning/10 text-warning hover:bg-warning hover:text-white transition-all radius-sm"
        title="最小化选中窗口"
      >
        <MinimizeIcon size={12} />
        批量最小化
      </button>
      <button
        onClick={onRestoreAll}
        data-testid="window-batch-action-restore"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-success/10 text-success hover:bg-success hover:text-white transition-all radius-sm"
        title="恢复选中窗口"
      >
        <MaximizeIcon size={12} />
        批量恢复
      </button>
      <button
        onClick={onCloseAll}
        data-testid="window-batch-action-close"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-error/10 text-error hover:bg-error hover:text-white transition-all radius-sm"
        title="关闭选中窗口"
      >
        <CloseIcon size={12} />
        批量关闭
      </button>
      <button
        onClick={onClearSelection}
        data-testid="window-batch-clear-selection"
        className="text-xs text-text-muted hover:text-text-primary transition-colors whitespace-nowrap ml-auto"
      >
        清除选择
      </button>
    </div>
  )
})

// ============================================
// Main WindowView Component
// ============================================
export function WindowView() {
  const { t } = useT()
  const {
    windows,
    groups,
    layouts,
    isScanning,
    selectedHwnd,
    selectedGroupId,
    scan,
    focusWindow,
    focusGroup,
    createGroup,
    fetchGroups,
    removeGroup,
    renameGroup,
    minimizeGroup,
    closeGroup,
    saveLayout,
    saveSnapshot,
    restoreLayout,
    fetchLayouts,
    removeLayout,
    restorePreviousLayout,
    screenshotWindow,
    toggleFavoriteWindow,
    getFavoriteWindows,
    openWorkingDir,
    selectWindow,
    selectGroup,
    // Advanced operations
    moveWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    closeWindow,
    setWindowTopmost,
    listTopmostWindows,
    setWindowOpacity,
    setWindowTitle,
    sendKeysToWindow,
    tileWindows,
    cascadeWindows,
    stackWindows
  } = useWindows()

  const { activeTasks, fetchActiveTasks } = useAITasks()
  const { aliases, fetchAliases, renameAndApply } = useAliasStore()
  const ports = usePortStore((state) => state.ports)

  const { showToast } = useToast()

  // Unified feedback wrapper for async operations
  const withFeedback = useCallback(async (
    operation: () => Promise<unknown>,
    successMsg: string,
    errorMsg: string
  ): Promise<unknown> => {
    try {
      const result = await operation()
      if (result !== false && result !== null && result !== undefined) {
        showToast('success', successMsg)
      } else {
        showToast('error', errorMsg)
      }
      return result
    } catch (err) {
      showToast('error', `${errorMsg}: ${err instanceof Error ? err.message : '未知错误'}`)
      return null
    }
  }, [showToast])

  const [viewTab, setViewTab] = useState<'windows' | 'groups' | 'layouts'>('windows')
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'process' | 'wall'>('cards')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showSaveLayout, setShowSaveLayout] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newLayoutName, setNewLayoutName] = useState('')
  const [newLayoutDesc, setNewLayoutDesc] = useState('')
  const {
    selectedWindows,
    selectedHwnds,
    clearSelection: clearWindowSelection,
    removeWindows: removeSelectedWindows,
    selectAll: selectAllWindows,
    selectRectangle: selectWindowRectangle,
    selectWindow: selectBatchWindow
  } = useBatchSelection()
  const [windowBatchActionLabel, setWindowBatchActionLabel] = useState('批量操作')
  const [windowBatchConfirm, setWindowBatchConfirm] = useState<PendingWindowBatchConfirm | null>(null)
  const [windowBatchCancelRequested, setWindowBatchCancelRequested] = useState(false)
  const [windowBatchProgress, setWindowBatchProgress] = useState<WindowBatchProgress | null>(null)
  const windowBatchCancelRequestedRef = useRef(false)
  const windowBatchRetryContextRef = useRef<WindowBatchRetryContext | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSystemWindows, setShowSystemWindows] = useState(false)
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set())
  const [favorites, setFavorites] = useState<WindowFavoriteRecord[]>([])
  const [topmostWindows, setTopmostWindows] = useState<Set<number>>(new Set())
  const [isWindowTourOpen, setIsWindowTourOpen] = useState(() => window.localStorage.getItem(WINDOW_MODULE_TOUR_STORAGE_KEY) !== 'dismissed')
  const [windowTourStep, setWindowTourStep] = useState(0)
  // Race condition guard: tracks the latest scan version so stale results trigger a corrective re-scan
  const scanVersionRef = useRef(0)
  // Tracks the latest showSystemWindows value for the corrective re-scan
  const latestShowSystemRef = useRef(false)
  const windowRelationshipPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scan(showSystemWindows)
    fetchGroups()
    fetchLayouts()
    fetchActiveTasks()
    fetchAliases()
    getFavoriteWindows().then(setFavorites).catch(() => setFavorites([]))
    listTopmostWindows().then(hwnds => setTopmostWindows(new Set(hwnds))).catch(() => setTopmostWindows(new Set()))
    // showSystemWindows intentionally excluded — handleToggleSystemWindows drives re-scan on toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, fetchGroups, fetchLayouts, fetchActiveTasks, fetchAliases, getFavoriteWindows, listTopmostWindows])

  // Periodically refresh AI tasks to keep status in sync
  useEffect(() => {
    const interval = setInterval(() => { fetchActiveTasks() }, 3000)
    return () => clearInterval(interval)
  }, [fetchActiveTasks])

  // Rescan when showSystemWindows changes, with race condition protection.
  // If scan() completes and discovers its version is stale (user toggled again while the
  // previous scan was in-flight), it re-issues a corrective scan with the latest flag
  // so the store always converges to fresh data.
  const handleToggleSystemWindows = useCallback(() => {
    setShowSystemWindows(prev => {
      const next = !prev
      latestShowSystemRef.current = next
      const version = ++scanVersionRef.current
      scan(next).then(() => {
        if (scanVersionRef.current !== version) {
          // A newer toggle happened — store holds stale data. Issue a corrective scan
          // with the most recent showSystemWindows value.
          scan(latestShowSystemRef.current)
        }
      })
      return next
    })
  }, [scan])

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) {
      showToast('warning', '请输入分组名称')
      return
    }

    // Filter out stale hwnds that no longer exist in current window list
    const validHwnds = Array.from(selectedWindows).filter(hwnd =>
      windows.some(w => w.hwnd === hwnd)
    )

    if (validHwnds.length === 0) {
      showToast('error', '所选窗口已关闭，请重新选择')
      clearWindowSelection()
      return
    }

    try {
      const result = await createGroup(newGroupName.trim(), validHwnds)
      if (result) {
        showToast('success', `分组 "${newGroupName.trim()}" 创建成功 (${validHwnds.length} 个窗口)`)
        setNewGroupName('')
        clearWindowSelection()
        setShowCreateGroup(false)
        await fetchGroups()
      } else {
        showToast('error', '分组创建失败')
      }
    } catch (err) {
      showToast('error', `分组创建失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }, [newGroupName, selectedWindows, windows, createGroup, fetchGroups, showToast, clearWindowSelection])

  const handleSaveLayout = useCallback(async () => {
    if (!newLayoutName.trim()) {
      showToast('warning', '请输入布局名称')
      return
    }

    try {
      const validSelectedHwnds = Array.from(selectedWindows).filter(hwnd => windows.some(windowInfo => windowInfo.hwnd === hwnd))
      const snapshotHwnds = validSelectedHwnds.length > 0
        ? validSelectedHwnds
        : windows.filter(windowInfo => !windowInfo.isSystemWindow).map(windowInfo => windowInfo.hwnd)
      if (snapshotHwnds.length === 0) {
        showToast('error', '没有可保存的真实窗口')
        return
      }

      const snapshot = await saveSnapshot(newLayoutName.trim(), newLayoutDesc || undefined, snapshotHwnds)
      const result = await saveLayout(newLayoutName.trim(), newLayoutDesc || undefined)
      if (snapshot && result) {
        const windowCount = result.groups.reduce((sum, g) => sum + g.windows.length, 0)
        showToast('success', `布局 "${newLayoutName.trim()}" 已保存 (${snapshot.items.length} 个快照窗口, ${windowCount} 个兼容窗口)`)
        setNewLayoutName('')
        setNewLayoutDesc('')
        setShowSaveLayout(false)
      } else {
        showToast('error', '布局保存失败')
      }    } catch (err) {
      showToast('error', `布局保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }, [newLayoutName, newLayoutDesc, selectedWindows, windows, saveLayout, saveSnapshot, showToast])

  // ==================== AI Window Identification ====================
  // Match windows to AI tasks by PID to identify AI tool windows
  const aiWindowPids = useMemo(() => {
    return new Set(activeTasks.map(t => t.pid))
  }, [activeTasks])

  // Split windows into AI windows (pinned) and regular windows
  const { aiWindows, regularWindows } = useMemo(() => {
    const ai: WindowInfo[] = []
    const regular: WindowInfo[] = []
    for (const w of windows) {
      if (aiWindowPids.has(w.pid)) {
        ai.push(w)
      } else {
        regular.push(w)
      }
    }
    return { aiWindows: ai, regularWindows: regular }
  }, [windows, aiWindowPids])

  // Get display name for an AI window (alias > autoName > processName)
  // Multi-level alias lookup: task.alias -> toolType+workingDir -> titlePrefix -> pid fallback
  const getAIWindowDisplayName = useCallback((win: WindowInfo): string => {
    const task = activeTasks.find(t => t.pid === win.pid)
    if (task?.alias) return task.alias
    if (task?.autoName) return task.autoName
    // Check stored aliases with multi-level fallback strategy
    // Strategy 1: Match by toolType + workingDir (most reliable for persisted aliases)
    const byWorkingDir = task && aliases.find(a =>
      a.matchCriteria.toolType === task.toolType &&
      a.matchCriteria.workingDir &&
      a.matchCriteria.workingDir === task.projectId
    )
    if (byWorkingDir) return byWorkingDir.alias
    // Strategy 2: Match by titlePrefix (survives process restarts if title is stable)
    const byTitle = aliases.find(a =>
      a.matchCriteria.titlePrefix && win.title.startsWith(a.matchCriteria.titlePrefix)
    )
    if (byTitle) return byTitle.alias
    // Strategy 3: Match by pid (least reliable - pid changes on restart)
    const byPid = aliases.find(a => a.matchCriteria.pid === win.pid)
    if (byPid) return byPid.alias
    return win.processName
  }, [activeTasks, aliases])

  // Get monitor state for an AI window
  const getAIWindowMonitorState = useCallback((win: WindowInfo): AIMonitorState => {
    const task = activeTasks.find(t => t.pid === win.pid)
    return task?.monitorState ?? 'idle'
  }, [activeTasks])

  const favoriteKeySet = useMemo(() => new Set(
    favorites.map(favorite => `${favorite.processName.toLowerCase()}|${favorite.title.toLowerCase()}|${favorite.className ?? ''}`)
  ), [favorites])

  const getOperationContext = useCallback((win: WindowInfo): WindowOperationContext => {
    const matchingTask = activeTasks.find(task => task.pid === win.pid || task.windowHwnd === win.hwnd)
    const matchingPort = ports.find(port => port.pid === win.pid)
    const favoriteKey = `${win.processName.toLowerCase()}|${win.title.toLowerCase()}|${win.className ?? ''}`
    return {
      hasPort: Boolean(matchingPort),
      hasAITask: Boolean(matchingTask),
      hasProject: Boolean(matchingTask?.projectId),
      isFavorite: favoriteKeySet.has(favoriteKey)
    }
  }, [activeTasks, favoriteKeySet, ports])

  // Handle AI window rename
  // Multi-level alias lookup: toolType+workingDir -> titlePrefix -> pid fallback.
  // Persistence and external title mutation are delegated to the main process so
  // renderer state, electron-store, and Win32 SetWindowText stay transactionally aligned.
  const handleAIWindowRename = useCallback(async (win: WindowInfo, newName: string) => {
    const trimmedName = newName.trim()
    if (!trimmedName) {
      showToast('warning', '别名不能为空')
      return
    }

    const task = activeTasks.find(t => t.pid === win.pid)
    const toolType = task?.toolType ?? ('other' as const)
    // Find existing alias with multi-level fallback (same order as getAIWindowDisplayName)
    const existingAlias =
      (task && aliases.find(a =>
        a.matchCriteria.toolType === task.toolType &&
        a.matchCriteria.workingDir &&
        a.matchCriteria.workingDir === task.projectId
      )) ||
      aliases.find(a =>
        a.matchCriteria.titlePrefix && win.title.startsWith(a.matchCriteria.titlePrefix)
      ) ||
      aliases.find(a => a.matchCriteria.pid === win.pid)

    const alias: AIWindowAlias = existingAlias ?? {
      id: `alias_${Date.now()}`,
      alias: trimmedName,
      matchCriteria: {
        pid: win.pid,
        toolType,
        titlePrefix: win.title.substring(0, 30),
        ...(task?.projectId ? { workingDir: task.projectId } : {}),
      },
      createdAt: Date.now(),
      lastMatchedAt: Date.now(),
      autoGenerated: false,
    }

    const result = await renameAndApply({
      alias,
      newName: trimmedName,
      hwnd: win.hwnd,
      pid: win.pid,
      toolType,
      toolDisplayName: getAIToolDisplayName(toolType),
      originalTitle: win.title,
      applyToExternalWindow: true,
      requestedAt: Date.now(),
    })

    if (result.success) {
      showToast('success', result.titleApplied
        ? `已重命名为 "${trimmedName}"，外部窗口标题已同步`
        : `已重命名为 "${trimmedName}"`)
      await fetchAliases()
      await scan(showSystemWindows)
    } else {
      showToast('error', result.error ? `重命名失败: ${result.error}` : '重命名失败')
    }
  }, [activeTasks, aliases, fetchAliases, renameAndApply, scan, showSystemWindows, showToast])

  // ==================== Batch Operations ====================
  const handleBatchTile = useCallback(async () => {
    const hwnds = selectedHwnds
    if (hwnds.length === 0) return
    const success = await tileWindows(hwnds)
    if (success) showToast('success', `${hwnds.length} 个窗口已平铺`)
    else showToast('error', '平铺失败')
  }, [selectedHwnds, tileWindows, showToast])

  const handleBatchCascade = useCallback(async () => {
    const hwnds = selectedHwnds
    if (hwnds.length === 0) return
    const success = await cascadeWindows(hwnds)
    if (success) showToast('success', `${hwnds.length} 个窗口已层叠`)
    else showToast('error', '层叠失败')
  }, [selectedHwnds, cascadeWindows, showToast])

  const handleBatchStack = useCallback(async () => {
    const hwnds = selectedHwnds
    if (hwnds.length === 0) return
    const success = await stackWindows(hwnds)
    if (success) showToast('success', `${hwnds.length} 个窗口已堆叠`)
    else showToast('error', '堆叠失败')
  }, [selectedHwnds, stackWindows, showToast])

  const handleRestorePreviousLayout = useCallback(async () => {
    const success = await restorePreviousLayout()
    if (success) showToast('success', '已恢复布局前位置')
    else showToast('error', '暂无可恢复的布局位置')
  }, [restorePreviousLayout, showToast])
  const handleSetWindowTopmost = useCallback(async (hwnd: number, topmost: boolean) => {
    const ok = await setWindowTopmost(hwnd, topmost)
    if (ok) {
      setTopmostWindows(prev => {
        const updated = new Set(prev)
        if (topmost) updated.add(hwnd)
        else updated.delete(hwnd)
        return updated
      })
    }
    showToast(ok ? 'success' : 'error', ok ? (topmost ? '窗口已置顶' : '已取消置顶') : '置顶切换失败')
  }, [setWindowTopmost, showToast])

  const handleSetWindowOpacity = useCallback(async (hwnd: number, opacity: number) => {
    await setWindowOpacity(hwnd, opacity)
  }, [setWindowOpacity])

  const requestWindowBatchConfirmation = useCallback((request: PendingWindowBatchConfirm) => {
    setWindowBatchConfirm(request)
  }, [])

  const handleCancelWindowBatchConfirmation = useCallback(() => {
    setWindowBatchConfirm(current => {
      current?.onCancel?.()
      return null
    })
  }, [])

  const handleConfirmWindowBatchConfirmation = useCallback(() => {
    const current = windowBatchConfirm
    if (!current) return
    setWindowBatchConfirm(null)
    void current.onConfirm()
  }, [windowBatchConfirm])

  const handleWindowOperation = useCallback(async (kind: WindowOperationKind, win: WindowInfo) => {
    switch (kind) {
      case 'focus': {
        const ok = await focusWindow(win.hwnd)
        showToast(ok ? 'success' : 'error', ok ? '窗口已前置' : '窗口前置失败')
        return
      }
      case 'minimize': {
        const ok = await minimizeWindow(win.hwnd)
        showToast(ok ? 'success' : 'error', ok ? '窗口已最小化' : '最小化失败')
        return
      }
      case 'maximize': {
        const ok = await maximizeWindow(win.hwnd)
        showToast(ok ? 'success' : 'error', ok ? '窗口已最大化' : '最大化失败')
        return
      }
      case 'restore': {
        const ok = await restoreWindow(win.hwnd)
        showToast(ok ? 'success' : 'error', ok ? '窗口已还原' : '还原失败')
        return
      }
      case 'move-resize': {
        const current = win.rect ?? { x: 0, y: 0, width: 800, height: 600 }
        const input = window.prompt('输入窗口位置和大小：x,y,width,height', `${current.x},${current.y},${current.width},${current.height}`)?.trim()
        if (!input) {
          showToast('warning', '已取消窗口移动')
          return
        }
        const rect = parseWindowRectInput(input)
        if (!rect) {
          showToast('error', '窗口移动参数无效，请输入 x,y,width,height，宽度至少 100，高度至少 80')
          return
        }
        const target = formatWindowInjectionTarget(win)
        const confirmed = window.confirm(`将移动窗口 ${target} 到 x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}。`)
        if (!confirmed) {
          showToast('warning', `已取消移动窗口 ${target}`)
          return
        }
        const ok = await moveWindow(win.hwnd, rect.x, rect.y, rect.width, rect.height)
        if (ok) await scan(showSystemWindows)
        showToast(ok ? 'success' : 'error', ok ? `窗口已移动: ${target}` : `窗口移动失败: ${target}`)
        return
      }
      case 'toggle-always-on-top': {
        const next = !topmostWindows.has(win.hwnd)
        const ok = await setWindowTopmost(win.hwnd, next)
        if (ok) {
          setTopmostWindows(prev => {
            const updated = new Set(prev)
            if (next) updated.add(win.hwnd)
            else updated.delete(win.hwnd)
            return updated
          })
        }
        showToast(ok ? 'success' : 'error', ok ? (next ? '窗口已置顶' : '已取消置顶') : '置顶切换失败')
        return
      }
      case 'set-opacity': {
        const input = window.prompt('输入窗口透明度 30-100', '100')?.trim()
        if (!input) {
          showToast('warning', '已取消透明度调整')
          return
        }
        const opacity = Number.parseInt(input, 10)
        if (!Number.isInteger(opacity) || opacity < 30 || opacity > 100) {
          showToast('error', '透明度必须是 30-100 的整数')
          return
        }
        const ok = await setWindowOpacity(win.hwnd, opacity)
        showToast(ok ? 'success' : 'error', ok ? `窗口透明度已设置为 ${opacity}%` : `窗口透明度设置失败: HWND ${win.hwnd}`)
        return
      }
      case 'screenshot': {
        const result = await screenshotWindow(win.hwnd)
        showToast(result.success ? 'success' : 'error', result.success ? `窗口截图已保存: ${result.data?.path}` : `窗口截图失败: ${result.error ?? '未知错误'}`)
        return
      }
      case 'copy-title': {
        try {
          await navigator.clipboard.writeText(win.title)
          showToast('success', '窗口标题已复制')
        } catch (error) {
          showToast('error', `复制失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
        return
      }
      case 'jump-process':
        window.dispatchEvent(buildWindowNavigationEvent({ tab: 'process', pid: win.pid }))
        window.location.hash = `monitor/process/pid:${win.pid}`
        showToast('success', `已定位进程 PID ${win.pid}`)
        return
      case 'jump-port': {
        const port = ports.find(candidate => candidate.pid === win.pid)
        if (!port) {
          showToast('warning', '当前窗口未关联端口')
          return
        }
        window.dispatchEvent(buildWindowNavigationEvent({ tab: 'port', port: port.port, pid: win.pid }))
        window.location.hash = `monitor/port/${port.port}`
        showToast('success', `已定位端口 ${port.port}`)
        return
      }
      case 'jump-ai-task': {
        const task = activeTasks.find(candidate => candidate.pid === win.pid || candidate.windowHwnd === win.hwnd)
        if (!task) {
          showToast('warning', '当前窗口未关联 AI 任务')
          return
        }
        window.dispatchEvent(buildWindowNavigationEvent({ tab: 'ai-task', taskId: task.id, pid: win.pid }))
        window.location.hash = `monitor/ai-task/${task.id}`
        showToast('success', `已定位 AI 任务 ${task.alias ?? getAIToolDisplayName(task.toolType)}`)
        return
      }
      case 'open-working-dir': {
        const result = await openWorkingDir(win.hwnd)
        showToast(result.success ? 'success' : 'error', result.success ? `已打开目录: ${result.data?.directory}` : `打开目录失败: ${result.error ?? '未知错误'}`)
        return
      }
      case 'open-project': {
        const task = activeTasks.find(candidate => candidate.pid === win.pid || candidate.windowHwnd === win.hwnd)
        if (!task?.projectId) {
          showToast('warning', '当前窗口未关联项目')
          return
        }
        window.dispatchEvent(buildWindowNavigationEvent({ tab: 'project', projectId: task.projectId, pid: win.pid }))
        window.location.hash = `project/${encodeURIComponent(task.projectId)}`
        showToast('success', `已定位项目 ${task.projectId}`)
        return
      }
      case 'toggle-favorite': {
        const result = await toggleFavoriteWindow(win.hwnd)
        if (result.success) {
          const refreshed = await getFavoriteWindows()
          setFavorites(refreshed)
        }
        showToast(result.success ? 'success' : 'error', result.success ? (result.data?.favorite ? '窗口已收藏' : '已取消收藏') : `收藏切换失败: ${result.error ?? '未知错误'}`)
        return
      }
      case 'set-title': {
        const nextTitle = window.prompt('输入新的窗口标题', win.title)?.trim()
        if (!nextTitle) return
        const ok = await setWindowTitle(win.hwnd, nextTitle)
        if (ok) await scan(showSystemWindows)
        showToast(ok ? 'success' : 'error', ok ? '窗口标题已更新' : '窗口标题更新失败')
        return
      }
      case 'send-safe-keys': {
        const keys = window.prompt('输入要发送的安全按键（Ctrl+C、Ctrl+D、Ctrl+Z、Enter、Escape）', 'Escape')?.trim()
        if (!keys) {
          showToast('warning', '已取消键盘事件注入')
          return
        }
        const target = formatWindowInjectionTarget(win)
        requestWindowBatchConfirmation({
          confirmText: '发送键盘事件',
          kind: 'inject',
          message: '将向目标窗口发送安全键盘事件。请确认目标窗口当前可安全接收该按键。',
          targetSummary: `${target} / ${keys}`,
          title: '确认键盘注入',
          variant: 'warning',
          onCancel: () => showToast('warning', `已取消向窗口 ${target} 发送键盘事件`),
          onConfirm: async () => {
            showToast('info', `将向窗口 ${target} 发送键盘事件: ${keys}`)
            const ok = await sendKeysToWindow(win.hwnd, keys)
            showToast(ok ? 'success' : 'error', ok ? `键盘事件已发送到窗口 ${target}: ${keys}` : `键盘事件注入失败: 窗口 ${target} / ${keys}`)
          }
        })
        return
      }
      case 'close': {
        const ok = await closeWindow(win.hwnd)
        showToast(ok ? 'success' : 'error', ok ? '关闭消息已发送' : '窗口关闭失败')
        return
      }
      case 'kill-process': {
        if (!window.devhub?.systemProcess?.kill) {
          showToast('error', '进程终止 API 不可用')
          return
        }
        const ok = await window.devhub.systemProcess.kill(win.pid)
        showToast(ok ? 'success' : 'error', ok ? `已终止进程 PID ${win.pid}` : '终止进程失败')
        return
      }
    }
  }, [activeTasks, closeWindow, focusWindow, getFavoriteWindows, maximizeWindow, minimizeWindow, moveWindow, openWorkingDir, ports, requestWindowBatchConfirmation, restoreWindow, scan, screenshotWindow, sendKeysToWindow, setWindowOpacity, setWindowTitle, setWindowTopmost, showSystemWindows, showToast, toggleFavoriteWindow, topmostWindows])

  const runWindowBatchForHwnds = useCallback(async (
    hwnds: number[],
    action: WindowBatchAction,
    actionLabel: string,
    handler: WindowBatchHandler,
    patch: WindowBatchPatch = {},
    options: WindowBatchOptions = {}
  ) => {
    const currentHwnds = hwnds.filter(hwnd => windows.some(windowInfo => windowInfo.hwnd === hwnd))
    if (currentHwnds.length === 0) {
      showToast('warning', '没有可操作的选中窗口')
      return null
    }
    const request = createWindowBatchRequest(action, currentHwnds, patch)
    windowBatchRetryContextRef.current = { action, actionLabel, handler, options, patch }
    windowBatchCancelRequestedRef.current = false
    setWindowBatchActionLabel(actionLabel)
    setWindowBatchCancelRequested(false)
    const progress = await runSequentialWindowBatch(request, handler, {
      ...options,
      isCancelled: () => windowBatchCancelRequestedRef.current,
      onProgress: nextProgress => {
        setWindowBatchProgress(nextProgress)
        if (nextProgress.state !== 'running') {
          setWindowBatchCancelRequested(false)
        }
      }
    })
    const toastType = progress.state === 'cancelled'
      ? 'warning'
      : progress.failed === 0 ? 'success' : 'warning'
    showToast(toastType, progress.state === 'cancelled'
      ? `${actionLabel}已取消：已处理 ${progress.completed}/${progress.total}`
      : summarizeWindowBatchProgress(progress, actionLabel))
    return progress
  }, [showToast, windows])

  const handleCancelWindowBatch = useCallback(() => {
    windowBatchCancelRequestedRef.current = true
    setWindowBatchCancelRequested(true)
  }, [])

  const handleDismissWindowBatchProgress = useCallback(() => {
    setWindowBatchProgress(current => current?.state === 'running' ? current : null)
  }, [])

  const handleRetryFailedWindowBatch = useCallback(async () => {
    const retryContext = windowBatchRetryContextRef.current
    if (!windowBatchProgress || windowBatchProgress.state === 'running' || !retryContext) {
      showToast('warning', '没有可重试的失败项')
      return
    }
    const failedHwnds = Array.from(new Set(
      windowBatchProgress.results
        .filter(result => result.status === 'failed')
        .map(result => result.hwnd)
    ))
    if (failedHwnds.length === 0) {
      showToast('warning', '没有可重试的失败项')
      return
    }
    await runWindowBatchForHwnds(
      failedHwnds,
      retryContext.action,
      `${retryContext.actionLabel} 重试失败项`,
      retryContext.handler,
      retryContext.patch,
      retryContext.options
    )
  }, [runWindowBatchForHwnds, showToast, windowBatchProgress])

  const runSelectedWindowBatch = useCallback((
    action: WindowBatchAction,
    actionLabel: string,
    handler: WindowBatchHandler,
    patch: WindowBatchPatch = {},
    options: WindowBatchOptions = {}
  ) => runWindowBatchForHwnds(
    selectedHwnds,
    action,
    actionLabel,
    handler,
    patch,
    options
  ), [runWindowBatchForHwnds, selectedHwnds])

  const handleBatchFocus = useCallback(async () => {
    await runSelectedWindowBatch(
      'focus',
      '批量聚焦',
      (hwnd) => focusWindow(hwnd),
      {},
      { delayMs: WINDOW_BATCH_LIMITS.FOCUS_INTERVAL_MS }
    )
  }, [focusWindow, runSelectedWindowBatch])

  const handleBatchToggleTopmost = useCallback(async () => {
    const currentHwnds = selectedHwnds.filter(hwnd => windows.some(windowInfo => windowInfo.hwnd === hwnd))
    const shouldPin = currentHwnds.some(hwnd => !topmostWindows.has(hwnd))
    const progress = await runSelectedWindowBatch(
      'aot-toggle',
      shouldPin ? '批量置顶' : '批量取消置顶',
      (hwnd) => setWindowTopmost(hwnd, shouldPin)
    )
    if (!progress) return
    const okHwnds = progress.results.filter(result => result.status === 'ok').map(result => result.hwnd)
    setTopmostWindows(prev => {
      const updated = new Set(prev)
      for (const hwnd of okHwnds) {
        if (shouldPin) updated.add(hwnd)
        else updated.delete(hwnd)
      }
      return updated
    })
  }, [runSelectedWindowBatch, selectedHwnds, setWindowTopmost, topmostWindows, windows])

  const handleBatchScreenshot = useCallback(async () => {
    await runSelectedWindowBatch(
      'screenshot',
      '批量截图',
      (hwnd) => screenshotWindow(hwnd)
    )
  }, [runSelectedWindowBatch, screenshotWindow])

  const handleBatchMinimize = useCallback(async () => {
    await runSelectedWindowBatch(
      'minimize',
      '批量最小化',
      (hwnd) => minimizeWindow(hwnd)
    )
  }, [minimizeWindow, runSelectedWindowBatch])

  const handleBatchRestore = useCallback(async () => {
    await runSelectedWindowBatch(
      'restore',
      '批量恢复',
      (hwnd) => restoreWindow(hwnd)
    )
  }, [restoreWindow, runSelectedWindowBatch])

  const executeBatchClose = useCallback(async (hwnds: number[], confirmed: boolean) => {
    const progress = await runWindowBatchForHwnds(
      hwnds,
      'close',
      '批量关闭',
      (hwnd) => closeWindow(hwnd),
      { confirmed }
    )
    if (progress?.failed === 0) {
      removeSelectedWindows(hwnds)
    }
  }, [closeWindow, runWindowBatchForHwnds, removeSelectedWindows])

  const handleBatchClose = useCallback(async () => {
    const currentHwnds = selectedHwnds.filter(hwnd => windows.some(windowInfo => windowInfo.hwnd === hwnd))
    if (currentHwnds.length > WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE) {
      requestWindowBatchConfirmation({
        confirmText: '关闭选中窗口',
        kind: 'close',
        message: `你将关闭 ${currentHwnds.length} 个真实窗口。该操作会向每个目标 HWND 发送关闭消息，未开始的项目仍可通过进度 toast 取消。`,
        targetSummary: `目标 HWND: ${currentHwnds.join(', ')}`,
        title: '确认批量关闭',
        variant: 'danger',
        onCancel: () => showToast('info', '批量关闭已取消'),
        onConfirm: () => executeBatchClose(currentHwnds, true)
      })
      return
    }
    await executeBatchClose(currentHwnds, false)
  }, [executeBatchClose, requestWindowBatchConfirmation, selectedHwnds, showToast, windows])

  // Filter windows
  const filteredWindows = windows.filter(w =>
    searchQuery === '' ||
    w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.processName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filtered AI and regular windows for display
  const filteredAIWindows = aiWindows.filter(w =>
    searchQuery === '' ||
    w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.processName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getAIWindowDisplayName(w).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRegularWindows = regularWindows.filter(w =>
    searchQuery === '' ||
    w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.processName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredWindowHwnds = filteredWindows.map(windowInfo => windowInfo.hwnd)

  const toggleWindowSelection = useCallback((hwnd: number, gesture: WindowSelectionGesture = { toggle: true }) => {
    selectBatchWindow(hwnd, filteredWindowHwnds, gesture)
  }, [filteredWindowHwnds, selectBatchWindow])

  const handleLassoWindowSelection = useCallback((hwnds: number[], gesture: WindowSelectionGesture) => {
    selectWindowRectangle(hwnds, gesture)
  }, [selectWindowRectangle])

  const handleSelectAll = useCallback(() => {
    selectAllWindows(filteredWindowHwnds)
  }, [filteredWindowHwnds, selectAllWindows])

  useEffect(() => {
    if (viewTab !== 'windows') return undefined
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
      if (isEditableKeyboardTarget(event.target)) return
      event.preventDefault()
      selectAllWindows(filteredWindowHwnds)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredWindowHwnds, selectAllWindows, viewTab])

  useEffect(() => {
    const handler = () => {
      void runWindowBatchForHwnds(
        filteredWindows.map(windowInfo => windowInfo.hwnd),
        'focus',
        '命令面板批量聚焦',
        (hwnd) => focusWindow(hwnd),
        {},
        { delayMs: WINDOW_BATCH_LIMITS.FOCUS_INTERVAL_MS }
      )
    }
    window.addEventListener('devhub:window-batch-focus-filtered', handler)
    return () => window.removeEventListener('devhub:window-batch-focus-filtered', handler)
  }, [filteredWindows, focusWindow, runWindowBatchForHwnds])

  // Process groups: group filteredWindows by PID
  const processGroups = useMemo((): ProcessGroupData[] => {
    const groupMap = new Map<number, ProcessGroupData>()
    for (const w of filteredWindows) {
      let group = groupMap.get(w.pid)
      if (!group) {
        group = { pid: w.pid, processName: w.processName, windows: [] }
        groupMap.set(w.pid, group)
      }
      group.windows.push(w)
    }
    // Sort by window count descending, then by process name
    return Array.from(groupMap.values()).sort((a, b) => {
      if (b.windows.length !== a.windows.length) return b.windows.length - a.windows.length
      return a.processName.localeCompare(b.processName)
    })
  }, [filteredWindows])

  const togglePidExpanded = useCallback((pid: number) => {
    setExpandedPids(prev => {
      const next = new Set(prev)
      if (next.has(pid)) {
        next.delete(pid)
      } else {
        next.add(pid)
      }
      return next
    })
  }, [])

  // Statistics
  const selectedWindow = useMemo(() => windows.find(windowInfo => windowInfo.hwnd === selectedHwnd) ?? null, [selectedHwnd, windows])

  const focusWindowRelationshipPanel = useCallback(() => {
    windowRelationshipPanelRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    windowRelationshipPanelRef.current?.focus({ preventScroll: true })
  }, [])

  const openSelectedWindowAttachedTopology = useCallback(() => {
    if (!selectedWindow) return
    focusWindowRelationshipPanel()
  }, [focusWindowRelationshipPanel, selectedWindow])

  const openSelectedWindowGlobalTopology = useCallback(() => {
    if (!selectedWindow) return
    openWindowInGlobalTopology(selectedWindow.hwnd)
  }, [selectedWindow])

  const openWindowAttachedTopology = useCallback((hwnd: number) => {
    selectWindow(hwnd)
    window.setTimeout(focusWindowRelationshipPanel, 0)
  }, [focusWindowRelationshipPanel, selectWindow])

  const windowTourTarget = useMemo(() => selectedWindow ?? filteredWindows[0] ?? windows[0] ?? null, [filteredWindows, selectedWindow, windows])

  const dismissWindowTour = useCallback(() => {
    window.localStorage.setItem(WINDOW_MODULE_TOUR_STORAGE_KEY, 'dismissed')
    setIsWindowTourOpen(false)
  }, [])

  const openWindowTour = useCallback(() => {
    setWindowTourStep(0)
    setIsWindowTourOpen(true)
  }, [])

  const openTourRelationshipView = useCallback(() => {
    if (!windowTourTarget) return
    setViewTab('windows')
    openWindowAttachedTopology(windowTourTarget.hwnd)
  }, [openWindowAttachedTopology, windowTourTarget])

  const showTourOperationMatrix = useCallback(() => {
    if (!windowTourTarget) return
    setViewTab('windows')
    setViewMode('cards')
    selectWindow(windowTourTarget.hwnd)
  }, [selectWindow, windowTourTarget])

  const toggleTourTopmost = useCallback(() => {
    if (!windowTourTarget) return
    void handleSetWindowTopmost(windowTourTarget.hwnd, !topmostWindows.has(windowTourTarget.hwnd))
  }, [handleSetWindowTopmost, topmostWindows, windowTourTarget])

  const stats = {
    total: windows.length,
    minimized: windows.filter(w => w.isMinimized).length,
    active: windows.filter(w => !w.isMinimized).length,
    groups: groups.length,
    systemCount: windows.filter(w => w.isSystemWindow).length,
    processCount: new Set(windows.map(w => w.pid)).size,
    aiToolCount: aiWindows.length
  }

  // Tab items
  const tabItems: { key: 'windows' | 'groups' | 'layouts'; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'windows', label: '窗口', icon: <WindowIcon size={16} />, count: windows.length },
    { key: 'groups', label: '分组', icon: <FolderIcon size={16} />, count: groups.length },
    { key: 'layouts', label: '布局', icon: <GridIcon size={16} />, count: layouts.length }
  ]

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center flex-wrap justify-between gap-y-2 mb-4 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent radius-sm flex-shrink-0"
            >
              <WindowIcon size={20} className="text-accent" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-gold font-bold uppercase tracking-wider whitespace-nowrap"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-2deg)',
                  transformOrigin: 'left center'
                }}
              >
                {t('monitor.window.title', '窗口管理')}
              </h2>
              <p className="text-xs text-text-muted whitespace-nowrap">{t('monitor.window.subtitle', 'WINDOW MANAGER')}</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 gap-y-2 justify-end">
            {/* View Mode Toggle */}
            {viewTab === 'windows' && (
              <ViewModeToggle
                modes={[
                  { key: 'cards', icon: <GridIcon size={16} />, label: '卡片视图' },
                  { key: 'list', icon: <ListIcon size={16} />, label: '列表视图' },
                  { key: 'process', icon: <ProcessIcon size={16} />, label: '按进程分组' },
                  { key: 'wall', icon: <WindowIcon size={16} />, label: '缩略图墙' }
                ]}
                current={viewMode}
                onChange={(mode) => setViewMode(mode as typeof viewMode)}
              />
            )}

            {/* Show System Windows Toggle */}
            {viewTab === 'windows' && (
              <button
                onClick={handleToggleSystemWindows}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 border-l-2 whitespace-nowrap
                  ${showSystemWindows
                    ? 'bg-warning/20 text-warning border-warning'
                    : 'bg-surface-800 text-text-muted border-surface-600 hover:bg-surface-700 hover:text-text-secondary'
                  }
                 radius-sm`}
                title={showSystemWindows ? '隐藏系统窗口' : '显示系统窗口'}
              >
                <EyeIcon size={14} />
                {showSystemWindows ? '隐藏系统窗口' : '系统窗口'}
              </button>
            )}

            {/* Create Group Button */}
            {viewTab === 'windows' && selectedWindows.size > 0 && (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all duration-200 border-l-2 border-accent radius-sm"
              >
                <PlusIcon size={14} />
                创建分组 ({selectedWindows.size})
              </button>
            )}

            {/* Save Layout Button - available in both windows and groups tabs */}
            {(viewTab === 'groups' || viewTab === 'windows') && windows.length > 0 && (
              <button
                onClick={() => setShowSaveLayout(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-success/20 text-success hover:bg-success hover:text-white transition-all duration-200 border-l-2 border-success radius-sm"
              >
                <FolderIcon size={14} />
                保存布局
              </button>
            )}

            {viewTab === 'windows' && selectedWindow && (
              <button
                type="button"
                data-testid="window-attached-topology-button"
                data-graph-entry="window-header-attached-topology"
                data-graph-kind="attached"
                title="查看关系图"
                onClick={openSelectedWindowAttachedTopology}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-accent transition-all duration-200 border-l-2 border-surface-600 hover:border-accent radius-sm"
              >
                <NetworkIcon size={14} />
                查看关系图
              </button>
            )}

            {viewTab === 'windows' && selectedWindow && (
              <button
                type="button"
                data-testid="window-global-topology-button"
                data-graph-entry="window-header-global-topology"
                data-graph-kind="global"
                title="在全局拓扑中查看"
                onClick={openSelectedWindowGlobalTopology}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-accent transition-all duration-200 border-l-2 border-surface-600 hover:border-accent radius-sm"
              >
                <GlobeIcon size={14} />
                全局拓扑
              </button>
            )}

            {viewTab === 'windows' && (
              <button
                type="button"
                data-testid="window-module-tour-open-button"
                onClick={openWindowTour}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-accent transition-all duration-200 border-l-2 border-surface-600 hover:border-accent radius-sm"
                aria-label="打开窗口模块导览"
                title="窗口导览"
              >
                <InfoIcon size={14} />
                导览
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => scan(showSystemWindows)}
              disabled={isScanning}
              className={`
                btn-icon-sm transition-all duration-200
                ${isScanning
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary'
                }
              `}
              title="刷新"
            >
              <RefreshIcon size={16} className={isScanning ? 'animate-spin' : ''} />
            </button>

            <PanelDetachButton surface="window" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1">
            {tabItems.map((tab, index) => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200
                  whitespace-nowrap flex-shrink-0
                  ${viewTab === tab.key
                    ? 'bg-accent/15 text-accent border-l-2 border-accent'
                    : 'text-text-secondary hover:bg-surface-800 hover:text-text-primary border-l-2 border-transparent'
                  }
                `}
                style={{ borderRadius: '2px', animationDelay: `${index * 50}ms` }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`
                    text-xs px-1.5 py-0.5 font-mono
                    ${viewTab === tab.key ? 'bg-accent/20' : 'bg-surface-700'}
                   radius-sm`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search (only for windows tab) */}
          {viewTab === 'windows' && (
            <div className="relative">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="搜索窗口..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-56 bg-surface-800 border border-surface-700 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 radius-sm"
              />
            </div>
          )}
        </div>
      </div>

      {viewTab === 'windows' && (
        <WindowModuleTour
          isOpen={isWindowTourOpen}
          stepIndex={windowTourStep}
          windowCount={windows.length}
          operationCount={WINDOW_OPERATION_CATALOG.length}
          targetWindow={windowTourTarget}
          isTargetTopmost={windowTourTarget ? topmostWindows.has(windowTourTarget.hwnd) : false}
          onStepChange={setWindowTourStep}
          onDismiss={dismissWindowTour}
          onOpenRelationshipView={openTourRelationshipView}
          onShowOperationMatrix={showTourOperationMatrix}
          onToggleTopmost={toggleTourTopmost}
        />
      )}

      {/* Statistics (only for windows tab) */}
      {viewTab === 'windows' && (
        <div className="flex-shrink-0 px-5 py-4 border-b border-surface-700/50">
          <div className="stat-grid">
            <StatCard
              icon={<WindowIcon size={20} className="text-info" />}
              label="总窗口数"
              value={stats.total}
              color="info"
            />
            <StatCard
              icon={<CheckIcon size={20} className="text-success" />}
              label="活动窗口"
              value={stats.active}
              color="success"
            />
            <StatCard
              icon={<AlertIcon size={20} className="text-warning" />}
              label="最小化"
              value={stats.minimized}
              color="warning"
            />
            <StatCard
              icon={<AIIcon size={20} className="text-blue-400" />}
              label="AI 工具"
              value={stats.aiToolCount}
              color="info"
            />
          </div>
        </div>
      )}

      {/* Batch Operations Toolbar */}
      {viewTab === 'windows' && (
        <BatchToolbar
          selectedCount={selectedWindows.size}
          totalCount={filteredWindows.length}
          onSelectAll={handleSelectAll}
          onFocusAll={handleBatchFocus}
          onTile={handleBatchTile}
          onCascade={handleBatchCascade}
          onStack={handleBatchStack}
          onRestorePrevious={handleRestorePreviousLayout}
          onToggleTopmostAll={handleBatchToggleTopmost}
          onScreenshotAll={handleBatchScreenshot}
          onMinimizeAll={handleBatchMinimize}
          onRestoreAll={handleBatchRestore}
          onCloseAll={handleBatchClose}
          onClearSelection={clearWindowSelection}
        />
      )}

      {viewTab === 'windows' && (
        <BatchProgressToast
          actionLabel={windowBatchActionLabel}
          cancelRequested={windowBatchCancelRequested}
          progress={windowBatchProgress}
          onCancel={handleCancelWindowBatch}
          onDismiss={handleDismissWindowBatchProgress}
          onRetryFailed={handleRetryFailedWindowBatch}
        />
      )}

      {windowBatchConfirm && (
        <BatchConfirmDialog
          confirmText={windowBatchConfirm.confirmText}
          isOpen
          kind={windowBatchConfirm.kind}
          message={windowBatchConfirm.message}
          targetSummary={windowBatchConfirm.targetSummary}
          title={windowBatchConfirm.title}
          variant={windowBatchConfirm.variant}
          onCancel={handleCancelWindowBatchConfirmation}
          onConfirm={handleConfirmWindowBatchConfirmation}
        />
      )}

      {/* Selected Window Relationship */}
      {viewTab === 'windows' && selectedWindow && (
        <div
          ref={windowRelationshipPanelRef}
          data-testid="window-relationship-panel"
          data-graph-entry="window-detail-panel"
          data-graph-kind="attached"
          tabIndex={-1}
          className="flex-shrink-0 border-b border-surface-700/50 bg-surface-950 px-5 py-3 outline-none"
        >
          <div className="mb-2 flex items-center gap-2">
            <WindowIcon size={14} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-display)' }}>
              关系视图
            </span>
            <span className="min-w-0 truncate text-[10px] text-text-muted">
              {redactWindowTitle(selectedWindow.title || selectedWindow.processName)} - HWND {selectedWindow.hwnd}
            </span>
            <button
              type="button"
              data-testid="window-detail-global-topology-button"
              data-graph-entry="window-detail-global-topology"
              data-graph-kind="global"
              title="在全局拓扑中查看"
              onClick={openSelectedWindowGlobalTopology}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-accent border border-surface-600 transition-colors radius-sm"
            >
              <GlobeIcon size={10} />
              全局拓扑
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <AttachedGraphView scope={{ kind: 'window', targetId: selectedWindow.hwnd, depth: 2 }} minHeight={320} />
            <AttachedFlowView scope={{ kind: 'window', targetId: selectedWindow.hwnd, depth: 2 }} />
          </div>
        </div>
      )}

      {/* Content */}
      <LassoSelect
        className="flex-1 overflow-y-auto p-5"
        enabled={viewTab === 'windows'}
        onSelect={handleLassoWindowSelection}
      >
        {viewTab === 'windows' && viewMode === 'cards' && (
          <div className="space-y-6">
            {/* AI Windows Pinned Section */}
            {filteredAIWindows.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AIIcon size={16} className="text-blue-400" />
                  <span
                    className="text-xs font-bold uppercase tracking-wider text-blue-400"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    AI Tools ({filteredAIWindows.length})
                  </span>
                  <div className="flex-1 h-px bg-blue-500/20" />
                </div>
                <div className="monitor-card-grid" style={{ display: 'grid', gap: 'var(--density-grid-gap, 8px)' }}>
                  {filteredAIWindows.map((win, index) => (
                    <ProcessCardErrorBoundary key={win.hwnd} pid={win.pid} processName={win.processName}>
                      <AIWindowCard
                        window={win}
                        task={activeTasks.find(t => t.pid === win.pid)}
                        displayName={getAIWindowDisplayName(win)}
                        monitorState={getAIWindowMonitorState(win)}
                        isSelected={selectedHwnd === win.hwnd}
                        isChecked={selectedWindows.has(win.hwnd)}
                        operationContext={getOperationContext(win)}
                        onSelect={() => selectWindow(win.hwnd)}
                        onShowGraph={() => openWindowAttachedTopology(win.hwnd)}
                        onFocus={() => { void handleWindowOperation('focus', win) }}
                        onToggleCheck={(gesture) => toggleWindowSelection(win.hwnd, gesture)}
                        onRename={(name) => handleAIWindowRename(win, name)}
                        onMinimize={() => { void handleWindowOperation('minimize', win) }}
                        onMaximize={() => { void handleWindowOperation('maximize', win) }}
                        onRestore={() => { void handleWindowOperation('restore', win) }}
                        onClose={() => { void handleWindowOperation('close', win) }}
                        onSetTopmost={handleSetWindowTopmost}
                        onSetOpacity={handleSetWindowOpacity}
                        onRunOperation={handleWindowOperation}
                        index={index}
                      />
                    </ProcessCardErrorBoundary>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Windows */}
            {(filteredAIWindows.length > 0 && filteredRegularWindows.length > 0) && (
              <div className="flex items-center gap-2">
                <WindowIcon size={16} className="text-text-muted" />
                <span
                  className="text-xs font-bold uppercase tracking-wider text-text-muted"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  其他窗口 ({filteredRegularWindows.length})
                </span>
                <div className="flex-1 h-px bg-surface-700" />
              </div>
            )}

            <div className="monitor-card-grid" style={{ display: 'grid', gap: 'var(--density-grid-gap, 8px)' }}>
              {filteredRegularWindows.map((window, index) => (
                <ProcessCardErrorBoundary key={window.hwnd} pid={window.pid} processName={window.processName}>
                    <WindowCard
                      window={window}
                      isSelected={selectedHwnd === window.hwnd}
                      isChecked={selectedWindows.has(window.hwnd)}
                      isTopmost={topmostWindows.has(window.hwnd)}
                      operationContext={getOperationContext(window)}
                    onSelect={() => selectWindow(window.hwnd)}
                    onShowGraph={() => openWindowAttachedTopology(window.hwnd)}
                    onFocus={() => { void handleWindowOperation('focus', window) }}
                    onToggleCheck={(gesture) => toggleWindowSelection(window.hwnd, gesture)}
                    onRunOperation={handleWindowOperation}
                    index={index}
                  />
                </ProcessCardErrorBoundary>
              ))}
              {filteredWindows.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    icon={<SearchIcon size={40} className="text-text-muted" />}
                    title="未找到窗口"
                    description={searchQuery ? '尝试其他搜索关键词' : '系统中没有可用窗口'}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {viewTab === 'windows' && viewMode === 'list' && (
          <div className="space-y-4">
            {/* AI Windows Pinned Section (List) */}
            {filteredAIWindows.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AIIcon size={16} className="text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400" style={{ fontFamily: 'var(--font-display)' }}>
                    AI Tools ({filteredAIWindows.length})
                  </span>
                  <div className="flex-1 h-px bg-blue-500/20" />
                </div>
                <div className="space-y-1">
                  {filteredAIWindows.map((win, index) => (
                    <ProcessCardErrorBoundary key={win.hwnd} pid={win.pid} processName={win.processName}>
                      <AIWindowCard
                        window={win}
                        task={activeTasks.find(t => t.pid === win.pid)}
                        displayName={getAIWindowDisplayName(win)}
                        monitorState={getAIWindowMonitorState(win)}
                        isSelected={selectedHwnd === win.hwnd}
                        isChecked={selectedWindows.has(win.hwnd)}
                        operationContext={getOperationContext(win)}
                        onSelect={() => selectWindow(win.hwnd)}
                        onShowGraph={() => openWindowAttachedTopology(win.hwnd)}
                        onFocus={() => { void handleWindowOperation('focus', win) }}
                        onToggleCheck={(gesture) => toggleWindowSelection(win.hwnd, gesture)}
                        onRename={(name) => handleAIWindowRename(win, name)}
                        onMinimize={() => { void handleWindowOperation('minimize', win) }}
                        onMaximize={() => { void handleWindowOperation('maximize', win) }}
                        onRestore={() => { void handleWindowOperation('restore', win) }}
                        onClose={() => { void handleWindowOperation('close', win) }}
                        onSetTopmost={handleSetWindowTopmost}
                        onSetOpacity={handleSetWindowOpacity}
                        onRunOperation={handleWindowOperation}
                        index={index}
                      />
                    </ProcessCardErrorBoundary>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Windows (List) */}
            {(filteredAIWindows.length > 0 && filteredRegularWindows.length > 0) && (
              <div className="flex items-center gap-2 mt-2">
                <WindowIcon size={16} className="text-text-muted" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted" style={{ fontFamily: 'var(--font-display)' }}>
                  其他窗口 ({filteredRegularWindows.length})
                </span>
                <div className="flex-1 h-px bg-surface-700" />
              </div>
            )}

            <div className="space-y-1">
              {filteredRegularWindows.map((window, index) => (
                <ProcessCardErrorBoundary key={window.hwnd} pid={window.pid} processName={window.processName}>
                    <WindowItem
                      window={window}
                      isSelected={selectedHwnd === window.hwnd}
                      isChecked={selectedWindows.has(window.hwnd)}
                      isTopmost={topmostWindows.has(window.hwnd)}
                      operationContext={getOperationContext(window)}
                    onSelect={() => selectWindow(window.hwnd)}
                    onFocus={() => { void handleWindowOperation('focus', window) }}
                    onToggleCheck={(gesture) => toggleWindowSelection(window.hwnd, gesture)}
                    onRunOperation={handleWindowOperation}
                    index={index}
                  />
                </ProcessCardErrorBoundary>
              ))}
              {filteredWindows.length === 0 && (
                <EmptyState
                  icon={<SearchIcon size={40} className="text-text-muted" />}
                  title="未找到窗口"
                  description={searchQuery ? '尝试其他搜索关键词' : '系统中没有可用窗口'}
                />
              )}
            </div>
          </div>
        )}

        {viewTab === 'windows' && viewMode === 'process' && (
          <div className="space-y-3">
            {processGroups.map((group, index) => (
              <ProcessGroupCard
                key={group.pid}
                group={group}
                isExpanded={expandedPids.has(group.pid)}
                onToggleExpand={() => togglePidExpanded(group.pid)}
                selectedHwnd={selectedHwnd}
                selectedWindows={selectedWindows}
                getOperationContext={getOperationContext}
                onSelectWindow={(hwnd) => selectWindow(hwnd)}
                onFocusWindow={(hwnd) => focusWindow(hwnd)}
                onToggleCheck={(hwnd, gesture) => toggleWindowSelection(hwnd, gesture)}
                onRunOperation={handleWindowOperation}
                index={index}
              />
            ))}
            {processGroups.length === 0 && (
              <EmptyState
                icon={<SearchIcon size={40} className="text-text-muted" />}
                title="未找到窗口"
                description={searchQuery ? '尝试其他搜索关键词' : '系统中没有可用窗口'}
              />
            )}
          </div>
        )}

        {viewTab === 'windows' && viewMode === 'wall' && (
          <ThumbnailWall
            windows={filteredWindows}
            selectedHwnd={selectedHwnd}
            selectedWindows={selectedWindows}
            getDisplayName={getAIWindowDisplayName}
            onSelectWindow={(hwnd) => selectWindow(hwnd)}
            onToggleWindowSelection={(hwnd, gesture) => toggleWindowSelection(hwnd, gesture)}
            onRunOperation={handleWindowOperation}
          />
        )}

        {viewTab === 'groups' && (
          <div className="space-y-4">
            {groups.map((group, index) => (
              <WindowGroupCard
                key={group.id}
                group={group}
                isSelected={selectedGroupId === group.id}
                onSelect={() => selectGroup(group.id)}
                onFocusGroup={() => withFeedback(
                  () => focusGroup(group.id),
                  `已聚焦分组 "${group.name}"`,
                  '聚焦分组失败'
                )}
                onMinimizeGroup={() => withFeedback(
                  () => minimizeGroup(group.id),
                  `分组 "${group.name}" 已最小化`,
                  '最小化分组失败'
                )}
                onCloseGroup={() => withFeedback(
                  () => closeGroup(group.id),
                  `分组 "${group.name}" 窗口已关闭`,
                  '关闭分组窗口失败'
                )}
                onRename={(newName) => withFeedback(
                  () => renameGroup(group.id, newName),
                  `分组已重命名为 "${newName}"`,
                  '重命名分组失败'
                )}
                onRemove={() => withFeedback(
                  () => removeGroup(group.id),
                  `分组 "${group.name}" 已删除`,
                  '删除分组失败'
                )}
                index={index}
              />
            ))}
            {groups.length === 0 && (
              <EmptyState
                icon={<FolderIcon size={40} className="text-text-muted" />}
                title="暂无窗口分组"
                description="在窗口列表中选择窗口并创建分组"
              />
            )}
          </div>
        )}

        {viewTab === 'layouts' && (
          <div className="space-y-4">
            {layouts.map((layout, index) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onRestore={() => withFeedback(
                  () => restoreLayout(layout.id),
                  `布局 "${layout.name}" 已恢复`,
                  '布局恢复失败'
                )}
                onRemove={() => withFeedback(
                  () => removeLayout(layout.id),
                  `布局 "${layout.name}" 已删除`,
                  '删除布局失败'
                )}
                index={index}
              />
            ))}
            {layouts.length === 0 && (
              <EmptyState
                icon={<GridIcon size={40} className="text-text-muted" />}
                title="暂无保存的布局"
                description="创建分组后可保存为布局"
              />
            )}
          </div>
        )}
      </LassoSelect>

      {/* Create Group Dialog */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div
            className="bg-surface-900 p-6 w-[min(420px,calc(100vw-2rem))] mx-4 border-2 border-surface-700 shadow-2xl relative radius-md"
          >
            {/* Diagonal decoration */}
            <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="w-10 h-10 bg-accent/20 flex items-center justify-center border-l-3 border-accent radius-sm"
              >
                <FolderIcon size={20} className="text-accent" />
              </div>
              <div>
                <h3
                  className="text-gold font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    transform: 'rotate(-1deg)',
                    transformOrigin: 'left center'
                  }}
                >
                  创建窗口分组
                </h3>
                <p className="text-xs text-text-muted">将选中的窗口添加到新分组</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="输入分组名称..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent relative z-10 radius-sm"
            />

            <div
              className="flex items-center gap-2 mt-3 p-3 bg-surface-800/50 border-l-3 border-success relative z-10 radius-sm"
            >
              <CheckIcon size={18} className="text-success" />
              <span className="text-sm text-text-secondary">
                已选择 <span className="font-bold text-accent">{selectedWindows.size}</span> 个窗口
              </span>
            </div>

            <div className="flex justify-end gap-3 mt-6 relative z-10">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="px-5 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors radius-sm"
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="px-5 py-2.5 bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-accent-400 radius-sm"
              >
                创建分组
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Layout Dialog */}
      {showSaveLayout && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div
            className="bg-surface-900 p-6 w-[min(420px,calc(100vw-2rem))] mx-4 border-2 border-surface-700 shadow-2xl relative radius-md"
          >
            {/* Diagonal decoration */}
            <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="w-10 h-10 bg-success/20 flex items-center justify-center border-l-3 border-success radius-sm"
              >
                <GridIcon size={20} className="text-success" />
              </div>
              <div>
                <h3
                  className="text-gold font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    transform: 'rotate(-1deg)',
                    transformOrigin: 'left center'
                  }}
                >
                  保存窗口布局
                </h3>
                <p className="text-xs text-text-muted">保存当前分组配置以便稍后恢复</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="布局名称..."
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent mb-3 relative z-10 radius-sm"
            />

            <textarea
              placeholder="描述（可选）..."
              value={newLayoutDesc}
              onChange={(e) => setNewLayoutDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none relative z-10 radius-sm"
            />

            <div
              className="flex items-center gap-2 mt-3 p-3 bg-surface-800/50 border-l-3 border-info relative z-10 radius-sm"
            >
              <AlertIcon size={18} className="text-info" />
              <span className="text-sm text-text-secondary">
                将保存 <span className="font-bold text-accent">{groups.length}</span> 个分组，
                共 <span className="font-bold text-accent">{windows.length}</span> 个窗口
              </span>
            </div>

            {/* Layout mini-map preview */}
            <LayoutPreview
              windows={windows.map(w => ({
                title: w.title,
                processName: w.processName,
                rect: w.rect
              }))}
            />

            <div className="flex justify-end gap-3 mt-6 relative z-10">
              <button
                onClick={() => setShowSaveLayout(false)}
                className="px-5 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors radius-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={!newLayoutName.trim()}
                className="px-5 py-2.5 bg-success text-white font-medium hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-success radius-sm"
              >
                保存布局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
