import { memo } from 'react'
import type { ProcessInfo, PortInfo, WindowInfo } from '@shared/types-extended'
import { CloseIcon, ProcessIcon, PortIcon, WindowIcon, FolderIcon } from '../../icons'

interface SelectedNodeInfo {
  nodeType: 'project' | 'process' | 'port' | 'window'
  processInfo?: ProcessInfo
  portInfo?: PortInfo
  windowInfo?: WindowInfo
  projectId?: string
  projectName?: string
}

interface TopologyDetailPanelProps {
  node: SelectedNodeInfo
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-surface-700 last:border-0">
      <span className="text-[11px] text-text-muted uppercase tracking-wider flex-shrink-0 mr-3">
        {label}
      </span>
      <span className="text-[11px] text-text-primary font-mono text-right break-all">
        {value}
      </span>
    </div>
  )
}

function ProcessDetail({ info }: { info: ProcessInfo }) {
  return (
    <div className="space-y-0">
      <DetailRow label="PID" value={info.pid} />
      <DetailRow label="Name" value={info.name} />
      <DetailRow label="Command" value={info.command} />
      <DetailRow label="Type" value={info.type} />
      <DetailRow label="Status" value={info.status} />
      <DetailRow label="CPU" value={`${info.cpu.toFixed(1)}%`} />
      <DetailRow label="Memory" value={`${info.memory.toFixed(1)} MB`} />
      {info.port && <DetailRow label="Port" value={info.port} />}
      {info.projectId && <DetailRow label="Project" value={info.projectId} />}
      {info.workingDir && <DetailRow label="Working Dir" value={info.workingDir} />}
      <DetailRow label="Started" value={new Date(info.startTime).toLocaleString()} />
    </div>
  )
}

function PortDetail({ info }: { info: PortInfo }) {
  return (
    <div className="space-y-0">
      <DetailRow label="Port" value={info.port} />
      <DetailRow label="PID" value={info.pid} />
      <DetailRow label="Process" value={info.processName} />
      <DetailRow label="Protocol" value={info.protocol} />
      <DetailRow label="State" value={info.state} />
      <DetailRow label="Local" value={info.localAddress} />
      <DetailRow label="Foreign" value={info.foreignAddress} />
      {info.projectId && <DetailRow label="Project" value={info.projectId} />}
    </div>
  )
}

function WindowDetail({ info }: { info: WindowInfo }) {
  return (
    <div className="space-y-0">
      <DetailRow label="HWND" value={info.hwnd} />
      <DetailRow label="Title" value={info.title} />
      <DetailRow label="Process" value={info.processName} />
      <DetailRow label="PID" value={info.pid} />
      <DetailRow label="Class" value={info.className} />
      <DetailRow label="Visible" value={info.isVisible ? 'Yes' : 'No'} />
      <DetailRow label="Minimized" value={info.isMinimized ? 'Yes' : 'No'} />
      <DetailRow label="Position" value={`${info.rect.x}, ${info.rect.y}`} />
      <DetailRow label="Size" value={`${info.rect.width} x ${info.rect.height}`} />
    </div>
  )
}

function ProjectDetail({ projectId, projectName }: { projectId?: string; projectName?: string }) {
  return (
    <div className="space-y-0">
      <DetailRow label="ID" value={projectId} />
      <DetailRow label="Name" value={projectName} />
    </div>
  )
}

const HEADER_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  process: {
    icon: <ProcessIcon size={14} className="text-gold" />,
    label: 'PROCESS',
    color: 'border-gold'
  },
  port: {
    icon: <PortIcon size={14} className="text-info" />,
    label: 'PORT',
    color: 'border-info'
  },
  window: {
    icon: <WindowIcon size={14} className="text-steel" />,
    label: 'WINDOW',
    color: 'border-steel'
  },
  project: {
    icon: <FolderIcon size={14} className="text-accent" />,
    label: 'PROJECT',
    color: 'border-accent'
  }
}

export const TopologyDetailPanel = memo(function TopologyDetailPanel({
  node,
  onClose
}: TopologyDetailPanelProps) {
  const config = HEADER_CONFIG[node.nodeType]

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-72 bg-surface-900 border-l-2 border-surface-600 z-20 flex flex-col"
      style={{ borderRadius: '0' }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b-2 border-surface-700 border-l-3 ${config.color}`}>
        <div className="flex items-center gap-2">
          {config.icon}
          <span
            className="text-xs font-bold text-text-primary uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {config.label} DETAIL
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
          style={{ borderRadius: '2px' }}
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {node.nodeType === 'process' && node.processInfo && (
          <ProcessDetail info={node.processInfo} />
        )}
        {node.nodeType === 'port' && node.portInfo && (
          <PortDetail info={node.portInfo} />
        )}
        {node.nodeType === 'window' && node.windowInfo && (
          <WindowDetail info={node.windowInfo} />
        )}
        {node.nodeType === 'project' && (
          <ProjectDetail projectId={node.projectId} projectName={node.projectName} />
        )}
      </div>
    </div>
  )
})
