import { useMemo } from 'react'
import type { DetachableViewProps } from '../popout/detachable-registry'
import { getDrawerContentDefinition } from './drawer-model'
import { DrawerContentRegistry } from './DrawerContentRegistry'

/**
 * Renders a single drawer content source as a standalone full-window view inside a
 * detached BrowserWindow. This is what a drawer "morph to popout" tears out into:
 * the morph creates a real `surface: 'drawer'` BrowserWindow whose target carries
 * `contentId:<id>`, and this view re-renders that content with the same
 * {@link DrawerContentRegistry} the in-app drawer uses (so notifications.top and
 * friends show their real content in the floating window — no blank, invisible
 * floating record).
 *
 * The `contentId` arrives through the shared detach-target channel
 * (`initialTarget.kind === 'contentId'`); the slot is derived from the content
 * definition's `defaultSlot` so the registry routes to the correct renderer.
 */
export function DrawerPopoutView({ initialTarget }: DetachableViewProps): React.JSX.Element {
  const contentId = initialTarget?.kind === 'contentId' ? initialTarget.value : null
  const definition = useMemo(() => getDrawerContentDefinition(contentId), [contentId])
  const slot = definition?.defaultSlot ?? 'floating'

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-900 text-text-primary" data-r8c-drawer-popout={contentId ?? 'unknown'}>
      {definition && (
        <header className="flex items-center justify-between gap-3 border-b border-surface-700 bg-surface-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[10px] uppercase tracking-[0.2em] text-text-muted">独立窗</div>
            <h1 className="truncate text-base font-bold text-text-primary">{definition.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
            {contentId && <span className="font-mono">{contentId}</span>}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <span>独立窗</span>
          </div>
        </header>
      )}
      <div className="flex-1 overflow-y-auto">
        {contentId
          ? (
              <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                <DrawerContentRegistry slot={slot} contentId={contentId} />
              </div>
            )
          : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-sm border-l-2 border-surface-600 bg-surface-950 p-4 radius-sm">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">独立窗</div>
                  <div className="mt-1 text-sm font-bold text-text-primary">缺少内容标识</div>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">无法识别要在此窗口渲染的 Drawer 内容,可关闭此窗重新从主窗发起 morph。</p>
                </div>
              </div>
            )}
      </div>
      <footer className="flex items-center justify-between border-t border-surface-700 bg-surface-900 px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted">
        <span className="font-mono">{contentId ?? 'unknown'}</span>
        <span>{slot}</span>
      </footer>
    </div>
  )
}
