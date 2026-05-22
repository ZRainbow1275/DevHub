import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

interface ChannelBuckets {
  invoke: string[]
  send: string[]
  on: string[]
}

const PRELOAD_INTERNAL_ONLY_CHANNELS = new Set(['ipc:ack-seq'])

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '..', '..')
const workspaceRoot = path.resolve(projectRoot, '..')

const preloadFiles = [
  path.join(projectRoot, 'src', 'preload', 'index.ts'),
  path.join(projectRoot, 'src', 'preload', 'extended.ts')
]

const contractPath = path.join(
  workspaceRoot,
  'prompts',
  '0421',
  'contracts',
  '23-ipc-contracts-master.md'
)

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
}

function sortUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function parseConstObject(filePath: string, constName: string): Record<string, string> {
  const text = readUtf8(filePath)
  const startMarker = `export const ${constName} = {`
  const startIndex = text.indexOf(startMarker)
  if (startIndex === -1) {
    throw new Error(`Unable to find ${constName} in ${filePath}`)
  }

  const tail = text.slice(startIndex)
  const endIndex = tail.indexOf('} as const')
  if (endIndex === -1) {
    throw new Error(`Unable to find end of ${constName} in ${filePath}`)
  }

  const body = tail.slice(tail.indexOf('{') + 1, endIndex)
  const entries: Record<string, string> = {}

  for (const match of body.matchAll(/\b([A-Z0-9_]+):\s*'([^']+)'/g)) {
    entries[match[1]] = match[2]
  }

  return entries
}

const constantMaps = {
  IPC_CHANNELS: parseConstObject(path.join(projectRoot, 'src', 'shared', 'types.ts'), 'IPC_CHANNELS'),
  IPC_CHANNELS_EXT: parseConstObject(
    path.join(projectRoot, 'src', 'shared', 'types-extended.ts'),
    'IPC_CHANNELS_EXT'
  ),
  DEV_OBS_CHANNELS: parseConstObject(
    path.join(projectRoot, 'src', 'shared', 'observability.ts'),
    'DEV_OBS_CHANNELS'
  )
} as const

type ConstantMapName = keyof typeof constantMaps

function resolveChannelToken(rawToken: string): string | null {
  const token = rawToken.trim()

  if (
    (token.startsWith("'") && token.endsWith("'"))
    || (token.startsWith('"') && token.endsWith('"'))
  ) {
    return token.slice(1, -1)
  }

  const constantMatch = token.match(
    /^(IPC_CHANNELS|IPC_CHANNELS_EXT|DEV_OBS_CHANNELS)\.([A-Z0-9_]+)$/
  )

  if (!constantMatch) {
    return null
  }

  const [, rawMapName, key] = constantMatch
  const mapName = rawMapName as ConstantMapName
  return constantMaps[mapName][key] ?? null
}

function extractCallChannels(
  sourceText: string,
  pattern: RegExp,
  skipInternalOnly = false
): string[] {
  const resolved: string[] = []

  for (const match of sourceText.matchAll(pattern)) {
    const channel = resolveChannelToken(match[1])
    if (!channel) {
      continue
    }

    if (skipInternalOnly && PRELOAD_INTERNAL_ONLY_CHANNELS.has(channel)) {
      continue
    }

    resolved.push(channel)
  }

  return sortUnique(resolved)
}

function extractPublicPreloadChannels(): ChannelBuckets {
  const collected = {
    invoke: new Set<string>(),
    send: new Set<string>(),
    on: new Set<string>()
  }

  for (const filePath of preloadFiles) {
    const sourceText = readUtf8(filePath)

    for (const channel of extractCallChannels(
      sourceText,
      /ipcRenderer\.invoke\(\s*([^,\n)]+)/g,
      true
    )) {
      collected.invoke.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /ipcRenderer\.send\(\s*([^,\n)]+)/g
    )) {
      collected.send.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /ipcRenderer\.on\(\s*([^,\n)]+)/g
    )) {
      collected.on.add(channel)
    }
  }

  return {
    invoke: sortUnique(collected.invoke),
    send: sortUnique(collected.send),
    on: sortUnique(collected.on)
  }
}

function walkTypeScriptFiles(dirPath: string): string[] {
  const files: string[] = []

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkTypeScriptFiles(fullPath))
      continue
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function extractMainRegistrations(): ChannelBuckets {
  const handles = new Set<string>()
  const ons = new Set<string>()
  const sends = new Set<string>()

  for (const filePath of walkTypeScriptFiles(path.join(projectRoot, 'src', 'main'))) {
    const sourceText = readUtf8(filePath)

    for (const channel of extractCallChannels(
      sourceText,
      /ipcMain\.handle\(\s*([^,\n)]+)/g
    )) {
      handles.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /ipcMain\.on\(\s*([^,\n)]+)/g
    )) {
      ons.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /\.send\(\s*([^,\n)]+)/g
    )) {
      sends.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /sendToRenderer\(\s*([^,\n)]+)/g
    )) {
      sends.add(channel)
    }

    for (const channel of extractCallChannels(
      sourceText,
      /registerDiffBatcher(?:<[^>]+>)?\(\s*[^,\n)]+\s*,\s*([^,\n)]+)/g
    )) {
      sends.add(channel)
    }
  }

  return {
    invoke: sortUnique(handles),
    send: sortUnique(ons),
    on: sortUnique(sends)
  }
}

function extractContractSubsection(markdown: string, heading: string): string[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(
    new RegExp(`### ${escapedHeading}\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`)
  )

  if (!match) {
    throw new Error(`Unable to find contract subsection "${heading}"`)
  }

  return sortUnique(
    [...match[1].matchAll(/`([^`]+)`/g)].map((entry) => entry[1]).filter(Boolean)
  )
}

function extractContractChannels(): ChannelBuckets {
  const markdown = readUtf8(contractPath)
  const whitelistSection = markdown.match(
    /## 七、Renderer Preload 白名单（X2 权威来源）\n([\s\S]*?)(?=\n## |$)/
  )

  if (!whitelistSection) {
    throw new Error('Unable to find the X2 preload whitelist section in contracts/23')
  }

  const section = whitelistSection[1]

  return {
    invoke: extractContractSubsection(section, '7.1 Renderer invoke 白名单'),
    send: extractContractSubsection(section, '7.2 Renderer send 白名单'),
    on: extractContractSubsection(section, '7.3 Renderer on 白名单')
  }
}

describe('preload whitelist contract (X2)', () => {
  const publicPreloadChannels = extractPublicPreloadChannels()
  const mainRegistrations = extractMainRegistrations()
  const contractChannels = extractContractChannels()

  it('keeps contracts/23 whitelist in sync with the public preload bridge', () => {
    expect(contractChannels).toEqual(publicPreloadChannels)
  })

  it('backs every public invoke channel with an ipcMain.handle registration', () => {
    const missing = publicPreloadChannels.invoke.filter(
      (channel) => !mainRegistrations.invoke.includes(channel)
    )

    expect(missing).toEqual([])
  })

  it('backs every public send channel with an ipcMain.on registration', () => {
    const missing = publicPreloadChannels.send.filter(
      (channel) => !mainRegistrations.send.includes(channel)
    )

    expect(missing).toEqual([])
  })

  it('backs every public listener channel with a main-process send emitter', () => {
    const missing = publicPreloadChannels.on.filter(
      (channel) => !mainRegistrations.on.includes(channel)
    )

    expect(missing).toEqual([])
  })
})
