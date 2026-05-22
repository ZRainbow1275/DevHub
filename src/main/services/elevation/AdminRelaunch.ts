import { spawn } from 'child_process'
import { app } from 'electron'

export interface AdminRelaunchResult {
  ok: boolean
  reason?: string
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

function buildArgumentArray(args: string[]): string {
  if (args.length === 0) {
    return '@()'
  }

  return `@(${args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(', ')})`
}

function mapRelaunchFailure(stderr: string, exitCode: number | null): string {
  const normalized = stderr.toLowerCase()
  if (
    normalized.includes('cancelled by the user')
    || normalized.includes('canceled by the user')
    || normalized.includes('operation was canceled')
    || normalized.includes('0x800704c7')
    || exitCode === 1223
  ) {
    return 'user-cancelled'
  }

  const trimmed = stderr.trim()
  if (trimmed.length > 0) {
    return trimmed
  }

  if (typeof exitCode === 'number' && exitCode !== 0) {
    return `powershell-exit-${exitCode}`
  }

  return 'unknown'
}

export class AdminRelaunch {
  static async relaunch(): Promise<AdminRelaunchResult> {
    const execPath = app.getPath('exe')
    const args = process.argv.slice(1)
    const powerShellScript = [
      `$filePath = '${escapePowerShellSingleQuoted(execPath)}'`,
      `$argList = ${buildArgumentArray(args)}`,
      'Start-Process -FilePath $filePath -ArgumentList $argList -Verb RunAs | Out-Null'
    ].join('; ')

    try {
      const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        const child = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            powerShellScript
          ],
          {
            windowsHide: true
          }
        )

        let stderr = ''

        child.stderr?.setEncoding('utf8')
        child.stderr?.on('data', (chunk: string) => {
          stderr += chunk
        })

        child.once('error', reject)
        child.once('close', (code) => {
          resolve({ code, stderr })
        })
      })

      if (result.code !== 0) {
        return {
          ok: false,
          reason: mapRelaunchFailure(result.stderr, result.code)
        }
      }

      setTimeout(() => app.quit(), 500)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
