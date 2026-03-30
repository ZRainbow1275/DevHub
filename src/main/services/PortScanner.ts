import { execFile } from 'child_process'
import { promisify } from 'util'
import kill from 'tree-kill'
import { PortInfo, PortState, COMMON_DEV_PORTS, DEV_PROCESS_PATTERNS, isProtectedProcess } from '@shared/types-extended'
import { auditLogger } from './AuditLogger'

const execFileAsync = promisify(execFile)

export class PortScanner {
  private processNameCache = new Map<number, string>()

  async scanAll(): Promise<PortInfo[]> {
    try {
      this.processNameCache.clear()
      const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true })
      return await this.parseNetstatOutput(stdout)
    } catch {
      return []
    }
  }

  async scanCommonPorts(): Promise<PortInfo[]> {
    const allPorts = await this.scanAll()
    return allPorts.filter(p => COMMON_DEV_PORTS.includes(p.port as typeof COMMON_DEV_PORTS[number]))
  }

  async checkPort(port: number): Promise<PortInfo | null> {
    const ports = await this.scanAll()
    return ports.find(p => p.port === port) || null
  }

  async isPortAvailable(port: number): Promise<boolean> {
    const info = await this.checkPort(port)
    return info === null
  }

  async releasePort(port: number): Promise<boolean> {
    const info = await this.checkPort(port)
    if (!info) return true

    // 1. Get process name
    const processName = this.processNameCache.get(info.pid) || info.processName

    // 2. Protected process check
    if (isProtectedProcess(processName)) {
      console.warn(`Refused: port ${port} held by protected process ${processName}`)
      auditLogger.log('port:release', { port, pid: info.pid, processName }, 'refused', 'protected process')
      return false
    }

    // 3. Dev process check
    if (!DEV_PROCESS_PATTERNS.some(p => processName.toLowerCase() === p.toLowerCase())) {
      console.warn(`Refused: port ${port} held by non-dev process ${processName}`)
      auditLogger.log('port:release', { port, pid: info.pid, processName }, 'refused', 'non-dev process')
      return false
    }

    // 4. Audit log
    auditLogger.log('port:release', { port, pid: info.pid, processName }, 'success')

    return this.killProcessGracefully(info.pid)
  }

  private killProcessGracefully(pid: number): Promise<boolean> {
    return new Promise((resolve) => {
      kill(pid, 'SIGTERM', (err) => {
        if (err) {
          kill(pid, 'SIGKILL', (err2) => resolve(!err2))
        } else {
          resolve(true)
        }
      })
    })
  }

  async findAvailablePort(startPort: number): Promise<number> {
    const ports = await this.scanAll()
    const usedPorts = new Set(ports.map(p => p.port))

    let port = startPort
    while (usedPorts.has(port)) {
      port++
      if (port > 65535) throw new Error('No available ports')
    }
    return port
  }

  async detectConflicts(projectPorts: number[]): Promise<PortInfo[]> {
    const allPorts = await this.scanAll()
    return allPorts.filter(p => projectPorts.includes(p.port))
  }

  private async parseNetstatOutput(output: string): Promise<PortInfo[]> {
    const lines = output.split('\n').slice(4) // Skip header lines
    const ports: PortInfo[] = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue

      const [protocol, localAddr, , state, pidStr] = parts
      if (protocol !== 'TCP') continue

      const localParts = localAddr.split(':')
      const port = parseInt(localParts[localParts.length - 1], 10)
      const pid = parseInt(pidStr, 10)

      if (isNaN(port) || isNaN(pid) || pid === 0) continue

      ports.push({
        port,
        pid,
        processName: this.getProcessName(pid),
        state: this.normalizeState(state),
        protocol: 'TCP',
        localAddress: localAddr
      })
    }

    // Get process names for all PIDs
    await this.enrichProcessNames(ports)
    return ports
  }

  private normalizeState(state: string): PortState {
    const stateMap: Record<string, PortState> = {
      'LISTENING': 'LISTENING',
      'ESTABLISHED': 'ESTABLISHED',
      'TIME_WAIT': 'TIME_WAIT',
      'CLOSE_WAIT': 'CLOSE_WAIT'
    }
    return stateMap[state] || 'LISTENING'
  }

  private getProcessName(pid: number): string {
    return this.processNameCache.get(pid) || `PID:${pid}`
  }

  private async enrichProcessNames(ports: PortInfo[]): Promise<void> {
    const pids = [...new Set(ports.map(p => p.pid))]

    try {
      // TODO: Migrate from deprecated WMIC to PowerShell Get-CimInstance
      const whereClause = `ProcessId=${pids.join(' or ProcessId=')}`
      const { stdout } = await execFileAsync(
        'wmic',
        ['process', 'where', whereClause, 'get', 'ProcessId,Name', '/format:csv'],
        { windowsHide: true }
      )

      // CSV format: Node,Name,ProcessId (columns sorted alphabetically by wmic)
      const lines = stdout.split('\n').filter(l => l.trim())
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(',')
        if (parts.length < 3) continue

        // Index 0 = Node (computer name)
        // Index 1 = Name
        // Index 2 = ProcessId
        const name = parts[1]?.trim()
        const pidStr = parts[2]?.trim()

        if (name && pidStr) {
          const pid = parseInt(pidStr, 10)
          if (!isNaN(pid)) {
            this.processNameCache.set(pid, name)
          }
        }
      }

      // Update port info with process names
      for (const port of ports) {
        port.processName = this.processNameCache.get(port.pid) || port.processName
      }
    } catch {
      // Keep default names
    }
  }

  getCommonDevPorts(): readonly number[] {
    return COMMON_DEV_PORTS
  }
}
