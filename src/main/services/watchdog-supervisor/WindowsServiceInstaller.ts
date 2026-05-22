import { execFile } from 'node:child_process'
import { exec as sudoExec } from 'sudo-prompt'

export interface WindowsServiceCommandPlan {
  command: 'sc.exe'
  args: string[]
  requiresElevation: true
  commandLine: string
}

export type WindowsServiceOperationCode =
  | 'OK'
  | 'E_PERMISSION'
  | 'E_UNSUPPORTED_PLATFORM'
  | 'E_UAC_CANCELLED'
  | 'E_SERVICE_COMMAND_FAILED'
  | 'E_SERVICE_VERIFY_FAILED'

export interface WindowsServiceOperationResult {
  success: boolean
  requiresElevation: boolean
  elevated: boolean
  serviceName: string
  command: WindowsServiceCommandPlan
  code: WindowsServiceOperationCode
  message: string
  stdout?: string
  stderr?: string
}

export interface ElevatedCommandResult {
  stdout: string
  stderr: string
}

export interface ElevatedCommandExecutor {
  exec(commandLine: string): Promise<ElevatedCommandResult>
}

export interface WindowsServiceInstallerOptions {
  elevatedExecutor?: ElevatedCommandExecutor
  platform?: NodeJS.Platform
  queryServiceInstalled?: (serviceName: string) => Promise<boolean>
}

class ElevatedCommandError extends Error {
  constructor(
    message: string,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(message)
  }
}

class SudoPromptElevatedCommandExecutor implements ElevatedCommandExecutor {
  async exec(commandLine: string): Promise<ElevatedCommandResult> {
    return await new Promise((resolve, reject) => {
      sudoExec(commandLine, { name: 'DevHub' }, (error, stdout, stderr) => {
        const stdoutText = outputToText(stdout)
        const stderrText = outputToText(stderr)
        if (error) {
          reject(new ElevatedCommandError(error.message, stdoutText, stderrText))
          return
        }
        resolve({ stdout: stdoutText, stderr: stderrText })
      })
    })
  }
}

export class WindowsServiceInstaller {
  private readonly elevatedExecutor: ElevatedCommandExecutor
  private readonly platform: NodeJS.Platform
  private readonly queryServiceInstalled: (serviceName: string) => Promise<boolean>

  constructor(
    private readonly serviceName: string = 'devhub-watchdog',
    options: WindowsServiceInstallerOptions = {}
  ) {
    this.validateServiceName(serviceName)
    this.elevatedExecutor = options.elevatedExecutor ?? new SudoPromptElevatedCommandExecutor()
    this.platform = options.platform ?? process.platform
    this.queryServiceInstalled = options.queryServiceInstalled ?? ((name) => this.queryScService(name))
  }

  installPlan(binaryPath: string): WindowsServiceCommandPlan {
    const normalizedBinaryPath = this.normalizeBinaryPath(binaryPath)
    const plan = {
      command: 'sc.exe' as const,
      args: ['create', this.serviceName, 'binPath=', normalizedBinaryPath, 'start=', 'demand'],
      requiresElevation: true as const
    }
    return { ...plan, commandLine: buildCommandLine(plan.command, plan.args) }
  }

  uninstallPlan(): WindowsServiceCommandPlan {
    const plan = { command: 'sc.exe' as const, args: ['delete', this.serviceName], requiresElevation: true as const }
    return { ...plan, commandLine: buildCommandLine(plan.command, plan.args) }
  }

  async install(binaryPath: string, request: { confirmAdmin?: boolean; confirmedBy?: string } = {}): Promise<WindowsServiceOperationResult> {
    const command = this.installPlan(binaryPath)
    if (!request.confirmAdmin) {
      return {
        success: false,
        requiresElevation: true,
        elevated: false,
        serviceName: this.serviceName,
        command,
        code: 'E_PERMISSION',
        message: 'Windows Service installation requires explicit confirmAdmin=true before DevHub triggers UAC.'
      }
    }
    if (this.platform !== 'win32') {
      return this.unsupported(command)
    }
    return await this.runElevatedAndVerify(command, true)
  }

  async uninstall(request: { confirmAdmin?: boolean; confirmedBy?: string } = {}): Promise<WindowsServiceOperationResult> {
    const command = this.uninstallPlan()
    if (!request.confirmAdmin) {
      return {
        success: false,
        requiresElevation: true,
        elevated: false,
        serviceName: this.serviceName,
        command,
        code: 'E_PERMISSION',
        message: 'Windows Service uninstall requires explicit confirmAdmin=true before DevHub triggers UAC.'
      }
    }
    if (this.platform !== 'win32') {
      return this.unsupported(command)
    }
    return await this.runElevatedAndVerify(command, false)
  }

  private async runElevatedAndVerify(command: WindowsServiceCommandPlan, expectedInstalled: boolean): Promise<WindowsServiceOperationResult> {
    try {
      const output = await this.elevatedExecutor.exec(command.commandLine)
      const installed = await this.queryServiceInstalled(this.serviceName)
      if (installed !== expectedInstalled) {
        return {
          success: false,
          requiresElevation: false,
          elevated: true,
          serviceName: this.serviceName,
          command,
          code: 'E_SERVICE_VERIFY_FAILED',
          message: expectedInstalled
            ? 'Windows Service command completed but sc.exe query did not confirm installation.'
            : 'Windows Service command completed but sc.exe query still reports the service as installed.',
          stdout: output.stdout,
          stderr: output.stderr
        }
      }
      return {
        success: true,
        requiresElevation: false,
        elevated: true,
        serviceName: this.serviceName,
        command,
        code: 'OK',
        message: expectedInstalled
          ? 'Windows Service installation completed and was verified by sc.exe query.'
          : 'Windows Service uninstall completed and absence was verified by sc.exe query.',
        stdout: output.stdout,
        stderr: output.stderr
      }
    } catch (error) {
      const elevatedError = error instanceof ElevatedCommandError ? error : null
      const message = error instanceof Error ? error.message : String(error)
      const cancelled = isUacCancellation(message) || isUacCancellation(elevatedError?.stderr ?? '')
      return {
        success: false,
        requiresElevation: cancelled,
        elevated: true,
        serviceName: this.serviceName,
        command,
        code: cancelled ? 'E_UAC_CANCELLED' : 'E_SERVICE_COMMAND_FAILED',
        message: cancelled ? 'Windows Service UAC prompt was cancelled.' : `Windows Service elevated command failed: ${message}`,
        stdout: elevatedError?.stdout,
        stderr: elevatedError?.stderr
      }
    }
  }

  private unsupported(command: WindowsServiceCommandPlan): WindowsServiceOperationResult {
    return {
      success: false,
      requiresElevation: false,
      elevated: false,
      serviceName: this.serviceName,
      command,
      code: 'E_UNSUPPORTED_PLATFORM',
      message: `Windows Service management is only supported on win32; current platform is ${this.platform}.`
    }
  }

  private async queryScService(serviceName: string): Promise<boolean> {
    try {
      await execFileAsync('sc.exe', ['query', serviceName])
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return !message.includes('1060')
    }
  }

  private validateServiceName(serviceName: string): void {
    if (!/^[A-Za-z0-9._-]+$/.test(serviceName)) {
      throw new Error('E_VALIDATION:serviceName must contain only letters, numbers, dot, underscore, or dash')
    }
  }

  private normalizeBinaryPath(binaryPath: string): string {
    const value = binaryPath.trim()
    if (value.length === 0) throw new Error('E_VALIDATION:service binaryPath is required')
    if (/["\r\n]/.test(value)) throw new Error('E_VALIDATION:service binaryPath contains unsupported characters')
    return value
  }
}

function outputToText(value: string | Buffer | undefined): string {
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return typeof value === 'string' ? value : ''
}

function buildCommandLine(command: string, args: readonly string[]): string {
  return [command, ...args].map(quoteCommandArg).join(' ')
}

function quoteCommandArg(value: string): string {
  if (/^[A-Za-z0-9._:=\\/-]+$/.test(value)) return value
  return `"${value.replace(/"/g, '\\"')}"`
}

function isUacCancellation(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized.includes('cancelled by the user')
    || normalized.includes('canceled by the user')
    || normalized.includes('operation was canceled')
    || normalized.includes('0x800704c7')
    || normalized.includes('1223')
}

function execFileAsync(command: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve({ stdout: outputToText(stdout), stderr: outputToText(stderr) })
    })
  })
}
