import type { SchemaValidationVerdict } from '@shared/schemas/_meta'
import type { SchemaRegistry } from './SchemaRegistry'

export class IpcSchemaValidationError extends Error {
  readonly code = 'E_VALIDATION'

  constructor(readonly verdict: SchemaValidationVerdict) {
    super(`E_VALIDATION:${verdict.channel}:${verdict.schemaName}:${verdict.direction}`)
    this.name = 'IpcSchemaValidationError'
  }
}

export class IpcSchemaGuard<SchemaName extends string = string> {
  constructor(private readonly registry: SchemaRegistry<SchemaName>) {}

  parseRequest<T>(channel: string, schemaName: SchemaName, payload: unknown): T {
    return this.parse(channel, schemaName, 'request', payload)
  }

  parseResponse<T>(channel: string, schemaName: SchemaName, payload: unknown): T {
    return this.parse(channel, schemaName, 'response', payload)
  }

  safeValidate(channel: string, schemaName: SchemaName, direction: 'request' | 'response', payload: unknown): SchemaValidationVerdict {
    return this.registry.validateForIpc(channel, schemaName, direction, payload)
  }

  private parse<T>(channel: string, schemaName: SchemaName, direction: 'request' | 'response', payload: unknown): T {
    const result = this.registry.validatePayload(schemaName, payload)
    const verdict = this.registry.validateForIpc(channel, schemaName, direction, payload)
    if (!result.valid) throw new IpcSchemaValidationError(verdict)
    return result.data as T
  }
}
