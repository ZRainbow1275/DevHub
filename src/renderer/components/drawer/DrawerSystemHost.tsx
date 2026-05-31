import { type CSSProperties, type ReactNode } from 'react'
import { useDrawerStore } from '../../stores/drawerStore'
import { DrawerBottom } from './DrawerBottom'
import { DrawerFloating } from './DrawerFloating'
import { DrawerRight } from './DrawerRight'
import { DrawerStatusbar } from './DrawerStatusbar'
import { DrawerTop } from './DrawerTop'

interface DrawerSystemHostProps {
  children: ReactNode
}

function useDrawerShellStyle(): CSSProperties {
  const top = useDrawerStore(store => store.states.top)
  const right = useDrawerStore(store => store.states.right)
  const bottom = useDrawerStore(store => store.states.bottom)
  return {
    '--drawer-top': top.open ? `${top.size ?? top.height ?? 0}px` : '0px',
    '--drawer-right': right.open ? `${right.size ?? right.width ?? 0}px` : '0px',
    '--drawer-bottom': bottom.open ? `${bottom.size ?? bottom.height ?? 0}px` : '0px',
    '--motion-drawer': '200ms'
  } as CSSProperties
}

export function DrawerSystemHost({ children }: DrawerSystemHostProps) {
  const shellStyle = useDrawerShellStyle()

  return (
    <div className="r8-drawer-shell relative flex-1 min-h-0 overflow-hidden" style={shellStyle} data-testid="drawer-system-host">
      <div className="r8-drawer-main flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </div>
      <DrawerTop />
      <DrawerRight />
      <DrawerBottom />
      <DrawerFloating />
      <DrawerStatusbar />
    </div>
  )
}
