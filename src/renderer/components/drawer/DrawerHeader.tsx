import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { CloseIcon, WindowIcon } from '../icons'
import { getDrawerContentDefinition } from './drawer-model'
import { useDrawer } from '../../hooks/useDrawer'
import { useT } from '../../hooks/useT'

interface DrawerHeaderProps {
  slot: DrawerSlot
}

export function DrawerHeader({ slot }: DrawerHeaderProps) {
  const { t } = useT()
  const { state, setOpen, setPinned, morphToPopout } = useDrawer(slot)
  const definition = getDrawerContentDefinition(state.contentId)
  const title = definition?.title ?? state.contentId ?? slot

  return (
    <header className="flex items-center justify-between gap-3 border-b border-surface-700 bg-surface-900 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{t('drawer.label', 'Drawer {{slot}}').replace('{{slot}}', slot)}</div>
        <h2 className="truncate text-sm font-bold text-text-primary">{title}</h2>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`btn-icon-sm ${state.pinned ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary'}`}
          data-testid={`drawer-${slot}-pin`}
          onClick={() => { void setPinned(!state.pinned) }}
          title={state.pinned ? t('drawer.unpin', 'Unpin drawer') : t('drawer.pin', 'Pin drawer')}
        >
          <WindowIcon size={13} />
        </button>
        {slot !== 'statusbar' && (
          <button
            type="button"
            className="btn-icon-sm text-text-muted hover:text-text-primary"
            data-testid="morph-to-popout"
            onClick={() => { void morphToPopout() }}
            title={t('drawer.morphToPopout', 'Morph drawer to popout')}
          >
            <WindowIcon size={13} />
          </button>
        )}
        <button
          type="button"
          className="btn-icon-sm text-error/70 hover:text-error"
          data-testid={`drawer-${slot}-close`}
          onClick={() => { void setOpen(false) }}
          title={t('drawer.close', 'Close drawer')}
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </header>
  )
}
