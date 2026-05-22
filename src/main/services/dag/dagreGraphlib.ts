import { createRequire } from 'node:module'
import type { graphlib as Graphlib } from '@dagrejs/dagre'

const nodeRequire = createRequire(import.meta.url)
const dagre = nodeRequire('@dagrejs/dagre') as typeof import('@dagrejs/dagre')

export const graphlib: typeof Graphlib = dagre.graphlib
