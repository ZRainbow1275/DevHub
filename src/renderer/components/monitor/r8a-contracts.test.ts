import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('R8.A monitor view contracts', () => {
  it('keeps process card and list surfaces on the same ProcessUnifiedViewModel field contract', () => {
    const contract = source('src/renderer/components/monitor/process-vm-contract.ts')
    const processView = source('src/renderer/components/monitor/ProcessView.tsx')
    const detailPanel = source('src/renderer/components/monitor/ProcessDetailPanel.tsx')
    const detailDrawer = source('src/renderer/components/monitor/ProcessDetailDrawer.tsx')
    const requiredFields = ['name', 'pid', 'status', 'type', 'port', 'cpu', 'memory', 'startTime', 'command']

    expect(contract).toContain('export const PROCESS_VM_FIELDS')
    expect(processView).toContain('data-vm-surface="card"')
    expect(processView).toContain('data-vm-surface="list"')
    expect(detailPanel).toContain('data-vm-surface="detail-panel"')
    expect(detailDrawer).toContain('data-vm-surface="detail-drawer"')
    for (const field of requiredFields) {
      expect(contract).toContain(`'${field}'`)
      expect(processView).toContain(`data-vm-field="${field}"`)
      expect(`${detailPanel}
${detailDrawer}`).toContain(`data-vm-field="${field}"`)
    }
  })

  it('keeps first-glance graph entry markers on process, port, and window detail surfaces', () => {
    expect(source('src/renderer/components/monitor/ProcessDetailPanel.tsx')).toContain("data-graph-entry={tab.key === 'relation-view' ? 'process-detail-tab' : undefined}")
    expect(source('src/renderer/components/monitor/ProcessDetailPanel.tsx')).toContain('data-graph-entry="process-detail-action"')
    expect(source('src/renderer/components/monitor/ProcessDetailDrawer.tsx')).toContain('data-graph-entry="process-drawer-action"')
    expect(source('src/renderer/components/monitor/PortFocusPanel.tsx')).toContain('data-graph-entry="port-focus-action"')
    expect(source('src/renderer/components/monitor/WindowView.tsx')).toContain('data-graph-entry="window-detail-panel"')
  })

  it('keeps port cards spacious enough for dense monitoring without color-only cues', () => {
    const portView = source('src/renderer/components/monitor/PortView.tsx')
    const popoutTriggerLayer = source('src/renderer/components/popout/PopoutTriggerLayer.tsx')
    const css = source('src/renderer/styles/z-index-tokens.css')

    expect(popoutTriggerLayer).toContain('data-r8a-port-card="true"')
    expect(popoutTriggerLayer).toContain('data-r8a-min-height="96"')
    expect(portView).toContain('data-r8a-field-row="port-header"')
    expect(portView).toContain('data-r8a-field-row="process"')
    expect(portView).toContain('data-r8a-field-row="local-address"')
    expect(css).toContain('--r8a-port-card-min-height: 96px;')
    expect(css).toContain('[data-r8a-field-row] + [data-r8a-field-row]')
  })

  it('keeps always-on-top renderer state hydrated from the main-process topmost registry', () => {
    const windowView = source('src/renderer/components/monitor/WindowView.tsx')
    const useWindows = source('src/renderer/hooks/useWindows.ts')

    expect(useWindows).toContain('listTopmostWindows')
    expect(windowView).toContain('listTopmostWindows().then(hwnds => setTopmostWindows(new Set(hwnds)))')
    expect(windowView).toContain('setWindowTopmost')
  })

  it('keeps runtime theme switching wired to the non-color delta guard', () => {
    const useTheme = source('src/renderer/hooks/useTheme.ts')

    expect(useTheme).toContain("import { ensureThemeNonColorDelta } from '../theme/theme-distance'")
    expect(useTheme).toContain('ensureThemeNonColorDelta(themeState, candidateState)')
  })
})
