import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import type { Project } from '@shared/types'
import { ProjectDetailPanel } from './ProjectDetailPanel'

const project: Project = {
  id: 'devhub',
  name: 'DevHub',
  path: 'D:/Desktop/CREATOR ONE/devhub',
  scripts: ['dev', 'build', 'test'],
  defaultScript: 'dev',
  projectType: 'npm',
  tags: ['local'],
  status: 'running',
  port: 5173,
  createdAt: 1713830400000,
  updatedAt: 1713830400000
}

describe('ProjectDetailPanel global topology bridge', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    if (window.devhub?.projects) {
      window.devhub.projects.getGitInfo = vi.fn().mockResolvedValue(null)
      window.devhub.projects.getDependencies = vi.fn().mockResolvedValue(null)
    }
  })

  it('opens the global topology with the selected project node id', async () => {
    const events: Event[] = []
    const openGlobal = (event: Event) => events.push(event)
    window.addEventListener('devhub:open-topology-global', openGlobal)

    await act(async () => {
      render(
        <ProjectDetailPanel
          project={project}
          onClose={vi.fn()}
          onStart={vi.fn()}
          onStop={vi.fn()}
        />
      )
    })

    fireEvent.click(screen.getByTestId('project-global-topology-button'))

    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('project-devhub')
    expect(events).toHaveLength(1)

    window.removeEventListener('devhub:open-topology-global', openGlobal)
  })
})
