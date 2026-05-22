import { lazy, Suspense, type ComponentType } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import {
  BUILTIN_DRAWER_CONTENTS,
  type BuiltinDrawerContentId,
  getDrawerContentDefinition
} from './drawer-model'
import type { DrawerContentModuleProps } from './DrawerContentModules'

interface DrawerContentRegistryProps {
  slot: DrawerSlot
  contentId: string | null
}

type DrawerContentModule = typeof import('./DrawerContentModules')

function lazyDrawerContent(select: (module: DrawerContentModule) => ComponentType<DrawerContentModuleProps>) {
  return lazy(async () => {
    const module = await import('./DrawerContentModules')
    return { default: select(module) }
  })
}

const LazyRegistryCatalog = lazyDrawerContent(module => module.RegistryCatalogContent)
const LazyNotifications = lazyDrawerContent(module => module.NotificationsDrawerContent)
const LazyStatusAggregate = lazyDrawerContent(module => module.StatusAggregateDrawerContent)
const LazyPopoutManager = lazyDrawerContent(module => module.PopoutManagerDrawerContent)
const LazyInjectWhitelist = lazyDrawerContent(module => module.InjectWhitelistDrawerContent)
const LazyTerminalLike = lazyDrawerContent(module => module.TerminalLikeDrawerContent)
const LazyRegisteredBoundary = lazyDrawerContent(module => module.RegisteredBoundaryDrawerContent)

const LAZY_DRAWER_CONTENTS: Record<BuiltinDrawerContentId, ComponentType<DrawerContentModuleProps>> = {
  [BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS]: LazyNotifications,
  [BUILTIN_DRAWER_CONTENTS.TOP_VERSION_BANNER]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PORT]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PROCESS]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_WINDOW]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_AI_TASK_DETAIL]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_INJECT_WHITELIST]: LazyInjectWhitelist,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_SETTINGS]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_TERMINAL]: LazyTerminalLike,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_OBSERVABILITY]: LazyRegisteredBoundary,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_LOGS]: LazyTerminalLike,
  [BUILTIN_DRAWER_CONTENTS.FLOATING_POPOUT_MANAGER]: LazyPopoutManager,
  [BUILTIN_DRAWER_CONTENTS.STATUSBAR_AGGREGATE]: LazyStatusAggregate
}

function isBuiltinDrawerContentId(contentId: string): contentId is BuiltinDrawerContentId {
  return Object.values(BUILTIN_DRAWER_CONTENTS).includes(contentId as BuiltinDrawerContentId)
}

function DrawerContentLoading({ contentId }: { contentId: string | null }) {
  return (
    <div className="text-xs text-text-muted" data-testid="drawer-content-loading" data-r8b-drawer-loading-content={contentId ?? 'registry'}>
      正在加载 Drawer 内容。
    </div>
  )
}

export function DrawerContentRegistry({ slot, contentId }: DrawerContentRegistryProps) {
  const definition = getDrawerContentDefinition(contentId)
  const ContentComponent = !contentId
    ? LazyRegistryCatalog
    : isBuiltinDrawerContentId(contentId)
      ? LAZY_DRAWER_CONTENTS[contentId]
      : LazyRegisteredBoundary

  return (
    <Suspense fallback={<DrawerContentLoading contentId={contentId} />}>
      <ContentComponent slot={slot} contentId={contentId} definition={definition} />
    </Suspense>
  )
}
