import { describe, expect, it } from 'vitest'
import { panelPopoutSurfaceSchema } from '@shared/schemas/r8-runtime'
import {
  DETACHABLE_REGISTRY,
  getDetachableDef,
  isPanelPopoutSurface,
  parseDetachTarget,
  serializeDetachTarget
} from './detachable-registry'

describe('detachable-registry', () => {
  it('is exhaustive against the Zod panel popout surface enum (single source of truth)', () => {
    const registryKeys = Object.keys(DETACHABLE_REGISTRY).sort()
    const schemaKeys = [...panelPopoutSurfaceSchema.options].sort()
    expect(registryKeys).toEqual(schemaKeys)
  })

  it('marks the four detail surfaces as target-bearing and the panels as not', () => {
    expect(getDetachableDef('process').needsTarget).toBe(false)
    expect(getDetachableDef('window').needsTarget).toBe(false)
    expect(getDetachableDef('dashboard').needsTarget).toBe(false)
    expect(getDetachableDef('topology').needsTarget).toBe(false)
    expect(getDetachableDef('r8-ops').needsTarget).toBe(false)

    for (const surface of ['process-detail', 'window-detail', 'port-detail', 'ai-task-detail'] as const) {
      const def = getDetachableDef(surface)
      expect(def.kind).toBe('detail')
      expect(def.needsTarget).toBe(true)
      expect(def.component).toBeTruthy()
      expect(def.title.length).toBeGreaterThan(0)
    }
  })

  it('registers the widget and toolbar surfaces as target-bearing (PR3)', () => {
    const widget = getDetachableDef('dashboard-widget')
    expect(widget.kind).toBe('widget')
    expect(widget.needsTarget).toBe(true)
    expect(widget.component).toBeTruthy()
    expect(widget.title.length).toBeGreaterThan(0)

    const toolbar = getDetachableDef('monitor-toolbar')
    expect(toolbar.kind).toBe('toolbar')
    expect(toolbar.needsTarget).toBe(true)
    expect(toolbar.component).toBeTruthy()
    expect(toolbar.title.length).toBeGreaterThan(0)
  })

  it('recognizes registered surfaces and rejects unknown values', () => {
    expect(isPanelPopoutSurface('process')).toBe(true)
    expect(isPanelPopoutSurface('port-detail')).toBe(true)
    expect(isPanelPopoutSurface('port')).toBe(false)
    expect(isPanelPopoutSurface('nope')).toBe(false)
    expect(isPanelPopoutSurface(null)).toBe(false)
    expect(isPanelPopoutSurface(undefined)).toBe(false)
  })

  it('parses kind:value detach targets and round-trips them', () => {
    expect(parseDetachTarget('pid:1234')).toEqual({ kind: 'pid', value: '1234' })
    expect(parseDetachTarget('port:8080')).toEqual({ kind: 'port', value: '8080' })
    expect(parseDetachTarget('hwnd:65792')).toEqual({ kind: 'hwnd', value: '65792' })
    expect(parseDetachTarget('taskId:abc-123')).toEqual({ kind: 'taskId', value: 'abc-123' })
    expect(parseDetachTarget('widgetId:widget-process-summary')).toEqual({ kind: 'widgetId', value: 'widget-process-summary' })
    expect(parseDetachTarget('toolbarId:monitor-quick')).toEqual({ kind: 'toolbarId', value: 'monitor-quick' })

    const target = { kind: 'pid', value: '1234' } as const
    expect(serializeDetachTarget(target)).toBe('pid:1234')
    expect(parseDetachTarget(serializeDetachTarget(target))).toEqual(target)

    // widget / toolbar targets round-trip including instance ids that contain hyphens.
    const widgetTarget = { kind: 'widgetId', value: 'widget-ai-task-queue' } as const
    expect(serializeDetachTarget(widgetTarget)).toBe('widgetId:widget-ai-task-queue')
    expect(parseDetachTarget(serializeDetachTarget(widgetTarget))).toEqual(widgetTarget)

    const toolbarTarget = { kind: 'toolbarId', value: 'monitor-quick' } as const
    expect(parseDetachTarget(serializeDetachTarget(toolbarTarget))).toEqual(toolbarTarget)
  })

  it('degrades to null on malformed or unknown targets', () => {
    expect(parseDetachTarget(null)).toBeNull()
    expect(parseDetachTarget(undefined)).toBeNull()
    expect(parseDetachTarget('')).toBeNull()
    expect(parseDetachTarget('pid')).toBeNull()
    expect(parseDetachTarget('pid:')).toBeNull()
    expect(parseDetachTarget(':1234')).toBeNull()
    expect(parseDetachTarget('unknown:1')).toBeNull()
  })
})
