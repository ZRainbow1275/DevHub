import { ChildProcess, spawn } from 'child_process'
import kill from 'tree-kill'
import { Project, LogEntry } from '@shared/types'
import { validateScriptName } from '../utils/security'

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
    this.statusCallback?.(projectId, status, pid)
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
      throw new Error(`Script "${script}" not found in package.json`)
    }

    // Check if already running or starting (race condition guard)
    if (this.processes.has(project.id) || this._startingProjects.has(project.id)) {
      throw new Error('Project is already running')
    }

    // Mark as starting to prevent concurrent starts
    this._startingProjects.add(project.id)

    return new Promise((resolve, reject) => {
      try {
        // Filter environment variables to only safe, necessary ones
        const SAFE_ENV_KEYS = [
          'PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP',
          'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec'
        ]
        const filteredEnv: Record<string, string> = {}
        for (const key of SAFE_ENV_KEYS) {
          if (process.env[key]) {
            filteredEnv[key] = process.env[key]!
          }
        }
        filteredEnv['FORCE_COLOR'] = '1'
        filteredEnv['NODE_ENV'] = 'development'

        // Use spawn with shell: false for security
        const proc = spawn('npm', ['run', script], {
          cwd: project.path,
          shell: false,
          env: filteredEnv,
          windowsHide: false
        })

        // Log system message
        this.emitLog(project.id, 'system', `Starting: npm run ${script}`)

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
          this._startingProjects.delete(project.id)
          this.processes.delete(project.id)
          this.emitLog(project.id, 'system', `Error: ${error.message}`)
          this.emitStatus(project.id, 'error')
          reject(error)
        })

        // Resolve once spawned
        proc.on('spawn', () => {
          this.processes.set(project.id, proc)
          this._startingProjects.delete(project.id)
          this.emitStatus(project.id, 'running', proc.pid)
          resolve()
        })
      } catch (error) {
        this._startingProjects.delete(project.id)
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
