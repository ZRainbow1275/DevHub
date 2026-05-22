import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProcessInfo } from '@shared/types-extended'
import type { ProcessTag, ProcessTreeNode as ProcessTreeNodeModel } from '@shared/schemas/r8-runtime'
import { useProcessTree } from '../../../hooks/useProcessTree'
import { useProcessStore } from '../../../stores/processStore'
import { flattenTree, ProcessTreeNode } from './ProcessTreeNode'

function withLazyChildren(node: ProcessTreeNodeModel, lazyChildrenByPid: Map<number, ProcessTreeNodeModel[]>): ProcessTreeNodeModel {
  const lazyChildren = lazyChildrenByPid.get(node.pid)
  const sourceChildren = node.children.length > 0 ? node.children : lazyChildren ?? []
  return {
    ...node,
    children: sourceChildren.map(child => withLazyChildren({ ...child, depth: node.depth + 1 }, lazyChildrenByPid))
  }
}

function normalizeLoadedChild(parent: ProcessTreeNodeModel, child: ProcessTreeNodeModel): ProcessTreeNodeModel {
  return {
    ...child,
    depth: parent.depth + 1,
    expanded: false,
    children: child.children ?? []
  }
}

export function ProcessTreeView({
  processes,
  selectedPid,
  onSelectProcess,
  onShowDetail,
  getProcessTag
}: {
  processes: ProcessInfo[]
  selectedPid: number | null
  onSelectProcess: (pid: number | null) => void
  onShowDetail: (pid: number) => void
  getProcessTag?: (process: ProcessInfo) => ProcessTag | undefined
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [lazyChildrenByPid, setLazyChildrenByPid] = useState<Map<number, ProcessTreeNodeModel[]>>(new Map())
  const [loadingPids, setLoadingPids] = useState<Set<number>>(new Set())
  const [childLoadErrors, setChildLoadErrors] = useState<Map<number, string>>(new Map())
  const childPidsByParentPid = useProcessStore(store => store.childPidsByParentPid)
  const tree = useProcessTree(processes)
  const treeWithLazyChildren = useMemo(() => withLazyChildren(tree, lazyChildrenByPid), [lazyChildrenByPid, tree])
  const rows = useMemo(() => flattenTree(treeWithLazyChildren, expanded).filter(node => node.pid !== 0), [treeWithLazyChildren, expanded])
  const processByPid = useMemo(() => new Map(processes.map(process => [process.pid, process])), [processes])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12
  })

  const loadChildren = async (node: ProcessTreeNodeModel): Promise<void> => {
    const childPids = childPidsByParentPid.get(node.pid) ?? []
    if (node.children.length > 0 || lazyChildrenByPid.has(node.pid) || childPids.length === 0) return

    const bridge = window.devhub?.r8?.processViews
    if (!bridge?.treeChildren) return

    setLoadingPids(current => new Set(current).add(node.pid))
    setChildLoadErrors(current => {
      const next = new Map(current)
      next.delete(node.pid)
      return next
    })

    try {
      const result = await bridge.treeChildren(node.pid)
      setLazyChildrenByPid(current => {
        const next = new Map(current)
        next.set(node.pid, result.children.map(child => normalizeLoadedChild(node, child)))
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setChildLoadErrors(current => new Map(current).set(node.pid, message))
    } finally {
      setLoadingPids(current => {
        const next = new Set(current)
        next.delete(node.pid)
        return next
      })
    }
  }

  return (
    <div className="h-full overflow-hidden" data-testid="process-tree">
      <div className="grid grid-cols-[minmax(240px,1fr)_120px_90px_120px_96px] gap-3 border-b border-surface-700 bg-surface-900 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
        <span>进程树</span>
        <span>标签</span>
        <span>PID</span>
        <span>RSS</span>
        <span>CPU/AI</span>
      </div>
      <div ref={parentRef} className="h-[calc(100%-33px)] overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const node = rows[virtualRow.index]
            return (
              <div
                key={node.pid}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <ProcessTreeNode
                  node={{ ...node, expanded: node.expanded || expanded.has(node.pid) }}
                  tag={getProcessTag?.(processByPid.get(node.pid) ?? ({
                    pid: node.pid,
                    name: node.exe,
                    command: node.cmdline ?? '',
                    cpu: node.cpu,
                    memory: node.rss,
                    status: 'running',
                    startTime: 0,
                    type: node.isAiTool ? 'ai-tool' : 'other',
                  } as ProcessInfo))}
                  onSelect={pid => onSelectProcess(pid)}
                  onShowDetail={onShowDetail}
                  onToggle={pid => {
                    const isExpanding = !expanded.has(pid)
                    if (isExpanding) {
                      void loadChildren(node)
                    }
                    setExpanded(current => {
                      const next = new Set(current)
                      if (next.has(pid)) next.delete(pid)
                      else next.add(pid)
                      return next
                    })
                  }}
                  selected={selectedPid === node.pid}
                  loadingChildren={loadingPids.has(node.pid)}
                  childLoadError={childLoadErrors.get(node.pid)}
                  hasLazyChildren={(childPidsByParentPid.get(node.pid)?.length ?? 0) > 0}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
