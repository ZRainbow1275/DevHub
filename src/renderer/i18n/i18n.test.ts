import { describe, expect, it } from 'vitest'
import i18n from './index'

describe('renderer i18n scaffold', () => {
  it('renders zh-CN settings keys by default', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('settings.locale.title')).toBe('语言与区域')
    expect(i18n.t('cmdk.placeholder')).toBe('输入命令、URI 或搜索词...')
  })

  it('can switch to en-US without reinitializing the app', async () => {
    await i18n.changeLanguage('en-US')
    expect(i18n.t('settings.locale.title')).toBe('Language and Region')
    expect(i18n.t('cmdk.placeholder')).toBe('Type a command, URI, or search...')
  })

  it('exposes R8.B theme decoration labels for the i18n scaffold', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('settings.appearance.decoration.customSvg')).toBe('自定义 SVG')
    await i18n.changeLanguage('en-US')
    expect(i18n.t('settings.appearance.decoration.position.globalBackground')).toBe('Global Background')
  })

  it('shows bracketed missing keys in dev-compatible mode', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('monitor.unknown')).toBe('[monitor.unknown]')
  })
})
