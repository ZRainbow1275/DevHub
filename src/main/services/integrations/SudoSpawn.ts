import { z } from 'zod'
import { ServiceResult } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export const sudoSpawnRequestSchema = z.object({
  command: z.string().min(1),
  applicationName: z.string().min(1).default('DevHub'),
  timeoutMs: z.number().int().positive().max(120000).default(60000)
})

export type SudoSpawnRequest = z.input<typeof sudoSpawnRequestSchema>

export class SudoSpawn {
  async exec(input: SudoSpawnRequest): Promise<ServiceResult<{ stdout: string; stderr: string }>> {
    const request = sudoSpawnRequestSchema.parse(input)
    const nativeModule = toRecord(await importOptionalNativeModule('sudo-prompt'))
    const execCandidate = nativeModule?.exec

    if (typeof execCandidate !== 'function') {
      return { success: false, error: 'SUDO_PROMPT_UNAVAILABLE' }
    }

    return new Promise(resolve => {
      const timer = setTimeout(() => resolve({ success: false, error: 'SUDO_PROMPT_TIMEOUT' }), request.timeoutMs)
      execCandidate(request.command, { name: request.applicationName }, (error: Error | null, stdout: string | Buffer = '', stderr: string | Buffer = '') => {
        clearTimeout(timer)
        if (error) {
          resolve({ success: false, error: error.message })
          return
        }
        resolve({ success: true, data: { stdout: stdout.toString(), stderr: stderr.toString() } })
      })
    })
  }
}
