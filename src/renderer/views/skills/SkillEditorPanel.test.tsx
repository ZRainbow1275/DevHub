import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillEditorPanel } from './SkillEditorPanel'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language, theme }: { value?: string; onChange?: (value: string) => void; language?: string; theme?: string }) => (
    <textarea aria-label="Monaco editor" data-language={language} data-theme={theme} value={value ?? ''} onChange={event => onChange?.(event.currentTarget.value)} />
  )
}))

vi.mock('./skill-monaco-config', () => ({
  SKILL_EDITOR_MONACO_THEME: 'devhub-skill-editor',
  configureSkillMonaco: vi.fn()
}))

const skill = {
  schemaVersion: '1.0',
  name: 'code-review',
  displayName: 'Code Review',
  version: '1.0.0',
  description: 'Review code with local context.',
  author: 'DevHub',
  license: 'MIT',
  sandbox: 'read-only',
  tags: ['review'],
  inputs: [{ name: 'file', type: 'file', required: true }],
  outputs: [{ name: 'report', type: 'json' }],
  scriptPath: './run.js',
  runtime: 'node',
  permissions: ['fs-read'],
  mcpServers: [],
  builtIn: true,
  source: 'builtin',
  loadedAt: 1,
  filePath: 'builtin://code-review/SKILL.md'
}

const skillText = [
  '---',
  'schemaVersion: "1.0"',
  'name: code-review',
  'displayName: "Code Review"',
  'version: "1.0.0"',
  'description: "Review code with local context."',
  'author: "DevHub"',
  'license: "MIT"',
  'sandbox: read-only',
  'tags: [review]',
  'inputs: []',
  'outputs: []',
  'scriptPath: "./run.js"',
  'runtime: node',
  'permissions: [fs-read]',
  'mcpServers: []',
  '---',
  '# Code Review'
].join(String.fromCharCode(10))

describe('SkillEditorPanel', () => {
  const api = {
    list: vi.fn(async () => ({ skills: [skill], errors: [] })),
    templateList: vi.fn(async () => [{ templateId: 'full', defaultName: 'full-skill', yaml: 'name: full-skill', body: '', script: '' }]),
    get: vi.fn(async () => ({ success: true, error: null, skill, text: skillText })),
    validate: vi.fn(async () => ({ valid: true, yamlErrors: [], schemaErrors: [] })),
    write: vi.fn(async () => ({ success: true })),
    delete: vi.fn(async () => ({ success: true })),
    reload: vi.fn(async () => ({ success: true })),
    createFromTemplate: vi.fn(async () => ({ filePath: 'skills/local/SKILL.md', skill: { ...skill, name: 'local-skill-test', source: 'user', builtIn: false } }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    api.list.mockResolvedValue({ skills: [skill], errors: [] })
    api.templateList.mockResolvedValue([{ templateId: 'full', defaultName: 'full-skill', yaml: 'name: full-skill', body: '', script: '' }])
    api.get.mockResolvedValue({ success: true, error: null, skill, text: skillText })
    api.validate.mockResolvedValue({ valid: true, yamlErrors: [], schemaErrors: [] })
    api.write.mockResolvedValue({ success: true })
    api.delete.mockResolvedValue({ success: true })
    api.reload.mockResolvedValue({ success: true })
    api.createFromTemplate.mockResolvedValue({ filePath: 'skills/local/SKILL.md', skill: { ...skill, name: 'local-skill-test', source: 'user', builtIn: false } })
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { skill: api } }
    })
  })

  it('loads real skill IPC data, validates YAML, and saves through preload API', async () => {
    render(<SkillEditorPanel />)

    expect(await screen.findByTestId('skill-editor-panel')).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('code-review'))
    await waitFor(() => expect(api.validate).toHaveBeenCalled())

    const editor = await screen.findByLabelText('Monaco editor')
    fireEvent.change(editor, { target: { value: `${skillText}${String.fromCharCode(10)}updated: true` } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.write).toHaveBeenCalled())
    expect(api.reload).toHaveBeenCalledWith(true)
  })

  it('switches script language and writes the selected runtime language', async () => {
    render(<SkillEditorPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'SCRIPT' }))
    fireEvent.change(screen.getByLabelText('Script language'), { target: { value: 'python' } })

    const editor = await screen.findByLabelText('Monaco editor')
    expect(editor).toHaveAttribute('data-language', 'python')
    expect(editor).toHaveAttribute('data-theme', 'devhub-skill-editor')

    fireEvent.change(editor, { target: { value: 'print("ok")' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.write).toHaveBeenCalledWith(expect.objectContaining({ scriptLanguage: 'python' })))
  })

  it('requires confirmation before deleting a user skill', async () => {
    const userSkill = { ...skill, builtIn: false, source: 'user' }
    api.list.mockResolvedValue({ skills: [userSkill], errors: [] })
    api.get.mockResolvedValue({ success: true, error: null, skill: userSkill, text: skillText })
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirmSpy })

    try {
      render(<SkillEditorPanel />)

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('code-review'))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('Delete SKILL "code-review"? This cannot be undone.'))
      expect(api.delete).toHaveBeenCalledWith('code-review', 'skill-editor-panel')
      expect(api.reload).toHaveBeenCalledWith(true)
    } finally {
      Reflect.deleteProperty(window, 'confirm')
    }
  })

  it('creates a local skill from a template through IPC', async () => {
    render(<SkillEditorPanel />)

    await screen.findByRole('button', { name: 'New from template' })
    fireEvent.click(screen.getByRole('button', { name: 'New from template' }))

    await waitFor(() => expect(api.createFromTemplate).toHaveBeenCalled())
  })
})
