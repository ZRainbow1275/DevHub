import type { FlowRequest } from '@shared/schemas/flow'

export interface FlowWindowSelection {
  windowMs: number
  fromTs: number
  toTs: number
  cursorTs: number
}

export class FlowWindowSelector {
  constructor(private readonly now: () => number = () => Date.now()) {}

  select(request: FlowRequest): FlowWindowSelection {
    const requestedToTs = request.toTs ?? request.cursorTs ?? this.now()
    const toTs = Math.max(0, Math.trunc(requestedToTs))
    const fromTs = request.fromTs ?? (request.windowMs === -1 ? 0 : Math.max(0, toTs - request.windowMs))
    if (fromTs > toTs) throw new Error('E_VALIDATION:fromTs must be less than or equal to toTs')

    return {
      windowMs: request.windowMs,
      fromTs,
      toTs,
      cursorTs: request.cursorTs ?? toTs
    }
  }
}
