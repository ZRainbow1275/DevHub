import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react'
import { act } from 'react'
import type { Project } from '@shared/types'
import { ProjectCard } from './ProjectCard'

const baseProject: Project = {
  id: 'split-1',
  name: 'Split Button Project',
  path: 'D:/Projects/split-button',
  scripts: ['dev', 'build'],
  defaultScript: 'dev',
  projectType: 'npm',
  tags: [],
  status: 'stopped',
  createdAt: 1713830400000,
  updatedAt: 1713830400000
}

function makeProps(overrides: Partial<Parameters<typeof ProjectCard>[0]> = {}) {
  return {
    project: baseProject,
    isSelected: false,
    onSelect: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onRemove: vi.fn(),
    onOpenFolder: vi.fn(),
    onOpenIn: vi.fn(),
    onCopyPath: vi.fn(),
    onManageTags: vi.fn(),
    ...overrides
  }
}

describe('ProjectCard split-button 打开按钮契约', () => {
  beforeEach(() => {
    cleanup()
    if (window.devhub?.projects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window.devhub.projects as any).getGitInfo = vi.fn().mockResolvedValue(null)
    }
  })

  it('渲染包含 data-testid="project-open-button" 主按钮', async () => {
    const props = makeProps()
    await act(async () => {
      render(<ProjectCard {...props} />)
    })

    const mainBtn = screen.getByTestId('project-open-button')
    expect(mainBtn).toBeTruthy()
    expect(mainBtn.tagName).toBe('BUTTON')
  })

  it('渲染包含 data-testid="project-open-chevron" 的 chevron 按钮', async () => {
    const props = makeProps()
    await act(async () => {
      render(<ProjectCard {...props} />)
    })

    const chevron = screen.getByTestId('project-open-chevron')
    expect(chevron).toBeTruthy()
    expect(chevron.tagName).toBe('BUTTON')
  })

  it('点击主按钮直接调用 onOpenFolder 且不弹出菜单', async () => {
    const onOpenFolder = vi.fn()
    const props = makeProps({ onOpenFolder })
    await act(async () => {
      render(<ProjectCard {...props} />)
    })

    expect(within(document.body).queryByTestId('context-menu-portal')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByTestId('project-open-button'))
    })

    expect(onOpenFolder).toHaveBeenCalledTimes(1)
    expect(within(document.body).queryByTestId('context-menu-portal')).toBeNull()
  })

  it('点击 chevron 弹出菜单且包含 5 个 open target 项', async () => {
    const props = makeProps()
    await act(async () => {
      render(<ProjectCard {...props} />)
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('project-open-chevron'))
    })

    const portal = within(document.body).getByTestId('context-menu-portal')
    const text = portal.textContent ?? ''

    expect(text).toContain('VS Code')
    expect(text).toContain('Cursor')
    expect(text).toContain('资源管理器')
    expect(text).toContain('终端')
    expect(text).toContain('复制路径')
  })
})
