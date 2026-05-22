import { beforeEach, describe, expect, it } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import { buildProcessIndexes, useProcessStore } from './processStore'

function processRow(overrides: Partial<ProcessInfo> & { ppid?: number; parentPid?: number }): ProcessInfo & { ppid?: number; parentPid?: number } {
  return {
    pid: overrides.pid ?? 1,
    name: overrides.name ?? `process-${overrides.pid ?? 1}.exe`,
    command: overrides.command ?? '',
    cpu: overrides.cpu ?? 0,
    memory: overrides.memory ?? 0,
    status: overrides.status ?? 'running',
    startTime: overrides.startTime ?? 1,
    type: overrides.type ?? 'other',
    ...overrides
  }
}

describe('processStore R8.B tree indexes', () => {
  beforeEach(() => {
    useProcessStore.setState({
      processes: [],
      processByPid: new Map(),
      childPidsByParentPid: new Map(),
      zombies: [],
      selectedPid: null
    })
  })

  it('builds deterministic parent and child indexes from real process rows', () => {
    const indexes = buildProcessIndexes([
      processRow({ pid: 12, ppid: 10, name: 'z-child.exe' }),
      processRow({ pid: 10, ppid: 0, name: 'root.exe' }),
      processRow({ pid: 11, ppid: 10, name: 'a-child.exe' })
    ])

    expect(indexes.processByPid.get(10)?.name).toBe('root.exe')
    expect(indexes.childPidsByParentPid.get(0)).toEqual([10])
    expect(indexes.childPidsByParentPid.get(10)).toEqual([11, 12])
  })

  it('keeps indexes current when processes are set and removed', () => {
    useProcessStore.getState().setProcesses([
      processRow({ pid: 20, ppid: 0, name: 'parent.exe' }),
      processRow({ pid: 21, parentPid: 20, name: 'child.exe' })
    ])

    expect(useProcessStore.getState().getProcessByPid(21)?.name).toBe('child.exe')
    expect(useProcessStore.getState().getChildPidsByParentPid(20)).toEqual([21])
    expect(useProcessStore.getState().getChildrenByParentPid(20).map(process => process.pid)).toEqual([21])

    useProcessStore.getState().removeProcess(21)

    expect(useProcessStore.getState().getProcessByPid(21)).toBeUndefined()
    expect(useProcessStore.getState().getChildPidsByParentPid(20)).toEqual([])
  })
})
