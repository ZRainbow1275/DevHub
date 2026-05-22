import { NdjsonStrategy } from './NdjsonStrategy'
import type { ParserDescriptor } from '@shared/schemas/r8-runtime'

export class ShimStrategy extends NdjsonStrategy {
  constructor(tool: ParserDescriptor['tool'] = 'unknown', priority = 90) {
    super(tool, priority, 'shim')
  }
}
