export const ICON_LIBRARY_VALUES = ['lucide', 'tabler', 'radix', 'heroicons', 'brand'] as const

export type IconLibrary = typeof ICON_LIBRARY_VALUES[number]

export const ICON_TOKEN_REGEX = /^([a-z]+):([A-Za-z0-9]+)$/

export const ICON_LIMITS = {
  DEFAULT_SIZE: 16,
  TILE_SIZE: 20,
  STATUS_SIZE: 14,
  HERO_SIZE: 24,
  STROKE_DEFAULT: 1.5,
  STROKE_THICK: 2,
  BUNDLE_KB_MAX: 200,
} as const

export const ICON_LIBRARY_USAGE: Record<IconLibrary, string> = {
  lucide: 'Primary product actions, toolbar icons, cards, statusbar, and monitor controls.',
  tabler: 'Settings, detailed forms, decoration controls, and secondary technical surfaces.',
  radix: 'Primitive UI internals such as cmdk, dialog chrome, chevrons, crosses, and dots.',
  heroicons: 'Marketing-scale hero icons, empty states, and large explanatory surfaces.',
  brand: 'Official AI tool and platform logos through simple-icons or vetted local SVG assets.',
} as const

export const ICON_AVAILABLE_NAMES: Record<IconLibrary, readonly string[]> = {
  lucide: [
    'AlertTriangle',
    'BarChart3',
    'Bell',
    'Bot',
    'Brain',
    'CheckCircle2',
    'Edit2',
    'Eye',
    'Flame',
    'Folder',
    'HelpCircle',
    'Info',
    'Lock',
    'Monitor',
    'Package',
    'Palette',
    'Pause',
    'Play',
    'RefreshCw',
    'Search',
    'Settings',
    'Square',
    'Tag',
    'Terminal',
    'Trash2',
    'XCircle',
    'Zap',
  ],
  tabler: [
    'Adjustments',
    'Box',
    'Cpu',
    'Database',
    'Forms',
    'LayoutDashboard',
    'Palette',
    'Settings',
  ],
  radix: [
    'Check',
    'ChevronDown',
    'Cross1',
    'DotFilled',
    'Gear',
    'MagnifyingGlass',
  ],
  heroicons: [
    'Bell',
    'InformationCircle',
    'Megaphone',
    'RocketLaunch',
    'Sparkles',
  ],
  brand: [
    'Anthropic',
    'Claude',
    'GitHub',
    'Google',
    'GoogleGemini',
    'OpenAI',
  ],
} as const

export interface ParsedIconToken {
  library: IconLibrary
  name: string
}

export const ICON_FALLBACK_TOKEN = 'lucide:HelpCircle'

export function parseIconToken(token: string): ParsedIconToken | null {
  const match = token.trim().match(ICON_TOKEN_REGEX)
  if (!match) {
    return null
  }

  const library = match[1] as IconLibrary
  if (!ICON_LIBRARY_VALUES.includes(library)) {
    return null
  }

  return { library, name: match[2] }
}

export function isKnownIconName(library: IconLibrary, name: string): boolean {
  return ICON_AVAILABLE_NAMES[library].includes(name)
}

export function listIconCounts(): Record<IconLibrary, number> {
  return ICON_LIBRARY_VALUES.reduce<Record<IconLibrary, number>>((counts, library) => {
    counts[library] = ICON_AVAILABLE_NAMES[library].length
    return counts
  }, {
    lucide: 0,
    tabler: 0,
    radix: 0,
    heroicons: 0,
    brand: 0,
  })
}
