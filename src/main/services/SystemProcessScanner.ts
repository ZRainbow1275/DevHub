import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import kill from 'tree-kill'
import { ProcessInfo, ProcessType, ProcessStatusType, ProcessGroup, DEV_PROCESS_PATTERNS, ServiceResult, isProtectedProcess } from '@shared/types-extended'
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
  private previousCpuTimes = new Map<number, number>()
  private lastCpuSampleTime: number = 0
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
    // Protected process check
    const proc = this.processes.get(pid)
    if (proc && isProtectedProcess(proc.name)) {
      console.warn(`Refused to kill protected process: ${proc.name} (PID ${pid})`)
      return false
    }

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
      p.cpu < 0.5 &&
      p.memory < 10 && // MB
      (now - p.startTime) > this.zombieThreshold &&
      !isProtectedProcess(p.name) &&
      this.isDevServerProcess(p.name, p.command)
    )
  }

  async cleanupZombies(): Promise<number> {
    const zombies = this.findZombieProcesses()
    let cleaned = 0

    for (const zombie of zombies) {
      // Graceful: SIGTERM first
      const terminated = await this.killProcess(zombie.pid, false)
      if (terminated) {
        cleaned++
        continue
      }
      // Wait 5s then force kill if still alive
      await new Promise(r => setTimeout(r, 5000))
      if (this.isProcessAlive(zombie.pid)) {
        const forced = await this.killProcess(zombie.pid, true)
        if (forced) cleaned++
      } else {
        this.processes.delete(zombie.pid)
        cleaned++
      }
    }

    return cleaned
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
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
      const psCmd = `Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine,WorkingSetSize | ConvertTo-Csv -NoTypeInformation`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
      )
      const lines = stdout.split('\n').filter(l => l.trim())
      const processes: RawProcessInfo[] = []

      // First line is CSV header: "ProcessId","Name","CommandLine","WorkingSetSize"
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Parse CSV with quoted fields
        const fields = this.parseCsvLine(line)
        if (fields.length < 4) continue

        const pid = parseInt(fields[0], 10)
        const name = fields[1] || 'Unknown'
        const commandLine = fields[2] || ''
        const memoryBytes = parseInt(fields[3], 10) || 0

        if (isNaN(pid) || pid === 0) continue

        processes.push({
          pid,
          name,
          commandLine,
          workingDir: this.extractWorkingDir(commandLine),
          memoryMB: Math.round(memoryBytes / 1024 / 1024),
          cpuPercent: 0 // Will be filled by measureCpuUsage
        })
      }

      // Measure CPU for dev processes only (to limit overhead)
      const devPids = processes
        .filter(p => this.isDevProcess(p.name))
        .map(p => p.pid)

      if (devPids.length > 0) {
        const cpuMap = await this.measureCpuUsage(devPids)
        for (const proc of processes) {
          const cpu = cpuMap.get(proc.pid)
          if (cpu !== undefined) {
            proc.cpuPercent = cpu
          }
        }
      }

      return processes
    } catch (err) {
      console.error('Process enumeration failed:', err instanceof Error ? err.message : err)
      return []
    }
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  }

  private async measureCpuUsage(pids: number[]): Promise<Map<number, number>> {
    const cpuMap = new Map<number, number>()
    const numCores = os.cpus().length

    try {
      // Get current CPU times for all target PIDs
      const currentCpuTimes = await this.getCpuTimes(pids)
      const now = Date.now()

      if (this.lastCpuSampleTime > 0) {
        const elapsedSec = (now - this.lastCpuSampleTime) / 1000
        if (elapsedSec > 0) {
          for (const pid of pids) {
            const currentTime = currentCpuTimes.get(pid)
            const previousTime = this.previousCpuTimes.get(pid)

            if (currentTime !== undefined && previousTime !== undefined) {
              const deltaCpu = currentTime - previousTime
              const cpuPercent = (deltaCpu / elapsedSec / numCores) * 100
              cpuMap.set(pid, Math.max(0, Math.round(cpuPercent * 10) / 10))
            }
          }
        }
      }

      // Store current values for next cycle
      this.previousCpuTimes = currentCpuTimes
      this.lastCpuSampleTime = now

      // Clean up PIDs that no longer exist
      const pidSet = new Set(pids)
      for (const pid of this.previousCpuTimes.keys()) {
        if (!pidSet.has(pid)) {
          this.previousCpuTimes.delete(pid)
        }
      }
    } catch (err) {
      console.error('CPU measurement failed:', err instanceof Error ? err.message : err)
    }

    return cpuMap
  }

  private async getCpuTimes(pids: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>()

    try {
      // Batch query: get CPU (total processor time in seconds) for all PIDs
      const pidList = pids.join(',')
      const psCmd = `${pidList} | ForEach-Object { try { $p = Get-Process -Id $_ -ErrorAction SilentlyContinue; if($p) { Write-Output "$($_.ToString())=$($p.TotalProcessorTime.TotalSeconds)" } } catch {} }`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, timeout: 10000 }
      )

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue

        const pid = parseInt(trimmed.substring(0, eqIdx), 10)
        const cpuTime = parseFloat(trimmed.substring(eqIdx + 1))

        if (!isNaN(pid) && !isNaN(cpuTime)) {
          result.set(pid, cpuTime)
        }
      }
    } catch (err) {
      console.error('getCpuTimes failed:', err instanceof Error ? err.message : err)
    }

    return result
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

  private isDevServerProcess(name: string, cmd: string): boolean {
    const devRuntimes = ['node.exe', 'python.exe', 'ruby.exe', 'java.exe']
    const serverKeywords = ['dev', 'serve', 'start', 'watch', 'run']
    return devRuntimes.some(r => name.toLowerCase().includes(r)) &&
           serverKeywords.some(k => cmd.toLowerCase().includes(k))
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
