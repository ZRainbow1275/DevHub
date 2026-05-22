#!/usr/bin/env node
/* global __filename, clearTimeout, console, process, require, setTimeout */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict'

const { spawn } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const net = require('node:net')
const path = require('node:path')

const RECONNECT_MIN_MS = 100
const RECONNECT_MAX_MS = 1000

let socket = null
let controlBuffer = ''
let reconnectDelayMs = RECONNECT_MIN_MS
let reconnectTimer = null
let childExited = false

function executablePath() {
  if (process.pkg) return process.execPath
  return process.argv[1] || __filename
}

function toolFromPath(value) {
  const baseName = path.basename(value).toLowerCase().replace(/\.(exe|cmd|bat|mjs|cjs|js)$/u, '')
  if (baseName.startsWith('codex')) return 'codex'
  if (baseName.startsWith('claude')) return 'claude'
  if (baseName.startsWith('gemini')) return 'gemini'
  return null
}

function manifestCandidates() {
  const candidates = []
  if (process.env.DEVHUB_SHIM_MANIFEST) {
    candidates.push(process.env.DEVHUB_SHIM_MANIFEST)
  }

  const exePath = executablePath()
  const exeDirectory = path.dirname(exePath)
  const inferredTool = process.env.DEVHUB_CLI_TOOL || toolFromPath(exePath)
  candidates.push(`${exePath}.json`)
  if (inferredTool) {
    candidates.push(path.join(exeDirectory, `${inferredTool}-devhub-shim.json`))
  }

  return [...new Set(candidates)]
}

function readManifest() {
  for (const candidate of manifestCandidates()) {
    if (!candidate || !existsSync(candidate)) continue
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'))
      if (
        parsed
        && typeof parsed.toolName === 'string'
        && typeof parsed.realExePath === 'string'
        && parsed.realExePath.length > 0
        && typeof parsed.ipcPipe === 'string'
      ) {
        return parsed
      }
    } catch {
      continue
    }
  }
  return null
}

function forwardedArgs() {
  if (!process.pkg) return process.argv.slice(2)
  const firstArg = process.argv[1]
  if (!firstArg) return []
  const normalizedExecPath = path.resolve(process.execPath).toLowerCase()
  const normalizedFirstArg = path.resolve(firstArg).toLowerCase()
  if (normalizedFirstArg === normalizedExecPath || /\.(cjs|js|mjs)$/iu.test(firstArg)) {
    return process.argv.slice(2)
  }
  return process.argv.slice(1)
}

function hasArg(args, name) {
  return args.some(arg => arg === name || arg.startsWith(`${name}=`))
}

function hasArgValue(args, name, value) {
  return args.some((arg, index) => arg === `${name}=${value}` || (arg === name && args[index + 1] === value))
}

function shouldSkipClaudeStreamJsonInjection(args) {
  const first = args.find(arg => !arg.startsWith('-'))
  const nonPrintCommands = new Set(['agents', 'auth', 'auto-mode', 'doctor', 'install', 'mcp', 'plugin', 'plugins', 'setup-token', 'update', 'upgrade'])
  return args.includes('--help') || args.includes('-h') || args.includes('--version') || args.includes('-v') || (first ? nonPrintCommands.has(first) : false)
}

function normalizeClaudeArgs(args) {
  if (!args.includes('-p') && !args.includes('--print')) return args
  if (shouldSkipClaudeStreamJsonInjection(args)) return args
  const next = [...args]
  const alreadyStreamJson = hasArgValue(next, '--output-format', 'stream-json')
  if (!alreadyStreamJson) {
    if (hasArg(next, '--output-format')) return next
    next.push('--output-format', 'stream-json')
  }
  if (!hasArg(next, '--include-partial-messages')) next.push('--include-partial-messages')
  return next
}

function isLikelyJsonLine(line) {
  const trimmed = String(line).trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('DEVHUB::MARKER::')
}

function clearReconnectTimer() {
  if (!reconnectTimer) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function scheduleReconnect(pipe) {
  if (!pipe || childExited || reconnectTimer) return
  const delay = reconnectDelayMs
  reconnectDelayMs = Math.min(RECONNECT_MAX_MS, reconnectDelayMs * 2)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectPipe(pipe)
  }, delay)
  if (typeof reconnectTimer.unref === 'function') reconnectTimer.unref()
}

function connectPipe(pipe) {
  if (!pipe || childExited) return
  try {
    const nextSocket = net.createConnection(pipe)
    socket = nextSocket
    nextSocket.on('connect', () => {
      reconnectDelayMs = RECONNECT_MIN_MS
    })
    nextSocket.on('data', chunk => {
      controlBuffer += String(chunk)
      const lines = controlBuffer.split(/\r?\n/u)
      controlBuffer = lines.pop() ?? ''
      for (const line of lines) handleControlLine(line)
    })
    nextSocket.on('error', () => {
      if (socket === nextSocket) socket = null
      scheduleReconnect(pipe)
    })
    nextSocket.on('close', () => {
      if (socket === nextSocket) socket = null
      scheduleReconnect(pipe)
    })
  } catch {
    socket = null
    scheduleReconnect(pipe)
  }
}

function emitFrame(source, chunk, childPid, tool, metadataForLine = () => ({})) {
  if (!socket || !socket.writable) return
  for (const line of String(chunk).split(/\r?\n/u).filter(Boolean)) {
    socket.write(JSON.stringify({
      shimPid: process.pid,
      realPid: childPid ?? null,
      source,
      line,
      ts: Date.now(),
      tool,
      ...metadataForLine(source, line)
    }) + '\n')
  }
}

function emitControlMarker(source, marker) {
  if (!socket || !socket.writable) return
  socket.write(JSON.stringify({
    shimPid: process.pid,
    realPid: child.pid ?? null,
    source,
    line: marker,
    ts: Date.now(),
    tool
  }) + '\n')
}

function handleControlLine(line) {
  if (!line.trim()) return
  let frame = null
  try {
    frame = JSON.parse(line)
  } catch {
    return
  }
  if (!frame || frame.type !== 'stdin' || typeof frame.requestId !== 'string' || typeof frame.text !== 'string') return
  const payload = frame.text + (frame.appendNewline === false ? '' : '\n')
  if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {
    emitControlMarker('stderr', `DEVHUB::MARKER::v=1::CONTROL_ERROR=${frame.requestId}:stdin unavailable`)
    return
  }
  try {
    child.stdin.write(payload, () => emitControlMarker('stdout', `DEVHUB::MARKER::v=1::CONTROL=${frame.requestId}`))
  } catch (error) {
    emitControlMarker('stderr', `DEVHUB::MARKER::v=1::CONTROL_ERROR=${frame.requestId}:${error instanceof Error ? error.message : String(error)}`)
  }
}

function exitCodeFor(code, signal) {
  if (typeof code === 'number') return code
  return signal ? 1 : 0
}

const manifest = readManifest()
const tool = process.env.DEVHUB_CLI_TOOL || manifest?.toolName || toolFromPath(executablePath()) || 'codex'
const real = process.env.DEVHUB_REAL_CLI_PATH || manifest?.realExePath
const pipe = process.env.DEVHUB_SHIM_PIPE || manifest?.ipcPipe || ''

if (!real) {
  console.error('E_CLI_NOT_FOUND: DEVHUB_REAL_CLI_PATH or shim manifest realExePath is required')
  process.exit(1)
}

connectPipe(pipe)

const childEnv = { ...process.env }
if (tool === 'gemini') {
  if (!childEnv.GEMINI_OUTPUT_FORMAT) childEnv.GEMINI_OUTPUT_FORMAT = 'json'
  childEnv.DEVHUB_SHIM_MARKER_PROTOCOL = 'v1'
}

const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/iu.test(real)
const originalArgs = forwardedArgs()
const childArgs = tool === 'claude' ? normalizeClaudeArgs(originalArgs) : originalArgs
let claudeFallbackFrameEmitted = false
function claudeFrameMetadata(source, line) {
  if (tool !== 'claude' || source !== 'stdout' || claudeFallbackFrameEmitted || isLikelyJsonLine(line)) return {}
  if (!hasArgValue(childArgs, '--output-format', 'stream-json')) return {}
  claudeFallbackFrameEmitted = true
  return {
    argv: originalArgs,
    restartArgs: childArgs,
    cwd: process.cwd(),
    fallbackReason: 'non-stream-json-output',
    requiresUserConfirmation: true
  }
}
const child = spawn(real, childArgs, {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: needsShell,
  windowsHide: true,
  env: childEnv
})

process.stdin.on('error', () => undefined)
child.stdin.on('error', () => undefined)
process.stdin.pipe(child.stdin)

child.stdout.on('data', chunk => {
  process.stdout.write(chunk)
  emitFrame('stdout', chunk, child.pid, tool, claudeFrameMetadata)
})

child.stderr.on('data', chunk => {
  process.stderr.write(chunk)
  emitFrame('stderr', chunk, child.pid, tool, claudeFrameMetadata)
})

child.on('exit', (code, signal) => {
  childExited = true
  clearReconnectTimer()
  emitFrame('stdout', `DEVHUB::MARKER::v=1::DONE=${code ?? signal ?? 0}`, child.pid, tool)
  process.exit(exitCodeFor(code, signal))
})

child.on('error', error => {
  childExited = true
  clearReconnectTimer()
  emitFrame('stderr', `DEVHUB::MARKER::v=1::ERROR=${error.message}`, null, tool)
  console.error(error.message)
  process.exit(1)
})
