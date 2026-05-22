#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const packageJsonPath = join(projectRoot, 'package.json')
const srcRoot = join(projectRoot, 'src')

const forbiddenExact = new Set([
  'aws-sdk',
  'firebase',
  'parse',
  'dropbox',
  'supabase',
  'appwrite',
  'pocketbase',
  '@vercel/blob',
  'kv-store'
])

const forbiddenPrefixes = [
  '@aws-sdk/',
  '@azure/',
  '@google-cloud/'
]

const failures = []

function isForbiddenPackage(name) {
  return forbiddenExact.has(name) || forbiddenPrefixes.some(prefix => name.startsWith(prefix))
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
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
    if (isForbiddenPackage(specifier) || isForbiddenPackage(packageName)) recordFailure('forbidden cloud import', specifier, filePath)
  }
}

if (failures.length > 0) {
  console.error('No-cloud dependency verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('No-cloud dependency verification passed.')
