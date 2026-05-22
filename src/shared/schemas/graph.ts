import { z } from 'zod'

export const graphKindSchema = z.enum(['network-topology', 'neural-relationship', 'flow'])
export const graphNodeKindSchema = z.enum(['process', 'port', 'window', 'project', 'tag', 'ai-task', 'event'])
export const networkEdgeKindSchema = z.enum(['listens', 'connects', 'owns', 'parent-of', 'dll-load', 'service-link'])
export const neuralEdgeKindSchema = z.enum(['belongs-to-project', 'has-tag', 'shares-cwd', 'spawned-by', 'ai-session-of'])
export const flowEdgeKindSchema = z.enum(['happens-before', 'triggers', 'fails', 'retries'])
export const graphLayoutSchema = z.enum(['dagre', 'cose-bilkent', 'cola', 'circle', 'preset'])
export const graphExportFormatSchema = z.enum(['mermaid', 'dot', 'svg', 'png'])

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  kind: graphNodeKindSchema,
  label: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).default({}),
  signals: z.object({
    fusionScore: z.number().min(0).max(1).optional(),
    state: z.string().optional()
  }).optional()
})

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  kind: graphKindSchema,
  type: z.union([networkEdgeKindSchema, neuralEdgeKindSchema, flowEdgeKindSchema]),
  source: z.string().min(1),
  target: z.string().min(1),
  inferenceConfidence: z.number().min(0).max(1).optional(),
  durationMs: z.number().int().nonnegative().optional()
})

export const graphSliceSchema = z.object({
  scope: z.enum(['process', 'port', 'window', 'project', 'global']).default('global'),
  targetIds: z.array(z.union([z.string().min(1), z.number().int()])).default([]),
  graphKind: graphKindSchema.default('network-topology'),
  depth: z.number().int().min(1).max(10).default(3),
  asOfTs: z.number().int().nonnegative().nullable().default(null),
  expandAll: z.boolean().default(false),
  layout: graphLayoutSchema.default('dagre'),
  selectedNodeId: z.string().min(1).nullable().optional()
})

export const graphWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
})

export const graphSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  generatedAt: z.number().int().nonnegative(),
  slice: graphSliceSchema,
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  warnings: z.array(graphWarningSchema).default([]),
  degraded: z.boolean().default(false),
  source: z.enum(['scanner-cache', 'runtime-scan', 'renderer-store']).default('scanner-cache')
})

export const graphSaveSnapshotRequestSchema = z.object({
  snapshotId: z.string().uuid(),
  label: z.string().min(1),
  confirmedBy: z.string().min(3).optional()
})

export const graphSavedSnapshotSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  savedAt: z.number().int().nonnegative(),
  path: z.string().min(1)
})

export const graphExportRequestSchema = z.object({
  snapshotId: z.string().uuid(),
  format: graphExportFormatSchema
})

export const graphExportResultSchema = z.object({
  content: z.string(),
  mimeType: z.string().min(1),
  encoding: z.enum(['utf8', 'base64']).default('utf8')
})

export const graphWarmScopeRequestSchema = z.object({
  scopes: z.array(graphSliceSchema).min(1).max(10)
})

export type GraphKind = z.infer<typeof graphKindSchema>
export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>
export type GraphEdge = z.infer<typeof graphEdgeSchema>
export type GraphNode = z.infer<typeof graphNodeSchema>
export type GraphSlice = z.infer<typeof graphSliceSchema>
export type GraphSnapshot = z.infer<typeof graphSnapshotSchema>
export type GraphLayout = z.infer<typeof graphLayoutSchema>
export type GraphExportFormat = z.infer<typeof graphExportFormatSchema>
export type GraphSavedSnapshot = z.infer<typeof graphSavedSnapshotSchema>
