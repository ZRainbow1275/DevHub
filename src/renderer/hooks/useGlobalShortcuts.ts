import { useEffect, useMemo } from 'react'

type ShortcutModifier = 'alt' | 'ctrl' | 'meta' | 'shift'

export interface GlobalShortcutRegistration {
  id: string
  keys: string[]
  handler: (event: KeyboardEvent) => void
  allowInEditable?: boolean
  enabled?: boolean
  preventDefault?: boolean
}

const MODIFIER_ORDER: ShortcutModifier[] = ['ctrl', 'meta', 'alt', 'shift']
const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  alt: 'alt',
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  ctrl: 'ctrl',
  meta: 'meta',
  option: 'alt',
  shift: 'shift'
}

function normalizeKeyToken(value: string): string {
  const key = value.trim().toLowerCase()
  if (key === ' ') return 'space'
  if (key === 'esc') return 'escape'
  return key
}

export function normalizeGlobalShortcut(shortcut: string): string {
  const parts = shortcut.split('+').map(part => part.trim()).filter(Boolean)
  const modifiers = new Set<ShortcutModifier>()
  let key = ''

  for (const part of parts) {
    const normalized = normalizeKeyToken(part)
    const modifier = MODIFIER_ALIASES[normalized]
    if (modifier) {
      modifiers.add(modifier)
    } else {
      key = normalized
    }
  }

  if (!key) throw new Error(`E_SHORTCUT_INVALID:${shortcut}`)
  return [...MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)), key].join('+')
}

function normalizeKeyboardEvent(event: KeyboardEvent): string {
  const modifiers: ShortcutModifier[] = []
  if (event.ctrlKey) modifiers.push('ctrl')
  if (event.metaKey) modifiers.push('meta')
  if (event.altKey) modifiers.push('alt')
  if (event.shiftKey) modifiers.push('shift')
  return [...modifiers, normalizeKeyToken(event.key)].join('+')
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') !== null
}

export function useGlobalShortcuts(registrations: GlobalShortcutRegistration[]): void {
  const activeShortcuts = useMemo(() => registrations
    .filter(registration => registration.enabled !== false)
    .flatMap(registration => registration.keys.map(key => ({
      normalizedKey: normalizeGlobalShortcut(key),
      registration
    }))), [registrations])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedEvent = normalizeKeyboardEvent(event)
      const match = activeShortcuts.find(shortcut => shortcut.normalizedKey === normalizedEvent)
      if (!match) return
      if (!match.registration.allowInEditable && isEditableShortcutTarget(event.target)) return
      if (match.registration.preventDefault !== false) event.preventDefault()
      match.registration.handler(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeShortcuts])
}
