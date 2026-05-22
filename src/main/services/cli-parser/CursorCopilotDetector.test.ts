import { describe, expect, it } from 'vitest'
import type { WindowInfo } from '@shared/types-extended'
import { parseSessionSchema } from '@shared/schemas/r8-runtime'
import { CursorCopilotDetector } from './CursorCopilotDetector'
import { CopilotTitleParser, CursorTitleParser } from './parsers'

function windowInfo(input: Partial<WindowInfo> & Pick<WindowInfo, 'hwnd' | 'title' | 'processName'>): WindowInfo {
  return {
    hwnd: input.hwnd,
    title: input.title,
    processName: input.processName,
    pid: input.pid ?? input.hwnd + 100,
    className: input.className ?? 'Chrome_WidgetWin_1',
    rect: input.rect ?? { x: 0, y: 0, width: 100, height: 100 },
    isVisible: input.isVisible ?? true,
    isMinimized: input.isMinimized ?? false,
    isSystemWindow: input.isSystemWindow ?? false
  }
}

function context(tool: 'cursor' | 'copilot') {
  return {
    session: parseSessionSchema.parse({
      sessionId: `${tool}-session`,
      instanceId: `${tool}-instance`,
      tool,
      strategy: 'line',
      startedAt: 1,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    }),
    stream: 'title' as const,
    observedAt: 40
  }
}

describe('Cursor/Copilot title detection', () => {
  it('parses Cursor editing titles with bounded confidence', () => {
    const parser = new CursorTitleParser()
    const events = parser.parseChunk('Cursor - Editing main.ts', context('cursor'))

    expect(events[0]).toMatchObject({ tool: 'cursor', stream: 'title', rawSource: 'window-title', phase: 'working', confidence: 0.6, payload: { titlePhase: 'editing' } })
  })

  it('parses Copilot suggesting titles as thinking', () => {
    const parser = new CopilotTitleParser()
    const events = parser.parseChunk('Visual Studio Code - main.ts (Copilot suggesting)', context('copilot'))

    expect(events[0]).toMatchObject({ tool: 'copilot', rawSource: 'window-title', phase: 'thinking', confidence: 0.5, payload: { titlePhase: 'thinking' } })
  })

  it('marks title spoofing as unknown when process whitelist fails', () => {
    const detector = new CursorCopilotDetector()
    const signals = detector.scanWindows([windowInfo({ hwnd: 10, title: 'Cursor - Editing main.ts', processName: 'notepad.exe' })], 50)

    expect(signals[0]).toMatchObject({ tool: 'unknown', phase: 'unknown', confidence: 0.1, source: 'window-title' })
    expect(signals[0].titleHash).toHaveLength(16)
  })

  it('accepts executable basename whitelist entries from paths and Windows ProcessName values', () => {
    const detector = new CursorCopilotDetector()
    const signals = detector.scanWindows([
      windowInfo({ hwnd: 101, title: 'Cursor - Editing main.ts', processName: 'C:\\Program Files\\Cursor\\Cursor.exe' }),
      windowInfo({ hwnd: 102, title: 'Cursor - Editing main.ts', processName: 'cursor-helper.exe' }),
      windowInfo({ hwnd: 103, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'gh.exe' }),
      windowInfo({ hwnd: 104, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'github-copilot.exe' }),
      windowInfo({ hwnd: 105, title: 'Cursor - Editing main.ts', processName: 'cursor' }),
      windowInfo({ hwnd: 106, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'Code' })
    ], 1_000)

    expect(signals.find(signal => signal.hwnd === 101)).toMatchObject({ tool: 'cursor', confidence: 0.6 })
    expect(signals.find(signal => signal.hwnd === 102)).toMatchObject({ tool: 'unknown', confidence: 0.1 })
    expect(signals.find(signal => signal.hwnd === 103)).toMatchObject({ tool: 'copilot', confidence: 0.5 })
    expect(signals.find(signal => signal.hwnd === 104)).toMatchObject({ tool: 'unknown', confidence: 0.1 })
    expect(signals.find(signal => signal.hwnd === 105)).toMatchObject({ tool: 'cursor', confidence: 0.6 })
    expect(signals.find(signal => signal.hwnd === 106)).toMatchObject({ tool: 'copilot', confidence: 0.5 })
  })

  it('caps scan frequency at 5 Hz and throttles the same hwnd for five seconds', () => {
    const detector = new CursorCopilotDetector()
    const first = detector.scanWindows([windowInfo({ hwnd: 20, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe' })], 1_000)
    const tooSoon = detector.scanWindows([windowInfo({ hwnd: 20, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe' })], 1_100)
    const sameHwnd = detector.scanWindows([windowInfo({ hwnd: 20, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe' })], 1_400)
    const afterThrottle = detector.scanWindows([windowInfo({ hwnd: 20, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe' })], 6_100)

    expect(first[0].ts).toBe(1_000)
    expect(tooSoon[0].ts).toBe(1_000)
    expect(sameHwnd[0].ts).toBe(1_000)
    expect(afterThrottle[0].ts).toBe(6_100)
  })

  it('builds status from real scanner window snapshots without process injection', () => {
    const detector = new CursorCopilotDetector()
    const status = detector.status({
      windows: [
        windowInfo({ hwnd: 11, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe' }),
        windowInfo({ hwnd: 12, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'Code.exe' })
      ],
      aiTasks: [{ id: 'task-1', tool: 'cursor' } as never]
    })

    expect(status.cursorTasks).toBe(1)
    expect(status.signals).toHaveLength(2)
    expect(status.confidence).toBeGreaterThanOrEqual(0.5)
  })

  it('covers the five Cursor/Copilot title-detection GWT scenarios from scanner window rows', () => {
    const detector = new CursorCopilotDetector()
    const signals = detector.scanWindows([
      windowInfo({ hwnd: 201, title: 'Cursor - Editing main.ts', processName: 'cursor.exe', pid: 5201 }),
      windowInfo({ hwnd: 202, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'Code.exe', pid: 5202 }),
      windowInfo({ hwnd: 203, title: 'Cursor - Editing main.ts', processName: 'notepad.exe', pid: 5203 }),
      windowInfo({ hwnd: 204, title: 'Terminal - npm run dev', processName: 'WindowsTerminal.exe', pid: 5204 }),
      windowInfo({ hwnd: 205, title: 'Visual Studio Code - Copilot completed edit', processName: 'gh.exe', pid: 5205 })
    ], 10_000)

    expect(signals.find(signal => signal.hwnd === 201)).toMatchObject({ tool: 'cursor', phase: 'editing', confidence: 0.6, source: 'window-title' })
    expect(signals.find(signal => signal.hwnd === 202)).toMatchObject({ tool: 'copilot', phase: 'thinking', confidence: 0.5, source: 'window-title' })
    expect(signals.find(signal => signal.hwnd === 203)).toMatchObject({ tool: 'unknown', phase: 'unknown', confidence: 0.1, source: 'window-title' })
    expect(signals.some(signal => signal.hwnd === 204)).toBe(false)
    expect(signals.find(signal => signal.hwnd === 205)).toMatchObject({ tool: 'copilot', phase: 'idle', confidence: 0.35, source: 'window-title' })
    expect(signals.map(signal => signal.titleHash)).toEqual(signals.map(() => expect.stringMatching(/^[a-f0-9]{16}$/)))
    expect(signals.map(signal => signal.titleHash)).not.toContain('Cursor - Editing main.ts')
  })

  it('hot reloads title rules for both parser and detector paths', () => {
    const detector = new CursorCopilotDetector()
    const reloaded = detector.reloadRules([{ tool: 'cursor', regex: 'Cursor Waiting', phase: 'thinking', confidence: 0.61 }])
    const signals = detector.scanWindows([windowInfo({ hwnd: 13, title: 'Cursor Waiting', processName: 'Cursor.exe' })], 60)

    expect(reloaded).toMatchObject({ success: true, applied: 1 })
    expect(signals[0]).toMatchObject({ tool: 'cursor', phase: 'thinking', confidence: 0.61 })
  })

  it('rejects title rules above the window-title confidence ceiling', () => {
    const detector = new CursorCopilotDetector()

    expect(() => detector.reloadRules([{ tool: 'cursor', regex: 'Cursor Waiting', phase: 'thinking', confidence: 0.95 }])).toThrow()
  })
})
