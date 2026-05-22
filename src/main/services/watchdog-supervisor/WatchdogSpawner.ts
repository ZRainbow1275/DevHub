import { spawn } from 'node:child_process'

export interface WatchdogSpawnCommand {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs: number
}

export interface WatchdogSpawnResult {
  pid: number | null
  started: boolean
  error: string | null
  command: WatchdogSpawnCommand
}

export class WatchdogSpawner {
  buildNodeCommand(entryFile: string, token: string, markerFilePath: string, timeoutMs: number = 15_000): WatchdogSpawnCommand {
    if (entryFile.trim().length === 0) throw new Error('E_VALIDATION:watchdog entry file is required')
    return {
      command: process.execPath,
      args: [entryFile, `--token=${token}`, `--marker=${markerFilePath}`],
      env: {
        DEVHUB_WATCHDOG_TOKEN: token,
        DEVHUB_WATCHDOG_MARKER: markerFilePath,
        ELECTRON_RUN_AS_NODE: '1'
      },
      timeoutMs
    }
  }

  spawn(command: WatchdogSpawnCommand): WatchdogSpawnResult {
    if (!Number.isInteger(command.timeoutMs) || command.timeoutMs <= 0) throw new Error('E_VALIDATION:spawn timeoutMs must be positive')
    try {
      const child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        windowsHide: true,
        stdio: 'ignore'
      })
      child.once('error', () => undefined)
      child.once('close', () => undefined)
      return { pid: typeof child.pid === 'number' ? child.pid : null, started: typeof child.pid === 'number', error: null, command }
    } catch (error) {
      return { pid: null, started: false, error: error instanceof Error ? error.message : String(error), command }
    }
  }
}
