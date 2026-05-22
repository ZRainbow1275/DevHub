import type { i18n as I18nInstance } from 'i18next'

const CHINESE_TEXT_PATTERN = /[\u4e00-\u9fff]/
const LEGACY_ATTRIBUTE_NAMES = ['aria-label', 'aria-description', 'title', 'placeholder'] as const

interface LegacyTranslationState {
  original: string
  translated: string
}

const textNodeTranslations = new WeakMap<Text, LegacyTranslationState>()

function hashLegacyText(text: string): string {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function legacyTranslationKey(text: string): string {
  return `legacy.${hashLegacyText(text)}`
}

function splitWhitespace(value: string): { leading: string; core: string; trailing: string } {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return { leading: '', core: value, trailing: '' }
  return { leading: match[1] ?? '', core: match[2] ?? '', trailing: match[3] ?? '' }
}

export function translateLegacyText(instance: I18nInstance, value: string): string {
  const { leading, core, trailing } = splitWhitespace(value)
  if (!core || !CHINESE_TEXT_PATTERN.test(core)) return value
  const key = legacyTranslationKey(core)
  const translated = instance.t(key, { defaultValue: core })
  const resolved = typeof translated === 'string' && translated !== key && translated !== `[${key}]` ? translated : core
  return `${leading}${resolved}${trailing}`
}

function translateTextNode(instance: I18nInstance, node: Text): void {
  const current = node.nodeValue ?? ''
  const previous = textNodeTranslations.get(node)
  let original = previous?.original ?? current
  if (previous && current !== previous.original && current !== previous.translated) {
    if (!CHINESE_TEXT_PATTERN.test(current)) {
      textNodeTranslations.delete(node)
      return
    }
    original = current
  }
  if (!CHINESE_TEXT_PATTERN.test(original)) return
  const translated = translateLegacyText(instance, original)
  textNodeTranslations.set(node, { original, translated })
  if (node.nodeValue !== translated) node.nodeValue = translated
}

function translateElementAttributes(instance: I18nInstance, element: Element): void {
  for (const attrName of LEGACY_ATTRIBUTE_NAMES) {
    const originalAttrName = `data-devhub-i18n-original-${attrName}`
    const translatedAttrName = `data-devhub-i18n-translated-${attrName}`
    const current = element.getAttribute(attrName)
    const previousOriginal = element.getAttribute(originalAttrName)
    const previousTranslated = element.getAttribute(translatedAttrName)
    let original = previousOriginal ?? current
    if (previousOriginal && current && current !== previousOriginal && current !== previousTranslated) {
      if (!CHINESE_TEXT_PATTERN.test(current)) {
        element.removeAttribute(originalAttrName)
        element.removeAttribute(translatedAttrName)
        continue
      }
      original = current
      element.setAttribute(originalAttrName, current)
    }
    if (!original || !CHINESE_TEXT_PATTERN.test(original)) continue
    if (!element.hasAttribute(originalAttrName)) element.setAttribute(originalAttrName, original)
    const translated = translateLegacyText(instance, original)
    element.setAttribute(translatedAttrName, translated)
    if (element.getAttribute(attrName) !== translated) element.setAttribute(attrName, translated)
  }
}

export function applyLegacyDomTranslations(instance: I18nInstance, root: ParentNode = document.body): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(instance, node as Text)
    node = walker.nextNode()
  }

  if (root instanceof Element) translateElementAttributes(instance, root)
  root.querySelectorAll?.('*').forEach(element => translateElementAttributes(instance, element))
}

export function installLegacyDomLocalizer(instance: I18nInstance): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined

  let pending = false
  const scheduleApply = () => {
    if (pending) return
    pending = true
    window.requestAnimationFrame(() => {
      pending = false
      applyLegacyDomTranslations(instance)
    })
  }

  const observer = new MutationObserver(scheduleApply)
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [...LEGACY_ATTRIBUTE_NAMES],
    childList: true,
    subtree: true,
  })
  instance.on('languageChanged', scheduleApply)
  scheduleApply()

  return () => {
    observer.disconnect()
    instance.off('languageChanged', scheduleApply)
  }
}
