import { z } from 'zod'

export const SCHEMA_VERSION = '1.0.0'

export const schemaVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)

export const schemaMetaSchema = z.object({
  schemaName: z.string().min(1),
  version: schemaVersionSchema,
  introducedAt: z.string().datetime(),
  deprecatedAt: z.string().datetime().nullable(),
  superseded_by: z.string().nullable()
}).strict()

export const ipcSchemaPairSchema = z.object({
  channel: z.string().min(1),
  reqSchema: z.string().min(1),
  respSchema: z.string().min(1),
  rateClass: z.enum(['high_freq_scan', 'medium_query', 'low_freq_op', 'meta'])
}).strict()

export const schemaValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string()
}).strict()

export const schemaValidationVerdictSchema = z.object({
  channel: z.string().min(1),
  schemaName: z.string().min(1),
  direction: z.enum(['request', 'response']),
  ok: z.boolean(),
  errors: z.array(schemaValidationIssueSchema),
  ts: z.number().int().nonnegative()
}).strict()

export const schemaMigrationStepSchema = z.object({
  fromVersion: schemaVersionSchema,
  toVersion: schemaVersionSchema,
  schemaName: z.string().min(1),
  transform: z.string().min(1),
  reversible: z.boolean()
}).strict()

export const zodListSchemasResponseSchema = z.object({
  currentVersion: schemaVersionSchema,
  count: z.number().int().nonnegative(),
  schemas: z.array(schemaMetaSchema)
}).strict()

export const zodValidatePayloadRequestSchema = z.object({
  schemaName: z.string().min(1),
  payload: z.unknown()
}).strict()

export const zodValidatePayloadResponseSchema = z.object({
  success: z.boolean(),
  valid: z.boolean(),
  schemaName: z.string().min(1),
  checkedAt: z.number().int().nonnegative(),
  data: z.unknown().optional(),
  errors: z.array(schemaValidationIssueSchema)
}).strict()

export const zodMigrationStatusResponseSchema = z.object({
  currentVersion: schemaVersionSchema,
  checkedAt: z.number().int().nonnegative(),
  migratedStores: z.array(z.string().min(1)),
  pendingMigrations: z.array(schemaMigrationStepSchema),
  appliedMigrations: z.array(schemaMigrationStepSchema)
}).strict()

export type SchemaMeta = z.infer<typeof schemaMetaSchema>
export type IpcSchemaPair = z.infer<typeof ipcSchemaPairSchema>
export type SchemaValidationIssue = z.infer<typeof schemaValidationIssueSchema>
export type SchemaValidationVerdict = z.infer<typeof schemaValidationVerdictSchema>
export type SchemaMigrationStep = z.infer<typeof schemaMigrationStepSchema>
export type ZodListSchemasResponse = z.infer<typeof zodListSchemasResponseSchema>
export type ZodValidatePayloadRequest = z.infer<typeof zodValidatePayloadRequestSchema>
export type ZodValidatePayloadResponse = z.infer<typeof zodValidatePayloadResponseSchema>
export type ZodMigrationStatusResponse = z.infer<typeof zodMigrationStatusResponseSchema>
