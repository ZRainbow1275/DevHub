import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from './projectStore'

describe('projectStore log redaction', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      selectedProjectId: null,
      logs: new Map(),
      filter: {
        tag: null,
        group: null,
        search: ''
      }
    })
  })

  it('redacts secret-shaped process output before storing renderer logs', () => {
    useProjectStore.getState().addLog({
      projectId: 'project-1',
      timestamp: 1_900_010,
      type: 'stderr',
      message: 'failed with token=tok-secret123456 and Bearer abcdefghijklmnopqrstuvwxyz'
    })

    const logs = useProjectStore.getState().logs.get('project-1') ?? []

    expect(logs).toHaveLength(1)
    expect(logs[0]?.message).toContain('token=[REDACTED]')
    expect(logs[0]?.message).toContain('Bearer [REDACTED]')
    expect(logs[0]?.message).not.toContain('tok-secret123456')
    expect(logs[0]?.message).not.toContain('abcdefghijklmnopqrstuvwxyz')
  })
})
