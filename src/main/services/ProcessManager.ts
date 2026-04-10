import { ChildProcess, spawn } from 'child_process'
import kill from 'tree-kill'
import { Project, LogEntry, ProjectType } from '@shared/types'
import { validateScriptName } from '../utils/security'

/**
 * Command mapping: project type + script name -> [executable, ...args]
 */
function resolveCommand(projectType: ProjectType, script: string): { cmd: string; args: string[] } {
  switch (projectType) {
    case 'npm':
      return { cmd: 'npm', args: ['run', script] }
    case 'pnpm':
      return { cmd: 'pnpm', args: ['run', script] }
    case 'yarn':
      return { cmd: 'yarn', args: ['run', script] }
    case 'rust':
      // Map scripts to cargo subcommands
      return { cmd: 'cargo', args: [script] }
    case 'go':
      // Map scripts to go subcommands
      if (script === 'run') return { cmd: 'go', args: ['run', '.'] }
      return { cmd: 'go', args: [script, './...'] }
    case 'venv':
      if (script === 'install') return { cmd: 'pip', args: ['install', '-r', 'requirements.txt'] }
      if (script === 'run') return { cmd: 'python', args: ['main.py'] }
      if (script === 'test') return { cmd: 'python', args: ['-m', 'pytest'] }
      return { cmd: 'python', args: ['-m', script] }
    case 'conda':
      if (script === 'create') return { cmd: 'conda', args: ['env', 'create', '-f', 'environment.yml'] }
      if (script === 'activate') return { cmd: 'conda', args: ['activate'] }
      if (script === 'install') return { cmd: 'conda', args: ['install', '--file', 'requirements.txt'] }
      return { cmd: 'conda', args: ['run', script] }
    case 'poetry':
      if (script === 'install') return { cmd: 'poetry', args: ['install'] }
      if (script === 'build') return { cmd: 'poetry', args: ['build'] }
      if (script === 'test') return { cmd: 'poetry', args: ['run', 'pytest'] }
      return { cmd: 'poetry', args: ['run', script] }
    case 'java-maven':
      return { cmd: 'mvn', args: [script] }
    case 'java-gradle':
      return { cmd: 'gradle', args: [script] }
    default:
      // Fallback: attempt npm
      return { cmd: 'npm', args: ['run', script] }
  }
}

type LogCallback = (entry: LogEntry) => void
type StatusCallback = (projectId: string, status: Project['status'], pid?: number) => void

export class ProcessManager {
  private processes = new Map<string, ChildProcess>()
  private logCallbacks = new Map<string, Set<LogCallback>>()
  private statusCallback: StatusCallback | null = null
  private _startingProjects = new Set<string>()
  private _stoppingProjects = new Set<string>()

  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback
  }

  onLog(projectId: string, callback: LogCallback): () => void {
    if (!this.logCallbacks.has(projectId)) {
      this.logCallbacks.set(projectId, new Set())
    }
    this.logCallbacks.get(projectId)!.add(callback)

    return () => {
      this.logCallbacks.get(projectId)?.delete(callback)
    }
  }

  private emitLog(projectId: string, type: LogEntry['type'], message: string): void {
    const entry: LogEntry = {
      projectId,
      timestamp: Date.now(),
      type,
      message
    }

    this.logCallbacks.get(projectId)?.forEach((callback) => callback(entry))
  }

  private emitStatus(projectId: string, status: Project['status'], pid?: number): void {
    if (pid !== undefined) {
      this.statusCallback?.(projectId, status, pid)
    } else {
      this.statusCallback?.(projectId, status)
    }
  }

  isRunning(projectId: string): boolean {
    return this.processes.has(projectId)
  }

  getRunningProjects(): string[] {
    return Array.from(this.processes.keys())
  }

  getProcessInfo(projectId: string): { pid: number; running: boolean } | null {
    const proc = this.processes.get(projectId)
    if (!proc || !proc.pid) return null
    return {
      pid: proc.pid,
      running: !proc.killed
    }
  }

  getAllProcessInfo(): Map<string, { pid: number; running: boolean }> {
    const info = new Map<string, { pid: number; running: boolean }>()
    this.processes.forEach((proc, id) => {
      if (proc.pid) {
        info.set(id, { pid: proc.pid, running: !proc.killed })
      }
    })
    return info
  }

  async start(project: Project, script: string): Promise<void> {
    // Validate script name
    if (!validateScriptName(script)) {
      throw new Error('Invalid script name')
    }

    // Check if script exists in project
    if (!project.scripts.includes(script)) {
      throw new Error(`Script "${script}" not found in project configuration`)
    }

    // Check if already running or starting (race condition guard)
    if (this.processes.has(project.id) || this._startingProjects.has(project.id)) {
      throw new Error('Project is already running')
    }

    // Mark as starting to prevent concurrent starts
    this._startingProjects.add(project.id)

    // Add timeout insurance: prevent _startingProjects items from never being cleaned
    const START_TIMEOUT_MS = 30000
    const startTimeout = setTimeout(() => {
      console.warn(`Start timeout for project ${project.id}, cleaning up`)
      this._startingProjects.delete(project.id)
    }, START_TIMEOUT_MS)

    return new Promise((resolve, reject) => {
      // Define cleanup function to prevent duplicate deletion
      let cleaned = false
      const cleanup = () => {
        if (!cleaned) {
          clearTimeout(startTimeout)
          this._startingProjects.delete(project.id)
          cleaned = true
        }
      }

      try {
        // Filter environment variables to only safe, necessary ones
        const SAFE_ENV_KEYS = [
          'PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP',
          'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec',
          'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
          'JAVA_HOME', 'MAVEN_HOME', 'GRADLE_HOME',
          'CONDA_PREFIX', 'VIRTUAL_ENV'
        ]
        const filteredEnv: Record<string, string> = {}
        for (const key of SAFE_ENV_KEYS) {
          if (process.env[key]) {
            filteredEnv[key] = process.env[key]!
          }
        }
        filteredEnv['FORCE_COLOR'] = '1'
        filteredEnv['NODE_ENV'] = 'development'

        // Resolve command based on project type
        const projectType = project.projectType || 'npm'
        const { cmd, args } = resolveCommand(projectType, script)

        // On Windows, many CLI tools (npm, pnpm, etc.) are .cmd scripts that
        // require a shell to execute. Use shell: true on win32 since env vars
        // are already filtered to a safe whitelist above.
        const isWin = process.platform === 'win32'
        const proc = spawn(cmd, args, {
          cwd: project.path,
          shell: isWin,
          env: filteredEnv,
          windowsHide: false
        })

        // Log system message
        this.emitLog(project.id, 'system', `Starting: ${cmd} ${args.join(' ')}`)

        // Handle stdout
        proc.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean)
          lines.forEach((line) => {
            this.emitLog(project.id, 'stdout', line)
          })
        })

        // Handle stderr
        proc.stderr?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean)
          lines.forEach((line) => {
            this.emitLog(project.id, 'stderr', line)
          })
        })

        // Handle process exit
        proc.on('exit', (code, signal) => {
          cleanup()
          this.processes.delete(project.id)
          // If we're stopping this project, skip duplicate status emit
          if (!this._stoppingProjects.has(project.id)) {
            const exitMessage = signal
              ? `Process killed with signal: ${signal}`
              : `Process exited with code: ${code}`
            this.emitLog(project.id, 'system', exitMessage)
            this.emitStatus(project.id, code === 0 ? 'stopped' : 'error')
          }
        })

        // Handle errors
        proc.on('error', (error) => {
          cleanup()
          this.processes.delete(project.id)
          this.emitLog(project.id, 'system', `Error: ${error.message}`)
          this.emitStatus(project.id, 'error')
          reject(error)
        })

        // Resolve once spawned
        proc.on('spawn', () => {
          cleanup()
          this.processes.set(project.id, proc)
          this.emitStatus(project.id, 'running', proc.pid)
          resolve()
        })
      } catch (error) {
        cleanup()
        reject(error)
      }
    })
  }

  async stop(projectId: string): Promise<void> {
    const proc = this.processes.get(projectId)
    if (!proc || !proc.pid) {
      return
    }

    // Prevent concurrent stop calls for the same project
    if (this._stoppingProjects.has(projectId)) {
      return
    }
    this._stoppingProjects.add(projectId)

    return new Promise((resolve) => {
      this.emitLog(projectId, 'system', 'Stopping process...')

      kill(proc.pid!, 'SIGTERM', (err) => {
        if (err) {
          // Force kill if SIGTERM fails
          kill(proc.pid!, 'SIGKILL', () => {
            this.processes.delete(projectId)
            this.emitLog(projectId, 'system', 'Process force killed')
            this.emitStatus(projectId, 'stopped')
            this._stoppingProjects.delete(projectId)
            resolve()
          })
        } else {
          this.processes.delete(projectId)
          this.emitLog(projectId, 'system', 'Process stopped')
          this.emitStatus(projectId, 'stopped')
          this._stoppingProjects.delete(projectId)
          resolve()
        }
      })
    })
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map((id) => this.stop(id))
    await Promise.all(stopPromises)
  }

  async restart(project: Project, script: string): Promise<void> {
    await this.stop(project.id)
    await new Promise((resolve) => setTimeout(resolve, 500)) // Brief delay
    await this.start(project, script)
  }

  /**
   * 清理所有资源 - 应在应用退出时调用
   */
  async cleanup(): Promise<void> {
    // 停止所有运行中的进程
    await this.stopAll()

    // 清理回调
    this.logCallbacks.clear()
    this.statusCallback = null

    // 清理进程引用
    this.processes.clear()
  }

  /**
   * 移除特定项目的日志回调
   */
  removeLogCallbacks(projectId: string): void {
    this.logCallbacks.delete(projectId)
  }
}
