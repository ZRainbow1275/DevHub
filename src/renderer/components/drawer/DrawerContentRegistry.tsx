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
const LazySettings = lazyDrawerContent(module => module.SettingsDrawerContent)
const LazyObservability = lazyDrawerContent(module => module.ObservabilityDrawerContent)
const LazyLogs = lazyDrawerContent(module => module.LogsDrawerContent)
const LazyTerminal = lazyDrawerContent(module => module.TerminalDrawerContent)
const LazyVersionBanner = lazyDrawerContent(module => module.VersionBannerDrawerContent)
const LazyPortDetail = lazyDrawerContent(module => module.PortDetailDrawerContent)
const LazyProcessDetail = lazyDrawerContent(module => module.ProcessDetailDrawerContent)
const LazyWindowDetail = lazyDrawerContent(module => module.WindowDetailDrawerContent)
const LazyAITaskDetail = lazyDrawerContent(module => module.AITaskDetailDrawerContent)
const LazyRegisteredBoundary = lazyDrawerContent(module => module.RegisteredBoundaryDrawerContent)

const LAZY_DRAWER_CONTENTS: Record<BuiltinDrawerContentId, ComponentType<DrawerContentModuleProps>> = {
  [BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS]: LazyNotifications,
  [BUILTIN_DRAWER_CONTENTS.TOP_VERSION_BANNER]: LazyVersionBanner,
  // RIGHT detail surfaces embed the full Monitor view (embedded-full-view
  // pattern) and mirror the in-tab selection store; same renderer reused by the
  // panel popout shell.
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PORT]: LazyPortDetail,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PROCESS]: LazyProcessDetail,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_WINDOW]: LazyWindowDetail,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_AI_TASK_DETAIL]: LazyAITaskDetail,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_INJECT_WHITELIST]: LazyInjectWhitelist,
  [BUILTIN_DRAWER_CONTENTS.RIGHT_SETTINGS]: LazySettings,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_TERMINAL]: LazyTerminal,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_OBSERVABILITY]: LazyObservability,
  [BUILTIN_DRAWER_CONTENTS.BOTTOM_LOGS]: LazyLogs,
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
