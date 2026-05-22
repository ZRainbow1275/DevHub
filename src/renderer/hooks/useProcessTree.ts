import { useMemo } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import { buildProcessTree, PROCESS_TREE_LIMITS } from '../utils/treemapLayout'

export function useProcessTree(processes: ProcessInfo[], rootPid?: number, maxDepth = PROCESS_TREE_LIMITS.DEFAULT_DEPTH) {
  return useMemo(() => buildProcessTree(processes, rootPid, maxDepth), [processes, rootPid, maxDepth])
}
