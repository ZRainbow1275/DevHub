import type { NodeTemplate } from '@shared/schemas/r8-runtime'
import { useT } from '../../hooks/useT'

interface TemplateNodePaletteProps {
  canInsert: boolean
  canSaveSelected: boolean
  onInsert: () => void
  onSaveSelected: () => void
  onSelectTemplate: (templateId: string) => void
  selectedTemplateId: string
  templates: NodeTemplate[]
}

function templatesBySource(templates: readonly NodeTemplate[], source: NodeTemplate['source']): NodeTemplate[] {
  return templates.filter(template => template.source === source)
}

export function TemplateNodePalette({
  canInsert,
  canSaveSelected,
  onInsert,
  onSaveSelected,
  onSelectTemplate,
  selectedTemplateId,
  templates
}: TemplateNodePaletteProps) {
  const { t } = useT()
  const builtinTemplates = templatesBySource(templates, 'builtin')
  const userTemplates = templatesBySource(templates, 'user')
  const counts = t('dag.templatePalette.counts', '{{builtin}} builtin / {{user}} user')
    .replace('{{builtin}}', String(builtinTemplates.length))
    .replace('{{user}}', String(userTemplates.length))

  return (
    <section aria-label={t('dag.templatePalette.aria', 'Template node palette')} className="space-y-2 border border-surface-800 bg-surface-950 p-3 radius-md" data-testid="template-node-palette">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase text-text-muted">TemplateNodePalette</div>
          <div className="text-xs text-text-muted">{counts}</div>
        </div>
        <button type="button" className="btn-secondary" disabled={!canSaveSelected} onClick={onSaveSelected}>保存选中为模板</button>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <select aria-label={t('dag.templatePalette.node', 'Node template')} className="border border-surface-700 bg-surface-950 px-3 py-2 text-xs text-text-primary radius-sm" value={selectedTemplateId} onChange={event => onSelectTemplate(event.currentTarget.value)}>
          <option value="">选择模板</option>
          {builtinTemplates.length > 0 && (
            <optgroup label="内置模板">
              {builtinTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </optgroup>
          )}
          {userTemplates.length > 0 && (
            <optgroup label="用户模板">
              {userTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </optgroup>
          )}
        </select>
        <button type="button" className="btn-secondary" disabled={!canInsert} onClick={onInsert}>插入模板</button>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={t('dag.templatePalette.builtinQuickPicks', 'Builtin template quick picks')}>
        {builtinTemplates.map(template => (
          <button
            key={template.id}
            type="button"
            className={selectedTemplateId === template.id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => onSelectTemplate(template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>
    </section>
  )
}
