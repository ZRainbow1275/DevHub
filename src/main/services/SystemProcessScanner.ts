import { execFile } from 'child_process'
import { promisify } from 'util'
import kill from 'tree-kill'
import { ProcessInfo, ProcessType, ProcessStatusType, ProcessGroup, DEV_PROCESS_PATTERNS, ServiceResult } from '@shared/types-extended'
import { Project } from '@shared/types'
import { PortScanner } from './PortScanner'

const execFileAsync = promisify(execFile)

interface RawProcessInfo {
  pid: number
  name: string
  commandLine: string
  workingDir: string
  memoryMB: number
  cpuPercent: number
}

export class SystemProcessScanner {
  private processes = new Map<number, ProcessInfo>()
  private processFirstSeen = new Map<number, number>()
  private portScanner: PortScanner
  private refreshInterval: number = 5000
  private zombieThreshold: number = 3600000 // 1 hour
  private refreshTimer: NodeJS.Timeout | null = null
  private onUpdateCallback: ((processes: ProcessInfo[]) => void) | null = null
  private onZombieCallback: ((zombies: ProcessInfo[]) => void) | null = null

  constructor(portScanner?: PortScanner) {
    this.portScanner = portScanner || new PortScanner()
  }

  setRefreshInterval(interval: number): void {
    this.refreshInterval = interval
    if (this.refreshTimer) {
      this.stopAutoRefresh()
      this.startAutoRefresh()
    }
  }

  setZombieThreshold(threshold: number): void {
    this.zombieThreshold = threshold
  }

  onUpdate(callback: (processes: ProcessInfo[]) => void): void {
    this.onUpdateCallback = callback
  }

  onZombieDetected(callback: (zombies: ProcessInfo[]) => void): void {
    this.onZombieCallback = callback
  }

  startAutoRefresh(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(async () => {
      await this.scan()
    }, this.refreshInterval)
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  async scan(): Promise<ServiceResult<ProcessInfo[]>> {
    try {
      const rawProcesses = await this.getRawProcesses()
      const portInfo = await this.portScanner.scanAll()
      const portMap = new Map(portInfo.map(p => [p.pid, p.port]))

      const processes: ProcessInfo[] = []

      for (const raw of rawProcesses) {
        if (!this.isDevProcess(raw.name)) continue

        // Reuse first-seen time for this PID, or record it now
        if (!this.processFirstSeen.has(raw.pid)) {
          this.processFirstSeen.set(raw.pid, Date.now())
        }

        const processInfo: ProcessInfo = {
          pid: raw.pid,
          name: raw.name,
          command: raw.commandLine,
          port: portMap.get(raw.pid),
          cpu: raw.cpuPercent,
          memory: raw.memoryMB,
          status: this.inferStatus(raw.cpuPercent),
          startTime: this.processFirstSeen.get(raw.pid)!,
          type: this.inferType(raw.name, raw.commandLine),
          workingDir: raw.workingDir
        }

        this.processes.set(raw.pid, processInfo)
        processes.push(processInfo)
      }

      // Clean up stale entries
      const currentPids = new Set(rawProcesses.map(p => p.pid))
      for (const pid of this.processes.keys()) {
        if (!currentPids.has(pid)) {
          this.processes.delete(pid)
          this.processFirstSeen.delete(pid)
        }
      }

      // Check for zombies
      const zombies = this.findZombieProcesses()
      if (zombies.length > 0 && this.onZombieCallback) {
        this.onZombieCallback(zombies)
      }

      if (this.onUpdateCallback) {
        this.onUpdateCallback(processes)
      }

      return { success: true, data: processes }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('SystemProcessScanner.scan() failed:', err)
      return { success: false, data: [], error: errorMsg }
    }
  }

  async getAll(): Promise<ProcessInfo[]> {
    if (this.processes.size === 0) {
      await this.scan()
    }
    return Array.from(this.processes.values())
  }

  async killProcess(pid: number, force: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      const signal = force ? 'SIGKILL' : 'SIGTERM'
      kill(pid, signal, (err) => {
        if (err && !force) {
          kill(pid, 'SIGKILL', () => {
            this.processes.delete(pid)
            resolve(true)
          })
        } else {
          this.processes.delete(pid)
          resolve(!err)
        }
      })
    })
  }

  findZombieProcesses(): ProcessInfo[] {
    const now = Date.now()
    return Array.from(this.processes.values()).filter(p =>
      p.cpu < 1 &&
      now - p.startTime > this.zombieThreshold
    )
  }

  async cleanupZombies(): Promise<number> {
    const zombies = this.findZombieProcesses()
    let cleaned = 0

    for (const zombie of zombies) {
      const success = await this.killProcess(zombie.pid, true)
      if (success) cleaned++
    }

    return cleaned
  }

  groupByProject(projects: Project[]): ProcessGroup[] {
    const groups: ProcessGroup[] = []
    const processArray = Array.from(this.processes.values())
    const assigned = new Set<number>()

    for (const project of projects) {
      const projectProcesses = processArray.filter(p => {
        if (assigned.has(p.pid)) return false
        if (!p.workingDir) return false

        const normalizedWorkingDir = p.workingDir.toLowerCase().replace(/\\/g, '/')
        const normalizedProjectPath = project.path.toLowerCase().replace(/\\/g, '/')

        return normalizedWorkingDir.startsWith(normalizedProjectPath)
      })

      if (projectProcesses.length > 0) {
        projectProcesses.forEach(p => {
          p.projectId = project.id
          assigned.add(p.pid)
        })

        groups.push({
          projectId: project.id,
          projectName: project.name,
          processes: projectProcesses,
          totalCpu: projectProcesses.reduce((sum, p) => sum + p.cpu, 0),
          totalMemory: projectProcesses.reduce((sum, p) => sum + p.memory, 0)
        })
      }
    }

    // Ungrouped processes
    const ungrouped = processArray.filter(p => !assigned.has(p.pid))
    if (ungrouped.length > 0) {
      groups.push({
        projectId: '__ungrouped__',
        projectName: 'Ungrouped',
        processes: ungrouped,
        totalCpu: ungrouped.reduce((sum, p) => sum + p.cpu, 0),
        totalMemory: ungrouped.reduce((sum, p) => sum + p.memory, 0)
      })
    }

    return groups
  }

  private async getRawProcesses(): Promise<RawProcessInfo[]> {
    try {
      // TODO: Migrate from deprecated WMIC to PowerShell Get-CimInstance
      const { stdout } = await execFileAsync(
        'wmic',
        ['process', 'get', 'ProcessId,Name,CommandLine,WorkingSetSize', '/format:csv'],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
      )
      const lines = stdout.split('\n').filter(l => l.trim())

      const processes: RawProcessInfo[] = []

      // First line is header: Node,CommandLine,Name,ProcessId,WorkingSetSize
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Parse CSV - columns: Node, CommandLine, Name, ProcessId, WorkingSetSize
        // CommandLine may contain commas, so we parse from the right side first
        const parts = line.split(',')
        if (parts.length < 5) continue

        // Index 0 = Node (computer name)
        // Last field = WorkingSetSize
        // Second-to-last = ProcessId
        // Third-to-last = Name
        // Everything between index 1 and third-to-last = CommandLine (may contain commas)
        const memoryStr = parts[parts.length - 1] || '0'
        const pidStr = parts[parts.length - 2] || '0'
        const name = parts[parts.length - 3] || ''
        const commandLine = parts.slice(1, parts.length - 3).join(',') || ''

        const pid = parseInt(pidStr.trim(), 10)
        const memoryBytes = parseInt(memoryStr.trim(), 10)

        if (isNaN(pid) || pid === 0) continue

        processes.push({
          pid,
          name: name.trim() || 'Unknown',
          commandLine: commandLine.trim(),
          workingDir: this.extractWorkingDir(commandLine),
          memoryMB: Math.round(memoryBytes / 1024 / 1024),
          cpuPercent: 0 // Will be updated separately if needed
        })
      }

      return processes
    } catch (err) {
      console.error('WMIC process enumeration failed:', err instanceof Error ? err.message : err)
      return []
    }
  }

  private isDevProcess(name: string): boolean {
    const lowerName = name.toLowerCase()
    return DEV_PROCESS_PATTERNS.some(pattern =>
      lowerName.includes(pattern.toLowerCase())
    )
  }

  private inferType(name: string, command: string): ProcessType {
    const lowerName = name.toLowerCase()
    const lowerCmd = command.toLowerCase()

    if (lowerCmd.includes('codex') || lowerCmd.includes('claude') || lowerCmd.includes('gemini')) {
      return 'ai-tool'
    }
    if (lowerCmd.includes('dev') || lowerCmd.includes('serve') || lowerCmd.includes('start')) {
      return 'dev-server'
    }
    if (lowerCmd.includes('build') || lowerCmd.includes('compile')) {
      return 'build'
    }
    if (lowerName.includes('redis') || lowerName.includes('mongo') || lowerName.includes('postgres')) {
      return 'database'
    }

    return 'other'
  }

  private inferStatus(cpu: number): ProcessStatusType {
    if (cpu > 5) return 'running'
    if (cpu > 0) return 'idle'
    return 'waiting'
  }

  private extractWorkingDir(commandLine: string): string {
    // Try to extract working directory from command line
    const cdMatch = commandLine.match(/cd\s+["']?([^"'&]+)["']?/i)
    if (cdMatch) return cdMatch[1].trim()

    // Look for common project path patterns
    const pathMatch = commandLine.match(/([A-Z]:[/\\][^"'\s]+(?:node_modules|src|dist)?)/i)
    if (pathMatch) return pathMatch[1]

    return ''
  }
}
