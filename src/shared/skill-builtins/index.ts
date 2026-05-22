import { skillSchema, type Skill } from '../schemas/r8-runtime'

export const BUILTIN_SKILL_NAMES = [
  'code-review',
  'explain-code',
  'write-test',
  'refactor',
  'fix-bug',
  'doc-generate',
  'translate-i18n',
  'lint-fix',
  'migrate-version',
  'security-audit'
] as const

export type BuiltinSkillName = typeof BUILTIN_SKILL_NAMES[number]

export interface BuiltinSkillManifest {
  name: BuiltinSkillName
  skill: Skill
  markdown: string
  readme: string
  scriptContent: string
}

interface BuiltinDefinition {
  name: BuiltinSkillName
  displayName: string
  description: string
  tags: string[]
  prompt: string
}

const DEFINITIONS: readonly BuiltinDefinition[] = [
  { name: 'code-review', displayName: 'Code Review Helper', description: 'Review source files for correctness, maintainability, and risky changes.', tags: ['review', 'quality'], prompt: 'Review this file and return findings grouped by severity.' },
  { name: 'explain-code', displayName: 'Explain Code Helper', description: 'Explain source code in practical language for maintainers and reviewers.', tags: ['explain', 'docs'], prompt: 'Explain what this code does, including inputs, outputs, and hidden risks.' },
  { name: 'write-test', displayName: 'Write Test Helper', description: 'Generate focused unit or integration test cases from real source context.', tags: ['test', 'quality'], prompt: 'Design tests for this code, covering happy paths and edge cases.' },
  { name: 'refactor', displayName: 'Refactor Helper', description: 'Suggest safe refactors while preserving existing behavior and public contracts.', tags: ['refactor', 'design'], prompt: 'Suggest a behavior-preserving refactor plan with risk notes.' },
  { name: 'fix-bug', displayName: 'Fix Bug Helper', description: 'Diagnose error logs and source snippets to propose a minimal root-cause fix.', tags: ['debug', 'bug'], prompt: 'Find the likely root cause and propose a minimal verified fix.' },
  { name: 'doc-generate', displayName: 'Documentation Generator', description: 'Generate developer documentation from source files and runtime notes.', tags: ['docs', 'maintainability'], prompt: 'Generate concise documentation for this source context.' },
  { name: 'translate-i18n', displayName: 'Translate I18n Helper', description: 'Translate locale JSON or message catalogs while preserving keys exactly.', tags: ['i18n', 'translation'], prompt: 'Translate values while preserving keys, placeholders, and JSON shape.' },
  { name: 'lint-fix', displayName: 'Lint Fix Helper', description: 'Explain lint failures and propose precise edits without hiding real problems.', tags: ['lint', 'quality'], prompt: 'Analyze lint output and suggest precise fixes with no suppression-only shortcuts.' },
  { name: 'migrate-version', displayName: 'Version Migration Helper', description: 'Plan framework or library version migrations using real code context.', tags: ['migration', 'upgrade'], prompt: 'Plan a safe migration for this code and call out compatibility risks.' },
  { name: 'security-audit', displayName: 'Security Audit Helper', description: 'Audit source snippets for injection, path traversal, auth, and data exposure risks.', tags: ['security', 'audit'], prompt: 'Audit this code for concrete security risks and remediation steps.' }
]

function scriptFor(definition: BuiltinDefinition): string {
  return `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

const target = process.argv[2]
if (!target) {
  console.error(JSON.stringify({ error: 'E_INPUT_REQUIRED', message: 'A file path argument is required.' }))
  process.exit(2)
}
const resolved = path.resolve(target)
const content = fs.readFileSync(resolved, 'utf8')
const result = {
  skill: '${definition.name}',
  file: resolved,
  bytes: Buffer.byteLength(content),
  lineCount: content.split(/\\r?\\n/).length,
  prompt: ${JSON.stringify(definition.prompt)} + '\\n\\n' + content
}
console.log(JSON.stringify(result))
`
}

function markdownFor(definition: BuiltinDefinition): string {
  return `---
schemaVersion: "1.0"
name: ${definition.name}
displayName: "${definition.displayName}"
version: "1.0.0"
description: "${definition.description}"
author: "DevHub"
license: "MIT"
sandbox: read-only
tags: [${definition.tags.join(', ')}]
inputs:
  - name: file
    type: file
    required: true
    description: "Source file to inspect."
outputs:
  - name: report
    type: json
scriptPath: "./run.js"
runtime: node
permissions: [fs-read]
mcpServers: []
---
# ${definition.displayName}

${definition.description}

This built-in skill runs offline, reads one local file, and prints JSON to stdout for the R8.C task queue.
`
}

function readmeFor(definition: BuiltinDefinition): string {
  return `# ${definition.displayName}

Use this skill with a local file path. It does not call network APIs and does not contain API keys.

## Example

\`node run.js src/example.ts\`

## Output

The script prints JSON containing the skill name, target file, byte count, line count, and prompt payload.
`
}

function skillFor(definition: BuiltinDefinition): BuiltinSkillManifest {
  const skill = skillSchema.parse({
    schemaVersion: '1.0',
    name: definition.name,
    displayName: definition.displayName,
    version: '1.0.0',
    description: definition.description,
    author: 'DevHub',
    license: 'MIT',
    sandbox: 'read-only',
    tags: definition.tags,
    inputs: [{ name: 'file', type: 'file', required: true, description: 'Source file to inspect.' }],
    outputs: [{ name: 'report', type: 'json' }],
    scriptPath: './run.js',
    runtime: 'node',
    permissions: ['fs-read'],
    mcpServers: [],
    builtIn: true,
    source: 'builtin',
    loadedAt: 0,
    filePath: `builtin://${definition.name}/SKILL.md`
  })
  return {
    name: definition.name,
    skill,
    markdown: markdownFor(definition),
    readme: readmeFor(definition),
    scriptContent: scriptFor(definition)
  }
}

export const BUILTIN_SKILLS = DEFINITIONS.map(skillFor) satisfies BuiltinSkillManifest[]

if (BUILTIN_SKILLS.length !== 10) {
  throw new Error(`E_VALIDATION:expected 10 builtin skills, got ${BUILTIN_SKILLS.length}`)
}

const uniqueNames = new Set(BUILTIN_SKILLS.map(item => item.name))
if (uniqueNames.size !== BUILTIN_SKILLS.length) {
  throw new Error('E_VALIDATION:builtin skill names must be unique')
}
