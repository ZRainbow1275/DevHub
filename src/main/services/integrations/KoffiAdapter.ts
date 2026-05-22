import { z } from 'zod'
import { ServiceResult } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export const koffiLibraryRequestSchema = z.object({
  libraryName: z.enum(['user32.dll', 'kernel32.dll', 'advapi32.dll'])
})

export type KoffiLibraryRequest = z.input<typeof koffiLibraryRequestSchema>

export class KoffiAdapter {
  async loadLibrary(input: KoffiLibraryRequest): Promise<ServiceResult<{ libraryName: string }>> {
    const request = koffiLibraryRequestSchema.parse(input)
    const nativeModule = toRecord(await importOptionalNativeModule('koffi'))
    const defaultExport = toRecord(nativeModule?.default)
    const loadCandidate = nativeModule?.load ?? defaultExport?.load

    if (typeof loadCandidate !== 'function') return { success: false, error: 'KOFFI_UNAVAILABLE' }

    try {
      loadCandidate.call(defaultExport ?? nativeModule, request.libraryName)
      return { success: true, data: { libraryName: request.libraryName } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
