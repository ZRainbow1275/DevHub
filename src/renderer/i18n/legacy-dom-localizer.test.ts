import { afterEach, describe, expect, it } from 'vitest'
import i18n from './index'
import {
  applyLegacyDomTranslations,
  legacyTranslationKey,
  translateLegacyText,
} from './legacy-dom-localizer'

describe('legacy DOM i18n localizer', () => {
  afterEach(async () => {
    document.body.innerHTML = ''
    await i18n.changeLanguage('zh-CN')
  })

  it('uses i18n.t keys for legacy hardcoded text with zh-CN fallback', async () => {
    await i18n.changeLanguage('en-US')
    expect(translateLegacyText(i18n, '  监控  ')).toBe('  监控  ')
  })

  it('never leaks missing legacy keys into rendered text', async () => {
    await i18n.changeLanguage('en-US')
    expect(translateLegacyText(i18n, '当前语言')).toBe('当前语言')
  })

  it('translates text nodes and display attributes when a legacy resource exists', async () => {
    const key = legacyTranslationKey('监控')
    i18n.addResource('en-US', 'translation', key, 'Monitor')
    await i18n.changeLanguage('en-US')

    document.body.innerHTML = '<main><button aria-label="监控" title="监控">监控</button><input placeholder="监控" /></main>'
    applyLegacyDomTranslations(i18n)

    expect(document.body.textContent).toContain('Monitor')
    expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Monitor')
    expect(document.querySelector('button')?.getAttribute('title')).toBe('Monitor')
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('Monitor')

    await i18n.changeLanguage('zh-CN')
    applyLegacyDomTranslations(i18n)

    expect(document.body.textContent).toContain('监控')
    expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('监控')
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('监控')
  })

  it('does not overwrite React-owned text after it changes to an English i18n value', async () => {
    document.body.innerHTML = '<main><h4>语言与区域</h4><button aria-label="关闭设置">关闭设置</button></main>'
    applyLegacyDomTranslations(i18n)

    const heading = document.querySelector('h4')
    const button = document.querySelector('button')
    if (!heading || !button) throw new Error('test DOM failed to initialize')

    heading.textContent = 'Language and Region'
    button.setAttribute('aria-label', 'Close settings')
    await i18n.changeLanguage('en-US')
    applyLegacyDomTranslations(i18n)

    expect(heading.textContent).toBe('Language and Region')
    expect(button.getAttribute('aria-label')).toBe('Close settings')
  })
})
