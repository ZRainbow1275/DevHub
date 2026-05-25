import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { act } from 'react'
import type { Project } from '@shared/types'
import { ProjectDetailPanel } from './ProjectDetailPanel'

const project: Project = {
  id: 'density-1',
  name: 'Density Project',
  path: 'D:/Projects/density',
  scripts: ['dev', 'build'],
  defaultScript: 'dev',
  projectType: 'npm',
  tags: [],
  status: 'stopped',
  createdAt: 1713830400000,
  updatedAt: 1713830400000
}

describe('ProjectDetailPanel density token 契约', () => {
  beforeEach(() => {
    cleanup()
    if (window.devhub?.projects) {
      window.devhub.projects.getGitInfo = vi.fn().mockResolvedValue(null)
      window.devhub.projects.getDependencies = vi.fn().mockResolvedValue(null)
    }
  })

  it('header 与 tab content padding / gap 走 density CSS 变量而非硬编码', async () => {
    let container: HTMLElement
    await act(async () => {
      const rendered = render(
        <ProjectDetailPanel
          project={project}
          onClose={vi.fn()}
          onStart={vi.fn()}
          onStop={vi.fn()}
        />
      )
      container = rendered.container
    })

    const inlineStyles = Array.from(container!.querySelectorAll<HTMLElement>('[style]'))
      .map((el) => el.getAttribute('style') ?? '')
      .join(' | ')

    expect(inlineStyles).toContain('var(--container-padding)')
    expect(inlineStyles).toContain('var(--space-card-padding)')
    expect(inlineStyles).toContain('var(--card-gap)')
  })
})
