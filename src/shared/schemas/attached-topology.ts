import { z } from 'zod'
import { graphLayoutSchema, graphSnapshotSchema } from './graph'

export const attachedTopologyScopeKindSchema = z.enum(['process', 'port', 'window', 'project'])
export const attachedTopologyGraphKindSchema = z.enum(['network-topology', 'neural-relationship'])

export const attachedTopologyFavoriteSchema = z.object({
  label: z.string().min(1),
  scope: attachedTopologyScopeKindSchema,
  targetId: z.union([z.number().int(), z.string().min(1)]),
  graphKind: attachedTopologyGraphKindSchema,
  pinnedAt: z.number().int().nonnegative()
})

export const attachedTopologyFavoriteChangeActionSchema = z.enum(['pin', 'unpin'])

export const attachedTopologyFavoriteChangeRequestSchema = z.object({
  action: attachedTopologyFavoriteChangeActionSchema,
  favorite: attachedTopologyFavoriteSchema,
  previousFavoriteCount: z.number().int().nonnegative().optional(),
  nextFavoriteCount: z.number().int().nonnegative(),
  selectedNodeId: z.string().min(1).nullable().default(null)
})

export const attachedTopologyFavoriteChangeResultSchema = z.object({
  success: z.literal(true),
  action: attachedTopologyFavoriteChangeActionSchema,
  favorite: attachedTopologyFavoriteSchema,
  auditedAt: z.number().int().nonnegative()
})

export const attachedTopologyRequestSchema = z.object({
  scope: attachedTopologyScopeKindSchema.default('process'),
  targetId: z.union([z.number().int(), z.string().min(1)]).optional(),
  rootId: z.string().min(1).optional(),
  graphKind: attachedTopologyGraphKindSchema.default('network-topology'),
  depth: z.number().int().min(1).max(10).default(3),
  expandedNodeIds: z.array(z.string().min(1)).default([]),
  selectedNodeId: z.string().min(1).nullable().default(null),
  layout: graphLayoutSchema.default('dagre'),
  thumbnailMode: z.boolean().default(false)
})

export const attachedTopologyResultSchema = z.object({
  snapshot: graphSnapshotSchema,
  truncatedAtDepth: z.number().int().min(1).max(10).nullable(),
  expandableNodes: z.array(z.string().min(1)),
  warnings: z.array(z.string()).default([]),
  lazy: z.boolean(),
  thumbnailRecommended: z.boolean().default(false),
  buildMs: z.number().int().nonnegative().optional()
})

export type AttachedTopologyScopeKind = z.infer<typeof attachedTopologyScopeKindSchema>
export type AttachedTopologyGraphKind = z.infer<typeof attachedTopologyGraphKindSchema>
export type AttachedTopologyFavorite = z.infer<typeof attachedTopologyFavoriteSchema>
export type AttachedTopologyFavoriteChangeAction = z.infer<typeof attachedTopologyFavoriteChangeActionSchema>
export type AttachedTopologyFavoriteChangeRequest = z.infer<typeof attachedTopologyFavoriteChangeRequestSchema>
export type AttachedTopologyFavoriteChangeResult = z.infer<typeof attachedTopologyFavoriteChangeResultSchema>
export type AttachedTopologyRequest = z.infer<typeof attachedTopologyRequestSchema>
export type AttachedTopologyResult = z.infer<typeof attachedTopologyResultSchema>
