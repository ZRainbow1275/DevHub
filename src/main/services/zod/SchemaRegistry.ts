import type { ZodType } from 'zod'
import {
  SCHEMA_VERSION,
  schemaMetaSchema,
  schemaValidationVerdictSchema,
  zodListSchemasResponseSchema,
  zodValidatePayloadResponseSchema,
  type SchemaMeta,
  type SchemaValidationIssue,
  type SchemaValidationVerdict,
  type ZodListSchemasResponse,
  type ZodValidatePayloadResponse
} from '@shared/schemas/_meta'
import { r8RuntimeSchemaRegistry, type R8RuntimeSchemaName } from '@shared/schemas/r8-runtime'

export type RuntimeSchemaMap = Record<string, ZodType>

export interface SchemaRegistryOptions {
  readonly currentVersion?: string
  readonly introducedAt?: string
  readonly deprecatedSchemas?: ReadonlyMap<string, { deprecatedAt: string; superseded_by: string | null }>
}

export class SchemaRegistry<SchemaName extends string = string> {
  private readonly currentVersion: string
  private readonly introducedAt: string
  private readonly deprecatedSchemas: ReadonlyMap<string, { deprecatedAt: string; superseded_by: string | null }>

  constructor(
    private readonly schemas: Readonly<Record<SchemaName, ZodType>>,
    options: SchemaRegistryOptions = {}
  ) {
    this.currentVersion = options.currentVersion ?? SCHEMA_VERSION
    this.introducedAt = options.introducedAt ?? '2026-05-05T00:00:00.000Z'
    this.deprecatedSchemas = options.deprecatedSchemas ?? new Map()
  }

  listSchemaNames(): SchemaName[] {
    return Object.keys(this.schemas).sort() as SchemaName[]
  }

  hasSchema(schemaName: string): schemaName is SchemaName {
    return Object.prototype.hasOwnProperty.call(this.schemas, schemaName)
  }

  count(): number {
    return this.listSchemaNames().length
  }

  getSchema(schemaName: SchemaName): ZodType {
    return this.schemas[schemaName]
  }

  listSchemas(): ZodListSchemasResponse {
    const schemas = this.listSchemaNames().map(schemaName => this.schemaMeta(schemaName))
    return zodListSchemasResponseSchema.parse({
      currentVersion: this.currentVersion,
      count: schemas.length,
      schemas
    })
  }

  schemaMeta(schemaName: SchemaName): SchemaMeta {
    const deprecated = this.deprecatedSchemas.get(schemaName)
    return schemaMetaSchema.parse({
      schemaName,
      version: this.currentVersion,
      introducedAt: this.introducedAt,
      deprecatedAt: deprecated?.deprecatedAt ?? null,
      superseded_by: deprecated?.superseded_by ?? null
    })
  }

  validatePayload(schemaName: string, payload: unknown): ZodValidatePayloadResponse {
    const checkedAt = Date.now()
    if (!this.hasSchema(schemaName)) {
      return zodValidatePayloadResponseSchema.parse({
        success: false,
        valid: false,
        schemaName,
        checkedAt,
        errors: [{ path: '$', message: `E_SCHEMA_NOT_FOUND:${schemaName}` }]
      })
    }

    const parsed = this.getSchema(schemaName).safeParse(payload)
    if (!parsed.success) {
      return zodValidatePayloadResponseSchema.parse({
        success: false,
        valid: false,
        schemaName,
        checkedAt,
        errors: this.formatIssues(parsed.error.issues)
      })
    }

    return zodValidatePayloadResponseSchema.parse({
      success: true,
      valid: true,
      schemaName,
      checkedAt,
      data: parsed.data,
      errors: []
    })
  }

  validateForIpc(channel: string, schemaName: string, direction: 'request' | 'response', payload: unknown): SchemaValidationVerdict {
    const result = this.validatePayload(schemaName, payload)
    return schemaValidationVerdictSchema.parse({
      channel,
      schemaName,
      direction,
      ok: result.valid,
      errors: result.errors,
      ts: result.checkedAt
    })
  }

  private formatIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): SchemaValidationIssue[] {
    return issues.map(issue => ({
      path: issue.path.length > 0 ? issue.path.map(segment => String(segment)).join('.') : '$',
      message: issue.message
    }))
  }
}

export function createR8SchemaRegistry(): SchemaRegistry<R8RuntimeSchemaName> {
  return new SchemaRegistry(r8RuntimeSchemaRegistry)
}
