import type { ProcessInfo } from '@shared/types-extended'
import { hierarchy, treemap, treemapBinary, type HierarchyRectangularNode } from 'd3-hierarchy'
import {
  processTreeNodeSchema,
  treemapLayoutSchema,
  type ProcessTreeNode,
  type TreemapLayout,
  type TreemapNode
} from '@shared/schemas/r8-runtime'

export const PROCESS_TREE_LIMITS = {
  DEFAULT_DEPTH: 3,
  MAX_DEPTH: 16,
  TREEMAP_MAX_NODES: 500,
  TREE_VIRTUAL_THRESHOLD: 100,
  RSS_AREA_TOLERANCE: 0.05
} as const

type ProcessRecord = ProcessInfo & {
  ppid?: number
  parentPid?: number
  exe?: string
  commandLine?: string
  rss?: number
  memoryRSS?: number
  isAiTool?: boolean
}

interface TreemapDatum {
  id: string
  row?: ProcessRecord
  value: number
  children?: TreemapDatum[]
}

function parentPidOf(processInfo: ProcessRecord): number {
  return Number(processInfo.ppid ?? processInfo.parentPid ?? 0)
}

function rssOf(processInfo: ProcessRecord): number {
  return Math.max(0, Math.round(Number(processInfo.rss ?? processInfo.memoryRSS ?? processInfo.memory ?? 0)))
}

function exeOf(processInfo: ProcessRecord): string {
  return processInfo.exe ?? processInfo.name ?? `pid-${processInfo.pid}`
}

export function buildProcessTree(processes: ProcessInfo[], rootPid?: number, maxDepth = PROCESS_TREE_LIMITS.DEFAULT_DEPTH): ProcessTreeNode {
  const rows = processes as ProcessRecord[]
  const byPid = new Map(rows.map(row => [row.pid, row]))
  const childMap = new Map<number, ProcessRecord[]>()
  for (const row of rows) {
    const parentPid = parentPidOf(row)
    if (!childMap.has(parentPid)) childMap.set(parentPid, [])
    childMap.get(parentPid)?.push(row)
  }
  const root = rootPid && byPid.has(rootPid)
    ? byPid.get(rootPid)
    : ({
        pid: 0,
        ppid: -1,
        name: 'root',
        command: '',
        cpu: rows.reduce((sum, row) => sum + row.cpu, 0),
        memory: rows.reduce((sum, row) => sum + row.memory, 0),
        status: 'running',
        startTime: 0,
        type: 'other'
      } as ProcessRecord)
  if (!root) throw new Error('E_NOT_FOUND:process-root')
  const boundedDepth = Math.max(1, Math.min(PROCESS_TREE_LIMITS.MAX_DEPTH, maxDepth))
  const seen = new Set<number>()
  const build = (row: ProcessRecord, depth: number): ProcessTreeNode => {
    const pid = row.pid
    if (seen.has(pid) || depth > boundedDepth) {
      return processTreeNodeSchema.parse({
        pid,
        ppid: parentPidOf(row),
        exe: exeOf(row),
        cmdline: row.commandLine ?? row.command,
        rss: rssOf(row),
        cpu: row.cpu,
        children: [],
        expanded: false,
        depth,
        isAiTool: row.type === 'ai-tool' || Boolean(row.isAiTool)
      })
    }
    seen.add(pid)
    const children = depth >= boundedDepth ? [] : (childMap.get(pid) ?? []).map(child => build(child, depth + 1))
    seen.delete(pid)
    return processTreeNodeSchema.parse({
      pid,
      ppid: parentPidOf(row),
      exe: exeOf(row),
      cmdline: row.commandLine ?? row.command,
      rss: rssOf(row),
      cpu: row.cpu,
      children,
      expanded: depth < PROCESS_TREE_LIMITS.DEFAULT_DEPTH,
      depth,
      isAiTool: row.type === 'ai-tool' || Boolean(row.isAiTool)
    })
  }
  return build(root as ProcessRecord, 0)
}

function colorFor(row: ProcessRecord, colorBy: TreemapLayout['colorBy']): string {
  if (colorBy === 'ai-tool' && (row.type === 'ai-tool' || row.isAiTool)) return 'warning'
  if (colorBy === 'cpu') return row.cpu > 50 ? 'warning' : 'accent'
  if (colorBy === 'rss') return rssOf(row) > 1024 ? 'warning' : 'info'
  return `hsl(${Math.abs(exeOf(row).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360} 62% 45%)`
}

export function computeTreemapLayout(
  processes: ProcessInfo[],
  width: number,
  height: number,
  groupBy: TreemapLayout['groupBy'] = 'parent',
  colorBy: TreemapLayout['colorBy'] = 'exe'
): TreemapLayout {
  const rows = (processes as ProcessRecord[])
    .filter(row => rssOf(row) > 0)
    .sort((left, right) => rssOf(right) - rssOf(left))
  const visibleRows = rows.slice(0, PROCESS_TREE_LIMITS.TREEMAP_MAX_NODES)
  const totalRss = visibleRows.reduce((sum, row) => sum + rssOf(row), 0)
  const root = hierarchy<TreemapDatum>({
    children: visibleRows.map(row => ({
      id: String(row.pid),
      row,
      value: rssOf(row)
    })),
    id: 'root',
    value: 0
  }).sum(datum => datum.value)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  const laidOutRoot = treemap<TreemapDatum>()
    .tile(treemapBinary)
    .size([width, height])
    .round(false)(root) as HierarchyRectangularNode<TreemapDatum>

  const nodes: TreemapNode[] = laidOutRoot.leaves().map((leaf) => {
    const row = leaf.data.row
    if (!row) throw new Error('E_INVALID_STATE:treemap leaf missing process row')
    return {
      id: String(row.pid),
      pid: row.pid,
      exe: exeOf(row),
      value: rssOf(row),
      x0: leaf.x0,
      y0: leaf.y0,
      x1: leaf.x1,
      y1: leaf.y1,
      depth: leaf.depth,
      parent: groupBy === 'parent' ? String(parentPidOf(row)) : groupBy === 'exe' ? exeOf(row) : groupBy === 'ai-tool' ? String(row.type === 'ai-tool' || row.isAiTool) : undefined,
      color: colorFor(row, colorBy)
    }
  })
  return treemapLayoutSchema.parse({ nodes, totalRss, width, height, groupBy, colorBy, truncated: rows.length > visibleRows.length })
}
