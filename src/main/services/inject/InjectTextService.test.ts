import { describe, expect, it } from 'vitest'
import type { ServiceResult } from '@shared/types-extended'
import { InjectTextService, type InjectTextWindowManager } from './InjectTextService'

class LocalWindowManager implements InjectTextWindowManager {
  readonly calls: string[] = []

  async sendTextToWindow(hwnd: number, text: string): Promise<ServiceResult<{ characters: number; mode: string }>> {
    this.calls.push(`text:${hwnd}:${text}`)
    return { success: true, data: { characters: Array.from(text).length, mode: 'sendinput' } }
  }

  async sendKeysToWindow(hwnd: number, keys: string): Promise<ServiceResult> {
    this.calls.push(`keys:${hwnd}:${keys}`)
    return { success: true }
  }
}

describe('InjectTextService', () => {
  it('uses the real text bridge when args.text is present', async () => {
    const windowManager = new LocalWindowManager()
    const service = new InjectTextService(windowManager)

    await expect(service.execute({ hwnd: 10, args: { text: 'hello' } })).resolves.toMatchObject({
      success: true,
      data: { characters: 5, mode: 'sendinput' }
    })
    expect(windowManager.calls).toEqual(['text:10:hello'])
  })

  it('allows only the shared safe key set when explicitly enabled', async () => {
    const windowManager = new LocalWindowManager()
    const service = new InjectTextService(windowManager)

    await expect(service.execute({ hwnd: 11, args: { keys: 'Enter' }, allowSafeKeys: true })).resolves.toMatchObject({
      success: true
    })
    await expect(service.execute({ hwnd: 11, args: { keys: 'Alt+F4' }, allowSafeKeys: true })).resolves.toMatchObject({
      success: false,
      error: 'E_VALIDATION: unsupported safe key combo Alt+F4'
    })
    await expect(service.execute({ hwnd: 11, args: { keys: 'Enter' }, allowSafeKeys: false })).resolves.toMatchObject({
      success: false,
      error: 'E_VALIDATION: process inject-text does not support key-only injection'
    })
  })
})
