import { createRequire } from 'node:module'

const nativeRequire = createRequire(import.meta.url)

export async function importOptionalNativeModule(moduleName: string): Promise<unknown | null> {
  try {
    return nativeRequire(moduleName)
  } catch {
    // Fall through to dynamic ESM loading for packages that are not require-compatible.
  }

  try {
    const load = new Function('moduleName', 'return import(moduleName)') as (name: string) => Promise<unknown>
    return await load(moduleName)
  } catch {
    return null
  }
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}
