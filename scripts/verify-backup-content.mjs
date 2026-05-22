#!/usr/bin/env node
import { readdir, readFile, lstat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const FORBIDDEN_PATTERNS = [
  { name: 'openai-key', pattern: /sk-[A-Za-z0-9_-]{8,}/g },
  { name: 'token-prefix', pattern: /tok-[A-Za-z0-9_-]{6,}/g },
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi }
]

async function collectFiles(targetPath) {
  const absolutePath = isAbsolute(targetPath) ? targetPath : resolve(process.cwd(), targetPath)
  const info = await lstat(absolutePath)
  if (info.isSymbolicLink()) return []
  if (info.isFile()) return [absolutePath]
  if (!info.isDirectory()) return []
  const entries = await readdir(absolutePath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const childPath = join(absolutePath, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) files.push(...await collectFiles(childPath))
    else if (entry.isFile()) files.push(childPath)
  }
  return files
}

function isZipBuffer(content) {
  return content.byteLength >= 4 && content.readUInt32LE(0) === 0x04034b50
}

function extractZipEntries(content, filePath) {
  const entries = []
  let offset = 0
  while (offset + 4 <= content.byteLength) {
    const signature = content.readUInt32LE(offset)
    if (signature === 0x02014b50 || signature === 0x06054b50) break
    if (signature !== 0x04034b50) {
      throw new Error(`${filePath}: invalid ZIP local header at offset ${offset}`)
    }
    const compressionMethod = content.readUInt16LE(offset + 8)
    const compressedSize = content.readUInt32LE(offset + 18)
    const fileNameLength = content.readUInt16LE(offset + 26)
    const extraLength = content.readUInt16LE(offset + 28)
    const fileNameStart = offset + 30
    const fileNameEnd = fileNameStart + fileNameLength
    const payloadStart = fileNameEnd + extraLength
    const payloadEnd = payloadStart + compressedSize
    if (payloadEnd > content.byteLength) {
      throw new Error(`${filePath}: truncated ZIP payload`)
    }
    const entryName = content.subarray(fileNameStart, fileNameEnd).toString('utf8')
    if (!entryName.endsWith('/')) {
      const compressedPayload = content.subarray(payloadStart, payloadEnd)
      const payload = compressionMethod === 0
        ? compressedPayload
        : compressionMethod === 8
          ? inflateRawSync(compressedPayload)
          : null
      if (!payload) throw new Error(`${filePath}: unsupported ZIP compression method ${compressionMethod} for ${entryName}`)
      entries.push({ entryName, content: payload.toString('utf8') })
    }
    offset = payloadEnd
  }
  return entries
}

function scanText(filePath, content) {
  const findings = []
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0
    const matches = content.match(pattern)
    if (matches && matches.length > 0) findings.push({ filePath, name, count: matches.length })
  }
  return findings
}

async function scanFile(filePath) {
  const content = await readFile(filePath)
  if (isZipBuffer(content)) {
    const findings = []
    for (const entry of extractZipEntries(content, filePath)) {
      findings.push(...scanText(`${filePath}!${entry.entryName}`, entry.content))
    }
    return findings
  }
  return scanText(filePath, content.toString('utf8'))
}

async function main() {
  const targets = process.argv.slice(2).filter(arg => arg.trim().length > 0)
  if (targets.length === 0) {
    throw new Error('Usage: node scripts/verify-backup-content.mjs <backup-file-or-directory> [...]')
  }

  const files = []
  for (const target of targets) files.push(...await collectFiles(target))
  const findings = []
  for (const filePath of files) findings.push(...await scanFile(filePath))

  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`${finding.filePath}: forbidden ${finding.name} matches=${finding.count}\n`)
    }
    throw new Error(`Backup content gate failed: ${findings.length} forbidden secret pattern hit(s)`)
  }

  process.stdout.write(`Backup content gate passed: scanned ${files.length} file(s).\n`)
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
