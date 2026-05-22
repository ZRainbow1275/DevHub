import {
  channelRegistrationSchema,
  type ChannelRegistration,
  type RateLimitClass
} from '@shared/schemas/ipc-rate-limit'
import type { R8IpcChannelDefinition } from '@shared/schemas/r8-runtime'

export interface RegisteredIpcChannel extends ChannelRegistration {
  readonly rpmOverride?: number
}

export interface ChannelRegistrationInput {
  readonly channel: string
  readonly rateClass?: RateLimitClass
  readonly burstAllowance?: number
  readonly perSenderBucket?: boolean
  readonly description: string
  readonly source?: string
  readonly rpmOverride?: number
}

export interface ValidationErrorWithCode extends Error {
  code: 'E_VALIDATION'
  details?: unknown
}

export function createRateLimitValidationError(message: string, details?: unknown): ValidationErrorWithCode {
  const error = new Error(message) as ValidationErrorWithCode
  error.name = 'RateLimitValidationError'
  error.code = 'E_VALIDATION'
  error.details = details
  return error
}

export class IpcChannelRegistry {
  private readonly channels = new Map<string, RegisteredIpcChannel>()

  register(input: ChannelRegistrationInput): RegisteredIpcChannel {
    const parsed = channelRegistrationSchema.parse({
      channel: input.channel,
      rateClass: input.rateClass ?? 'medium_query',
      burstAllowance: input.burstAllowance,
      perSenderBucket: input.perSenderBucket,
      description: input.description,
      source: input.source
    })

    const registered: RegisteredIpcChannel = input.rpmOverride === undefined
      ? parsed
      : { ...parsed, rpmOverride: input.rpmOverride }
    this.channels.set(parsed.channel, registered)
    return registered
  }

  registerDefinition(definition: R8IpcChannelDefinition): RegisteredIpcChannel {
    return this.register({
      channel: definition.channel,
      rateClass: definition.rateClass,
      burstAllowance: 5,
      perSenderBucket: false,
      description: `${definition.source} ${definition.namespace} IPC channel`,
      source: definition.source
    })
  }

  registerDefinitions(definitions: readonly R8IpcChannelDefinition[]): RegisteredIpcChannel[] {
    return definitions.map(definition => this.registerDefinition(definition))
  }

  ensureRegistered(channel: string, fallback?: ChannelRegistrationInput): RegisteredIpcChannel {
    const existing = this.channels.get(channel)
    if (existing) return existing

    if (fallback) {
      return this.register(fallback)
    }

    throw createRateLimitValidationError(`IPC channel is not registered for rate limiting: ${channel}`, { channel })
  }

  get(channel: string): RegisteredIpcChannel | undefined {
    return this.channels.get(channel)
  }

  list(): ChannelRegistration[] {
    return Array.from(this.channels.values())
      .map(registration => channelRegistrationSchema.parse({
        channel: registration.channel,
        rateClass: registration.rateClass,
        burstAllowance: registration.burstAllowance,
        perSenderBucket: registration.perSenderBucket,
        description: registration.description,
        source: registration.source
      }))
      .sort((left, right) => left.channel.localeCompare(right.channel))
  }

  listRegistered(): RegisteredIpcChannel[] {
    return Array.from(this.channels.values()).sort((left, right) => left.channel.localeCompare(right.channel))
  }

  overrideRateClass(channel: string, rateClass: RateLimitClass): ChannelRegistration {
    const existing = this.ensureRegistered(channel)
    const next = this.register({
      channel: existing.channel,
      rateClass,
      burstAllowance: existing.burstAllowance,
      perSenderBucket: existing.perSenderBucket,
      description: existing.description,
      source: existing.source,
      rpmOverride: existing.rpmOverride
    })
    return channelRegistrationSchema.parse(next)
  }

  assertRegistered(channels: Iterable<string>): void {
    const missing = Array.from(channels).filter(channel => !this.channels.has(channel))
    if (missing.length > 0) {
      throw createRateLimitValidationError('IPC channel registry is missing rateClass declarations.', { missing })
    }
  }

  reset(): void {
    this.channels.clear()
  }
}

export const ipcChannelRegistry = new IpcChannelRegistry()
