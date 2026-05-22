import fs from 'fs'
import os from 'os'
import path from 'path'
import Store from 'electron-store'
import { describe, expect, it } from 'vitest'
import type { Locale } from '@shared/schemas/r8-runtime'
import { LocaleStore } from './LocaleStore'

function createStore() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-locale-'))
  return new Store<{ locale: Locale }>({
    cwd,
    name: 'locale-test',
    defaults: { locale: 'zh-CN' },
  })
}

describe('LocaleStore', () => {
  it('defaults to zh-CN and persists supported locale changes', () => {
    const store = new LocaleStore(createStore())

    expect(store.getLocale()).toBe('zh-CN')
    expect(store.setLocale('en-US')).toBe('en-US')
    expect(store.getLocale()).toBe('en-US')
  })

  it('lists locale manifests without emoji flags', () => {
    const store = new LocaleStore(createStore())
    const manifests = store.listLocales()

    expect(manifests.map(item => item.locale)).toEqual(['zh-CN', 'en-US'])
    expect(manifests.every(item => item.coverage >= 0 && item.coverage <= 1)).toBe(true)
    expect(JSON.stringify(manifests)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
})
