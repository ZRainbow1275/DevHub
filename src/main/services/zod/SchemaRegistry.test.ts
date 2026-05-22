import { describe, expect, it } from 'vitest'
import { csvTaskRowSchema } from '@shared/schemas/r8-runtime'
import { IpcSchemaGuard, IpcSchemaValidationError } from './IpcSchemaGuard'
import { SchemaMigration } from './SchemaMigration'
import { SchemaRegistry } from './SchemaRegistry'

describe('R8.C Zod source-of-truth services', () => {
  it('lists versioned schema metadata from real Zod schema objects', () => {
    const registry = new SchemaRegistry({ CsvTaskRow: csvTaskRowSchema }, { introducedAt: '2026-05-05T00:00:00.000Z' })

    expect(registry.count()).toBe(1)
    expect(registry.listSchemas()).toEqual({
      currentVersion: '1.0.0',
      count: 1,
      schemas: [{
        schemaName: 'CsvTaskRow',
        version: '1.0.0',
        introducedAt: '2026-05-05T00:00:00.000Z',
        deprecatedAt: null,
        superseded_by: null
      }]
    })
  })

  it('validates payloads without mock success and returns structured issue paths', () => {
    const registry = new SchemaRegistry({ CsvTaskRow: csvTaskRowSchema })

    const valid = registry.validatePayload('CsvTaskRow', { id: 'row-1', tool: 'codex', prompt: 'run real validation' })
    const invalid = registry.validatePayload('CsvTaskRow', { id: 'row-2', tool: 'codex', prompt: '' })
    const missing = registry.validatePayload('MissingSchema', {})

    expect(valid.success).toBe(true)
    expect(valid.valid).toBe(true)
    expect(invalid.success).toBe(false)
    expect(invalid.errors.some(issue => issue.path === 'prompt')).toBe(true)
    expect(missing.errors[0]?.message).toBe('E_SCHEMA_NOT_FOUND:MissingSchema')
  })

  it('guards IPC request and response boundaries with E_VALIDATION details', () => {
    const registry = new SchemaRegistry({ CsvTaskRow: csvTaskRowSchema })
    const guard = new IpcSchemaGuard(registry)

    expect(guard.parseRequest('zod:validate-payload', 'CsvTaskRow', { id: 'row-1', tool: 'codex', prompt: 'go' })).toEqual(expect.objectContaining({
      id: 'row-1',
      tool: 'codex',
      prompt: 'go'
    }))
    expect(() => guard.parseResponse('zod:validate-payload', 'CsvTaskRow', { id: 'row-1', tool: 'codex', prompt: '' })).toThrow(IpcSchemaValidationError)

    const verdict = guard.safeValidate('zod:validate-payload', 'CsvTaskRow', 'request', { id: 'row-1', tool: 'codex', prompt: '' })
    expect(verdict.ok).toBe(false)
    expect(verdict.errors[0]?.path).toBe('prompt')
  })

  it('reports migration status and applies only reversible local migrations', () => {
    const migration = new SchemaMigration({
      steps: [{
        fromVersion: '0.9.0',
        toVersion: '1.0.0',
        schemaName: 'CsvTaskRow',
        transform: 'copy-with-schemaVersion',
        reversible: true
      }]
    })

    const migrated = migration.migrateRecord('CsvTaskRow', { id: 'row-1', schemaVersion: '0.9.0' })
    const status = migration.status()

    expect(migrated.value.schemaVersion).toBe('1.0.0')
    expect(migrated.appliedMigrations).toHaveLength(1)
    expect(status.currentVersion).toBe('1.0.0')
    expect(status.appliedMigrations).toHaveLength(1)
    expect(status.pendingMigrations).toHaveLength(0)
  })
})
