import { z } from 'zod'

export const dependencyConditionSchema = z.enum(['success', 'failure', 'any', 'completed'])
export const dependencyCombinatorSchema = z.enum(['all', 'any'])

export const dependencyClauseSchema = z.strictObject({
  refs: z.array(z.string().min(1)).min(1),
  combinator: dependencyCombinatorSchema.default('all'),
  condition: dependencyConditionSchema.default('success')
})

export const parsedDependencySchema = z.strictObject({
  raw: z.string(),
  clauses: z.array(dependencyClauseSchema)
})

export const dagInputNodeSchema = z.strictObject({
  id: z.string().min(1),
  dependencyIds: z.array(z.string().min(1)).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  parallelGroup: z.string().min(1).nullable().default(null),
  parallelGroupMax: z.number().int().positive().nullable().default(null),
  estimatedDurationMs: z.number().int().nonnegative().nullable().default(null)
})

export const dagGraphSchema = z.strictObject({
  nodes: z.array(dagInputNodeSchema).min(1),
  completedIds: z.array(z.string().min(1)).default([]),
  failedIds: z.array(z.string().min(1)).default([])
})

export const dagWarningSchema = z.strictObject({
  kind: z.enum(['orphan-node', 'unreachable', 'long-critical-path', 'parallel-group-conflict']),
  taskIds: z.array(z.string().min(1)),
  message: z.string().min(1)
})

export const dagNodeSchema = z.strictObject({
  taskId: z.string().min(1),
  layer: z.number().int().nonnegative(),
  parallelGroup: z.string().min(1).nullable(),
  parallelGroupMax: z.number().int().positive().nullable(),
  priority: z.number().int().min(0).max(100).default(50),
  estimatedDurationMs: z.number().int().nonnegative().nullable(),
  isCriticalPath: z.boolean().default(false),
  inDegree: z.number().int().nonnegative(),
  outDegree: z.number().int().nonnegative()
})

export const dagEdgeSchema = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  condition: dependencyConditionSchema,
  combinator: dependencyCombinatorSchema.default('all')
})

export const dagSnapshotSchema = z.strictObject({
  sessionId: z.string().min(1),
  generatedAt: z.number().int().nonnegative(),
  nodes: z.array(dagNodeSchema),
  edges: z.array(dagEdgeSchema),
  layers: z.array(z.array(z.string().min(1))),
  totalLayers: z.number().int().nonnegative(),
  criticalPath: z.array(z.string().min(1)),
  estimatedTotalMs: z.number().int().nonnegative().nullable(),
  warnings: z.array(dagWarningSchema),
  hash: z.string().min(1).optional()
})

export const dagAuditEntrySchema = z.strictObject({
  type: z.literal('dag:build'),
  sessionId: z.string().min(1),
  hash: z.string().min(1),
  previousHash: z.string().min(1).nullable(),
  sequence: z.number().int().positive(),
  generatedAt: z.number().int().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  layerCount: z.number().int().nonnegative(),
  criticalPathLength: z.number().int().nonnegative()
})

export const dagCycleErrorSchema = z.strictObject({
  cyclePaths: z.array(z.array(z.string().min(1)).min(2))
})

export const dagBuildRequestSchema = z.strictObject({
  sessionId: z.string().min(1).optional(),
  csvPath: z.string().min(1).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  graph: dagGraphSchema.optional(),
  nodes: z.array(dagInputNodeSchema).optional()
})

export const dagExportFormatSchema = z.enum(['dot', 'mermaid', 'cytoscape'])

export const dagExportRequestSchema = z.strictObject({
  sessionId: z.string().min(1),
  format: dagExportFormatSchema
})

export const dagLayerRequestSchema = z.strictObject({
  sessionId: z.string().min(1),
  layerIndex: z.number().int().nonnegative()
})

export const dagReadyRequestSchema = z.strictObject({
  sessionId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  graph: dagGraphSchema.optional(),
  snapshot: dagSnapshotSchema.optional(),
  completedIds: z.array(z.string().min(1)).default([]),
  failedIds: z.array(z.string().min(1)).default([])
})

export const dagExportResultSchema = z.strictObject({
  content: z.string(),
  mimeType: z.string().min(1),
  format: dagExportFormatSchema,
  sessionId: z.string().min(1)
})

export type DependencyCondition = z.infer<typeof dependencyConditionSchema>
export type DependencyCombinator = z.infer<typeof dependencyCombinatorSchema>
export type DependencyClause = z.infer<typeof dependencyClauseSchema>
export type ParsedDependency = z.infer<typeof parsedDependencySchema>
export type DagInputNode = z.infer<typeof dagInputNodeSchema>
export type DagGraphInput = z.infer<typeof dagGraphSchema>
export type DagNode = z.infer<typeof dagNodeSchema>
export type DagEdge = z.infer<typeof dagEdgeSchema>
export type DagSnapshot = z.infer<typeof dagSnapshotSchema>
export type DagAuditEntry = z.infer<typeof dagAuditEntrySchema>
export type DagCycleError = z.infer<typeof dagCycleErrorSchema>
export type DagExportFormat = z.infer<typeof dagExportFormatSchema>
export type DagWarning = z.infer<typeof dagWarningSchema>
