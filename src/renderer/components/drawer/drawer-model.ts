import type { DrawerSlot, DrawerState } from '@shared/schemas/r8-runtime'

export const DRAWER_SLOTS: DrawerSlot[] = ['top', 'right', 'bottom', 'floating', 'statusbar']

export const DRAWER_LIMITS: Record<DrawerSlot, { min: number; max: number; defaultSize: number; zIndex: number }> = {
  top: { min: 40, max: 240, defaultSize: 80, zIndex: 2000 },
  right: { min: 280, max: 800, defaultSize: 360, zIndex: 2010 },
  bottom: { min: 120, max: 600, defaultSize: 240, zIndex: 2020 },
  floating: { min: 240, max: 640, defaultSize: 320, zIndex: 4000 },
  statusbar: { min: 28, max: 96, defaultSize: 28, zIndex: 1500 }
}

export const BUILTIN_DRAWER_CONTENTS = {
  TOP_NOTIFICATIONS: 'notifications.top',
  TOP_VERSION_BANNER: 'system.version-banner',
  RIGHT_DETAIL_PORT: 'monitor.port-detail',
  RIGHT_DETAIL_PROCESS: 'monitor.process-detail',
  RIGHT_DETAIL_WINDOW: 'monitor.window-detail',
  RIGHT_AI_TASK_DETAIL: 'ai-task.detail',
  RIGHT_INJECT_WHITELIST: 'inject.whitelist',
  RIGHT_SETTINGS: 'settings',
  BOTTOM_TERMINAL: 'terminal',
  BOTTOM_OBSERVABILITY: 'observability',
  BOTTOM_LOGS: 'logs',
  FLOATING_POPOUT_MANAGER: 'popout.manager',
  STATUSBAR_AGGREGATE: 'statusbar.aggregate'
} as const

export type BuiltinDrawerContentId = typeof BUILTIN_DRAWER_CONTENTS[keyof typeof BUILTIN_DRAWER_CONTENTS]

export interface DrawerContentDefinition {
  id: BuiltinDrawerContentId
  title: string
  description: string
  defaultSlot: DrawerSlot
  allowedSlots: DrawerSlot[]
  scope: DrawerState['scope']
  initialSize: number
  minSize: number
  maxSize: number
  iconToken?: string
}

export const DRAWER_CONTENT_REGISTRY: DrawerContentDefinition[] = [
  {
    id: BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS,
    title: '通知中心',
    description: '实时通知、错误和桌面铃铛事件',
    defaultSlot: 'top',
    allowedSlots: ['top', 'floating'],
    scope: 'global',
    initialSize: 80,
    minSize: 40,
    maxSize: 240,
    iconToken: 'BellIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.TOP_VERSION_BANNER,
    title: '版本横幅',
    description: '版本更新与发布提示',
    defaultSlot: 'top',
    allowedSlots: ['top'],
    scope: 'global',
    initialSize: 80,
    minSize: 40,
    maxSize: 240
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PORT,
    title: '端口详情',
    description: '监听端口与进程关系详情',
    defaultSlot: 'right',
    allowedSlots: ['right', 'floating'],
    scope: 'monitor',
    initialSize: 360,
    minSize: 280,
    maxSize: 800,
    iconToken: 'PortIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PROCESS,
    title: '进程详情',
    description: '系统进程详情面板',
    defaultSlot: 'right',
    allowedSlots: ['right', 'floating'],
    scope: 'monitor',
    initialSize: 360,
    minSize: 280,
    maxSize: 800,
    iconToken: 'ProcessIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_WINDOW,
    title: '窗口详情',
    description: '窗口管理详情面板',
    defaultSlot: 'right',
    allowedSlots: ['right', 'floating'],
    scope: 'monitor',
    initialSize: 360,
    minSize: 280,
    maxSize: 800,
    iconToken: 'WindowIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_AI_TASK_DETAIL,
    title: 'AI 任务详情',
    description: 'AI 任务状态与回放入口',
    defaultSlot: 'right',
    allowedSlots: ['right', 'bottom', 'floating'],
    scope: 'ai-task',
    initialSize: 360,
    minSize: 280,
    maxSize: 800,
    iconToken: 'AIIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_INJECT_WHITELIST,
    title: '注入白名单',
    description: 'R8.C 注入目标授权、过期与删除管理',
    defaultSlot: 'right',
    allowedSlots: ['right', 'floating'],
    scope: 'global',
    initialSize: 420,
    minSize: 320,
    maxSize: 800,
    iconToken: 'TerminalIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.RIGHT_SETTINGS,
    title: '设置',
    description: '应用设置入口',
    defaultSlot: 'right',
    allowedSlots: ['right', 'floating'],
    scope: 'global',
    initialSize: 360,
    minSize: 280,
    maxSize: 800
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.BOTTOM_TERMINAL,
    title: '终端',
    description: '任务运行与命令输出区域',
    defaultSlot: 'bottom',
    allowedSlots: ['bottom', 'floating'],
    scope: 'project',
    initialSize: 240,
    minSize: 120,
    maxSize: 600,
    iconToken: 'TerminalIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.BOTTOM_OBSERVABILITY,
    title: '可观测面板',
    description: '运行时指标、IPC 与诊断快照',
    defaultSlot: 'bottom',
    allowedSlots: ['bottom', 'floating'],
    scope: 'global',
    initialSize: 240,
    minSize: 120,
    maxSize: 600
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.BOTTOM_LOGS,
    title: '日志',
    description: '项目日志与系统事件',
    defaultSlot: 'bottom',
    allowedSlots: ['bottom', 'floating'],
    scope: 'project',
    initialSize: 240,
    minSize: 120,
    maxSize: 600,
    iconToken: 'LogIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.FLOATING_POPOUT_MANAGER,
    title: '浮卡管理',
    description: '当前浮卡与 BrowserWindow popout 状态',
    defaultSlot: 'floating',
    allowedSlots: ['floating', 'right'],
    scope: 'global',
    initialSize: 320,
    minSize: 240,
    maxSize: 640,
    iconToken: 'WindowIcon'
  },
  {
    id: BUILTIN_DRAWER_CONTENTS.STATUSBAR_AGGREGATE,
    title: '状态栏聚合',
    description: 'R8 状态徽章与实时聚合值',
    defaultSlot: 'statusbar',
    allowedSlots: ['statusbar', 'top'],
    scope: 'global',
    initialSize: 28,
    minSize: 28,
    maxSize: 96
  }
]

export function getDrawerContentDefinition(contentId: string | null | undefined): DrawerContentDefinition | null {
  if (!contentId) return null
  return DRAWER_CONTENT_REGISTRY.find(definition => definition.id === contentId) ?? null
}

export function clampDrawerSize(slot: DrawerSlot, size: number): number {
  const limits = DRAWER_LIMITS[slot]
  return Math.max(limits.min, Math.min(limits.max, Math.round(size)))
}

export function getDrawerDefaultState(slot: DrawerSlot, now = Date.now()): DrawerState {
  const limits = DRAWER_LIMITS[slot]
  const content = DRAWER_CONTENT_REGISTRY.find(definition => definition.defaultSlot === slot)
  const base = {
    slot,
    open: false,
    pinned: false,
    contentId: content?.id ?? null,
    scope: content?.scope ?? 'global',
    size: limits.defaultSize,
    zIndex: limits.zIndex,
    updatedAt: now
  }
  if (slot === 'right' || slot === 'floating') return { ...base, width: limits.defaultSize }
  return { ...base, height: limits.defaultSize }
}

export function createDefaultDrawerStateMap(now = Date.now()): Record<DrawerSlot, DrawerState> {
  return DRAWER_SLOTS.reduce<Record<DrawerSlot, DrawerState>>((states, slot) => {
    states[slot] = getDrawerDefaultState(slot, now)
    return states
  }, {} as Record<DrawerSlot, DrawerState>)
}

export function normalizeDrawerState(input: DrawerState): DrawerState {
  const content = getDrawerContentDefinition(input.contentId)
  const nextSize = clampDrawerSize(input.slot, input.size ?? input.width ?? input.height ?? DRAWER_LIMITS[input.slot].defaultSize)
  return {
    ...input,
    scope: input.scope ?? content?.scope ?? 'global',
    pinned: Boolean(input.pinned),
    size: nextSize,
    width: input.slot === 'right' || input.slot === 'floating' ? nextSize : undefined,
    height: input.slot === 'top' || input.slot === 'bottom' || input.slot === 'statusbar' ? nextSize : undefined,
    zIndex: input.zIndex ?? DRAWER_LIMITS[input.slot].zIndex
  }
}

export function drawerStatesToMap(states: DrawerState[], now = Date.now()): Record<DrawerSlot, DrawerState> {
  const defaults = createDefaultDrawerStateMap(now)
  for (const state of states) {
    defaults[state.slot] = normalizeDrawerState({ ...defaults[state.slot], ...state })
  }
  return defaults
}

export function updateDrawerOpen(state: DrawerState, open: boolean, contentId = state.contentId): DrawerState {
  const content = getDrawerContentDefinition(contentId)
  return normalizeDrawerState({
    ...state,
    open,
    contentId,
    scope: content?.scope ?? state.scope,
    updatedAt: Date.now()
  })
}

export function updateDrawerSize(state: DrawerState, size: number): DrawerState {
  return normalizeDrawerState({
    ...state,
    size,
    updatedAt: Date.now()
  })
}
