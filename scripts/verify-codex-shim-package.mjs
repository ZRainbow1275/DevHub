import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactName = `codex-shim-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`
const artifactPath = join(projectRoot, 'resources', 'shims', 'codex', artifactName)
const markerLine = 'DEVHUB::MARKER::v=1::PHASE=packaged'
const stderrLine = 'devhub-packaged-shim-stderr-proof'

if (!existsSync(artifactPath)) {
  throw new Error(`Missing packaged codex shim artifact: ${artifactPath}. Run pnpm shim:build:codex first.`)
}

function runPackagedShim(shimPath) {
  const child = spawn(shimPath, [
    '-e',
    `console.log(${JSON.stringify(markerLine)}); console.error(${JSON.stringify(stderrLine)})`
  ], {
    env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', chunk => {
    stdout += String(chunk)
  })
  child.stderr?.on('data', chunk => {
    stderr += String(chunk)
  })

  return new Promise((resolveRun, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Timed out while running packaged codex shim'))
    }, 15_000)
    timer.unref?.()

    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', exitCode => {
      clearTimeout(timer)
      resolveRun({ exitCode, stderr, stdout })
    })
  })
}

function startFrameServer(pipeName, frames) {
  const server = net.createServer(socket => {
    let buffer = ''
    socket.on('data', chunk => {
      buffer += String(chunk)
      const lines = buffer.split(/\r?\n/u)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        frames.push(JSON.parse(line))
      }
    })
  })

  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(pipeName, () => resolveListen(server))
  })
}

const tempRoot = await mkdtemp(join(tmpdir(), 'devhub-packaged-codex-shim-'))
const shimPath = join(tempRoot, process.platform === 'win32' ? 'codex.exe' : 'codex')
const pipeName = process.platform === 'win32'
  ? `\\\\.\\pipe\\devhub-packaged-codex-shim-${process.pid}-${Date.now()}`
  : join(tempRoot, 'devhub-packaged-codex-shim.sock')
const frames = []

try {
  await copyFile(artifactPath, shimPath)
  if (process.platform !== 'win32') await chmod(shimPath, 0o755)
  await writeFile(`${shimPath}.json`, JSON.stringify({
    toolName: 'codex',
    realExePath: process.execPath,
    shimExePath: shimPath,
    installedAt: Date.now(),
    shimVersion: 'verify',
    ipcPipe: pipeName
  }, null, 2), 'utf8')

  const server = await startFrameServer(pipeName, frames)
  try {
    const result = await runPackagedShim(shimPath)
    if (result.exitCode !== 0) {
      throw new Error(`Packaged shim exited with ${result.exitCode}: ${result.stderr}`)
    }
    if (!result.stdout.includes(markerLine)) {
      throw new Error('Packaged shim did not preserve stdout marker line')
    }
    if (!result.stderr.includes(stderrLine)) {
      throw new Error('Packaged shim did not preserve stderr line')
    }
    if (!frames.some(frame => frame.source === 'stdout' && frame.line === markerLine)) {
      throw new Error('Packaged shim did not forward stdout frame to named pipe')
    }
    if (!frames.some(frame => frame.source === 'stderr' && frame.line === stderrLine)) {
      throw new Error('Packaged shim did not forward stderr frame to named pipe')
    }
    console.log(JSON.stringify({
      artifactPath,
      exitCode: result.exitCode,
      frameCount: frames.length,
      stderrPreserved: true,
      stdoutPreserved: true
    }, null, 2))
  } finally {
    await new Promise(resolveClose => server.close(() => resolveClose()))
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
