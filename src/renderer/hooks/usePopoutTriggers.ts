import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import type { AppSettings } from '@shared/types'
import type { PortPopoutPosition, PortPopoutTrigger } from '../components/popout/port-popout-model'

type PortPopoutSettings = AppSettings['window']['portPopout']

export interface UsePopoutTriggersArgs {
  popoutSettings: PortPopoutSettings
  onOpenPopout: (trigger: PortPopoutTrigger, anchor?: PortPopoutPosition) => void
}

export interface UsePopoutTriggersResult {
  isHovered: boolean
  showAdvancedMenu: boolean
  scheduleHoverPopout: (event: MouseEvent<HTMLDivElement>) => void
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void
  handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void
  handlePointerUp: (event: PointerEvent<HTMLDivElement>) => void
  handleMouseLeave: () => void
  handleContextMenu: (event: MouseEvent<HTMLDivElement>) => void
  openAdvancedMenuPopout: (event: MouseEvent<HTMLElement>) => void
  closeAdvancedMenu: () => void
  clearHoverTimer: () => void
}

export const PORT_ADVANCED_MENU_LONG_PRESS_MS = 1500
const INTERACTIVE_POINTER_TARGET_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="menuitem"]',
].join(',')

function isInteractivePointerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_POINTER_TARGET_SELECTOR))
}

export function usePopoutTriggers({ popoutSettings, onOpenPopout }: UsePopoutTriggersArgs): UsePopoutTriggersResult {
  const [isHovered, setIsHovered] = useState(false)
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false)
  const hoverTimerRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  const dragTriggeredRef = useRef(false)
  const pointerStartRef = useRef<PortPopoutPosition | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimerRef.current) return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }, [])

  const closeAdvancedMenu = useCallback(() => {
    setShowAdvancedMenu(false)
  }, [])

  useEffect(() => {
    return () => {
      clearHoverTimer()
      clearLongPressTimer()
    }
  }, [clearHoverTimer, clearLongPressTimer])

  const anchorFromPointer = useCallback((event: { clientX: number; clientY: number }): PortPopoutPosition => ({
    x: event.clientX,
    y: event.clientY
  }), [])

  const scheduleHoverPopout = useCallback((event: MouseEvent<HTMLDivElement>) => {
    setIsHovered(true)
    clearHoverTimer()
    if (!popoutSettings.triggerEnabled.hover) return
    const anchor = anchorFromPointer(event)
    hoverTimerRef.current = window.setTimeout(() => {
      onOpenPopout('hover', anchor)
      hoverTimerRef.current = null
    }, popoutSettings.hoverDelayMs)
  }, [anchorFromPointer, clearHoverTimer, onOpenPopout, popoutSettings.hoverDelayMs, popoutSettings.triggerEnabled.hover])

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (isInteractivePointerTarget(event.target)) return
    pointerStartRef.current = anchorFromPointer(event)
    longPressFiredRef.current = false
    dragTriggeredRef.current = false
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best-effort in tests and older embedded Chromium builds.
    }
    clearHoverTimer()
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      setShowAdvancedMenu(true)
      longPressTimerRef.current = null
    }, PORT_ADVANCED_MENU_LONG_PRESS_MS)
  }, [anchorFromPointer, clearHoverTimer, clearLongPressTimer])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current
    if (!start || dragTriggeredRef.current || longPressFiredRef.current) return
    if (!popoutSettings.triggerEnabled.drag) return

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (distance < popoutSettings.dragThresholdPx) return

    dragTriggeredRef.current = true
    clearLongPressTimer()
    event.stopPropagation()
    onOpenPopout('drag', anchorFromPointer(event))
  }, [anchorFromPointer, clearLongPressTimer, onOpenPopout, popoutSettings.dragThresholdPx, popoutSettings.triggerEnabled.drag])

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    clearLongPressTimer()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may not have been set if the pointer did not start on this card.
    }
    if (!start) return
    if (longPressFiredRef.current || dragTriggeredRef.current) {
      event.stopPropagation()
      return
    }
    if (!popoutSettings.triggerEnabled.drag) return

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (distance < popoutSettings.dragThresholdPx) return
    event.stopPropagation()
    dragTriggeredRef.current = true
    onOpenPopout('drag', anchorFromPointer(event))
  }, [anchorFromPointer, clearLongPressTimer, onOpenPopout, popoutSettings.dragThresholdPx, popoutSettings.triggerEnabled.drag])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    clearHoverTimer()
    clearLongPressTimer()
  }, [clearHoverTimer, clearLongPressTimer])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    clearHoverTimer()
    clearLongPressTimer()
    setShowAdvancedMenu(false)
    if (!popoutSettings.triggerEnabled.contextMenu) return
    onOpenPopout('context-menu', anchorFromPointer(event))
  }, [anchorFromPointer, clearHoverTimer, clearLongPressTimer, onOpenPopout, popoutSettings.triggerEnabled.contextMenu])

  const openAdvancedMenuPopout = useCallback((event: MouseEvent<HTMLElement>) => {
    closeAdvancedMenu()
    clearHoverTimer()
    onOpenPopout('api', anchorFromPointer(event))
  }, [anchorFromPointer, clearHoverTimer, closeAdvancedMenu, onOpenPopout])

  return {
    isHovered,
    showAdvancedMenu,
    scheduleHoverPopout,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleMouseLeave,
    handleContextMenu,
    openAdvancedMenuPopout,
    closeAdvancedMenu,
    clearHoverTimer,
  }
}
