import kill from 'tree-kill'
import { z } from 'zod'
import { ServiceResult, isProtectedProcess } from '@shared/types-extended'

export const treeKillRequestSchema = z.object({
  pid: z.number().int().positive(),
  processName: z.string().min(1).optional(),
  signal: z.enum(['SIGTERM', 'SIGKILL']).default('SIGTERM')
})

export type TreeKillRequest = z.input<typeof treeKillRequestSchema>

export class TreeKillAdapter {
  killTree(input: TreeKillRequest): Promise<ServiceResult<{ pid: number; signal: 'SIGTERM' | 'SIGKILL' }>> {
    const request = treeKillRequestSchema.parse(input)
    if (request.processName && isProtectedProcess(request.processName)) {
      return Promise.resolve({ success: false, error: `PROTECTED_PROCESS:${request.processName}` })
    }

    return new Promise(resolve => {
      kill(request.pid, request.signal, error => {
        if (error) {
          resolve({ success: false, error: error.message })
          return
        }
        resolve({ success: true, data: { pid: request.pid, signal: request.signal } })
      })
    })
  }
}
