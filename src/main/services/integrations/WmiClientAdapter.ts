import { z } from 'zod'
import { getPowerShellGateway, PowerShellGateway } from '../runtime/PowerShellGateway'
import { importOptionalNativeModule, toRecord } from './nativeImport'

const wmiQuerySchema = z.object({
  className: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
  where: z.string().optional(),
  timeoutMs: z.number().int().positive().max(10000).default(1500)
})

export type WmiQueryRequest = z.input<typeof wmiQuerySchema>

export interface WmiQueryResult {
  rows: Record<string, unknown>[]
  source: 'wmi-client' | 'powershell'
  degraded: boolean
  durationMs: number
  error?: string
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(toRecord).filter((row): row is Record<string, unknown> => row !== null)
  const row = toRecord(value)
  return row ? [row] : []
}

function buildPowerShellQuery(request: z.output<typeof wmiQuerySchema>): string {
  const fieldList = request.fields.join(',')
  const where = request.where ? ` | Where-Object { ${request.where} }` : ''
  return `Get-CimInstance -ClassName ${request.className}${where} | Select-Object ${fieldList} | ConvertTo-Json -Depth 4`
}

export class WmiClientAdapter {
  constructor(private readonly gateway: PowerShellGateway = getPowerShellGateway()) {}

  async query(input: WmiQueryRequest): Promise<WmiQueryResult> {
    const request = wmiQuerySchema.parse(input)
    const start = Date.now()
    const nativeModule = await importOptionalNativeModule('wmi-client')
    const nativeRecord = toRecord(nativeModule)
    const defaultExport = toRecord(nativeRecord?.default)
    const queryCandidate = nativeRecord?.query ?? defaultExport?.query

    if (typeof queryCandidate === 'function') {
      try {
        const rows = normalizeRows(await queryCandidate.call(defaultExport ?? nativeRecord, request.className, request.fields, request.where))
        return { rows, source: 'wmi-client', degraded: false, durationMs: Date.now() - start }
      } catch (error) {
        const fallback = await this.queryWithPowerShell(request, start)
        return { ...fallback, error: error instanceof Error ? error.message : String(error) }
      }
    }

    return this.queryWithPowerShell(request, start)
  }

  private async queryWithPowerShell(request: z.output<typeof wmiQuerySchema>, start: number): Promise<WmiQueryResult> {
    const stdout = await this.gateway.execute(buildPowerShellQuery(request), {
      label: `wmi-fallback:${request.className}`,
      timeoutMs: request.timeoutMs,
      parser: output => output.trim()
    })
    const parsed = stdout ? JSON.parse(stdout) as unknown : []
    return { rows: normalizeRows(parsed), source: 'powershell', degraded: true, durationMs: Date.now() - start }
  }
}
