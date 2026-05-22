import fs from 'fs'
import path from 'path'

const root = process.cwd()
const rendererRoot = path.join(root, 'src', 'renderer')
const zhPath = path.join(root, 'src', 'renderer', 'i18n', 'zh-CN.json')
const sourceExtensions = new Set(['.ts', '.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', 'coverage', '.vite'])
const zhPattern = /[\u4e00-\u9fff]/
const quotedStringPattern = /(['"`])((?:\\.|(?!\1).)*[\u4e00-\u9fff](?:\\.|(?!\1).)*)\1/g
const testPathPattern = /(?:\.test\.|\.spec\.|\/fixtures\/)/

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files)
      continue
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function flattenStrings(value, output = new Set()) {
  if (typeof value === 'string') output.add(value)
  else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const item of Object.values(value)) flattenStrings(item, output)
  }
  return output
}

function readLegacyCatalog() {
  if (!fs.existsSync(zhPath)) return new Set()
  const parsed = JSON.parse(fs.readFileSync(zhPath, 'utf8'))
  return flattenStrings(parsed.legacy ?? {})
}

const findings = []
for (const file of walk(rendererRoot)) {
  const text = fs.readFileSync(file, 'utf8')
  if (!zhPattern.test(text)) continue
  const relativeFile = path.relative(root, file).replace(/\\/g, '/')
  for (const match of text.matchAll(quotedStringPattern)) {
    const value = match[2].trim()
    if (!value || value.includes('TODO')) continue
    findings.push({
      file: relativeFile,
      isTest: testPathPattern.test(relativeFile),
      line: lineOf(text, match.index ?? 0),
      text: value.slice(0, 160),
    })
  }
}

const productionFindings = findings.filter(item => !item.isTest)
const uniqueProductionStrings = [...new Set(productionFindings.map(item => item.text))]
const legacyCatalog = readLegacyCatalog()
const uncoveredLegacyStrings = uniqueProductionStrings.filter(text => !legacyCatalog.has(text))

console.log(JSON.stringify({
  scannedRoot: path.relative(root, rendererRoot).replace(/\\/g, '/'),
  hardcodedChineseStrings: findings.length,
  productionHardcodedChineseStrings: productionFindings.length,
  testHardcodedChineseStrings: findings.length - productionFindings.length,
  uniqueProductionChineseStrings: uniqueProductionStrings.length,
  legacyCatalogStrings: legacyCatalog.size,
  uncoveredLegacyStrings,
  findings,
}, null, 2))
