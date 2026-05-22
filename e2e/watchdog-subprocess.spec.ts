import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

const APP_MAIN = 'out/main/index.js'

interface LaunchResult {
  electronApp: ElectronApplication
  tempRoot: string
  userDataPath: string
  window: Page
}

interface SupervisorStatus {
  channelDiagnostics?: unknown[]
  channelStates: Record<string, boolean>
  eventPipePath: string
  evidence?: string[]
  innerHealthy: boolean
  innerWatchdogPid: number | null
  markerFilePath: string
  sessionTokenPrefix: string
  status: string
}

interface RespawnResult {
  code: string
  message: string
  spawnResult?: {
    pid: number | null
    started: boolean
  }
  status: SupervisorStatus
  success: boolean
}

interface RuntimeStoreSession {
  token: string
}

interface RpcResponse {
  error?: {
    code: number
    message: string
  }
  id: string | number
  jsonrpc: '2.0'
  result?: unknown
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} must be a non-empty string`)
  return value
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error(`${key} must be boolean`)
  return value
}

function readNullablePid(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (value === null) return null
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  throw new Error(`${key} must be a positive pid or null`)
}

function parseSupervisorStatus(value: unknown): SupervisorStatus {
  const record = assertRecord(value, 'supervisor status')
  return {
    channelDiagnostics: Array.isArray(record.channelDiagnostics) ? record.channelDiagnostics : undefined,
    channelStates: assertRecord(record.channelStates, 'channelStates') as Record<string, boolean>,
    eventPipePath: readString(record, 'eventPipePath'),
    evidence: Array.isArray(record.evidence) ? record.evidence.map(String) : undefined,
    innerHealthy: readBoolean(record, 'innerHealthy'),
    innerWatchdogPid: readNullablePid(record, 'innerWatchdogPid'),
    markerFilePath: readString(record, 'markerFilePath'),
    sessionTokenPrefix: readString(record, 'sessionTokenPrefix'),
    status: readString(record, 'status')
  }
}

function parseRespawnResult(value: unknown): RespawnResult {
  const record = assertRecord(value, 'respawn result')
  const spawnRecord = record.spawnResult === undefined ? undefined : assertRecord(record.spawnResult, 'spawnResult')
  return {
    code: readString(record, 'code'),
    message: readString(record, 'message'),
    spawnResult: spawnRecord
      ? {
          pid: readNullablePid(spawnRecord, 'pid'),
          started: readBoolean(spawnRecord, 'started')
        }
      : undefined,
    status: parseSupervisorStatus(record.status),
    success: readBoolean(record, 'success')
  }
}

function parseRuntimeSession(value: unknown): RuntimeStoreSession {
  const record = assertRecord(value, 'watchdogSupervisorSession')
  const token = readString(record, 'token')
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('watchdog supervisor token must be 64 lowercase hex characters')
  return { token }
}

function parseRpcResponse(value: unknown): RpcResponse {
  const record = assertRecord(value, 'rpc response')
  const jsonrpc = readString(record, 'jsonrpc')
  if (jsonrpc !== '2.0') throw new Error('rpc response jsonrpc must be 2.0')
  const id = record.id
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('rpc response id must be string or number')
  const response: RpcResponse = { id, jsonrpc }
  if (record.error !== undefined) {
    const error = assertRecord(record.error, 'rpc error')
    const code = error.code
    const message = error.message
    if (typeof code !== 'number' || !Number.isInteger(code)) throw new Error('rpc error code must be integer')
    if (typeof message !== 'string' || message.length === 0) throw new Error('rpc error message must be non-empty')
    response.error = { code, message }
  } else {
    response.result = record.result
  }
  return response
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    return code !== 'ESRCH'
  }
}

async function waitForCondition(check: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function stopPid(pid: number | null): Promise<void> {
  if (!pid || !isPidAlive(pid)) return
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return
  }
  const exited = await waitForCondition(() => !isPidAlive(pid), 2_500)
  if (exited || process.platform !== 'win32') return
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/F'], {
      stdio: 'ignore',
      timeout: 5_000,
      windowsHide: true
    })
  } catch {
    return
  }
  await waitForCondition(() => !isPidAlive(pid), 2_500)
}

async function launchApp(): Promise<LaunchResult> {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build before Electron E2E.`)
  }

  const tempRoot = join(tmpdir(), `devhub-r8c-spec17-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const appData = join(tempRoot, 'appdata')
  const localAppData = join(tempRoot, 'localappdata')
  const electronUserData = join(tempRoot, 'electron-user-data')
  const home = join(tempRoot, 'home')
  const xdgConfig = join(tempRoot, 'xdg-config')
  for (const directory of [appData, localAppData, electronUserData, home, xdgConfig]) mkdirSync(directory, { recursive: true })

  const electronApp = await electron.launch({
    args: [APP_MAIN],
    env: {
      ...process.env,
      APPDATA: appData,
      DEVHUB_USER_DATA_DIR: electronUserData,
      HOME: home,
      LOCALAPPDATA: localAppData,
      XDG_CONFIG_HOME: xdgConfig
    }
  })
  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  if (!userDataPath.startsWith(tempRoot)) {
    await closeElectronApp(electronApp)
    throw new Error(`Electron userData isolation failed: ${userDataPath}`)
  }
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const mainWindow = electronApp.windows().find((page) =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )
    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return { electronApp, tempRoot, userDataPath, window: mainWindow }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  await closeElectronApp(electronApp)
  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp: ElectronApplication): Promise<void> {
  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    return
  }

  await Promise.race([
    electronApp.close(),
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8_000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

async function supervisorStatus(page: Page): Promise<SupervisorStatus> {
  return page.evaluate(async () => {
    return window.devhub.r8.watchdog.supervisorStatus()
  }).then(parseSupervisorStatus)
}

async function supervisorRespawn(page: Page, reason: string): Promise<RespawnResult> {
  return page.evaluate(async (input) => {
    return window.devhub.r8.watchdog.supervisorRespawn(input.reason, input.confirmedBy)
  }, { confirmedBy: 'spec17-e2e', reason }).then(parseRespawnResult)
}

async function waitForReachableSupervisor(page: Page, expectedPid?: number): Promise<SupervisorStatus> {
  let latest: SupervisorStatus | null = null
  await expect.poll(async () => {
    latest = await supervisorStatus(page)
    const pidOk = expectedPid === undefined || latest.innerWatchdogPid === expectedPid
    return Boolean(
      pidOk
      && latest.innerWatchdogPid
      && latest.innerHealthy
      && (latest.status === 'healthy' || latest.status === 'degraded' || latest.status === 'starting')
    )
  }, {
    message: 'wait for real InnerWatchdog child to become reachable',
    timeout: 20_000,
    intervals: [500, 750, 1000]
  }).toBe(true)
  if (!latest) throw new Error('supervisor status was not resolved')
  return latest
}

async function waitForDeadSupervisor(page: Page, killedPid: number): Promise<SupervisorStatus> {
  let latest: SupervisorStatus | null = null
  await expect.poll(async () => {
    latest = await supervisorStatus(page)
    return latest.innerWatchdogPid === killedPid && latest.status === 'dead' && latest.innerHealthy === false
  }, {
    message: 'wait for killed InnerWatchdog child to be reported dead',
    timeout: 35_000,
    intervals: [1000, 1500, 2000]
  }).toBe(true)
  if (!latest) throw new Error('dead supervisor status was not resolved')
  return latest
}

function readRuntimeSession(userDataPath: string): RuntimeStoreSession {
  const runtimeStorePath = join(userDataPath, 'devhub-r8-runtime.json')
  const runtimeStore = assertRecord(JSON.parse(readFileSync(runtimeStorePath, 'utf8')) as unknown, 'runtime store')
  return parseRuntimeSession(runtimeStore.watchdogSupervisorSession)
}

function readMarkerParentPid(markerFilePath: string): number {
  const marker = assertRecord(JSON.parse(readFileSync(markerFilePath, 'utf8')) as unknown, 'watchdog marker')
  const parentPid = marker.parentPid
  if (typeof parentPid !== 'number' || !Number.isInteger(parentPid) || parentPid <= 0) {
    throw new Error('watchdog marker parentPid must be a positive integer')
  }
  return parentPid
}

async function sendChildRpc(eventPipePath: string, token: string, method: string, id: string, params: Record<string, unknown> = {}): Promise<RpcResponse> {
  return await new Promise<RpcResponse>((resolve, reject) => {
    const socket = createConnection(eventPipePath)
    let buffer = ''
    let settled = false
    const timeout = setTimeout(() => {
      settle(new Error(`E_TIMEOUT:${method} child RPC timed out`))
    }, 3_000)

    const settle = (error?: Error, response?: RpcResponse): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.destroy()
      if (error) reject(error)
      else resolve(response ?? parseRpcResponse({ jsonrpc: '2.0', id, error: { code: -32000, message: 'empty child RPC response' } }))
    }

    socket.setEncoding('utf8')
    socket.once('connect', () => {
      socket.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: { ...params, sessionToken: token }
      })}\n`)
    })
    socket.on('data', chunk => {
      buffer += chunk
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) return
      try {
        settle(undefined, parseRpcResponse(JSON.parse(buffer.slice(0, newlineIndex)) as unknown))
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)))
      }
    })
    socket.once('error', error => settle(error))
  })
}

async function waitForChildRpc(eventPipePath: string, token: string, method: string, id: string, params: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<RpcResponse> {
  const deadline = Date.now() + timeoutMs
  let lastError: Error | null = null
  while (Date.now() < deadline) {
    try {
      return await sendChildRpc(eventPipePath, token, method, id, params)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError ?? new Error(`E_TIMEOUT:${method} child RPC did not become ready`)
}

async function removeTempRoot(tempRoot: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      rmSync(tempRoot, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
}

test('R8.C spec-17 packaged watchdog subprocess respawns after a real child kill', async () => {
  test.skip(process.platform !== 'win32', 'R8.C spec-17 watchdog subprocess E2E requires Windows named-pipe semantics')
  test.setTimeout(180_000)

  let launched: LaunchResult | null = null
  let firstPid: number | null = null
  let secondPid: number | null = null

  try {
    launched = await launchApp()
    const { window } = launched

    const firstRespawn = await supervisorRespawn(window, 'R8.C spec-17 e2e initial respawn')
    expect(firstRespawn).toMatchObject({ success: true, code: 'OK' })
    firstPid = firstRespawn.spawnResult?.pid ?? firstRespawn.status.innerWatchdogPid
    expect(firstPid).toBeGreaterThan(0)
    if (firstPid === null) throw new Error('first InnerWatchdog pid was not resolved')
    const firstStatus = await waitForReachableSupervisor(window, firstPid ?? undefined)
    expect(firstStatus.markerFilePath).toContain(firstStatus.sessionTokenPrefix)

    await stopPid(firstPid)
    await waitForDeadSupervisor(window, firstPid)

    const secondRespawn = await supervisorRespawn(window, 'R8.C spec-17 e2e respawn after killed child')
    expect(secondRespawn).toMatchObject({ success: true, code: 'OK' })
    secondPid = secondRespawn.spawnResult?.pid ?? secondRespawn.status.innerWatchdogPid
    expect(secondPid).toBeGreaterThan(0)
    expect(secondPid).not.toBe(firstPid)
    await waitForReachableSupervisor(window, secondPid ?? undefined)
  } finally {
    if (launched) {
      await closeElectronApp(launched.electronApp)
    }
    await stopPid(firstPid)
    await stopPid(secondPid)
    if (launched) await removeTempRoot(launched.tempRoot)
  }
})

test('R8.C spec-17 packaged watchdog subprocess enters real orphan read-only mode after parent exit', async () => {
  test.skip(process.platform !== 'win32', 'R8.C spec-17 watchdog subprocess orphan E2E requires Windows named-pipe semantics')
  test.setTimeout(120_000)

  let launched: LaunchResult | null = null
  let childPid: number | null = null

  try {
    launched = await launchApp()
    const { userDataPath, window } = launched

    const respawn = await supervisorRespawn(window, 'R8.C spec-17 e2e orphan respawn')
    expect(respawn).toMatchObject({ success: true, code: 'OK' })
    childPid = respawn.spawnResult?.pid ?? respawn.status.innerWatchdogPid
    expect(childPid).toBeGreaterThan(0)
    const status = await waitForReachableSupervisor(window, childPid ?? undefined)
    const session = readRuntimeSession(userDataPath)
    const parentPid = readMarkerParentPid(status.markerFilePath)

    try {
      await waitForChildRpc(status.eventPipePath, session.token, 'get-status', 'wait-child-rpc-ready')
    } catch (error) {
      const latest = await supervisorStatus(window)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`child event pipe was not ready: ${message}; supervisor=${JSON.stringify(latest)}`)
    }
    const register = await waitForChildRpc(status.eventPipePath, session.token, 'register-instance', 'register-attached', {
      instanceId: 'spec17-packaged-e2e',
      pid: childPid
    })
    expect(register.error).toBeUndefined()

    await stopPid(parentPid)
    await expect.poll(() => isPidAlive(parentPid), {
      message: 'wait for Electron parent process to exit before orphan assertion',
      timeout: 15_000,
      intervals: [250, 500, 1000]
    }).toBe(false)

    const orphanStatus = await waitForChildRpc(status.eventPipePath, session.token, 'get-status', 'status-after-parent-exit')
    const orphanStatusResult = assertRecord(orphanStatus.result, 'orphan status result')
    expect(orphanStatusResult.mode).toBe('orphan')
    expect(orphanStatusResult.registeredInstanceCount).toBe(1)

    const refusedRegister = await waitForChildRpc(status.eventPipePath, session.token, 'register-instance', 'register-after-orphan', {
      instanceId: 'spec17-refused-after-orphan',
      pid: childPid
    })
    expect(refusedRegister.error?.message).toContain('E_ORPHAN_READ_ONLY')
  } finally {
    if (launched) {
      await closeElectronApp(launched.electronApp)
    }
    await stopPid(childPid)
    if (launched) await removeTempRoot(launched.tempRoot)
  }
})
