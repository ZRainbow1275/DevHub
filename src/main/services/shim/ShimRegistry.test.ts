import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ShimRegistry } from './ShimRegistry'

class MemoryShimStore {
  private readonly values = new Map<string, unknown>()

  get(key: 'shimManifests', defaultValue: unknown[]): unknown {
    return this.values.get(key) ?? defaultValue
  }

  set(key: 'shimManifests', value: unknown[]): void {
    this.values.set(key, value)
  }
}

let cleanupPath: string | null = null
let originalPath: string | undefined

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function runShimArgProbe(shimPath: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<string[]> {
  const probe = 'console.log(JSON.stringify(process.argv.slice(1)))'
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [shimPath, '-e', probe, '--', ...args],
      {
        env: { ...process.env, ...env, FORCE_COLOR: undefined, NO_COLOR: '1' },
        timeout: 5000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }
        if (stderr.trim().length > 0) {
          reject(new Error(stderr))
          return
        }
        resolve(JSON.parse(stdout.trim()) as string[])
      }
    )
  })
}

function runShimControlProbe(shimPath: string, env: NodeJS.ProcessEnv = {}): Promise<{ stdout: string; stderr: string }> {
  const probe = [
    'process.stdin.setEncoding("utf8")',
    'process.stdin.on("data", chunk => console.log("stdin:" + chunk.trim()))',
    'setTimeout(() => process.exit(0), 1200)'
  ].join(';')
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [shimPath, '-e', probe],
      {
        env: { ...process.env, ...env, FORCE_COLOR: undefined, NO_COLOR: '1' },
        timeout: 5000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

afterEach(async () => {
  if (originalPath !== undefined) process.env.PATH = originalPath
  originalPath = undefined
  if (cleanupPath) await rm(cleanupPath, { recursive: true, force: true })
  cleanupPath = null
})

describe('ShimRegistry', () => {
  it('writes a real passthrough shim manifest and removes it on uninstall', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, tool => `${tool}.cmd`)

    await expect(registry.install({ tool: 'codex' })).rejects.toThrow('E_PERMISSION')
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })

    expect(installed.manifest.toolName).toBe('codex')
    expect(installed.manifest.realExePath).toBe('codex.cmd')
    expect(installed.artifactKind).toBe('node-script')
    expect(installed.shimManifestPath).toBeNull()
    expect(existsSync(installed.shimPath)).toBe(true)
    const shimScript = await readFile(installed.shimPath, 'utf8')
    expect(shimScript).toContain('process.stdin.pipe(child.stdin)')
    expect(shimScript).toContain('handleControlLine(line)')
    expect(shimScript).toContain('DEVHUB::MARKER::v=1::CONTROL=')
    expect(shimScript).toContain('child.stdout.on')
    expect(shimScript).toContain('child.stderr.on')
    expect(shimScript).toContain('child.on(\'exit\'')
    expect(shimScript).toContain('reconnectDelayMs = Math.min(1000, reconnectDelayMs * 2)')
    expect(installed.pathUpdated).toBe(true)
    expect((process.env.PATH ?? '').split(delimiter)[0]).toBe(join(cleanupPath, 'r8-cli-shims'))
    expect(registry.status().codex?.shimExePath).toBe(installed.shimPath)

    const uninstalled = await registry.uninstall({ tool: 'codex', confirmedBy: 'vitest' })
    expect(uninstalled.success).toBe(true)
    expect(existsSync(installed.shimPath)).toBe(false)
    expect(registry.status().codex).toBeNull()
  })

  it('installs a packaged executable shim with a sidecar manifest when an artifact is available', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-packaged-shim-'))
    originalPath = process.env.PATH
    const packagedSource = join(cleanupPath, process.platform === 'win32' ? 'source-codex.exe' : 'source-codex')
    await writeFile(packagedSource, 'packaged-codex-shim-binary', 'utf8')
    const registry = new ShimRegistry(
      new MemoryShimStore(),
      () => cleanupPath as string,
      () => process.execPath,
      () => packagedSource
    )

    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })

    expect(installed.artifactKind).toBe('packaged-executable')
    expect(basename(installed.shimPath)).toBe(process.platform === 'win32' ? 'codex.exe' : 'codex')
    expect(installed.shimManifestPath).toBe(`${installed.shimPath}.json`)
    expect(existsSync(installed.shimPath)).toBe(true)
    expect(existsSync(installed.shimManifestPath as string)).toBe(true)
    expect(await readFile(installed.shimPath, 'utf8')).toBe('packaged-codex-shim-binary')
    const sidecar = JSON.parse(await readFile(installed.shimManifestPath as string, 'utf8')) as Record<string, unknown>
    expect(sidecar).toMatchObject({
      realExePath: process.execPath,
      shimExePath: installed.shimPath,
      toolName: 'codex'
    })
    expect(installed.env.DEVHUB_SHIM_MANIFEST).toBe(installed.shimManifestPath)
    expect((process.env.PATH ?? '').split(delimiter)[0]).toBe(join(cleanupPath, 'r8-cli-shims'))

    await registry.uninstall({ tool: 'codex', confirmedBy: 'vitest' })
    expect(existsSync(installed.shimPath)).toBe(false)
    expect(existsSync(installed.shimManifestPath as string)).toBe(false)
  })

  it('reconnects the generated shim client with bounded backoff when the pipe appears late', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })
    const markerLine = 'DEVHUB::MARKER::v=1::PHASE=reconnected'
    const frames: string[] = []

    const childRun = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        process.execPath,
        [
          installed.shimPath,
          '-e',
          `setTimeout(() => console.log(${JSON.stringify(markerLine)}), 750)`
        ],
        {
          env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: '1' },
          timeout: 5000,
          windowsHide: true
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error)
            return
          }
          resolve({ stdout, stderr })
        }
      )
    })

    await wait(250)
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame.line)
    })
    expect(status.listening).toBe(true)

    try {
      const output = await childRun
      expect(output.stdout).toContain(markerLine)
      expect(output.stderr).toBe('')
      expect(frames).toContain(markerLine)
    } finally {
      await registry.stopFrameServer('codex')
    }
  })

  it('passes Gemini marker environment into the real child and emits a completion marker', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-gemini-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'gemini', confirmedBy: 'vitest' })
    const frames: string[] = []
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame.line)
    })
    expect(status.listening).toBe(true)

    try {
      const output = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(
          process.execPath,
          [
            installed.shimPath,
            '-e',
            'console.log(`${process.env.GEMINI_OUTPUT_FORMAT}:${process.env.DEVHUB_SHIM_MARKER_PROTOCOL}`)'
          ],
          {
            env: { ...process.env, GEMINI_OUTPUT_FORMAT: undefined, DEVHUB_SHIM_MARKER_PROTOCOL: undefined },
            timeout: 5000,
            windowsHide: true
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(error)
              return
            }
            resolve({ stdout, stderr })
          }
        )
      })

      expect(output.stdout.trim()).toBe('json:v1')
      expect(output.stderr).toBe('')
      expect(frames).toContain('json:v1')
      expect(frames.some(line => line.startsWith('DEVHUB::MARKER::v=1::DONE='))).toBe(true)
    } finally {
      await registry.stopFrameServer('gemini')
    }
  })

  it('sends a real control frame through the generated shim socket into child stdin', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-control-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })
    const frames: string[] = []
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame.line)
    })
    expect(status.listening).toBe(true)

    try {
      const childRun = runShimControlProbe(installed.shimPath)
      await wait(250)
      const sent = await registry.sendControl({ tool: 'codex', text: '[continue]', timeoutMs: 3000, verifyEcho: true, echoText: '[continue]' })
      const output = await childRun

      expect(sent.success).toBe(true)
      expect(sent.verifiedContentMatches).toBe(true)
      expect(output.stdout).toContain('stdin:[continue]')
      expect(output.stderr).toBe('')
      expect(frames).toContain(`DEVHUB::MARKER::v=1::CONTROL=${sent.requestId}`)
      expect(frames).toContain('stdin:[continue]')
    } finally {
      await registry.stopFrameServer('codex')
    }
  })

  it('sends a real control frame through the packaged shim source into child stdin', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-packaged-control-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })
    const frames: string[] = []
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame.line)
    })
    expect(status.listening).toBe(true)

    try {
      const sourceShimPath = join(process.cwd(), 'shim/codex/codex-shim.cjs')
      const childRun = runShimControlProbe(sourceShimPath, {
        DEVHUB_CLI_TOOL: 'codex',
        DEVHUB_REAL_CLI_PATH: process.execPath,
        DEVHUB_SHIM_MANIFEST: '',
        DEVHUB_SHIM_PIPE: installed.manifest.ipcPipe
      })
      await wait(250)
      const sent = await registry.sendControl({ tool: 'codex', text: '[packaged-control]', timeoutMs: 3000, verifyEcho: true, echoText: '[packaged-control]' })
      const output = await childRun

      expect(sent.success).toBe(true)
      expect(sent.verifiedContentMatches).toBe(true)
      expect(output.stdout).toContain('stdin:[packaged-control]')
      expect(output.stderr).toBe('')
      expect(frames).toContain(`DEVHUB::MARKER::v=1::CONTROL=${sent.requestId}`)
      expect(frames).toContain('stdin:[packaged-control]')
    } finally {
      await registry.stopFrameServer('codex')
    }
  })

  it('keeps SHIM control delivery truthful when child stdin does not echo injected content', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-control-no-echo-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })
    const frames: string[] = []
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame.line)
    })
    expect(status.listening).toBe(true)

    try {
      const childRun = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(
          process.execPath,
          [
            installed.shimPath,
            '-e',
            'process.stdin.resume(); setTimeout(() => process.exit(0), 1200)'
          ],
          {
            env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: '1' },
            timeout: 5000,
            windowsHide: true
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(error)
              return
            }
            resolve({ stdout, stderr })
          }
        )
      })
      await wait(250)
      const sent = await registry.sendControl({
        tool: 'codex',
        text: '[no-echo]',
        timeoutMs: 3000,
        verifyEcho: true,
        echoText: '[no-echo]',
        echoTimeoutMs: 100
      })
      const output = await childRun

      expect(sent.success).toBe(true)
      expect(sent.verifiedContentMatches).toBe(false)
      expect(sent.verificationError).toContain('E_SHIM_CONTROL_ECHO_TIMEOUT')
      expect(output.stdout).toBe('')
      expect(output.stderr).toBe('')
      expect(frames).toContain(`DEVHUB::MARKER::v=1::CONTROL=${sent.requestId}`)
      expect(frames).not.toContain('stdin:[no-echo]')
    } finally {
      await registry.stopFrameServer('codex')
    }
  })

  it('injects Claude stream-json flags before spawning the generated node shim child', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-claude-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'claude', confirmedBy: 'vitest' })
    const shimScript = await readFile(installed.shimPath, 'utf8')

    expect(shimScript.indexOf('const childArgs = tool === \'claude\'')).toBeLessThan(
      shimScript.indexOf('const child = spawn(real, childArgs')
    )

    await expect(runShimArgProbe(installed.shimPath, ['-p', 'hello'])).resolves.toEqual([
      '-p',
      'hello',
      '--output-format',
      'stream-json',
      '--include-partial-messages'
    ])
    await expect(runShimArgProbe(installed.shimPath, ['--print', 'hello', '--output-format=stream-json'])).resolves.toEqual([
      '--print',
      'hello',
      '--output-format=stream-json',
      '--include-partial-messages'
    ])
    await expect(runShimArgProbe(installed.shimPath, ['-p', 'hello', '--output-format', 'json'])).resolves.toEqual([
      '-p',
      'hello',
      '--output-format',
      'json'
    ])
    await expect(runShimArgProbe(installed.shimPath, ['hello'])).resolves.toEqual(['hello'])
  })

  it('emits a real Claude post-output restart authorization frame for non stream-json stdout', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-claude-fallback-shim-'))
    originalPath = process.env.PATH
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => process.execPath)
    const installed = await registry.install({ tool: 'claude', confirmedBy: 'vitest' })
    const frames: Array<Record<string, unknown>> = []
    const status = await registry.startFrameServer(installed.manifest, frame => {
      frames.push(frame)
    })
    expect(status.listening).toBe(true)

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          process.execPath,
          [
            installed.shimPath,
            '-e',
            'process.stdout.write("plain claude text\\n")',
            '--',
            '-p',
            'hello'
          ],
          {
            env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: '1' },
            timeout: 5000,
            windowsHide: true
          },
          (error) => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          }
        )
      })

      const fallback = frames.find(frame => frame.fallbackReason === 'non-stream-json-output')
      expect(fallback).toMatchObject({
        line: 'plain claude text',
        tool: 'claude',
        fallbackReason: 'non-stream-json-output',
        requiresUserConfirmation: true
      })
      expect(fallback?.argv).toEqual(['-e', 'process.stdout.write("plain claude text\\n")', '--', '-p', 'hello'])
      expect(fallback?.restartArgs).toEqual([
        '-e',
        'process.stdout.write("plain claude text\\n")',
        '--',
        '-p',
        'hello',
        '--output-format',
        'stream-json',
        '--include-partial-messages'
      ])
    } finally {
      await registry.stopFrameServer('claude')
    }
  })

  it('injects Claude stream-json flags from the packaged shim source without invoking Claude', async () => {
    const sourceShimPath = join(process.cwd(), 'shim/codex/codex-shim.cjs')

    await expect(
      runShimArgProbe(sourceShimPath, ['-p', 'hello'], {
        DEVHUB_CLI_TOOL: 'claude',
        DEVHUB_REAL_CLI_PATH: process.execPath,
        DEVHUB_SHIM_MANIFEST: '',
        DEVHUB_SHIM_PIPE: ''
      })
    ).resolves.toEqual([
      '-p',
      'hello',
      '--output-format',
      'stream-json',
      '--include-partial-messages'
    ])

    await expect(
      runShimArgProbe(sourceShimPath, ['-p', 'hello', '--output-format', 'json'], {
        DEVHUB_CLI_TOOL: 'claude',
        DEVHUB_REAL_CLI_PATH: process.execPath,
        DEVHUB_SHIM_MANIFEST: '',
        DEVHUB_SHIM_PIPE: ''
      })
    ).resolves.toEqual(['-p', 'hello', '--output-format', 'json'])
  })

  it('removes dead shim manifests when the real executable disappears', async () => {
    cleanupPath = await mkdtemp(join(tmpdir(), 'devhub-shim-'))
    originalPath = process.env.PATH
    const realCodex = join(cleanupPath, process.platform === 'win32' ? 'real-codex.cmd' : 'real-codex')
    await writeFile(realCodex, process.platform === 'win32' ? '@echo off\r\necho codex\r\n' : '#!/usr/bin/env sh\necho codex\n', 'utf8')
    const registry = new ShimRegistry(new MemoryShimStore(), () => cleanupPath as string, () => realCodex)
    const installed = await registry.install({ tool: 'codex', confirmedBy: 'vitest' })
    expect(existsSync(installed.shimPath)).toBe(true)

    await unlink(realCodex)
    const reconciled = await registry.ensureInstalledShims()

    expect(reconciled.kept).toEqual([])
    expect(reconciled.removed).toHaveLength(1)
    expect(reconciled.removed[0].reason).toBe('missing-real-command')
    expect(reconciled.removed[0].manifest.toolName).toBe('codex')
    expect(existsSync(installed.shimPath)).toBe(false)
    expect(registry.status().codex).toBeNull()
  })
})
