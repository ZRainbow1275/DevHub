import { execFile } from 'child_process'
import { promisify } from 'util'
import { z } from 'zod'
import { ServiceResult, isProtectedProcess } from '@shared/types-extended'

const execFileAsync = promisify(execFile)

export const safeTaskKillRequestSchema = z.object({
  pid: z.number().int().positive(),
  processName: z.string().min(1).optional(),
  force: z.boolean().default(false)
})

export type SafeTaskKillRequest = z.input<typeof safeTaskKillRequestSchema>

export class SafeTaskKill {
  async kill(input: SafeTaskKillRequest): Promise<ServiceResult<{ pid: number }>> {
    const request = safeTaskKillRequestSchema.parse(input)
    if (request.processName && isProtectedProcess(request.processName)) {
      return { success: false, error: `PROTECTED_PROCESS:${request.processName}` }
    }

    const args = ['/PID', String(request.pid)]
    if (request.force) args.push('/F')

    try {
      await execFileAsync('taskkill.exe', args, { windowsHide: true, timeout: 5000 })
      return { success: true, data: { pid: request.pid } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
