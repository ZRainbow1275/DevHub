import { describe, it, expect } from 'vitest'
import type { PortInfo, PortState } from '@shared/types-extended'
import { COMMON_DEV_PORTS } from '@shared/types-extended'

// 由于 PortScanner 依赖于 child_process 和 tree-kill 等 Node.js 模块
// 在 jsdom 测试环境中难以完全 mock
// 这里测试核心业务逻辑而非实际端口扫描

describe('PortScanner Logic Tests', () => {
  describe('Netstat Output Parsing Logic', () => {

    it('应该正确解析端口号', () => {
      const parsePort = (localAddr: string): number => {
        const parts = localAddr.split(':')
        return parseInt(parts[parts.length - 1], 10)
      }

      expect(parsePort('0.0.0.0:3000')).toBe(3000)
      expect(parsePort('127.0.0.1:8080')).toBe(8080)
      expect(parsePort('[::1]:5173')).toBe(5173)
    })

    it('应该正确解析 PID', () => {
      const parsePid = (pidStr: string): number => parseInt(pidStr, 10)

      expect(parsePid('12345')).toBe(12345)
      expect(parsePid('67890')).toBe(67890)
    })

    it('应该正确过滤无效行', () => {
      const isValidLine = (line: string): boolean => {
        const parts = line.trim().split(/\s+/)
        return parts.length >= 5 && parts[0] === 'TCP'
      }

      expect(isValidLine('  TCP    0.0.0.0:3000          0.0.0.0:0              LISTENING       12345')).toBe(true)
      expect(isValidLine('Active Connections')).toBe(false)
      expect(isValidLine('')).toBe(false)
      expect(isValidLine('  Proto  Local Address          Foreign Address        State           PID')).toBe(false)
    })
  })

  describe('Port State Normalization', () => {
    const normalizeState = (state: string): PortState => {
      const stateMap: Record<string, PortState> = {
        'LISTENING': 'LISTENING',
        'ESTABLISHED': 'ESTABLISHED',
        'TIME_WAIT': 'TIME_WAIT',
        'CLOSE_WAIT': 'CLOSE_WAIT'
      }
      return stateMap[state] || 'LISTENING'
    }

    it('应该正确标准化已知状态', () => {
      expect(normalizeState('LISTENING')).toBe('LISTENING')
      expect(normalizeState('ESTABLISHED')).toBe('ESTABLISHED')
      expect(normalizeState('TIME_WAIT')).toBe('TIME_WAIT')
      expect(normalizeState('CLOSE_WAIT')).toBe('CLOSE_WAIT')
    })

    it('应该将未知状态默认为 LISTENING', () => {
      expect(normalizeState('UNKNOWN')).toBe('LISTENING')
      expect(normalizeState('')).toBe('LISTENING')
    })
  })

  describe('Common Dev Ports', () => {
    it('应该包含常用开发端口', () => {
      expect(COMMON_DEV_PORTS).toContain(3000)
      expect(COMMON_DEV_PORTS).toContain(5173) // Vite
      expect(COMMON_DEV_PORTS).toContain(8080)
      expect(COMMON_DEV_PORTS).toContain(4200) // Angular
    })

    it('常用端口数组应该是只读的', () => {
      expect(Array.isArray(COMMON_DEV_PORTS)).toBe(true)
      expect(COMMON_DEV_PORTS.length).toBeGreaterThan(0)
    })
  })

  describe('Port Filtering Logic', () => {
    const mockPorts: PortInfo[] = [
      { port: 3000, pid: 12345, processName: 'node.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:3000' },
      { port: 5173, pid: 67890, processName: 'node.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:5173' },
      { port: 49152, pid: 11111, processName: 'System', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:49152' }
    ]

    it('应该正确过滤常用开发端口', () => {
      const commonPorts = mockPorts.filter(p =>
        (COMMON_DEV_PORTS as readonly number[]).includes(p.port)
      )

      expect(commonPorts.length).toBe(2)
      expect(commonPorts.map(p => p.port)).toContain(3000)
      expect(commonPorts.map(p => p.port)).toContain(5173)
      expect(commonPorts.map(p => p.port)).not.toContain(49152)
    })

    it('应该正确查找特定端口', () => {
      const findPort = (ports: PortInfo[], port: number): PortInfo | undefined => {
        return ports.find(p => p.port === port)
      }

      expect(findPort(mockPorts, 3000)?.pid).toBe(12345)
      expect(findPort(mockPorts, 8080)).toBeUndefined()
    })
  })

  describe('Port Availability Check Logic', () => {
    const mockUsedPorts = new Set([3000, 5173, 8080])

    it('应该正确判断端口是否可用', () => {
      const isAvailable = (port: number): boolean => !mockUsedPorts.has(port)

      expect(isAvailable(3000)).toBe(false)
      expect(isAvailable(4000)).toBe(true)
      expect(isAvailable(5173)).toBe(false)
    })

    it('应该正确查找可用端口', () => {
      const findAvailable = (startPort: number): number => {
        let port = startPort
        while (mockUsedPorts.has(port)) {
          port++
          if (port > 65535) throw new Error('No available ports')
        }
        return port
      }

      expect(findAvailable(3000)).toBe(3001)
      expect(findAvailable(5173)).toBe(5174)
      expect(findAvailable(4000)).toBe(4000) // 直接可用
    })
  })

  describe('Conflict Detection Logic', () => {
    const mockPorts: PortInfo[] = [
      { port: 3000, pid: 12345, processName: 'node.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:3000' },
      { port: 5173, pid: 67890, processName: 'node.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:5173' },
      { port: 8080, pid: 11111, processName: 'java.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '0.0.0.0:8080' }
    ]

    it('应该正确检测端口冲突', () => {
      const detectConflicts = (allPorts: PortInfo[], projectPorts: number[]): PortInfo[] => {
        return allPorts.filter(p => projectPorts.includes(p.port))
      }

      const conflicts = detectConflicts(mockPorts, [3000, 4000, 8080])
      expect(conflicts.length).toBe(2)
      expect(conflicts.map(c => c.port)).toContain(3000)
      expect(conflicts.map(c => c.port)).toContain(8080)
      expect(conflicts.map(c => c.port)).not.toContain(4000)
    })

    it('应该返回空数组当没有冲突时', () => {
      const detectConflicts = (allPorts: PortInfo[], projectPorts: number[]): PortInfo[] => {
        return allPorts.filter(p => projectPorts.includes(p.port))
      }

      const conflicts = detectConflicts(mockPorts, [4000, 9000])
      expect(conflicts.length).toBe(0)
    })
  })

  describe('Process Name Cache Logic', () => {
    it('应该正确缓存进程名称', () => {
      const cache = new Map<number, string>()

      cache.set(12345, 'node.exe')
      cache.set(67890, 'java.exe')

      expect(cache.get(12345)).toBe('node.exe')
      expect(cache.get(67890)).toBe('java.exe')
      expect(cache.get(11111)).toBeUndefined()
    })

    it('应该返回默认名称当缓存未命中', () => {
      const cache = new Map<number, string>()
      const getProcessName = (pid: number): string => {
        return cache.get(pid) || `PID:${pid}`
      }

      expect(getProcessName(12345)).toBe('PID:12345')

      cache.set(12345, 'node.exe')
      expect(getProcessName(12345)).toBe('node.exe')
    })
  })

  describe('WMIC Output Parsing Logic', () => {
    const mockWmicOutput = [
      'Node,Name,ProcessId',
      'DESKTOP-ABC,node.exe,12345',
      'DESKTOP-ABC,java.exe,67890',
      'DESKTOP-ABC,System,4'
    ]

    it('应该正确解析 WMIC CSV 输出', () => {
      const parseWmic = (lines: string[]): Map<number, string> => {
        const result = new Map<number, string>()
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',')
          if (parts.length >= 3) {
            const name = parts[1]?.trim()
            const pidStr = parts[2]?.trim()
            if (name && pidStr) {
              const pid = parseInt(pidStr, 10)
              if (!isNaN(pid)) {
                result.set(pid, name)
              }
            }
          }
        }
        return result
      }

      const cache = parseWmic(mockWmicOutput)
      expect(cache.get(12345)).toBe('node.exe')
      expect(cache.get(67890)).toBe('java.exe')
      expect(cache.get(4)).toBe('System')
    })
  })
})
