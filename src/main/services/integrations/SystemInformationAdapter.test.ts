import { describe, expect, it } from 'vitest'
import { SystemInformationAdapter } from './SystemInformationAdapter'

describe('SystemInformationAdapter', () => {
  it('maps real systeminformation connection and process shapes into DevHub contracts', async () => {
    const adapter = new SystemInformationAdapter(async () => ({
      networkConnections: async () => [
        { protocol: 'tcp4', localAddress: '127.0.0.1', localPort: 5173, peerAddress: '0.0.0.0', peerPort: 0, state: 'LISTEN', pid: 1234, process: 'node.exe' },
        { protocol: 'udp4', localAddress: '0.0.0.0', localPort: 5353, pid: 4321, process: 'mdns.exe' },
        { protocol: 'tcp4', localAddress: '127.0.0.1', localPort: 0, state: 'ESTABLISHED', pid: 0, process: 'invalid.exe' }
      ],
      processes: async () => ({
        list: [
          { pid: 1234, parentPid: 100, name: 'node.exe', command: 'pnpm dev', cpu: 2.5, memRss: 134217728, started: 1_900_000 }
        ]
      })
    }))

    const ports = await adapter.listNetworkPorts()
    const processes = await adapter.listProcesses()

    expect(ports.success).toBe(true)
    expect(ports.data).toEqual([
      expect.objectContaining({ foreignAddress: '*:*', localAddress: '127.0.0.1:5173', pid: 1234, port: 5173, processName: 'node.exe', protocol: 'TCP', source: 'systeminformation', state: 'LISTENING' }),
      expect.objectContaining({ foreignAddress: '*:*', localAddress: '0.0.0.0:5353', pid: 4321, port: 5353, processName: 'mdns.exe', protocol: 'UDP', source: 'systeminformation', state: 'LISTENING' })
    ])
    expect(processes.success).toBe(true)
    expect(processes.data?.[0]).toEqual(expect.objectContaining({ command: 'pnpm dev', memory: 128, name: 'node.exe', pid: 1234, ppid: 100 }))
  })

  it('returns a typed failure when systeminformation is unavailable', async () => {
    const adapter = new SystemInformationAdapter(async () => null)

    await expect(adapter.listNetworkPorts()).resolves.toEqual({ success: false, error: 'SYSTEMINFORMATION_UNAVAILABLE' })
  })
})
