import { describe, expect, it, vi } from 'vitest'
import type { PowerShellGateway } from './runtime/PowerShellGateway'
import { VirtualDesktopService, virtualDesktopServiceInternals } from './VirtualDesktopService'

function createGateway(stdout: string): PowerShellGateway {
  return {
    execute: vi.fn(async (_script: string, options?: { parser?: (output: string) => unknown }) => {
      const parsed = options?.parser ? options.parser(stdout) : stdout
      return parsed
    })
  } as unknown as PowerShellGateway
}

function createSequencedGateway(stdoutValues: readonly string[]) {
  let nextIndex = 0
  const execute = vi.fn(async (_script: string, options?: { parser?: (output: string) => unknown }) => {
    const stdout = stdoutValues[Math.min(nextIndex, stdoutValues.length - 1)] ?? ''
    nextIndex += 1
    const parsed = options?.parser ? options.parser(stdout) : stdout
    return parsed
  })
  return {
    execute,
    gateway: { execute } as unknown as PowerShellGateway
  }
}

describe('VirtualDesktopService', () => {
  it('normalizes GUIDs without fabricating invalid ids', () => {
    expect(virtualDesktopServiceInternals.normalizeGuid('{2439FD36-4943-43B0-AA9A-61DBF165ADD0}')).toBe('2439fd36-4943-43b0-aa9a-61dbf165add0')
    expect(virtualDesktopServiceInternals.normalizeGuid('not-a-guid')).toBeNull()
  })

  it('returns real desktop info rows from the PowerShell COM bridge output', async () => {
    const gateway = createGateway(JSON.stringify({
      ok: true,
      items: [{
        hwnd: 501,
        desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
        isOnCurrentDesktop: true,
        hrCurrent: 0,
        hrDesktop: 0,
        error: null
      }],
      desktops: ['2439fd36-4943-43b0-aa9a-61dbf165add0'],
      foregroundDesktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0'
    }))
    const service = new VirtualDesktopService(gateway)

    const response = await service.getWindowInfo([501], new Map([[501, 7]]))

    expect(response.info).toEqual([{
      hwnd: 501,
      desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
      monitorId: 7,
      isOnCurrentDesktop: true
    }])
  })

  it('reuses recent real COM desktop rows within the short cache window', async () => {
    const firstDesktopId = '2439fd36-4943-43b0-aa9a-61dbf165add0'
    const secondDesktopId = 'c396b8bd-90bb-468f-979d-65f367f1a03f'
    const { execute, gateway } = createSequencedGateway([
      JSON.stringify({
        ok: true,
        items: [{
          hwnd: 501,
          desktopId: firstDesktopId,
          isOnCurrentDesktop: true,
          hrCurrent: 0,
          hrDesktop: 0,
          error: null
        }],
        desktops: [firstDesktopId],
        foregroundDesktopId: firstDesktopId
      }),
      JSON.stringify({
        ok: true,
        items: [{
          hwnd: 501,
          desktopId: secondDesktopId,
          isOnCurrentDesktop: false,
          hrCurrent: 0,
          hrDesktop: 0,
          error: null
        }],
        desktops: [secondDesktopId],
        foregroundDesktopId: secondDesktopId
      })
    ])
    const service = new VirtualDesktopService(gateway)

    const first = await service.getWindowInfo([501], new Map([[501, 7]]))
    const second = await service.getWindowInfo([501], new Map([[501, 7]]))

    expect(execute).toHaveBeenCalledTimes(1)
    expect(first.info).toEqual([{
      hwnd: 501,
      desktopId: firstDesktopId,
      monitorId: 7,
      isOnCurrentDesktop: true
    }])
    expect(second.info).toEqual(first.info)
  })

  it('reuses recent real desktop list rows without rerunning the COM bridge', async () => {
    const firstDesktopId = '2439fd36-4943-43b0-aa9a-61dbf165add0'
    const secondDesktopId = 'c396b8bd-90bb-468f-979d-65f367f1a03f'
    const { execute, gateway } = createSequencedGateway([
      JSON.stringify({
        ok: true,
        items: [],
        desktops: [firstDesktopId],
        foregroundDesktopId: firstDesktopId
      }),
      JSON.stringify({
        ok: true,
        items: [],
        desktops: [secondDesktopId],
        foregroundDesktopId: secondDesktopId
      })
    ])
    const service = new VirtualDesktopService(gateway)

    const first = await service.listDesktops()
    const second = await service.listDesktops()

    expect(execute).toHaveBeenCalledTimes(1)
    expect(first.desktops).toEqual([{ id: firstDesktopId, index: 0, name: null, current: true }])
    expect(second).toEqual(first)
  })

  it('reports unavailable state instead of fake desktop ids when COM bridge fails', async () => {
    const gateway = {
      execute: vi.fn(async () => {
        throw new Error('COM unavailable')
      })
    } as unknown as PowerShellGateway
    const service = new VirtualDesktopService(gateway)

    const response = await service.getWindowInfo([501], new Map([[501, 1]]))

    expect(response).toMatchObject({
      info: [{ hwnd: 501, desktopId: null, monitorId: 1, isOnCurrentDesktop: true }],
      unavailableReason: 'E_INTERNAL: COM unavailable'
    })
  })

  it('moves a real HWND only when the COM bridge reports HRESULT 0', async () => {
    const gateway = createGateway(JSON.stringify({
      hwnd: 501,
      desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
      success: true,
      hr: 0,
      error: null
    }))
    const service = new VirtualDesktopService(gateway)

    const response = await service.moveWindowToDesktop({
      hwnd: 501,
      desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
      confirmedBy: 'vitest'
    })

    expect(response).toMatchObject({
      success: true,
      data: { hwnd: 501, desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0' }
    })
  })

  it('invalidates cached desktop rows after a move attempt', async () => {
    const firstDesktopId = '2439fd36-4943-43b0-aa9a-61dbf165add0'
    const movedDesktopId = 'c396b8bd-90bb-468f-979d-65f367f1a03f'
    const { execute, gateway } = createSequencedGateway([
      JSON.stringify({
        ok: true,
        items: [{
          hwnd: 501,
          desktopId: firstDesktopId,
          isOnCurrentDesktop: true,
          hrCurrent: 0,
          hrDesktop: 0,
          error: null
        }],
        desktops: [firstDesktopId, movedDesktopId],
        foregroundDesktopId: firstDesktopId
      }),
      JSON.stringify({
        hwnd: 501,
        desktopId: movedDesktopId,
        success: true,
        hr: 0,
        error: null
      }),
      JSON.stringify({
        ok: true,
        items: [{
          hwnd: 501,
          desktopId: movedDesktopId,
          isOnCurrentDesktop: false,
          hrCurrent: 0,
          hrDesktop: 0,
          error: null
        }],
        desktops: [firstDesktopId, movedDesktopId],
        foregroundDesktopId: firstDesktopId
      })
    ])
    const service = new VirtualDesktopService(gateway)

    await service.getWindowInfo([501])
    const moveResponse = await service.moveWindowToDesktop({
      hwnd: 501,
      desktopId: movedDesktopId,
      confirmedBy: 'vitest'
    })
    const refreshed = await service.getWindowInfo([501])

    expect(moveResponse.success).toBe(true)
    expect(execute).toHaveBeenCalledTimes(3)
    expect(refreshed.info).toEqual([{
      hwnd: 501,
      desktopId: movedDesktopId,
      monitorId: 0,
      isOnCurrentDesktop: false
    }])
  })

  it('invalidates cached desktop lists after a move attempt', async () => {
    const firstDesktopId = '2439fd36-4943-43b0-aa9a-61dbf165add0'
    const movedDesktopId = 'c396b8bd-90bb-468f-979d-65f367f1a03f'
    const { execute, gateway } = createSequencedGateway([
      JSON.stringify({
        ok: true,
        items: [],
        desktops: [firstDesktopId, movedDesktopId],
        foregroundDesktopId: firstDesktopId
      }),
      JSON.stringify({
        hwnd: 501,
        desktopId: movedDesktopId,
        success: true,
        hr: 0,
        error: null
      }),
      JSON.stringify({
        ok: true,
        items: [],
        desktops: [firstDesktopId, movedDesktopId],
        foregroundDesktopId: movedDesktopId
      })
    ])
    const service = new VirtualDesktopService(gateway)

    const beforeMove = await service.listDesktops()
    await service.moveWindowToDesktop({
      hwnd: 501,
      desktopId: movedDesktopId,
      confirmedBy: 'vitest'
    })
    const afterMove = await service.listDesktops()

    expect(execute).toHaveBeenCalledTimes(3)
    expect(beforeMove.desktops.map(desktop => desktop.current)).toEqual([true, false])
    expect(afterMove.desktops.map(desktop => desktop.current)).toEqual([false, true])
  })
})
