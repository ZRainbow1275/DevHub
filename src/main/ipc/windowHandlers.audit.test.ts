import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(resolve(process.cwd(), 'src/main/ipc/windowHandlers.ts'), 'utf8')

const REQUIRED_WINDOW_AUDIT_ACTIONS = [
  'window:move',
  'window:close',
  'window:remove-group',
  'window:rename-group',
  'window:save-layout',
  'window:restore-layout',
  'window:remove-layout',
  'window:apply-layout',
  'window:save-snapshot',
  'window:update-snapshot',
  'window:delete-snapshot',
  'window:restore-snapshot',
  'window:restore-previous',
  'window:tile-group',
  'window:minimize-group',
  'window:close-group',
  'window:set-topmost',
  'window:always-on-top',
  'window:set-opacity',
  'window:set-title',
  'window:send-keys',
  'window:tile-layout',
  'window:cascade-layout',
  'window:stack-layout',
  'window:minimize-all',
  'window:restore-all',
  'window:add-to-group',
  'window:restore-group',
  'window:screenshot',
  'window:toggle-favorite',
  'window:open-working-dir'
]

describe('window handler audit coverage', () => {
  it('imports the main security audit logger', () => {
    expect(source).toContain("import { auditLogger } from '../services/AuditLogger'")
  })

  it.each(REQUIRED_WINDOW_AUDIT_ACTIONS)('keeps %s wired to AuditLogger', action => {
    if (action === 'window:set-topmost' || action === 'window:always-on-top') {
      expect(source).toContain(`setWindowAlwaysOnTop('${action}'`)
      return
    }

    const auditCallPattern = new RegExp(`audit(?:Logger\\.log|ServiceResult|ApplyLayoutResult|BooleanResult|NullableResult)\\('${escapeRegExp(action)}'`)
    expect(source).toMatch(auditCallPattern)
  })
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
