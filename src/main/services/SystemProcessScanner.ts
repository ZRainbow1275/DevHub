import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import kill from 'tree-kill'
import { ProcessInfo, ProcessInfoExtended, ProcessRelationship, ProcessType, ProcessStatusType, ProcessGroup, DEV_PROCESS_PATTERNS, ServiceResult, isProtectedProcess, PortInfo, WindowInfo, ProcessDeepDetail, NetworkConnectionInfo, ProcessTreeNode, RelatedProcessInfo, ProcessPriority } from '@shared/types-extended'
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

  // History tracking for sparklines (max 30 samples = 60 seconds at 2s interval)
  private cpuHistoryMap = new Map<number, number[]>()
  private memoryHistoryMap = new Map<number, number[]>()
  private static readonly HISTORY_MAX_SAMPLES = 30

  // Callback for window info resolution (injected from handlers)
  private getWindowsForPid: ((pid: number) => WindowInfo[]) | null = null

  constructor(portScanner?: PortScanner) {
    this.portScanner = portScanner || new PortScanner()
  }

  setWindowResolver(resolver: (pid: number) => WindowInfo[]): void {
    this.getWindowsForPid = resolver
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

  private _autoScanning = false

  startAutoRefresh(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(async () => {
      if (this._autoScanning) return // prevent overlapping scans
      this._autoScanning = true
      try {
        await this.scan()
      } catch (err) {
        console.error('SystemProcessScanner: auto-refresh error:', err instanceof Error ? err.message : err)
      } finally {
        this._autoScanning = false
      }
    }, this.refreshInterval)
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * Release all resources — call on app exit.
   */
  cleanup(): void {
    this.stopAutoRefresh()
    this.processes.clear()
    this.processFirstSeen.clear()
    this.previousCpuTimes.clear()
    this.cpuHistoryMap.clear()
    this.memoryHistoryMap.clear()
    this.onUpdateCallback = null
    this.onZombieCallback = null
    this.getWindowsForPid = null
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

        // Track CPU/Memory history for sparklines
        const cpuHistory = this.cpuHistoryMap.get(raw.pid) || []
        cpuHistory.push(raw.cpuPercent)
        if (cpuHistory.length > SystemProcessScanner.HISTORY_MAX_SAMPLES) {
          cpuHistory.shift()
        }
        this.cpuHistoryMap.set(raw.pid, cpuHistory)

        const memHistory = this.memoryHistoryMap.get(raw.pid) || []
        memHistory.push(raw.memoryMB)
        if (memHistory.length > SystemProcessScanner.HISTORY_MAX_SAMPLES) {
          memHistory.shift()
        }
        this.memoryHistoryMap.set(raw.pid, memHistory)
      }

      // Clean up stale entries
      const currentPids = new Set(rawProcesses.map(p => p.pid))
      for (const pid of this.processes.keys()) {
        if (!currentPids.has(pid)) {
          this.processes.delete(pid)
          this.processFirstSeen.delete(pid)
          this.cpuHistoryMap.delete(pid)
          this.memoryHistoryMap.delete(pid)
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
    if (!proc) return false
    if (isProtectedProcess(proc.name)) {
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

  async getProcessTree(pid: number): Promise<ProcessInfo[]> {
    if (!Number.isInteger(pid) || pid <= 0) return []
    try {
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${pid} } | Select-Object ProcessId,Name,CommandLine,WorkingSetSize | ConvertTo-Csv -NoTypeInformation`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8', timeout: 15000 }
      )

      const lines = stdout.split('\n').filter(l => l.trim())
      const children: ProcessInfo[] = []

      // First line is CSV header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const fields = this.parseCsvLine(line)
        if (fields.length < 4) continue

        const childPid = parseInt(fields[0], 10)
        const name = fields[1] || 'Unknown'
        const commandLine = fields[2] || ''
        const memoryBytes = parseInt(fields[3], 10) || 0

        if (isNaN(childPid) || childPid === 0) continue

        children.push({
          pid: childPid,
          name,
          command: commandLine,
          cpu: 0,
          memory: Math.round(memoryBytes / 1024 / 1024),
          status: 'running',
          startTime: Date.now(),
          type: this.inferType(name, commandLine),
          workingDir: this.extractWorkingDir(commandLine)
        })
      }

      return children
    } catch (err) {
      console.error('getProcessTree failed:', err instanceof Error ? err.message : err)
      return []
    }
  }

  /**
   * Get CPU/memory history for a process (for sparkline display).
   */
  getProcessHistory(pid: number): { cpuHistory: number[]; memoryHistory: number[] } {
    return {
      cpuHistory: this.cpuHistoryMap.get(pid) || [],
      memoryHistory: this.memoryHistoryMap.get(pid) || []
    }
  }

  /**
   * Get full relationship for a given PID: ancestors, children, descendants,
   * siblings, related ports, and related windows.
   */
  async getFullRelationship(pid: number): Promise<ProcessRelationship | null> {
    if (!Number.isInteger(pid) || pid <= 0) return null

    try {
      // Single PowerShell call to get all process info at once
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,WorkingSetSize,ThreadCount,HandleCount,Priority,@{N='User';E={try{($_ | Invoke-CimMethod -MethodName GetOwner).User}catch{''}}} | ConvertTo-Csv -NoTypeInformation`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', timeout: 30000 }
      )

      const lines = stdout.split('\n').filter(l => l.trim())
      interface FullProcInfo {
        pid: number
        ppid: number
        name: string
        commandLine: string
        memoryMB: number
        threadCount: number
        handleCount: number
        priority: number
        userName: string
      }

      const allProcs = new Map<number, FullProcInfo>()

      // Parse CSV (skip header line)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const fields = this.parseCsvLine(line)
        if (fields.length < 9) continue

        const procPid = parseInt(fields[0], 10)
        const ppid = parseInt(fields[1], 10)
        const name = fields[2] || 'Unknown'
        const commandLine = fields[3] || ''
        const memoryBytes = parseInt(fields[4], 10) || 0
        const threadCount = parseInt(fields[5], 10) || 0
        const handleCount = parseInt(fields[6], 10) || 0
        const priority = parseInt(fields[7], 10) || 0
        const userName = fields[8] || ''

        if (isNaN(procPid) || procPid === 0) continue

        allProcs.set(procPid, {
          pid: procPid,
          ppid: isNaN(ppid) ? 0 : ppid,
          name,
          commandLine,
          memoryMB: Math.round(memoryBytes / 1024 / 1024),
          threadCount,
          handleCount,
          priority,
          userName
        })
      }

      const target = allProcs.get(pid)
      if (!target) return null

      // Helper: convert FullProcInfo to ProcessInfo
      const toProcessInfo = (fp: FullProcInfo): ProcessInfo => {
        const existing = this.processes.get(fp.pid)
        return existing || {
          pid: fp.pid,
          name: fp.name,
          command: fp.commandLine,
          cpu: 0,
          memory: fp.memoryMB,
          status: 'running' as ProcessStatusType,
          startTime: this.processFirstSeen.get(fp.pid) || Date.now(),
          type: this.inferType(fp.name, fp.commandLine),
          workingDir: this.extractWorkingDir(fp.commandLine)
        }
      }

      // Build ancestors chain (walk up parent pointers)
      const ancestors: ProcessInfo[] = []
      let currentPpid = target.ppid
      const visited = new Set<number>([pid])
      while (currentPpid > 0 && !visited.has(currentPpid)) {
        visited.add(currentPpid)
        const parent = allProcs.get(currentPpid)
        if (!parent) break
        ancestors.push(toProcessInfo(parent))
        currentPpid = parent.ppid
      }
      ancestors.reverse() // root first

      // Build direct children
      const children: ProcessInfo[] = []
      const childPids: number[] = []
      for (const [, proc] of allProcs) {
        if (proc.ppid === pid && proc.pid !== pid) {
          children.push(toProcessInfo(proc))
          childPids.push(proc.pid)
        }
      }

      // Build all descendants (recursive BFS)
      const descendants: ProcessInfo[] = []
      const queue = [...childPids]
      const descendantVisited = new Set<number>(childPids)
      while (queue.length > 0) {
        const currentPid = queue.shift()!
        const proc = allProcs.get(currentPid)
        if (proc) {
          descendants.push(toProcessInfo(proc))
          for (const [, child] of allProcs) {
            if (child.ppid === currentPid && !descendantVisited.has(child.pid)) {
              descendantVisited.add(child.pid)
              queue.push(child.pid)
            }
          }
        }
      }

      // Build siblings (same parent, excluding self)
      const siblings: ProcessInfo[] = []
      const siblingPids: number[] = []
      if (target.ppid > 0) {
        for (const [, proc] of allProcs) {
          if (proc.ppid === target.ppid && proc.pid !== pid) {
            siblings.push(toProcessInfo(proc))
            siblingPids.push(proc.pid)
          }
        }
      }

      // Get related ports (self + all descendants)
      const relatedPidSet = new Set([pid, ...childPids, ...descendants.map(d => d.pid)])
      const allPorts = await this.portScanner.scanAll()
      const relatedPorts: PortInfo[] = allPorts.filter(p => relatedPidSet.has(p.pid))

      // Get related windows
      const relatedWindows: WindowInfo[] = []
      if (this.getWindowsForPid) {
        for (const relPid of relatedPidSet) {
          relatedWindows.push(...this.getWindowsForPid(relPid))
        }
      }

      // Get ports bound to this specific process
      const selfPorts = allPorts.filter(p => p.pid === pid).map(p => p.port)

      // Build ProcessInfoExtended for self
      const existingSelf = this.processes.get(pid)
      const selfExtended: ProcessInfoExtended = {
        pid: target.pid,
        name: target.name,
        command: existingSelf?.command || target.commandLine,
        port: existingSelf?.port,
        cpu: existingSelf?.cpu || 0,
        memory: existingSelf?.memory || target.memoryMB,
        status: existingSelf?.status || 'running',
        startTime: existingSelf?.startTime || (this.processFirstSeen.get(pid) || Date.now()),
        type: existingSelf?.type || this.inferType(target.name, target.commandLine),
        workingDir: existingSelf?.workingDir || this.extractWorkingDir(target.commandLine),
        projectId: existingSelf?.projectId,
        ppid: target.ppid,
        parentName: target.ppid > 0 ? allProcs.get(target.ppid)?.name : undefined,
        childPids,
        siblingPids,
        threadCount: target.threadCount,
        handleCount: target.handleCount,
        ports: selfPorts,
        relatedWindowHwnds: relatedWindows.filter(w => w.pid === pid).map(w => w.hwnd),
        cpuHistory: this.cpuHistoryMap.get(pid) || [],
        memoryHistory: this.memoryHistoryMap.get(pid) || [],
        commandLine: target.commandLine,
        userName: target.userName || undefined,
        priority: target.priority || undefined
      }

      return {
        ancestors,
        self: selfExtended,
        children,
        descendants,
        siblings,
        relatedPorts,
        relatedWindows
      }
    } catch (err) {
      console.error('getFullRelationship failed:', err instanceof Error ? err.message : err)
      return null
    }
  }

  /**
   * Get deep detail for a single process (Layer 2 — on-demand).
   * Uses PowerShell + WMI to gather comprehensive info.
   * C# 5 compatible syntax (no `out _`, no pattern matching).
   */
  async getProcessDeepDetail(pid: number): Promise<ProcessDeepDetail | null> {
    if (!Number.isInteger(pid) || pid <= 0) return null

    try {
      // Single PowerShell call to collect process info, connections, and tree
      const sanitizedPid = Math.floor(pid)
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference = 'SilentlyContinue'
$result = @{}
$p = Get-Process -Id ${sanitizedPid} -ErrorAction SilentlyContinue
$w = Get-CimInstance Win32_Process -Filter "ProcessId=${sanitizedPid}" -ErrorAction SilentlyContinue
if ($p -and $w) {
  $ownerResult = Invoke-CimMethod -InputObject $w -MethodName GetOwner -ErrorAction SilentlyContinue
  $result.pid = $w.ProcessId
  $result.name = $w.Name
  $result.executablePath = if ($p.Path) { $p.Path } else { $w.ExecutablePath }
  $result.commandLine = $w.CommandLine
  $result.workingDirectory = if ($w.ExecutablePath) { Split-Path $w.ExecutablePath -Parent } else { '' }
  $result.startTime = if ($p.StartTime) { $p.StartTime.ToString('o') } else { '' }
  $result.userName = if ($ownerResult -and $ownerResult.User) { $ownerResult.User } else { '' }
  $result.threadCount = if ($p.Threads) { $p.Threads.Count } else { 0 }
  $result.handleCount = if ($p.HandleCount) { $p.HandleCount } else { 0 }
  $result.memoryRSS = if ($p.WorkingSet64) { $p.WorkingSet64 } else { 0 }
  $result.memoryVMS = if ($p.VirtualMemorySize64) { $p.VirtualMemorySize64 } else { 0 }
  $result.cpuPercent = 0
  $result.requiresElevation = $false
  $ioCounters = $p.PrivilegedProcessorTime
  $result.ioReadBytes = 0
  $result.ioWriteBytes = 0
  try {
    $counters = $w | Select-Object ReadTransferCount, WriteTransferCount
    if ($counters) {
      $result.ioReadBytes = if ($counters.ReadTransferCount) { $counters.ReadTransferCount } else { 0 }
      $result.ioWriteBytes = if ($counters.WriteTransferCount) { $counters.WriteTransferCount } else { 0 }
    }
  } catch {}
} else {
  $result.requiresElevation = $true
  $result.pid = ${sanitizedPid}
  $result.name = ''
}
$result | ConvertTo-Json -Depth 3`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8', timeout: 15000 }
      )

      let info: Record<string, unknown>
      try {
        info = JSON.parse(stdout.trim())
      } catch {
        console.error('getProcessDeepDetail: Failed to parse JSON output')
        return null
      }

      if (info.requiresElevation === true && !info.name) {
        return {
          pid: sanitizedPid,
          name: '',
          executablePath: '',
          commandLine: '',
          workingDirectory: '',
          scriptPath: null,
          startTime: '',
          userName: '',
          cpuPercent: 0,
          cpuHistory: this.cpuHistoryMap.get(sanitizedPid) || [],
          memoryRSS: 0,
          memoryVMS: 0,
          threadCount: 0,
          handleCount: 0,
          ioReadBytes: 0,
          ioWriteBytes: 0,
          networkConnections: [],
          loadedModules: [],
          environmentVariables: {},
          ancestorChain: [],
          children: [],
          relatedProcesses: [],
          requiresElevation: true,
        }
      }

      // Resolve script path for interpreter processes
      const processName = String(info.name || '')
      const cmdLine = String(info.commandLine || '')
      const scriptPath = this.resolveScriptPath(processName, cmdLine)

      // Get existing CPU data from cache
      const existingCpu = this.processes.get(sanitizedPid)?.cpu || 0

      // Build tree data from relationship
      const treeData = await this.buildTreeForDetail(sanitizedPid)

      // Get network connections separately
      const connections = await this.getProcessConnections(sanitizedPid)

      // Get related processes (port-shared)
      const relatedProcesses = await this.getRelatedProcesses(sanitizedPid)

      return {
        pid: sanitizedPid,
        name: processName,
        executablePath: String(info.executablePath || ''),
        commandLine: cmdLine,
        workingDirectory: String(info.workingDirectory || ''),
        scriptPath,
        startTime: String(info.startTime || ''),
        userName: String(info.userName || ''),
        cpuPercent: existingCpu,
        cpuHistory: this.cpuHistoryMap.get(sanitizedPid) || [],
        memoryRSS: Math.round(Number(info.memoryRSS || 0) / 1024 / 1024),
        memoryVMS: Math.round(Number(info.memoryVMS || 0) / 1024 / 1024),
        threadCount: Number(info.threadCount || 0),
        handleCount: Number(info.handleCount || 0),
        ioReadBytes: Number(info.ioReadBytes || 0),
        ioWriteBytes: Number(info.ioWriteBytes || 0),
        networkConnections: connections,
        loadedModules: [], // Modules are expensive; leave empty unless explicitly requested
        environmentVariables: {}, // Fetched separately via getProcessEnvironment
        ancestorChain: treeData.ancestors,
        children: treeData.children,
        relatedProcesses,
        requiresElevation: false,
      }
    } catch (err) {
      console.error('getProcessDeepDetail failed:', err instanceof Error ? err.message : err)
      return null
    }
  }

  /**
   * Get network connections for a specific process.
   */
  async getProcessConnections(pid: number): Promise<NetworkConnectionInfo[]> {
    if (!Number.isInteger(pid) || pid <= 0) return []

    try {
      const sanitizedPid = Math.floor(pid)
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference = 'SilentlyContinue'
$conns = @()
$tcp = Get-NetTCPConnection -OwningProcess ${sanitizedPid} -ErrorAction SilentlyContinue
if ($tcp) {
  foreach ($c in $tcp) {
    $conns += @{
      protocol = 'TCP'
      localAddress = $c.LocalAddress
      localPort = $c.LocalPort
      remoteAddress = $c.RemoteAddress
      remotePort = $c.RemotePort
      state = $c.State.ToString()
    }
  }
}
$udp = Get-NetUDPEndpoint -OwningProcess ${sanitizedPid} -ErrorAction SilentlyContinue
if ($udp) {
  foreach ($u in $udp) {
    $conns += @{
      protocol = 'UDP'
      localAddress = $u.LocalAddress
      localPort = $u.LocalPort
      remoteAddress = '*'
      remotePort = 0
      state = 'LISTENING'
    }
  }
}
$conns | ConvertTo-Json -Depth 2`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', timeout: 10000 }
      )

      const trimmed = stdout.trim()
      if (!trimmed || trimmed === '' || trimmed === 'null') return []

      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        return []
      }

      // PowerShell returns single object (not array) when there's only one result
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
      return items
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map(item => ({
          protocol: String(item.protocol || 'TCP') as 'TCP' | 'UDP',
          localAddress: String(item.localAddress || ''),
          localPort: Number(item.localPort || 0),
          remoteAddress: String(item.remoteAddress || ''),
          remotePort: Number(item.remotePort || 0),
          state: String(item.state || 'UNKNOWN'),
        }))
    } catch (err) {
      console.error('getProcessConnections failed:', err instanceof Error ? err.message : err)
      return []
    }
  }

  /**
   * Get environment variables for a process.
   * Note: May require elevation for some processes.
   */
  async getProcessEnvironment(pid: number): Promise<{ variables: Record<string, string>; requiresElevation: boolean }> {
    if (!Number.isInteger(pid) || pid <= 0) return { variables: {}, requiresElevation: false }

    try {
      const sanitizedPid = Math.floor(pid)
      // Use WMI to get environment block — works for current user's processes
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ requiresElevation = $false; variables = @{} }
try {
  $p = Get-Process -Id ${sanitizedPid} -ErrorAction Stop
  $envBlock = $p.StartInfo.EnvironmentVariables
  if ($envBlock -and $envBlock.Count -gt 0) {
    foreach ($key in $envBlock.Keys) {
      $result.variables[$key] = $envBlock[$key]
    }
  } else {
    $envBlock2 = [System.Environment]::GetEnvironmentVariables()
    foreach ($key in $envBlock2.Keys) {
      $result.variables[$key] = $envBlock2[$key]
    }
    $result.requiresElevation = $true
  }
} catch {
  $result.requiresElevation = $true
}
$result | ConvertTo-Json -Depth 3 -Compress`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8', timeout: 10000 }
      )

      const trimmed = stdout.trim()
      if (!trimmed) return { variables: {}, requiresElevation: true }

      try {
        const parsed = JSON.parse(trimmed) as { variables?: Record<string, string>; requiresElevation?: boolean }
        return {
          variables: parsed.variables || {},
          requiresElevation: Boolean(parsed.requiresElevation),
        }
      } catch {
        return { variables: {}, requiresElevation: true }
      }
    } catch (err) {
      console.error('getProcessEnvironment failed:', err instanceof Error ? err.message : err)
      return { variables: {}, requiresElevation: true }
    }
  }

  /**
   * Get loaded modules/DLLs for a process.
   * Returns a list of module names, paths, and sizes.
   * May require elevation for some processes.
   */
  async getLoadedModules(pid: number): Promise<{ modules: import('@shared/types-extended').LoadedModuleInfo[]; requiresElevation: boolean }> {
    if (!Number.isInteger(pid) || pid <= 0) return { modules: [], requiresElevation: false }

    try {
      const sanitizedPid = Math.floor(pid)
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ requiresElevation = $false; modules = @() }
try {
  $p = Get-Process -Id ${sanitizedPid} -ErrorAction Stop
  $mods = $p.Modules
  if ($mods) {
    foreach ($m in $mods) {
      $result.modules += @{
        name = if ($m.ModuleName) { $m.ModuleName } else { '' }
        path = if ($m.FileName) { $m.FileName } else { '' }
        sizeKB = if ($m.ModuleMemorySize) { [math]::Round($m.ModuleMemorySize / 1024, 1) } else { 0 }
      }
    }
  }
} catch {
  $result.requiresElevation = $true
}
$result | ConvertTo-Json -Depth 3 -Compress`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8', timeout: 15000 }
      )

      const trimmed = stdout.trim()
      if (!trimmed) return { modules: [], requiresElevation: true }

      try {
        const parsed = JSON.parse(trimmed) as { modules?: Array<Record<string, unknown>>; requiresElevation?: boolean }
        const modules = (parsed.modules || []).map(m => ({
          name: String(m.name || ''),
          path: String(m.path || ''),
          sizeKB: Number(m.sizeKB || 0),
        }))
        return {
          modules,
          requiresElevation: Boolean(parsed.requiresElevation),
        }
      } catch {
        return { modules: [], requiresElevation: true }
      }
    } catch (err) {
      console.error('getLoadedModules failed:', err instanceof Error ? err.message : err)
      return { modules: [], requiresElevation: true }
    }
  }

  /**
   * Kill an entire process tree using tree-kill.
   */
  async killProcessTree(pid: number): Promise<boolean> {
    if (!Number.isInteger(pid) || pid <= 0) return false

    const proc = this.processes.get(pid)
    if (proc && isProtectedProcess(proc.name)) {
      console.warn(`Refused to kill protected process tree: ${proc.name} (PID ${pid})`)
      return false
    }

    return new Promise((resolve) => {
      kill(pid, 'SIGKILL', (err) => {
        if (err) {
          console.error('killProcessTree failed:', err)
          resolve(false)
        } else {
          this.processes.delete(pid)
          this.cpuHistoryMap.delete(pid)
          this.memoryHistoryMap.delete(pid)
          resolve(true)
        }
      })
    })
  }

  /**
   * Set process priority via PowerShell. C# 5 compatible.
   */
  async setProcessPriority(pid: number, priority: ProcessPriority): Promise<boolean> {
    if (!Number.isInteger(pid) || pid <= 0) return false

    const validPriorities: Record<ProcessPriority, string> = {
      'Idle': 'Idle',
      'BelowNormal': 'BelowNormal',
      'Normal': 'Normal',
      'AboveNormal': 'AboveNormal',
      'High': 'High',
      'RealTime': 'RealTime',
    }

    const psPriority = validPriorities[priority]
    if (!psPriority) return false

    try {
      const sanitizedPid = Math.floor(pid)
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$p = Get-Process -Id ${sanitizedPid} -ErrorAction Stop
$p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::${psPriority}
Write-Output 'OK'`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 1024 * 1024, encoding: 'utf8', timeout: 10000 }
      )

      return stdout.trim().includes('OK')
    } catch (err) {
      console.error('setProcessPriority failed:', err instanceof Error ? err.message : err)
      return false
    }
  }

  /**
   * Build ancestor/children tree for the detail view.
   */
  private async buildTreeForDetail(pid: number): Promise<{ ancestors: ProcessTreeNode[]; children: ProcessTreeNode[] }> {
    try {
      // Build ancestors chain
      const ancestors: ProcessTreeNode[] = []
      // We need PPID data — use WMI to get the full process table
      const sanitizedPid = Math.floor(pid)
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize | ConvertTo-Csv -NoTypeInformation`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', timeout: 15000 }
      )

      const lines = stdout.split('\n').filter(l => l.trim())
      const procMap = new Map<number, { pid: number; ppid: number; name: string; memoryMB: number }>()

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const fields = this.parseCsvLine(line)
        if (fields.length < 4) continue
        const procPid = parseInt(fields[0], 10)
        const ppid = parseInt(fields[1], 10)
        if (isNaN(procPid) || procPid === 0) continue
        procMap.set(procPid, {
          pid: procPid,
          ppid: isNaN(ppid) ? 0 : ppid,
          name: fields[2] || 'Unknown',
          memoryMB: Math.round((parseInt(fields[3], 10) || 0) / 1024 / 1024),
        })
      }

      // Walk up ancestor chain
      const target = procMap.get(sanitizedPid)
      if (target) {
        let currentPpid = target.ppid
        const visited = new Set<number>([sanitizedPid])
        while (currentPpid > 0 && !visited.has(currentPpid)) {
          visited.add(currentPpid)
          const parent = procMap.get(currentPpid)
          if (!parent) break
          const existingProc = this.processes.get(parent.pid)
          ancestors.unshift({
            pid: parent.pid,
            name: parent.name,
            cpuPercent: existingProc?.cpu || 0,
            memoryMB: existingProc?.memory || parent.memoryMB,
          })
          currentPpid = parent.ppid
        }
      }

      // Collect direct children recursively
      const collectChildren = (parentPid: number, depth: number): ProcessTreeNode[] => {
        if (depth > 5) return [] // prevent infinite recursion
        const result: ProcessTreeNode[] = []
        for (const [, proc] of procMap) {
          if (proc.ppid === parentPid && proc.pid !== parentPid) {
            const existingProc = this.processes.get(proc.pid)
            result.push({
              pid: proc.pid,
              name: proc.name,
              cpuPercent: existingProc?.cpu || 0,
              memoryMB: existingProc?.memory || proc.memoryMB,
              children: collectChildren(proc.pid, depth + 1),
            })
          }
        }
        return result
      }

      const children = collectChildren(sanitizedPid, 0)

      return { ancestors, children }
    } catch (err) {
      console.error('buildTreeForDetail failed:', err instanceof Error ? err.message : err)
      return { ancestors: [], children: [] }
    }
  }

  /**
   * Get processes related via shared ports.
   */
  private async getRelatedProcesses(pid: number): Promise<RelatedProcessInfo[]> {
    try {
      const allPorts = await this.portScanner.scanAll()
      const targetPorts = allPorts.filter(p => p.pid === pid).map(p => p.port)
      if (targetPorts.length === 0) return []

      const related: RelatedProcessInfo[] = []
      const seen = new Set<number>()

      for (const portEntry of allPorts) {
        if (portEntry.pid !== pid && targetPorts.includes(portEntry.port) && !seen.has(portEntry.pid)) {
          seen.add(portEntry.pid)
          const proc = this.processes.get(portEntry.pid)
          related.push({
            pid: portEntry.pid,
            name: proc?.name || portEntry.processName || 'unknown',
            relation: 'shared_port',
            detail: `共享端口 :${portEntry.port}`,
          })
        }
      }

      return related
    } catch {
      return []
    }
  }

  /**
   * Resolve script path for interpreter processes.
   */
  private resolveScriptPath(name: string, commandLine: string): string | null {
    const lowerName = name.toLowerCase()

    const interpreters: Array<{ match: string; pattern: RegExp }> = [
      { match: 'node', pattern: /node(?:\.exe)?\s+(.+?)(?:\s+--|$)/ },
      { match: 'python', pattern: /python(?:\d)?(?:\.exe)?\s+(?:-m\s+)?(.+?)(?:\s+--|$)/ },
      { match: 'java', pattern: /java(?:\.exe)?.*?(?:-jar\s+)?(\S+\.jar)/ },
      { match: 'ruby', pattern: /ruby(?:\.exe)?\s+(.+?)(?:\s+--|$)/ },
    ]

    for (const { match, pattern } of interpreters) {
      if (lowerName.includes(match)) {
        const result = commandLine.match(pattern)
        if (result && result[1]) return result[1].trim()
      }
    }

    return null
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
      // Single PowerShell call: Get-CimInstance Win32_Process returns KernelModeTime + UserModeTime
      // (100-nanosecond units) alongside process info, eliminating the need for a second Get-Process call
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine,WorkingSetSize,KernelModeTime,UserModeTime | ConvertTo-Csv -NoTypeInformation`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', timeout: 30000 }
      )
      const lines = stdout.split('\n').filter(l => l.trim())
      const processes: RawProcessInfo[] = []
      // Collect CPU times from this single query for dev processes
      const currentCpuTimes = new Map<number, number>()

      // First line is CSV header: "ProcessId","Name","CommandLine","WorkingSetSize","KernelModeTime","UserModeTime"
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

        // KernelModeTime and UserModeTime are in 100-nanosecond units
        // Convert to seconds for CPU delta calculation
        // Handle locale: some locales use comma as decimal separator
        const kernelTimeRaw = (fields[4] || '0').replace(',', '.')
        const userTimeRaw = (fields[5] || '0').replace(',', '.')
        const kernelTime = parseFloat(kernelTimeRaw) || 0
        const userTime = parseFloat(userTimeRaw) || 0
        // Convert 100-nanosecond units to seconds
        const totalCpuSeconds = (kernelTime + userTime) / 10_000_000

        const isDev = this.isDevProcess(name)
        if (isDev) {
          currentCpuTimes.set(pid, totalCpuSeconds)
        }

        processes.push({
          pid,
          name,
          commandLine,
          workingDir: this.extractWorkingDir(commandLine),
          memoryMB: Math.round(memoryBytes / 1024 / 1024),
          cpuPercent: 0 // Will be filled by CPU delta calculation below
        })
      }

      // Calculate CPU usage from delta between current and previous samples
      if (currentCpuTimes.size > 0) {
        const cpuMap = this.calculateCpuFromDelta(currentCpuTimes)
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

  /**
   * Calculate CPU usage percentage from delta between current and previous CPU time samples.
   *
   * Cold start handling: On first call (lastCpuSampleTime === 0), we store the current
   * samples but return an empty map (no delta data yet). The second call will have
   * valid delta data and return real CPU percentages.
   *
   * This replaces the previous two-method approach (measureCpuUsage + getCpuTimes)
   * that required a separate PowerShell process for Get-Process. CPU times are now
   * obtained directly from Win32_Process KernelModeTime + UserModeTime fields.
   */
  private calculateCpuFromDelta(currentCpuTimes: Map<number, number>): Map<number, number> {
    const cpuMap = new Map<number, number>()
    const numCores = os.cpus().length
    const now = Date.now()

    if (this.lastCpuSampleTime > 0 && currentCpuTimes.size > 0) {
      const elapsedSec = (now - this.lastCpuSampleTime) / 1000
      if (elapsedSec > 0) {
        for (const [pid, currentTime] of currentCpuTimes) {
          const previousTime = this.previousCpuTimes.get(pid)

          if (previousTime !== undefined) {
            const deltaCpu = currentTime - previousTime
            const cpuPercent = (deltaCpu / elapsedSec / numCores) * 100
            cpuMap.set(pid, Math.max(0, Math.round(cpuPercent * 10) / 10))
          }
          // If no previousTime, this PID is new — it will get data on the next cycle
        }
      }
    }

    // Always store current values for next cycle, even on first call (cold start fix).
    // Previously, the condition `if (currentCpuTimes.size > 0)` could be blocked by
    // getCpuTimes returning empty Map due to PowerShell errors. Now that CPU times
    // come from the same Win32_Process query as process info, this is much more reliable.
    if (currentCpuTimes.size > 0) {
      this.previousCpuTimes = new Map(currentCpuTimes)
      this.lastCpuSampleTime = now
    }

    // Clean up PIDs that no longer exist
    const currentPidSet = new Set(currentCpuTimes.keys())
    for (const pid of this.previousCpuTimes.keys()) {
      if (!currentPidSet.has(pid)) {
        this.previousCpuTimes.delete(pid)
      }
    }

    return cpuMap
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
