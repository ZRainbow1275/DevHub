import fs from 'fs'
import path from 'path'

const root = process.cwd()
const zhPath = path.join(root, 'src', 'renderer', 'i18n', 'zh-CN.json')
const enPath = path.join(root, 'src', 'renderer', 'i18n', 'en-US.json')
const rendererRoot = path.join(root, 'src', 'renderer')
const maxBundleBytes = 80 * 1024
const sourceExtensions = new Set(['.ts', '.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', 'coverage', '.vite'])
const zhPattern = /[\u4e00-\u9fff]/
const quotedStringPattern = /(['"`])((?:\\.|(?!\1).)*[\u4e00-\u9fff](?:\\.|(?!\1).)*)\1/g
const testPathPattern = /(?:\.test\.|\.spec\.|\/fixtures\/)/

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function flatten(value, prefix = '', output = []) {
  for (const [key, item] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (typeof item === 'string') output.push(next)
    else if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, next, output)
  }
  return output
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files)
      continue
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) files.push(path.join(dir, entry.name))
  }
  return files
}

function collectProductionChineseStrings() {
  const values = new Set()
  for (const file of walk(rendererRoot)) {
    const relativeFile = path.relative(root, file).replace(/\\/g, '/')
    if (testPathPattern.test(relativeFile)) continue
    const text = fs.readFileSync(file, 'utf8')
    if (!zhPattern.test(text)) continue
    for (const match of text.matchAll(quotedStringPattern)) {
      const value = match[2].trim()
      if (value && !value.includes('TODO')) values.add(value)
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function flattenStringValues(value, output = new Set()) {
  if (typeof value === 'string') output.add(value)
  else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const item of Object.values(value)) flattenStringValues(item, output)
  }
  return output
}

const zhBytes = fs.statSync(zhPath).size
const zh = readJson(zhPath)
const en = readJson(enPath)
const zhKeys = flatten(zh).sort()
const nonLegacyZhKeys = zhKeys.filter(key => !key.startsWith('legacy.'))
const enKeys = new Set(flatten(en))
const missingInEn = nonLegacyZhKeys.filter(key => !enKeys.has(key))
const enCoverage = nonLegacyZhKeys.length === 0 ? 1 : (nonLegacyZhKeys.length - missingInEn.length) / nonLegacyZhKeys.length
const zhCoverage = zhKeys.length > 0 ? 1 : 0
const productionChineseStrings = collectProductionChineseStrings()
const legacyCatalog = flattenStringValues(zh.legacy ?? {})
const uncoveredLegacyStrings = productionChineseStrings.filter(text => !legacyCatalog.has(text))
const legacyCoverage = productionChineseStrings.length === 0
  ? 1
  : (productionChineseStrings.length - uncoveredLegacyStrings.length) / productionChineseStrings.length

const report = {
  zhKeys: zhKeys.length,
  nonLegacyZhKeys: nonLegacyZhKeys.length,
  zhBundleKb: Number((zhBytes / 1024).toFixed(2)),
  zhCoverage,
  enCoverage: Number(enCoverage.toFixed(4)),
  missingInEn,
  productionChineseStrings: productionChineseStrings.length,
  legacyCatalogStrings: legacyCatalog.size,
  legacyCoverage: Number(legacyCoverage.toFixed(4)),
  uncoveredLegacyStrings: uncoveredLegacyStrings.slice(0, 50),
}

console.log(JSON.stringify(report, null, 2))

if (zhBytes > maxBundleBytes) {
  console.error(`zh-CN bundle exceeds 80KB: ${zhBytes} bytes`)
  process.exit(1)
}

if (zhCoverage < 0.95) {
  console.error(`zh-CN coverage below 95%: ${zhCoverage}`)
  process.exit(1)
}

if (enCoverage < 0.35) {
  console.error(`en-US partial coverage below 35%: ${enCoverage}`)
  process.exit(1)
}

if (legacyCoverage < 1) {
  console.error(`Legacy zh-CN catalog coverage below 100%: ${legacyCoverage}`)
  process.exit(1)
}
