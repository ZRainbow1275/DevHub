#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemasDir = join(projectRoot, 'src', 'shared', 'schemas')
const schemaIndexPath = join(schemasDir, 'index.ts')
const runtimeSchemaPath = join(schemasDir, 'r8-runtime.ts')
const runtimeHandlersPath = join(projectRoot, 'src', 'main', 'ipc', 'r8RuntimeHandlers.ts')
const typesExtendedPath = join(projectRoot, 'src', 'shared', 'types-extended.ts')

const failures = []
const allowedLegacyRuntimeTypeDuplicates = new Set([
  'SignalContribution'
])

function readRequired(path) {
  if (!existsSync(path)) {
    failures.push(`missing file: ${relative(projectRoot, path)}`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

function schemaSourceFiles() {
  return readdirSync(schemasDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.endsWith('.ts'))
    .filter(name => !name.endsWith('.test.ts'))
    .filter(name => name !== 'index.ts')
    .filter(name => name !== 'r8-runtime.ts')
    .map(name => basename(name, '.ts'))
    .sort()
}

function extractRuntimeRegistryKeys(source) {
  const registryStart = source.indexOf('export const r8RuntimeSchemaRegistry = {')
  if (registryStart === -1) return []
  const registrySource = source.slice(registryStart)
  return Array.from(registrySource.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s/gm)).map(match => match[1])
}

function verifySchemaIndexExports() {
  const indexSource = readRequired(schemaIndexPath)
  for (const schemaFile of schemaSourceFiles()) {
    const expected = `from './${schemaFile}'`
    if (!indexSource.includes(expected)) failures.push(`schema index missing export for: ${schemaFile}`)
  }
}

function verifyRuntimeMetaSchemas() {
  const runtimeSource = readRequired(runtimeSchemaPath)
  const requiredKeys = [
    'SchemaMeta',
    'IpcSchemaPair',
    'SchemaValidationIssue',
    'SchemaValidationVerdict',
    'SchemaMigrationStep',
    'ZodListSchemasResponse',
    'ZodValidatePayloadRequest',
    'ZodValidatePayloadResponse',
    'ZodMigrationStatusResponse'
  ]
  const registryKeys = new Set(extractRuntimeRegistryKeys(runtimeSource))
  for (const key of requiredKeys) {
    if (!registryKeys.has(key)) failures.push(`runtime schema registry missing: ${key}`)
  }
}

function verifyZodIpcGuard() {
  const handlerSource = readRequired(runtimeHandlersPath)
  const requiredSnippets = [
    "ipcMain.handle('zod:list-schemas'",
    "ipcMain.handle('zod:validate-payload'",
    "ipcMain.handle('zod:migration-status'",
    'zodValidatePayloadRequestSchema.parse(input)'
  ]
  for (const snippet of requiredSnippets) {
    if (!handlerSource.includes(snippet)) failures.push(`zod IPC handler missing guard snippet: ${snippet}`)
  }
}

function verifyNoNewDuplicateRuntimeTypes() {
  const runtimeSource = readRequired(runtimeSchemaPath)
  const typesSource = readRequired(typesExtendedPath)
  const registryKeys = new Set(extractRuntimeRegistryKeys(runtimeSource))

  for (const match of typesSource.matchAll(/^export type ([A-Z][A-Za-z0-9]*)\s*=/gm)) {
    const [line] = typesSource.slice(match.index ?? 0).split(/\r?\n/, 1)
    const typeName = match[1]
    if (allowedLegacyRuntimeTypeDuplicates.has(typeName)) continue
    if (registryKeys.has(typeName) && !line.includes('z.infer<typeof')) {
      failures.push(`types-extended duplicates runtime schema type without z.infer: ${typeName}`)
    }
  }

  for (const match of typesSource.matchAll(/^export interface ([A-Z][A-Za-z0-9]*)\s/gm)) {
    const typeName = match[1]
    if (allowedLegacyRuntimeTypeDuplicates.has(typeName)) continue
    if (registryKeys.has(typeName)) {
      failures.push(`types-extended duplicates runtime schema interface: ${typeName}`)
    }
  }
}

verifySchemaIndexExports()
verifyRuntimeMetaSchemas()
verifyZodIpcGuard()
verifyNoNewDuplicateRuntimeTypes()

if (failures.length > 0) {
  console.error('Zod SoT verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Zod SoT verification passed.')
