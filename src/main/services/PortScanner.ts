import { execFile } from 'child_process'
import { promisify } from 'util'
import kill from 'tree-kill'
import {
  PortInfo, PortState, COMMON_DEV_PORTS, DEV_PROCESS_PATTERNS, isProtectedProcess,
  PortTopologyData, TopologyNode, TopologyEdge,
  PortFocusData, PortConnection, ProcessInfo, ProcessInfoExtended
} from '@shared/types-extended'
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
    const focusData = await this.getPortDetailIncremental(port)
    return focusData?.port ?? null
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

      const [protocol, localAddr, foreignAddr, state, pidStr] = parts
      if (protocol !== 'TCP') continue

      const localParts = localAddr.split(':')
      const port = parseInt(localParts[localParts.length - 1], 10)
      const pid = parseInt(pidStr, 10)

      if (isNaN(port) || isNaN(pid) || pid === 0) continue

      const normalizedState = this.normalizeState(state)
      if (normalizedState === null) continue

      ports.push({
        port,
        pid,
        processName: this.getProcessName(pid),
        state: normalizedState,
        protocol: 'TCP',
        localAddress: localAddr,
        foreignAddress: foreignAddr || '*:*'
      })
    }

    // Get process names for all PIDs
    await this.enrichProcessNames(ports)
    return ports
  }

  private normalizeState(state: string): PortState | null {
    const stateMap: Record<string, PortState> = {
      'LISTENING': 'LISTENING',
      'ESTABLISHED': 'ESTABLISHED',
      'TIME_WAIT': 'TIME_WAIT',
      'CLOSE_WAIT': 'CLOSE_WAIT'
    }
    return stateMap[state] ?? null
  }

  private getProcessName(pid: number): string {
    return this.processNameCache.get(pid) || `PID:${pid}`
  }

  private async enrichProcessNames(ports: PortInfo[]): Promise<void> {
    const pids = [...new Set(ports.map(p => p.pid))].filter(p => Number.isInteger(p) && p > 0 && p <= 4194304)
    if (pids.length === 0) return

    try {
      // Build PowerShell filter for target PIDs (safe: all values validated as integers above)
      const pidFilter = pids.map(p => `ProcessId = ${Math.floor(p)}`).join(' OR ')
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter '${pidFilter}' | Select-Object ProcessId,Name | ConvertTo-Csv -NoTypeInformation`

      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, timeout: 15000, encoding: 'utf8' }
      )

      // CSV format: "ProcessId","Name"
      const lines = stdout.split('\n').filter(l => l.trim())
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const fields = this.parseCsvLine(line)
        if (fields.length < 2) continue

        const pidStr = fields[0]?.trim()
        const name = fields[1]?.trim()

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
    } catch (err) {
      console.error('enrichProcessNames failed:', err instanceof Error ? err.message : err)
      // Keep default names on error
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

  async buildTopology(): Promise<PortTopologyData> {
    const ports = await this.scanAll()
    const nodes: TopologyNode[] = []
    const edges: TopologyEdge[] = []
    const processNodeIds = new Map<number, string>()
    const externalNodeIds = new Map<string, string>()

    // 1. Aggregate ports by PID to build process nodes (1:N)
    const portsByPid = new Map<number, PortInfo[]>()
    for (const p of ports) {
      const existing = portsByPid.get(p.pid) ?? []
      existing.push(p)
      portsByPid.set(p.pid, existing)
    }

    // 2. Create process nodes
    for (const [pid, pidPorts] of portsByPid) {
      const nodeId = `process-${pid}`
      processNodeIds.set(pid, nodeId)
      nodes.push({
        id: nodeId,
        type: 'process',
        label: pidPorts[0].processName,
        metadata: {
          pid,
          processName: pidPorts[0].processName,
          portCount: pidPorts.length
        }
      })
    }

    // 3. Create port nodes and process->port edges
    for (const p of ports) {
      const portNodeId = `port-${p.port}-${p.pid}-${p.state}`
      nodes.push({
        id: portNodeId,
        type: 'port',
        label: `:${p.port}`,
        metadata: {
          port: p.port,
          protocol: p.protocol,
          state: p.state,
          address: p.localAddress
        }
      })

      const processNodeId = processNodeIds.get(p.pid)
      if (processNodeId) {
        edges.push({
          id: `edge-${processNodeId}-${portNodeId}`,
          source: processNodeId,
          target: portNodeId,
          label: p.state
        })
      }

      // 4. Create external nodes for ESTABLISHED connections
      if (p.state === 'ESTABLISHED' && p.foreignAddress && p.foreignAddress !== '*:*' && p.foreignAddress !== '0.0.0.0:0') {
        let externalNodeId = externalNodeIds.get(p.foreignAddress)
        if (!externalNodeId) {
          externalNodeId = `external-${p.foreignAddress.replace(/[:.]/g, '-')}`
          externalNodeIds.set(p.foreignAddress, externalNodeId)
          nodes.push({
            id: externalNodeId,
            type: 'external',
            label: p.foreignAddress,
            metadata: {
              address: p.foreignAddress
            }
          })
        }

        edges.push({
          id: `edge-${portNodeId}-${externalNodeId}`,
          source: portNodeId,
          target: externalNodeId,
          label: 'ESTABLISHED'
        })
      }
    }

    return { nodes, edges }
  }

  /**
   * Get detailed focus data for a specific port: owning process info,
   * sibling ports (same PID), active connections, and child processes.
   */
  async getPortFocusData(
    targetPort: number,
    processScanner?: { getFullRelationship(pid: number): Promise<import('@shared/types-extended').ProcessRelationship | null> }
  ): Promise<PortFocusData | null> {
    const allPorts = await this.scanAll()
    const portInfo = allPorts.find(p => p.port === targetPort && p.state === 'LISTENING')
      ?? allPorts.find(p => p.port === targetPort)
    if (!portInfo) return null

    // Sibling ports (same PID, different port)
    const siblingPorts = allPorts.filter(p => p.pid === portInfo.pid && p.port !== targetPort)

    // Connections: all entries for this port across all states
    const connections: PortConnection[] = allPorts
      .filter(p => p.port === targetPort)
      .map(p => {
        const isInbound = p.state === 'LISTENING' || (p.localAddress.includes(`:${targetPort}`))
        return {
          localAddress: p.localAddress,
          foreignAddress: p.foreignAddress,
          state: p.state,
          foreignProcessName: undefined,
          direction: isInbound ? 'inbound' as const : 'outbound' as const
        }
      })

    // Try to get extended process info via the process scanner
    let process: ProcessInfoExtended | null = null
    let processChildren: ProcessInfo[] = []

    if (processScanner) {
      try {
        const rel = await processScanner.getFullRelationship(portInfo.pid)
        if (rel) {
          process = rel.self
          processChildren = rel.children
        }
      } catch {
        // Process scanner unavailable, return basic info
      }
    }

    return {
      port: portInfo,
      process,
      siblingPorts,
      connections,
      processChildren
    }
  }

  /**
   * Incremental port detail query — only scans a single port using filtered netstat.
   * Much faster than full scanAll() for per-port detail views.
   */
  async getPortDetailIncremental(
    targetPort: number,
    processScanner?: { getFullRelationship(pid: number): Promise<import('@shared/types-extended').ProcessRelationship | null> }
  ): Promise<PortFocusData | null> {
    try {
      // Filtered netstat: only rows matching this port
      const { stdout } = await execFileAsync(
        'netstat', ['-ano', '-p', 'TCP'],
        { windowsHide: true, timeout: 5000 }
      )

      const lines = stdout.split('\n').slice(4)
      const portEntries: PortInfo[] = []

      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 5) continue
        const [protocol, localAddr, foreignAddr, state, pidStr] = parts
        if (protocol !== 'TCP') continue

        const localParts = localAddr.split(':')
        const port = parseInt(localParts[localParts.length - 1], 10)
        const pid = parseInt(pidStr, 10)
        if (isNaN(port) || isNaN(pid) || pid === 0) continue

        // Only keep entries matching the target port (local or remote)
        const foreignParts = foreignAddr.split(':')
        const foreignPort = parseInt(foreignParts[foreignParts.length - 1], 10)
        if (port !== targetPort && foreignPort !== targetPort) continue

        const normalizedState = this.normalizeState(state)
        if (normalizedState === null) continue

        portEntries.push({
          port,
          pid,
          processName: this.getProcessName(pid),
          state: normalizedState,
          protocol: 'TCP',
          localAddress: localAddr,
          foreignAddress: foreignAddr || '*:*'
        })
      }

      // Enrich process names for matching entries
      await this.enrichProcessNames(portEntries)

      // Find the primary port entry (prefer LISTENING)
      const portInfo = portEntries.find(p => p.port === targetPort && p.state === 'LISTENING')
        ?? portEntries.find(p => p.port === targetPort)
      if (!portInfo) return null

      // Sibling ports: other ports held by same PID (from cache or quick lookup)
      const siblingPorts = portEntries.filter(p => p.pid === portInfo.pid && p.port !== targetPort)

      // Connections for this port
      const connections: PortConnection[] = portEntries
        .filter(p => p.port === targetPort)
        .map(p => ({
          localAddress: p.localAddress,
          foreignAddress: p.foreignAddress,
          state: p.state,
          foreignProcessName: undefined,
          direction: (p.state === 'LISTENING' || p.localAddress.includes(`:${targetPort}`))
            ? 'inbound' as const
            : 'outbound' as const
        }))

      // Extended process info (optional, may be slow)
      let process: ProcessInfoExtended | null = null
      let processChildren: ProcessInfo[] = []

      if (processScanner) {
        try {
          const rel = await processScanner.getFullRelationship(portInfo.pid)
          if (rel) {
            process = rel.self
            processChildren = rel.children
          }
        } catch {
          // Process scanner unavailable — return basic info
        }
      }

      return {
        port: portInfo,
        process,
        siblingPorts,
        connections,
        processChildren
      }
    } catch {
      return null
    }
  }

  getCommonDevPorts(): readonly number[] {
    return COMMON_DEV_PORTS
  }
}
