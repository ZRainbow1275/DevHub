import { rpcChannelSchema, type RpcChannel, type WatchdogChannelDiagnostic, type SupervisorState } from '@shared/schemas/watchdog-rpc'

export const WATCHDOG_RPC_CHANNELS: readonly RpcChannel[] = ['named-pipe', 'tcp-localhost', 'marker-file']

export interface ChannelRecordInput {
  channel: RpcChannel
  at: number
  ok?: boolean
  error?: string | null
}

export class MutualHeartbeat {
  constructor(private readonly staleAfterMs: number = 15_000, private readonly failureThreshold: number = 3) {}

  createDiagnostics(): WatchdogChannelDiagnostic[] {
    return WATCHDOG_RPC_CHANNELS.map(channel => ({
      channel,
      healthy: false,
      lastHeartbeatAt: null,
      consecutiveFailures: 0,
      lastError: null
    }))
  }

  record(diagnostics: WatchdogChannelDiagnostic[], input: ChannelRecordInput): WatchdogChannelDiagnostic[] {
    const channel = rpcChannelSchema.parse(input.channel)
    if (!Number.isInteger(input.at) || input.at < 0) throw new Error('E_VALIDATION:heartbeat timestamp must be nonnegative integer')
    const ok = input.ok ?? true
    return this.normalize(diagnostics).map(item => {
      if (item.channel !== channel) return item
      return {
        channel,
        healthy: ok,
        lastHeartbeatAt: ok ? input.at : item.lastHeartbeatAt,
        consecutiveFailures: ok ? 0 : Math.min(item.consecutiveFailures + 1, this.failureThreshold),
        lastError: ok ? null : input.error ?? 'channel heartbeat failed'
      }
    })
  }

  evaluate(diagnostics: WatchdogChannelDiagnostic[], now: number): WatchdogChannelDiagnostic[] {
    if (!Number.isInteger(now) || now < 0) throw new Error('E_VALIDATION:evaluate timestamp must be nonnegative integer')
    return this.normalize(diagnostics).map(item => {
      const stale = item.lastHeartbeatAt === null || now - item.lastHeartbeatAt > this.staleAfterMs
      if (!stale) return { ...item, healthy: true, lastError: null }
      return {
        ...item,
        healthy: false,
        consecutiveFailures: Math.min(Math.max(item.consecutiveFailures, this.failureThreshold), this.failureThreshold),
        lastError: item.lastError ?? 'channel heartbeat stale'
      }
    })
  }

  toChannelStates(diagnostics: WatchdogChannelDiagnostic[]): SupervisorState['channelStates'] {
    const normalized = this.normalize(diagnostics)
    return {
      'named-pipe': normalized.find(item => item.channel === 'named-pipe')?.healthy ?? false,
      'tcp-localhost': normalized.find(item => item.channel === 'tcp-localhost')?.healthy ?? false,
      'marker-file': normalized.find(item => item.channel === 'marker-file')?.healthy ?? false
    }
  }

  innerHealthy(diagnostics: WatchdogChannelDiagnostic[]): boolean {
    return this.normalize(diagnostics).some(item => item.healthy)
  }

  private normalize(diagnostics: WatchdogChannelDiagnostic[]): WatchdogChannelDiagnostic[] {
    const byChannel = new Map(diagnostics.map(item => [item.channel, item]))
    return WATCHDOG_RPC_CHANNELS.map(channel => byChannel.get(channel) ?? this.emptyDiagnostic(channel))
  }

  private emptyDiagnostic(channel: RpcChannel): WatchdogChannelDiagnostic {
    return { channel, healthy: false, lastHeartbeatAt: null, consecutiveFailures: 0, lastError: null }
  }
}
