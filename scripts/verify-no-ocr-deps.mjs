#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const packageJsonPath = join(projectRoot, 'package.json')
const srcRoot = join(projectRoot, 'src')

const forbiddenExact = new Set([
  'tesseract.js',
  'tesseract.js-core',
  'node-tesseract-ocr',
  'paddleocr',
  'paddle-ocr',
  '@azure/cognitiveservices-computervision',
  '@google-cloud/vision',
  'aws-sdk-textract',
  'amazon-textract'
])

const forbiddenFragments = [
  'tesseract',
  'paddleocr',
  'paddle-ocr',
  'cognitiveservices-computervision',
  'google-cloud/vision',
  'textract'
]

const failures = []

function isForbiddenPackage(name) {
  const lower = name.toLowerCase()
  return forbiddenExact.has(lower) || forbiddenFragments.some(fragment => lower.includes(fragment))
}

function walkFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') continue
      files.push(...walkFiles(fullPath))
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

function recordFailure(kind, name, filePath) {
  failures.push(`${kind}: ${name}${filePath ? ` in ${relative(projectRoot, filePath)}` : ''}`)
}

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const name of Object.keys(pkg[field] ?? {})) {
    if (isForbiddenPackage(name)) recordFailure(`forbidden ${field}`, name)
  }
}

const importPattern = /\b(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g
for (const filePath of walkFiles(srcRoot)) {
  const source = readFileSync(filePath, 'utf8')
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) continue
    if (isForbiddenPackage(specifier)) recordFailure('forbidden OCR import', specifier, filePath)
  }
}

if (failures.length > 0) {
  console.error('No-OCR dependency verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('No-OCR dependency verification passed.')
