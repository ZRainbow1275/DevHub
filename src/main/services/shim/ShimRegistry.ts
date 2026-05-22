import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { chmod, copyFile, mkdir, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { delimiter, dirname, extname, isAbsolute, join } from 'node:path'
import which from 'which'
import { shimControlFrameSchema, shimFrameSchema, shimManifestSchema, type ShimFrame, type ShimManifest } from '@shared/schemas/r8-runtime'

export type ShimTool = 'codex' | 'claude' | 'gemini'

interface ShimStore {
  get(key: 'shimManifests', defaultValue: unknown[]): unknown
  set(key: 'shimManifests', value: unknown[]): void
}

export interface InstallShimInput {
  tool: ShimTool
  confirmedBy?: string
}

export interface ShimServerStatus {
  tool: ShimTool
  pipeName: string
  listening: boolean
  error: string | null
}

export interface ShimReconcileRemoval {
  manifest: ShimManifest
  reason: 'missing-real-command' | 'missing-shim'
}

export interface ShimReconcileResult {
  checkedAt: number
  kept: ShimManifest[]
  removed: ShimReconcileRemoval[]
}

export interface SendShimControlInput {
  tool: ShimTool
  text: string
  appendNewline?: boolean
  timeoutMs?: number
  verifyEcho?: boolean
  echoText?: string
  echoTimeoutMs?: number
}

export interface SendShimControlResult {
  success: boolean
  tool: ShimTool
  requestId: string
  clientCount: number
  verifiedContentMatches?: boolean | null
  verificationError?: string
  error?: string
}

interface PendingControlAck {
  reject: (error: Error) => void
  resolve: () => void
  timer: NodeJS.Timeout
}

interface PendingControlEcho {
  expectedText: string
  expectedLines: string[]
  seenLines: string[]
  reject: (error: Error) => void
  resolve: () => void
  timer: NodeJS.Timeout
}

export class ShimRegistry {
  private readonly servers = new Map<ShimTool, net.Server>()
  private readonly controlClients = new Map<ShimTool, Set<net.Socket>>()
  private readonly pendingControlAcks = new Map<ShimTool, Map<string, PendingControlAck>>()
  private readonly pendingControlEchoes = new Map<ShimTool, Map<string, PendingControlEcho>>()

  constructor(
    private readonly store: ShimStore,
    private readonly getUserDataPath: () => string,
    private readonly resolveRealCommand: (tool: ShimTool) => string,
    private readonly resolvePackagedShimPath: (tool: ShimTool) => string | null = () => null
  ) {}

  async install(input: InstallShimInput) {
    this.assertConfirmed(input.confirmedBy)
    const directory = join(this.getUserDataPath(), 'r8-cli-shims')
    await mkdir(directory, { recursive: true })
    const packagedShimSource = this.getAvailablePackagedShimPath(input.tool)
    const shimPath = packagedShimSource
      ? join(directory, this.installedExecutableName(input.tool))
      : join(directory, `${input.tool}-devhub-shim.mjs`)
    const manifest = shimManifestSchema.parse({
      toolName: input.tool,
      realExePath: this.resolveRealCommand(input.tool),
      shimExePath: shimPath,
      installedAt: Date.now(),
      shimVersion: '1.0.0',
      ipcPipe: this.pipeName(input.tool)
    })

    if (packagedShimSource) {
      await copyFile(packagedShimSource, shimPath)
      if (process.platform !== 'win32') await chmod(shimPath, 0o755)
      await writeFile(this.sidecarPath(shimPath), JSON.stringify(manifest, null, 2), 'utf8')
    } else {
      await writeFile(shimPath, this.buildNodeShimScript(manifest), 'utf8')
    }
    const pathUpdated = this.prependShimDirectoryToProcessPath(directory)
    this.store.set('shimManifests', [manifest, ...this.list().filter(item => item.toolName !== input.tool)].slice(0, 20))

    return {
      success: true,
      manifest,
      artifactKind: packagedShimSource ? 'packaged-executable' : 'node-script',
      shimPath,
      shimDirectory: directory,
      shimManifestPath: packagedShimSource ? this.sidecarPath(shimPath) : null,
      pathUpdated,
      requiresPathRefresh: true,
      env: {
        DEVHUB_CLI_TOOL: manifest.toolName,
        DEVHUB_REAL_CLI_PATH: manifest.realExePath,
        DEVHUB_SHIM_MANIFEST: packagedShimSource ? this.sidecarPath(shimPath) : '',
        DEVHUB_SHIM_PIPE: manifest.ipcPipe
      },
      note: packagedShimSource
        ? 'packaged shim executable written; caller must put the shim directory before the real CLI on PATH'
        : 'node shim file written; caller must launch the generated shim through the real Node executable'
    }
  }

  async uninstall(input: InstallShimInput) {
    this.assertConfirmed(input.confirmedBy)
    await this.stopFrameServer(input.tool)
    const manifest = this.list().find(item => item.toolName === input.tool)
    if (manifest && existsSync(manifest.shimExePath)) await unlink(manifest.shimExePath)
    if (manifest && existsSync(this.sidecarPath(manifest.shimExePath))) await unlink(this.sidecarPath(manifest.shimExePath))
    this.store.set('shimManifests', this.list().filter(item => item.toolName !== input.tool))
    return { success: true, tool: input.tool }
  }

  async ensureInstalledShims(): Promise<ShimReconcileResult> {
    const kept: ShimManifest[] = []
    const removed: ShimReconcileRemoval[] = []

    for (const manifest of this.list()) {
      const shimExists = existsSync(manifest.shimExePath)
      const sidecarExists = !this.requiresSidecar(manifest.shimExePath) || existsSync(this.sidecarPath(manifest.shimExePath))
      const realExists = await this.realCommandAvailable(manifest.realExePath, dirname(manifest.shimExePath))

      if (shimExists && sidecarExists && realExists) {
        kept.push(manifest)
        continue
      }

      await this.stopFrameServer(manifest.toolName)
      if (shimExists) await unlink(manifest.shimExePath)
      if (existsSync(this.sidecarPath(manifest.shimExePath))) await unlink(this.sidecarPath(manifest.shimExePath))
      removed.push({
        manifest,
        reason: shimExists && sidecarExists ? 'missing-real-command' : 'missing-shim'
      })
    }

    if (removed.length > 0) {
      this.store.set('shimManifests', kept)
    }

    return { checkedAt: Date.now(), kept, removed }
  }

  async startFrameServer(manifest: ShimManifest, onFrame: (frame: ShimFrame, tool: ShimTool) => void): Promise<ShimServerStatus> {
    await this.stopFrameServer(manifest.toolName)
    const server = net.createServer(socket => {
      this.addControlClient(manifest.toolName, socket)
      let buffer = ''
      socket.on('data', chunk => {
        buffer += String(chunk)
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const frame = shimFrameSchema.parse(JSON.parse(line))
            this.resolveControlAck(manifest.toolName, frame)
            this.resolveControlEcho(manifest.toolName, frame)
            onFrame(frame, manifest.toolName)
          } catch {
            const frame = shimFrameSchema.parse({ shimPid: 0, realPid: null, source: 'stderr', line, ts: Date.now() })
            this.resolveControlAck(manifest.toolName, frame)
            this.resolveControlEcho(manifest.toolName, frame)
            onFrame(frame, manifest.toolName)
          }
        }
      })
      socket.once('close', () => this.removeControlClient(manifest.toolName, socket))
      socket.once('error', () => this.removeControlClient(manifest.toolName, socket))
    })

    const status = await new Promise<ShimServerStatus>(resolve => {
      let settled = false
      server.once('error', error => {
        if (!settled) {
          settled = true
          resolve({ tool: manifest.toolName, pipeName: manifest.ipcPipe, listening: false, error: error.message })
        }
      })
      server.listen(manifest.ipcPipe, () => {
        if (!settled) {
          settled = true
          this.servers.set(manifest.toolName, server)
          resolve({ tool: manifest.toolName, pipeName: manifest.ipcPipe, listening: true, error: null })
        }
      })
    })
    if (!status.listening) server.close()
    return status
  }

  async stopFrameServer(tool: ShimTool): Promise<void> {
    const server = this.servers.get(tool)
    this.closeControlClients(tool)
    this.rejectPendingControlAcks(tool, new Error('E_SHIM_CONTROL_CLOSED:shim frame server stopped'))
    this.rejectPendingControlEchoes(tool, new Error('E_SHIM_CONTROL_CLOSED:shim frame server stopped'))
    if (!server) return
    this.servers.delete(tool)
    await new Promise<void>(resolve => server.close(() => resolve()))
  }

  async sendControl(input: SendShimControlInput): Promise<SendShimControlResult> {
    const requestId = randomUUID()
    const text = input.text.normalize('NFC')
    if (text.length === 0) {
      return { success: false, tool: input.tool, requestId, clientCount: 0, error: 'E_VALIDATION:shim control text is required' }
    }

    const clients = [...(this.controlClients.get(input.tool) ?? [])].filter(socket => socket.writable && !socket.destroyed)
    if (clients.length === 0) {
      return { success: false, tool: input.tool, requestId, clientCount: 0, error: 'E_SHIM_NOT_CONNECTED:shim control channel has no active client' }
    }

    const frame = shimControlFrameSchema.parse({
      type: 'stdin',
      requestId,
      text,
      appendNewline: input.appendNewline ?? true,
      ts: Date.now()
    })
    const ack = this.waitForControlAck(input.tool, requestId, input.timeoutMs ?? 2000)
    const echoText = input.echoText && input.echoText.trim().length > 0 ? input.echoText : text
    const echo = input.verifyEcho === true
      ? this.waitForControlEcho(input.tool, requestId, echoText, input.echoTimeoutMs ?? input.timeoutMs ?? 2000)
      : null
    const payload = `${JSON.stringify(frame)}\n`
    let delivered = 0
    for (const socket of clients) {
      try {
        socket.write(payload)
        delivered += 1
      } catch {
        this.removeControlClient(input.tool, socket)
      }
    }

    if (delivered === 0) {
      this.clearPendingControlAck(input.tool, requestId)
      this.clearPendingControlEcho(input.tool, requestId)
      return { success: false, tool: input.tool, requestId, clientCount: clients.length, error: 'E_SHIM_NOT_CONNECTED:shim control channel is not writable' }
    }

    try {
      await ack
      if (!echo) return { success: true, tool: input.tool, requestId, clientCount: delivered, verifiedContentMatches: null }
      try {
        await echo
        return { success: true, tool: input.tool, requestId, clientCount: delivered, verifiedContentMatches: true }
      } catch (error) {
        return {
          success: true,
          tool: input.tool,
          requestId,
          clientCount: delivered,
          verifiedContentMatches: false,
          verificationError: error instanceof Error ? error.message : String(error)
        }
      }
    } catch (error) {
      this.clearPendingControlEcho(input.tool, requestId)
      return { success: false, tool: input.tool, requestId, clientCount: delivered, error: error instanceof Error ? error.message : String(error) }
    }
  }

  status(): Record<ShimTool, ShimManifest | null> {
    const manifests = this.list()
    return {
      codex: manifests.find(item => item.toolName === 'codex') ?? null,
      claude: manifests.find(item => item.toolName === 'claude') ?? null,
      gemini: manifests.find(item => item.toolName === 'gemini') ?? null
    }
  }

  list(): ShimManifest[] {
    const value = this.store.get('shimManifests', [])
    if (!Array.isArray(value)) return []
    return value.map(item => shimManifestSchema.parse(item))
  }

  private assertConfirmed(confirmedBy: string | undefined): void {
    if (!confirmedBy || confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
  }

  private addControlClient(tool: ShimTool, socket: net.Socket): void {
    const clients = this.controlClients.get(tool) ?? new Set<net.Socket>()
    clients.add(socket)
    this.controlClients.set(tool, clients)
  }

  private removeControlClient(tool: ShimTool, socket: net.Socket): void {
    const clients = this.controlClients.get(tool)
    if (!clients) return
    clients.delete(socket)
    if (clients.size === 0) this.controlClients.delete(tool)
  }

  private closeControlClients(tool: ShimTool): void {
    const clients = this.controlClients.get(tool)
    if (!clients) return
    this.controlClients.delete(tool)
    for (const socket of clients) socket.destroy()
  }

  private waitForControlAck(tool: ShimTool, requestId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.clearPendingControlAck(tool, requestId)
        reject(new Error('E_SHIM_CONTROL_ACK_TIMEOUT:shim control acknowledgement was not received'))
      }, Math.max(50, timeoutMs))
      const pending = this.pendingControlAcks.get(tool) ?? new Map<string, PendingControlAck>()
      pending.set(requestId, {
        reject,
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        timer
      })
      this.pendingControlAcks.set(tool, pending)
    })
  }

  private clearPendingControlAck(tool: ShimTool, requestId: string): void {
    const pending = this.pendingControlAcks.get(tool)
    const entry = pending?.get(requestId)
    if (entry) clearTimeout(entry.timer)
    pending?.delete(requestId)
    if (pending?.size === 0) this.pendingControlAcks.delete(tool)
  }

  private rejectPendingControlAcks(tool: ShimTool, error: Error): void {
    const pending = this.pendingControlAcks.get(tool)
    if (!pending) return
    this.pendingControlAcks.delete(tool)
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
  }

  private waitForControlEcho(tool: ShimTool, requestId: string, expectedText: string, timeoutMs: number): Promise<void> {
    const normalizedExpectedText = expectedText.normalize('NFC')
    const expectedLines = normalizedExpectedText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.clearPendingControlEcho(tool, requestId)
        reject(new Error('E_SHIM_CONTROL_ECHO_TIMEOUT:shim stdout/stderr echo did not match injected text'))
      }, Math.max(50, timeoutMs))
      const pending = this.pendingControlEchoes.get(tool) ?? new Map<string, PendingControlEcho>()
      pending.set(requestId, {
        expectedText: normalizedExpectedText,
        expectedLines,
        seenLines: [],
        reject,
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        timer
      })
      this.pendingControlEchoes.set(tool, pending)
    })
  }

  private clearPendingControlEcho(tool: ShimTool, requestId: string): void {
    const pending = this.pendingControlEchoes.get(tool)
    const entry = pending?.get(requestId)
    if (entry) clearTimeout(entry.timer)
    pending?.delete(requestId)
    if (pending?.size === 0) this.pendingControlEchoes.delete(tool)
  }

  private rejectPendingControlEchoes(tool: ShimTool, error: Error): void {
    const pending = this.pendingControlEchoes.get(tool)
    if (!pending) return
    this.pendingControlEchoes.delete(tool)
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
  }

  private resolveControlAck(tool: ShimTool, frame: ShimFrame): void {
    const prefix = 'DEVHUB::MARKER::v=1::CONTROL='
    if (!frame.line.startsWith(prefix)) return
    const requestId = frame.line.slice(prefix.length).trim()
    const pending = this.pendingControlAcks.get(tool)
    const entry = pending?.get(requestId)
    if (!entry) return
    pending?.delete(requestId)
    if (pending?.size === 0) this.pendingControlAcks.delete(tool)
    entry.resolve()
  }

  private resolveControlEcho(tool: ShimTool, frame: ShimFrame): void {
    if (frame.line.startsWith('DEVHUB::MARKER::')) return
    const pending = this.pendingControlEchoes.get(tool)
    if (!pending) return
    for (const [requestId, entry] of pending.entries()) {
      entry.seenLines.push(frame.line.normalize('NFC'))
      if (entry.seenLines.length > 100) entry.seenLines.splice(0, entry.seenLines.length - 100)
      if (!this.controlEchoMatches(entry)) continue
      pending.delete(requestId)
      if (pending.size === 0) this.pendingControlEchoes.delete(tool)
      entry.resolve()
    }
  }

  private controlEchoMatches(entry: PendingControlEcho): boolean {
    const seenText = entry.seenLines.join('\n')
    if (seenText.includes(entry.expectedText)) return true
    return entry.expectedLines.length > 0 && entry.expectedLines.every(expectedLine =>
      entry.seenLines.some(seenLine => seenLine.includes(expectedLine))
    )
  }

  private prependShimDirectoryToProcessPath(directory: string): boolean {
    const currentPath = process.env.PATH ?? ''
    const entries = currentPath.split(delimiter).filter(Boolean)
    const normalizedDirectory = this.normalizePathForComparison(directory)
    const alreadyPresent = entries.some(entry => this.normalizePathForComparison(entry) === normalizedDirectory)
    if (alreadyPresent) return false

    process.env.PATH = [directory, ...entries].join(delimiter)
    return true
  }

  private normalizePathForComparison(value: string): string {
    return process.platform === 'win32' ? value.toLowerCase() : value
  }

  private getAvailablePackagedShimPath(tool: ShimTool): string | null {
    const candidate = this.resolvePackagedShimPath(tool)
    return candidate && existsSync(candidate) ? candidate : null
  }

  private installedExecutableName(tool: ShimTool): string {
    return `${tool}${process.platform === 'win32' ? '.exe' : ''}`
  }

  private requiresSidecar(shimPath: string): boolean {
    return extname(shimPath).toLowerCase() !== '.mjs'
  }

  private sidecarPath(shimPath: string): string {
    return `${shimPath}.json`
  }

  private async realCommandAvailable(command: string, shimDirectory: string): Promise<boolean> {
    if (isAbsolute(command)) return existsSync(command)
    const resolved = await which(command, {
      nothrow: true,
      path: this.pathWithoutShimDirectory(shimDirectory)
    })
    return typeof resolved === 'string' && resolved.length > 0
  }

  private pathWithoutShimDirectory(shimDirectory: string): string {
    const normalizedShimDirectory = this.normalizePathForComparison(shimDirectory)
    return (process.env.PATH ?? '')
      .split(delimiter)
      .filter(entry => entry.length > 0 && this.normalizePathForComparison(entry) !== normalizedShimDirectory)
      .join(delimiter)
  }

  private pipeName(tool: ShimTool): string {
    return process.platform === 'win32'
      ? `\\\\.\\pipe\\devhub-shim-${process.pid}-${tool}`
      : `/tmp/devhub-shim-${process.pid}-${tool}.sock`
  }

  private buildNodeShimScript(manifest: ShimManifest): string {
    const lines = [
      '#!/usr/bin/env node',
      'import { spawn } from \'node:child_process\'',
      'import net from \'node:net\'',
      `const tool = ${JSON.stringify(manifest.toolName)}`,
      `const fallbackReal = ${JSON.stringify(manifest.realExePath)}`,
      `const fallbackPipe = ${JSON.stringify(manifest.ipcPipe)}`,
      'const real = process.env.DEVHUB_REAL_CLI_PATH || fallbackReal',
      'const pipe = process.env.DEVHUB_SHIM_PIPE || fallbackPipe',
      'const needsShell = process.platform === \'win32\' && /\\.(cmd|bat)$/i.test(real)',
      'let socket = null',
      'let controlBuffer = \'\'',
      'let reconnectDelayMs = 100',
      'let reconnectTimer = null',
      'let childExited = false',
      'function clearReconnectTimer() {',
      '  if (!reconnectTimer) return',
      '  clearTimeout(reconnectTimer)',
      '  reconnectTimer = null',
      '}',
      'function scheduleReconnect() {',
      '  if (!pipe || childExited || reconnectTimer) return',
      '  const delay = reconnectDelayMs',
      '  reconnectDelayMs = Math.min(1000, reconnectDelayMs * 2)',
      '  reconnectTimer = setTimeout(() => { reconnectTimer = null; connectPipe() }, delay)',
      '  if (typeof reconnectTimer.unref === \'function\') reconnectTimer.unref()',
      '}',
      'function connectPipe() {',
      '  if (!pipe || childExited) return',
      '  try {',
      '    const nextSocket = net.createConnection(pipe)',
      '    socket = nextSocket',
      '    nextSocket.on(\'connect\', () => { reconnectDelayMs = 100 })',
      '    nextSocket.on(\'data\', chunk => {',
      '      controlBuffer += String(chunk)',
      '      const lines = controlBuffer.split(/\\r?\\n/)',
      '      controlBuffer = lines.pop() ?? \'\'',
      '      for (const line of lines) handleControlLine(line)',
      '    })',
      '    nextSocket.on(\'error\', () => { if (socket === nextSocket) socket = null; scheduleReconnect() })',
      '    nextSocket.on(\'close\', () => { if (socket === nextSocket) socket = null; scheduleReconnect() })',
      '  } catch {',
      '    socket = null',
      '    scheduleReconnect()',
      '  }',
      '}',
      'connectPipe()',
      'const childEnv = { ...process.env }',
      'if (tool === \'gemini\') {',
      '  if (!childEnv.GEMINI_OUTPUT_FORMAT) childEnv.GEMINI_OUTPUT_FORMAT = \'json\'',
      '  childEnv.DEVHUB_SHIM_MARKER_PROTOCOL = \'v1\'',
      '}',
      'function hasArg(args, name) {',
      '  return args.some(arg => arg === name || arg.startsWith(`${name}=`))',
      '}',
      'function hasArgValue(args, name, value) {',
      '  return args.some((arg, index) => arg === `${name}=${value}` || (arg === name && args[index + 1] === value))',
      '}',
      'function shouldSkipClaudeStreamJsonInjection(args) {',
      '  const first = args.find(arg => !arg.startsWith(\'-\'))',
      '  const nonPrintCommands = new Set([\'agents\', \'auth\', \'auto-mode\', \'doctor\', \'install\', \'mcp\', \'plugin\', \'plugins\', \'setup-token\', \'update\', \'upgrade\'])',
      '  return args.includes(\'--help\') || args.includes(\'-h\') || args.includes(\'--version\') || args.includes(\'-v\') || (first ? nonPrintCommands.has(first) : false)',
      '}',
      'function normalizeClaudeArgs(args) {',
      '  if (!args.includes(\'-p\') && !args.includes(\'--print\')) return args',
      '  if (shouldSkipClaudeStreamJsonInjection(args)) return args',
      '  const next = [...args]',
      '  const alreadyStreamJson = hasArgValue(next, \'--output-format\', \'stream-json\')',
      '  if (!alreadyStreamJson) {',
      '    if (hasArg(next, \'--output-format\')) return next',
      '    next.push(\'--output-format\', \'stream-json\')',
      '  }',
      '  if (!hasArg(next, \'--include-partial-messages\')) next.push(\'--include-partial-messages\')',
      '  return next',
      '}',
      'function isLikelyJsonLine(line) {',
      '  const trimmed = String(line).trim()',
      '  return trimmed.startsWith(\'{\') || trimmed.startsWith(\'[\') || trimmed.startsWith(\'DEVHUB::MARKER::\')',
      '}',
      'const originalArgs = process.argv.slice(2)',
      'const childArgs = tool === \'claude\' ? normalizeClaudeArgs(originalArgs) : originalArgs',
      'let claudeFallbackFrameEmitted = false',
      'function claudeFrameMetadata(source, line) {',
      '  if (tool !== \'claude\' || source !== \'stdout\' || claudeFallbackFrameEmitted || isLikelyJsonLine(line)) return {}',
      '  if (!hasArgValue(childArgs, \'--output-format\', \'stream-json\')) return {}',
      '  claudeFallbackFrameEmitted = true',
      '  return { argv: originalArgs, restartArgs: childArgs, cwd: process.cwd(), fallbackReason: \'non-stream-json-output\', requiresUserConfirmation: true }',
      '}',
      'const child = spawn(real, childArgs, { stdio: [\'pipe\', \'pipe\', \'pipe\'], shell: needsShell, windowsHide: true, env: childEnv })',
      'function emitFrame(source, chunk) {',
      '  if (!socket || !socket.writable) return',
      '  for (const line of String(chunk).split(/\\r?\\n/).filter(Boolean)) {',
      '    socket.write(JSON.stringify({ shimPid: process.pid, realPid: child.pid ?? null, source, line, ts: Date.now(), tool, ...claudeFrameMetadata(source, line) }) + \'\\n\')',
      '  }',
      '}',
      'function emitControlMarker(source, marker) {',
      '  if (!socket || !socket.writable) return',
      '  socket.write(JSON.stringify({ shimPid: process.pid, realPid: child.pid ?? null, source, line: marker, ts: Date.now(), tool }) + \'\\n\')',
      '}',
      'function handleControlLine(line) {',
      '  if (!line.trim()) return',
      '  let frame = null',
      '  try { frame = JSON.parse(line) } catch { return }',
      '  if (!frame || frame.type !== \'stdin\' || typeof frame.requestId !== \'string\' || typeof frame.text !== \'string\') return',
      '  const payload = frame.text + (frame.appendNewline === false ? \'\' : \'\\n\')',
      '  if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {',
      '    emitControlMarker(\'stderr\', `DEVHUB::MARKER::v=1::CONTROL_ERROR=${frame.requestId}:stdin unavailable`)',
      '    return',
      '  }',
      '  try {',
      '    child.stdin.write(payload, () => emitControlMarker(\'stdout\', `DEVHUB::MARKER::v=1::CONTROL=${frame.requestId}`))',
      '  } catch (error) {',
      '    emitControlMarker(\'stderr\', `DEVHUB::MARKER::v=1::CONTROL_ERROR=${frame.requestId}:${error instanceof Error ? error.message : String(error)}`)',
      '  }',
      '}',
      'process.stdin.pipe(child.stdin)',
      'child.stdout.on(\'data\', chunk => { process.stdout.write(chunk); emitFrame(\'stdout\', chunk) })',
      'child.stderr.on(\'data\', chunk => { process.stderr.write(chunk); emitFrame(\'stderr\', chunk) })',
      'child.on(\'exit\', (code, signal) => {',
      '  childExited = true',
      '  clearReconnectTimer()',
      '  if (socket && socket.writable) socket.write(JSON.stringify({ shimPid: process.pid, realPid: child.pid ?? null, source: \'stdout\', line: `DEVHUB::MARKER::v=1::DONE=${code ?? signal ?? 0}`, ts: Date.now(), tool }) + \'\\n\')',
      '  process.exit(code ?? (signal ? 1 : 0))',
      '})',
      'child.on(\'error\', error => {',
      '  childExited = true',
      '  clearReconnectTimer()',
      '  if (socket && socket.writable) socket.write(JSON.stringify({ shimPid: process.pid, realPid: null, source: \'stderr\', line: `DEVHUB::MARKER::v=1::ERROR=${error.message}`, ts: Date.now(), tool }) + \'\\n\')',
      '  console.error(error.message)',
      '  process.exit(1)',
      '})',
      ''
    ]
    return lines.join('\n')
  }
}
