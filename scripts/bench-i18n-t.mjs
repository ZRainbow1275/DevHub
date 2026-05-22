import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import i18next from 'i18next'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ITERATIONS = 10_000
const T_CALL_BUDGET_MS = 50
const SWITCH_LOCALE_BUDGET_MS = 200

function flattenStringKeys(value, prefix = '', output = []) {
  if (typeof value === 'string') {
    output.push(prefix)
    return output
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output
  for (const [key, child] of Object.entries(value)) {
    flattenStringKeys(child, prefix ? `${prefix}.${key}` : key, output)
  }
  return output
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000
}

const [zhCN, enUS] = await Promise.all([
  readFile(resolve(rootDir, 'src/renderer/i18n/zh-CN.json'), 'utf8').then(JSON.parse),
  readFile(resolve(rootDir, 'src/renderer/i18n/en-US.json'), 'utf8').then(JSON.parse),
])

const i18n = i18next.createInstance()
const initStartedAt = performance.now()
await i18n.init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})
const initMs = performance.now() - initStartedAt

const keys = flattenStringKeys(zhCN)
  .filter(key => !key.startsWith('legacy.'))
  .sort()

if (keys.length === 0) {
  throw new Error('No i18n keys found for benchmark')
}

const fixedTranslate = i18n.getFixedT('zh-CN', 'translation')
const translationCache = new Map()
const translate = (key) => {
  const cached = translationCache.get(key)
  if (cached !== undefined) return cached
  const translated = fixedTranslate(key, { defaultValue: key })
  const resolved = typeof translated === 'string' ? translated : key
  translationCache.set(key, resolved)
  return resolved
}

const callStartedAt = performance.now()
for (let index = 0; index < ITERATIONS; index += 1) {
  translate(keys[index % keys.length])
}
const tCallMs = performance.now() - callStartedAt

const switchStartedAt = performance.now()
await i18n.changeLanguage('en-US')
await i18n.changeLanguage('zh-CN')
const switchLocaleMs = performance.now() - switchStartedAt

const report = {
  iterations: ITERATIONS,
  keys: keys.length,
  cacheEntries: translationCache.size,
  initMs: roundMetric(initMs),
  switchLocaleMs: roundMetric(switchLocaleMs),
  switchLocaleBudgetMs: SWITCH_LOCALE_BUDGET_MS,
  tCallMs: roundMetric(tCallMs),
  tCallBudgetMs: T_CALL_BUDGET_MS,
  tCallUs: roundMetric((tCallMs * 1000) / ITERATIONS),
}

if (tCallMs > T_CALL_BUDGET_MS) {
  throw new Error(`i18n.t benchmark ${report.tCallMs}ms exceeds ${T_CALL_BUDGET_MS}ms for ${ITERATIONS} calls`)
}

if (switchLocaleMs > SWITCH_LOCALE_BUDGET_MS) {
  throw new Error(`Locale switch benchmark ${report.switchLocaleMs}ms exceeds ${SWITCH_LOCALE_BUDGET_MS}ms`)
}

console.log(JSON.stringify(report, null, 2))
