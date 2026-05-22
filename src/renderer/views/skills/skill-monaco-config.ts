import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import yamlWorker from 'monaco-yaml/yaml.worker?worker'
import { configureMonacoYaml, type JSONSchema } from 'monaco-yaml'

const globalScope = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_workerId: string, label: string) => Worker
  }
}

globalScope.MonacoEnvironment = {
  getWorker: (_workerId: string, label: string) => {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    if (label === 'yaml') return new yamlWorker()
    return new editorWorker()
  }
}

loader.config({ monaco })

export const SKILL_EDITOR_MONACO_THEME = 'devhub-skill-editor'

export const skillYamlJsonSchema: JSONSchema = {
  type: 'object',
  required: ['schemaVersion', 'name', 'displayName', 'version', 'description', 'scriptPath', 'runtime'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: '1.0' },
    name: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 1, maxLength: 60 },
    displayName: { type: 'string', minLength: 1, maxLength: 120 },
    version: { type: 'string', pattern: '^[0-9]+[.][0-9]+[.][0-9]+$' },
    description: { type: 'string', minLength: 10, maxLength: 500 },
    author: { type: 'string', maxLength: 80 },
    license: { type: 'string', minLength: 1, maxLength: 80 },
    sandbox: { enum: ['read-only', 'read-write', 'system'] },
    tags: { type: 'array', maxItems: 10, items: { type: 'string' } },
    inputs: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['name', 'type'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: { enum: ['string', 'number', 'boolean', 'file', 'json'] },
          required: { type: 'boolean' },
          default: {},
          description: { type: 'string' }
        }
      }
    },
    outputs: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['name', 'type'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: { enum: ['string', 'json', 'file', 'exit-code'] }
        }
      }
    },
    scriptPath: { type: 'string', minLength: 1 },
    runtime: { enum: ['node', 'python', 'bash', 'powershell', 'exe'] },
    runtimeVersion: { type: 'string' },
    permissions: { type: 'array', maxItems: 4, items: { enum: ['fs-read', 'fs-write', 'net', 'exec'] } },
    mcpServers: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['name', 'command'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', pattern: '^[a-z0-9-]+$' },
          transport: { enum: ['stdio'] },
          command: { type: 'string', minLength: 1, maxLength: 500 },
          args: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } },
          env: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 } }
        }
      }
    }
  }
}

let yamlConfigured = false

function readCssVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

function isLightPalette(): boolean {
  if (typeof document === 'undefined') return false
  const palette = document.documentElement.dataset.theme ?? ''
  return palette.includes('light') || palette === 'swiss'
}

export function refreshSkillEditorMonacoTheme(monacoApi: typeof monaco): void {
  monacoApi.editor.defineTheme(SKILL_EDITOR_MONACO_THEME, {
    base: isLightPalette() ? 'vs' : 'vs-dark',
    inherit: true,
    colors: {
      'editor.background': readCssVariable('--surface-950', '#1a1814'),
      'editor.foreground': readCssVariable('--text-primary', '#f5f0e8'),
      'editorLineNumber.foreground': readCssVariable('--surface-500', '#6b635a'),
      'editorLineNumber.activeForeground': readCssVariable('--text-primary', '#f5f0e8'),
      'editorCursor.foreground': readCssVariable('--warning', '#c9a227'),
      'editor.selectionBackground': readCssVariable('--surface-700', '#443f39'),
      'editor.lineHighlightBackground': readCssVariable('--surface-900', '#252220'),
      'editorWidget.background': readCssVariable('--surface-900', '#252220'),
      'editorWidget.border': readCssVariable('--surface-700', '#443f39'),
      'inputValidation.errorBorder': readCssVariable('--error', '#d64545'),
      'inputValidation.warningBorder': readCssVariable('--warning', '#c9a227'),
      'inputValidation.infoBorder': readCssVariable('--info', '#6b7d8a')
    },
    rules: []
  })
}

export function configureSkillMonaco(monacoApi: typeof monaco): void {
  refreshSkillEditorMonacoTheme(monacoApi)
  if (yamlConfigured) return
  configureMonacoYaml(monacoApi, {
    enableSchemaRequest: false,
    validate: true,
    completion: true,
    hover: true,
    format: true,
    schemas: [{ uri: 'devhub://schemas/skill-frontmatter.json', fileMatch: ['**/*.skill.yaml', '**/SKILL.md'], schema: skillYamlJsonSchema }]
  })
  yamlConfigured = true
}
