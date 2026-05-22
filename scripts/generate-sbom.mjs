#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const checkOnly = process.argv.includes('--check')
const outputPath = checkOnly
  ? resolve(rootDir, 'out', 'sbom.cyclonedx.json')
  : resolve(rootDir, 'sbom.cyclonedx.json')

function readJsonFromNodeEval(script) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: rootDir,
    encoding: 'utf8'
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'node eval failed')
  return JSON.parse(result.stdout)
}

function runPnpmLicenses() {
  const result = spawnSync('pnpm', ['licenses', 'list', '--json', '--prod'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) throw new Error(`pnpm licenses list failed: ${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
}

function flattenLicenseReport(report) {
  if (Array.isArray(report)) return report
  return Object.entries(report).flatMap(([license, packages]) => {
    if (!Array.isArray(packages)) return []
    return packages.map(item => ({ ...item, license: item.license || license }))
  })
}

function packageUrl(name, version) {
  const encoded = name.startsWith('@')
    ? `@${name.slice(1).split('/').map(encodeURIComponent).join('/')}`
    : encodeURIComponent(name)
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`
}

function bomRef(name, version) {
  return `${name}@${version}`
}

function componentHash(name, version, license) {
  return createHash('sha256').update(`${name}\0${version}\0${license}`).digest('hex')
}

function buildSbom() {
  const packageJson = readJsonFromNodeEval("console.log(JSON.stringify(require('./package.json')))")
  const entries = flattenLicenseReport(runPnpmLicenses())
  const components = entries.flatMap(entry => {
    const versions = Array.isArray(entry.versions) && entry.versions.length > 0 ? entry.versions : [entry.version ?? '0.0.0']
    return versions.map(version => ({
      type: 'library',
      'bom-ref': bomRef(entry.name, version),
      name: entry.name,
      version,
      description: entry.description ?? undefined,
      author: entry.author ?? undefined,
      purl: packageUrl(entry.name, version),
      licenses: [{ license: { id: entry.license || 'UNKNOWN' } }],
      externalReferences: entry.homepage ? [{ type: 'website', url: entry.homepage }] : undefined,
      hashes: [{ alg: 'SHA-256', content: componentHash(entry.name, version, entry.license || 'UNKNOWN') }]
    }))
  }).sort((left, right) => left.name.localeCompare(right.name) || String(left.version).localeCompare(String(right.version)))

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'DevHub', name: 'scripts/generate-sbom.mjs', version: packageJson.version }],
      component: {
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        licenses: [{ license: { id: 'AGPL-3.0-only' } }]
      }
    },
    components
  }
}

function validateSbom(sbom) {
  if (sbom.bomFormat !== 'CycloneDX') throw new Error('invalid SBOM bomFormat')
  if (!Array.isArray(sbom.components) || sbom.components.length === 0) throw new Error('SBOM has no components')
  const missing = sbom.components.filter(component => !component.name || !component.version || !component.licenses?.[0]?.license?.id)
  if (missing.length > 0) throw new Error(`SBOM components missing required fields: ${missing.slice(0, 5).map(item => item.name || '<unknown>').join(', ')}`)
}

const sbom = buildSbom()
validateSbom(sbom)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`)
console.log(`SBOM generated: ${outputPath} (${sbom.components.length} components)`)
