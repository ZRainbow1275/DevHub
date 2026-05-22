#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const FORBIDDEN_PACKAGES = new Set([
  'tesseract.js',
  'azure-cognitiveservices-computervision',
  'bullmq',
  'react-joyride'
])

const ALLOWED_LICENSES = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MPL-2.0',
  'Python-2.0',
  'AFL-2.1',
  'Zlib',
  'BlueOak-1.0.0',
  'CC0-1.0',
  '0BSD',
  'Unlicense'
])

const EXCEPTION_LICENSES = new Set(['EPL-2.0'])

function runPnpmLicenses() {
  const result = spawnSync('pnpm', ['licenses', 'list', '--json', '--prod'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })

  if (result.status !== 0) {
    throw new Error(`pnpm licenses list failed: ${result.stderr || result.stdout}`)
  }

  return JSON.parse(result.stdout)
}

function flattenLicenseReport(report) {
  if (Array.isArray(report)) return report
  return Object.entries(report).flatMap(([license, packages]) => {
    if (!Array.isArray(packages)) return []
    return packages.map(item => ({ ...item, license: item.license || license }))
  })
}

function readPackageJson() {
  return JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))
}

function readManifestExceptions() {
  const source = readFileSync(resolve(rootDir, 'src/shared/integration-manifest.ts'), 'utf8')
  const exceptions = new Map()
  for (const line of source.split('\n')) {
    if (!line.includes('EPL-2.0')) continue
    const tupleMatch = line.match(/^\s*\['([^']+)',\s*'([^']+)'/)
    if (!tupleMatch) continue
    const packageName = tupleMatch[2]
    const hasException = /exception|approved|允许|豁免/i.test(line)
    if (hasException) exceptions.set(packageName, line.trim())
  }
  return exceptions
}

function tokenizeLicense(license) {
  return String(license)
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+|\s*\/\s*|\s*,\s*/i)
    .map(part => part.trim())
    .filter(Boolean)
}

function isLicenseAllowed(packageName, license, exceptionPackages) {
  const tokens = tokenizeLicense(license)
  if (tokens.length === 0) return false
  return tokens.some(token => {
    if (ALLOWED_LICENSES.has(token)) return true
    if (EXCEPTION_LICENSES.has(token)) return exceptionPackages.has(packageName)
    return false
  })
}

function main() {
  const packageJson = readPackageJson()
  const directPackages = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {})
  ])
  const exceptionPackages = readManifestExceptions()
  const report = flattenLicenseReport(runPnpmLicenses())
  const failures = []

  for (const forbiddenPackage of FORBIDDEN_PACKAGES) {
    if (directPackages.has(forbiddenPackage)) failures.push(`Forbidden direct dependency present: ${forbiddenPackage}`)
  }

  for (const entry of report) {
    const packageName = entry.name
    const license = entry.license || 'UNKNOWN'
    if (FORBIDDEN_PACKAGES.has(packageName)) failures.push(`Forbidden package present in production dependency graph: ${packageName}`)
    if (!isLicenseAllowed(packageName, license, exceptionPackages)) failures.push(`Unapproved license ${license} for ${packageName}`)
  }

  if (failures.length > 0) {
    console.error('License check failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`License check passed: ${report.length} production package entries validated; ${exceptionPackages.size} manifest exception(s) documented.`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
