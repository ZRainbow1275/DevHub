import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { Skill, SkillTemplate, SkillValidationResult } from '@shared/schemas/r8-runtime'
import { SKILL_EDITOR_MONACO_THEME, configureSkillMonaco } from './skill-monaco-config'
import { useT } from '../../hooks/useT'

type SkillTab = 'yaml' | 'body' | 'script'
type SkillScriptLanguage = 'node' | 'python' | 'bash' | 'powershell'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))
const skillScriptLanguages: SkillScriptLanguage[] = ['node', 'python', 'bash', 'powershell']

const emptyValidation: SkillValidationResult = { valid: false, yamlErrors: [], schemaErrors: [] }

function splitSkillMarkdown(text: string | null): { yaml: string; body: string } {
  if (!text) return { yaml: '', body: '' }
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) return { yaml: trimmed, body: '' }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { yaml: trimmed, body: '' }
  return { yaml: trimmed.slice(3, end).trim(), body: trimmed.slice(end + 4).trimStart() }
}

function extractSkillName(yaml: string): string {
  return yaml.match(/^name:\s*['"]?([a-z0-9-]+)['"]?\s*$/m)?.[1] ?? 'local-skill'
}

function scriptLanguageForRuntime(runtime: Skill['runtime'] | string | undefined): SkillScriptLanguage {
  return skillScriptLanguages.includes(runtime as SkillScriptLanguage) ? runtime as SkillScriptLanguage : 'node'
}

function monacoLanguageForScript(language: SkillScriptLanguage): string {
  if (language === 'node') return 'javascript'
  if (language === 'bash') return 'shell'
  return language
}

function validationText(validation: SkillValidationResult): string {
  if (validation.valid) return 'Schema valid'
  const firstSchema = validation.schemaErrors[0]
  if (firstSchema) return `${firstSchema.path || 'frontmatter'}: ${firstSchema.message}`
  const firstYaml = validation.yamlErrors[0]
  if (firstYaml) return `${firstYaml.line}:${firstYaml.column} ${firstYaml.message}`
  return 'Waiting for validation'
}

export function SkillEditorPanel() {
  const { t } = useT()
  const [skills, setSkills] = useState<Skill[]>([])
  const [templates, setTemplates] = useState<SkillTemplate[]>([])
  const [selectedName, setSelectedName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<SkillTab>('yaml')
  const [yaml, setYaml] = useState('')
  const [body, setBody] = useState('')
  const [script, setScript] = useState('')
  const [scriptLanguage, setScriptLanguage] = useState<SkillScriptLanguage>('node')
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [validation, setValidation] = useState<SkillValidationResult>(emptyValidation)
  const [message, setMessage] = useState<string>('Loading skills')
  const [saving, setSaving] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const selectedSkill = useMemo(() => skills.find(skill => skill.name === selectedName) ?? null, [selectedName, skills])
  const currentValue = activeTab === 'yaml' ? yaml : activeTab === 'body' ? body : script
  const currentLanguage = activeTab === 'yaml' ? 'yaml' : activeTab === 'body' ? 'markdown' : monacoLanguageForScript(scriptLanguage)
  const canDeleteSelected = Boolean(selectedSkill && !selectedSkill.builtIn && !saving)

  const refresh = useCallback(async (preferredName?: string) => {
    const [listResult, templateResult] = await Promise.all([
      window.devhub.r8.skill.list(),
      window.devhub.r8.skill.templateList()
    ])
    setSkills(listResult.skills)
    setTemplates(templateResult)
    setMessage(listResult.errors.length > 0 ? `${listResult.errors.length} invalid skill(s) skipped` : 'Skill library loaded')
    const targetName = preferredName ?? selectedName
    if (targetName && listResult.skills.some(skill => skill.name === targetName)) {
      setSelectedName(targetName)
    } else {
      setSelectedName(listResult.skills[0]?.name ?? '')
    }
    if (!selectedTemplateId && templateResult[0]) setSelectedTemplateId(templateResult[0].templateId)
  }, [selectedName, selectedTemplateId])

  useEffect(() => {
    void refresh().catch(error => setMessage(error instanceof Error ? error.message : String(error)))
  }, [refresh])

  useEffect(() => {
    if (!selectedName) return
    let disposed = false
    void window.devhub.r8.skill.get(selectedName)
      .then(result => {
        if (disposed) return
        const split = splitSkillMarkdown(result.text)
        setYaml(split.yaml)
        setBody(split.body)
        setScript('')
        setScriptLanguage(scriptLanguageForRuntime(result.skill?.runtime))
        setLastSavedAt(result.skill?.loadedAt ?? null)
        setDirty(false)
        setMessage(result.success ? `Loaded ${selectedName}` : result.error ?? 'Skill not found')
      })
      .catch(error => setMessage(error instanceof Error ? error.message : String(error)))
    return () => {
      disposed = true
    }
  }, [selectedName])

  useEffect(() => {
    let disposed = false
    const timer = window.setTimeout(() => {
      void window.devhub.r8.skill.validate({ yaml, body, script })
        .then(result => {
          if (!disposed) setValidation(result)
        })
        .catch(error => {
          if (!disposed) setValidation({ valid: false, yamlErrors: [{ line: 0, column: 0, message: error instanceof Error ? error.message : String(error), severity: 'error' }], schemaErrors: [] })
        })
    }, 200)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [yaml, body, script])

  const updateCurrentValue = (value: string | undefined) => {
    const nextValue = value ?? ''
    if (activeTab === 'yaml') setYaml(nextValue)
    if (activeTab === 'body') setBody(nextValue)
    if (activeTab === 'script') setScript(nextValue)
    setDirty(true)
  }

  const save = async () => {
    if (!validation.valid) return
    setSaving(true)
    try {
      const name = extractSkillName(yaml)
      await window.devhub.r8.skill.write({ name, yaml, body, script, scriptLanguage, confirmedBy: 'skill-editor-panel' })
      await window.devhub.r8.skill.reload(true)
      const savedAt = Date.now()
      setDirty(false)
      setLastSavedAt(savedAt)
      setSelectedName(name)
      setMessage(`Saved ${name}`)
      await refresh(name)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const createFromTemplate = async () => {
    const template = templates.find(item => item.templateId === selectedTemplateId) ?? templates.find(item => item.templateId === 'full') ?? templates[0]
    if (!template) return
    const suffix = Date.now().toString(36)
    const name = `local-skill-${suffix}`
    const created = await window.devhub.r8.skill.createFromTemplate({ templateId: template.templateId, name, displayName: `Local Skill ${suffix}`, confirmedBy: 'skill-editor-panel' })
    setSelectedName(created.skill.name)
    setLastSavedAt(Date.now())
    await refresh(created.skill.name)
  }

  const deleteSelected = async () => {
    if (!selectedSkill) return
    const confirmed = window.confirm(`Delete SKILL "${selectedSkill.name}"? This cannot be undone.`)
    if (!confirmed) return
    setSaving(true)
    try {
      await window.devhub.r8.skill.delete(selectedSkill.name, 'skill-editor-panel')
      await window.devhub.r8.skill.reload(true)
      setYaml('')
      setBody('')
      setScript('')
      setDirty(false)
      setLastSavedAt(null)
      setMessage(`Deleted ${selectedSkill.name}`)
      await refresh('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="skill-editor-panel" data-theme-axis-sync="palette-density-radius-motion">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input flex-1 min-w-48" value={selectedName} onChange={event => setSelectedName(event.target.value)} aria-label={t('skills.editor.selector', 'Skill selector')}>
          {skills.map(skill => <option key={skill.name} value={skill.name}>{skill.name} · {skill.source}</option>)}
        </select>
        <select className="input min-w-44" value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)} aria-label={t('skills.editor.template', 'Skill template')}>
          {templates.map(template => <option key={template.templateId} value={template.templateId}>{template.templateId}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={() => { void createFromTemplate() }}>{t('skills.editor.newFromTemplate', 'New from template')}</button>
        <button type="button" className="btn-secondary" onClick={() => { void refresh() }}>{t('common.reload', 'Reload')}</button>
        <button type="button" className="btn-secondary" disabled={!canDeleteSelected} onClick={() => { void deleteSelected() }}>{t('common.delete', 'Delete')}</button>
        <button type="button" className="btn-primary" disabled={!dirty || !validation.valid || saving} onClick={() => { void save() }}>{t('common.save', 'Save')}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['yaml', 'body', 'script'] as const).map(tab => (
          <button key={tab} type="button" className={activeTab === tab ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab(tab)} data-tab={tab}>{tab.toUpperCase()}</button>
        ))}
        <select className="input-sm" value={scriptLanguage} onChange={event => { setScriptLanguage(event.target.value as SkillScriptLanguage); setDirty(true) }} aria-label={t('skills.editor.scriptLanguage', 'Script language')}>
          {skillScriptLanguages.map(language => <option key={language} value={language}>{language}</option>)}
        </select>
      </div>

      <div className="border border-surface-700 bg-surface-950 radius-md overflow-hidden transition-colors" data-testid="skill-monaco-frame" style={{ borderRadius: 'var(--radius-md)', transitionDuration: 'var(--duration-theme)' }}>
        <Suspense fallback={<textarea className="h-80 w-full bg-surface-950 p-3 font-mono text-sm text-text-primary" value={currentValue} readOnly aria-label={t('skills.editor.loading', 'Skill editor loading')} />}>
          <MonacoEditor
            height="360px"
            value={currentValue}
            defaultLanguage={currentLanguage}
            language={currentLanguage}
            theme={SKILL_EDITOR_MONACO_THEME}
            beforeMount={configureSkillMonaco}
            onChange={updateCurrentValue}
            options={{ automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on', fontSize: 13 }}
          />
        </Suspense>
      </div>

      <div className="grid gap-2 text-xs md:grid-cols-3">
        <div className={validation.valid ? 'text-success' : 'text-warning'} data-validation-error={!validation.valid || undefined}>{validationText(validation)}</div>
        <div className="text-text-muted">{selectedSkill ? `${selectedSkill.runtime} · ${selectedSkill.permissions.join(', ') || t('skills.editor.noPermissions', 'no permissions')}` : t('skills.editor.noSkillSelected', 'No skill selected')}</div>
        <div className="text-text-muted">{lastSavedAt ? `lastSavedAt ${new Date(lastSavedAt).toLocaleString()} · ${message}` : message}</div>
      </div>
    </div>
  )
}
