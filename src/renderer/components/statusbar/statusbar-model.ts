import {
  STATUSBAR_LIMITS,
  type StatusAggregate,
  type StatusbarConfig,
  type StatusTile,
  type StatusTileId
} from '@shared/schemas/r8-runtime'

export const STATUSBAR_CONFIG_CHANGE_EVENT = 'devhub:statusbar-config-changed'

export const STATUSBAR_BUILTIN_TILE_IDS = [
  'cpu',
  'mem',
  'net',
  'battery',
  'projects',
  'ai-tasks',
  'public-ports',
  'listening-ports',
  'notifications',
  'popouts',
  'theme',
  'cmdk'
] as const satisfies readonly StatusTileId[]

const DEFAULT_TONE_BY_ID: Record<StatusTileId, StatusTile['tone']> = {
  cpu: 'neutral',
  mem: 'neutral',
  net: 'neutral',
  battery: 'neutral',
  projects: 'neutral',
  'ai-tasks': 'neutral',
  'public-ports': 'success',
  'listening-ports': 'neutral',
  notifications: 'neutral',
  popouts: 'neutral',
  theme: 'accent',
  cmdk: 'success',
  time: 'neutral'
}

const DEFAULT_LABEL_BY_ID: Record<StatusTileId, string> = {
  cpu: 'CPU',
  mem: 'MEM',
  net: 'NET',
  battery: 'BAT',
  projects: '项目',
  'ai-tasks': 'AI',
  'public-ports': '公网',
  'listening-ports': '监听',
  notifications: '通知',
  popouts: '浮卡',
  theme: '主题',
  cmdk: 'CMDK',
  time: '时间'
}

export function createStatusTile(
  id: StatusTileId,
  value: StatusTile['value'],
  now: number,
  extras: Partial<StatusTile> = {}
): StatusTile {
  const fallbackOrder = STATUSBAR_BUILTIN_TILE_IDS.findIndex(tileId => tileId === id)
  return {
    id,
    label: extras.label ?? DEFAULT_LABEL_BY_ID[id],
    value,
    tone: extras.tone ?? DEFAULT_TONE_BY_ID[id],
    source: extras.source ?? 'renderer',
    updatedAt: extras.updatedAt ?? now,
    visible: extras.visible ?? true,
    order: extras.order ?? (fallbackOrder >= 0 ? fallbackOrder : STATUSBAR_LIMITS.MAX_VISIBLE_TILES),
    align: extras.align ?? 'left',
    badgeType: extras.badgeType,
    badgeValue: extras.badgeValue,
    iconToken: extras.iconToken,
    tooltip: extras.tooltip,
    clickAction: extras.clickAction
  }
}

export function splitStatusBarTiles(tiles: readonly StatusTile[], maxVisible: number = STATUSBAR_LIMITS.MAX_VISIBLE_TILES) {
  const sorted = [...tiles]
    .filter(tile => tile.visible)
    .sort((left, right) => left.order - right.order)
  return {
    visibleTiles: sorted.slice(0, maxVisible),
    overflowTiles: sorted.slice(maxVisible)
  }
}

export function mergeStatusTiles(primary: readonly StatusTile[], fallback: readonly StatusTile[]): StatusTile[] {
  const merged = new Map<StatusTileId, StatusTile>()
  for (const tile of fallback) merged.set(tile.id, tile)
  for (const tile of primary) {
    const base = merged.get(tile.id)
    merged.set(tile.id, {
      ...base,
      ...tile,
      clickAction: tile.clickAction ?? base?.clickAction,
      iconToken: tile.iconToken ?? base?.iconToken,
      tooltip: tile.tooltip ?? base?.tooltip
    })
  }
  return [...merged.values()].sort((left, right) => left.order - right.order)
}

export function applyStatusbarConfig(tiles: readonly StatusTile[], config: StatusbarConfig | null): StatusTile[] {
  if (!config) return [...tiles].sort((left, right) => left.order - right.order)
  const configuredById = new Map(config.tiles.map(tile => [tile.id, tile]))
  return tiles
    .map(tile => {
      const configured = configuredById.get(tile.id)
      if (!configured) return tile
      return {
        ...tile,
        visible: configured.visible,
        order: configured.order,
        align: configured.align
      }
    })
    .sort((left, right) => left.order - right.order)
}

export function createEmptyStatusAggregate(now: number): StatusAggregate {
  const tiles = STATUSBAR_BUILTIN_TILE_IDS.map(tileId => createStatusTile(tileId, tileId === 'cmdk' ? 'Ctrl+K' : 0, now, {
    visible: tileId !== 'battery',
    badgeType: tileId === 'theme' ? 'new' : 'number',
    badgeValue: tileId === 'theme' ? 'NEW' : 0
  }))
  return {
    generatedAt: now,
    tiles,
    badges: tiles.filter(tile => tile.visible).slice(0, 6),
    refreshIntervalMs: STATUSBAR_LIMITS.REFRESH_INTERVAL_MS
  }
}
