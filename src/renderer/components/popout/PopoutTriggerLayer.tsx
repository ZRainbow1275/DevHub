import type { ReactNode } from 'react'
import type { AppSettings } from '@shared/types'
import type { PortInfo } from '@shared/types-extended'
import {
  PORT_ADVANCED_MENU_LONG_PRESS_MS,
  usePopoutTriggers,
  type UsePopoutTriggersResult
} from '../../hooks/usePopoutTriggers'
import type { PortPopoutPosition, PortPopoutTrigger } from './port-popout-model'

type PortPopoutSettings = AppSettings['window']['portPopout']

export interface PopoutTriggerLayerState {
  isHovered: UsePopoutTriggersResult['isHovered']
  showAdvancedMenu: UsePopoutTriggersResult['showAdvancedMenu']
  openAdvancedMenuPopout: UsePopoutTriggersResult['openAdvancedMenuPopout']
  closeAdvancedMenu: UsePopoutTriggersResult['closeAdvancedMenu']
  clearHoverTimer: UsePopoutTriggersResult['clearHoverTimer']
  longPressThresholdMs: number
}

interface PopoutTriggerLayerProps {
  port: PortInfo
  index: number
  isSelected: boolean
  isPopoutOpen: boolean
  popoutSettings: PortPopoutSettings
  onSelect: () => void
  onOpenPopout: (trigger: PortPopoutTrigger, anchor?: PortPopoutPosition) => void
  children: (state: PopoutTriggerLayerState) => ReactNode
}

export function PopoutTriggerLayer({
  port,
  index,
  isSelected,
  isPopoutOpen,
  popoutSettings,
  onSelect,
  onOpenPopout,
  children
}: PopoutTriggerLayerProps) {
  const {
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
  } = usePopoutTriggers({ popoutSettings, onOpenPopout })

  return (
    <div
      data-testid={`port-card-${port.port}-${port.pid}`}
      data-r8a-port-card="true"
      data-r8a-density="breathing-room"
      data-r8a-min-height="96"
      data-r8a-fields="port,protocol,pid,state,securityTier"
      data-port-number={port.port}
      data-port-pid={port.pid}
      onClick={onSelect}
      onMouseEnter={scheduleHoverPopout}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      className={`
        monitor-card group cursor-pointer relative overflow-hidden animate-card-stagger
        ${isSelected ? 'monitor-card-selected' : ''}
        ${port.state === 'LISTENING' ? 'card-running' : ''}
        ${isPopoutOpen ? 'ring-1 ring-accent/70' : ''}
      `}
      style={{ animationDelay: `${index * 50}ms`, minHeight: 'var(--r8a-port-card-min-height, 96px)' }}
    >
      {children({
        isHovered,
        showAdvancedMenu,
        openAdvancedMenuPopout,
        closeAdvancedMenu,
        clearHoverTimer,
        longPressThresholdMs: PORT_ADVANCED_MENU_LONG_PRESS_MS,
      })}
    </div>
  )
}
