import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DrawerPopoutView } from './DrawerPopoutView'
import { BUILTIN_DRAWER_CONTENTS } from './drawer-model'

// DrawerContentRegistry resolves its renderers via dynamic import() of the heavy
// DrawerContentModules chunk. Under full-suite transform contention that first
// import can balloon past testing-library's wait window, leaving the assertion
// racing a cold module transform rather than the behavior under test. Warm the
// module into vitest's cache up front so React.lazy resolves from cache and this
// test deterministically exercises real content rendering (not a blank window).
beforeAll(async () => {
  await import('./DrawerContentModules')
})

describe('DrawerPopoutView', () => {
  afterEach(() => {
    delete (window.devhub as { r8?: unknown }).r8
  })

  it('renders the morphed drawer content (notifications) keyed by a contentId target', async () => {
    const list = vi.fn(async () => [{
      id: 'notification-popout-1',
      level: 'INFO',
      source: 'runtime',
      title: '浮窗通知',
      body: '在抽屉浮窗里渲染的真实通知'
    }])
    Object.assign(window.devhub, {
      r8: {
        notify: { list, onStream: () => () => undefined, onStatusbar: () => () => undefined }
      }
    })

    render(
      <DrawerPopoutView
        initialTarget={{ kind: 'contentId', value: BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS }}
      />
    )

    // The title from the drawer content definition shows in the popout header.
    expect(await screen.findByText('通知中心')).toBeInTheDocument()
    // And the real content (the notifications list) renders through the lazily
    // loaded DrawerContentRegistry, not a blank window. The module is pre-warmed in
    // beforeAll so React.lazy resolves from cache; this timeout only needs to cover
    // the async notify list() round-trip plus a state flush.
    expect(await screen.findByText('浮窗通知', undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(list).toHaveBeenCalled()
  })

  it('degrades to a content-missing notice when no target is provided', () => {
    render(<DrawerPopoutView initialTarget={null} />)
    expect(screen.getByText('缺少内容标识')).toBeInTheDocument()
    expect(screen.getByText(/无法识别要在此窗口渲染的 Drawer 内容/)).toBeInTheDocument()
  })
})
