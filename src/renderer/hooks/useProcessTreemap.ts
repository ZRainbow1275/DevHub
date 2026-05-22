import { useMemo } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import type { TreemapLayout } from '@shared/schemas/r8-runtime'
import { computeTreemapLayout } from '../utils/treemapLayout'

export function useProcessTreemap(
  processes: ProcessInfo[],
  width: number,
  height: number,
  groupBy: TreemapLayout['groupBy'],
  colorBy: TreemapLayout['colorBy']
) {
  return useMemo(
    () => computeTreemapLayout(processes, width, height, groupBy, colorBy),
    [processes, width, height, groupBy, colorBy]
  )
}
