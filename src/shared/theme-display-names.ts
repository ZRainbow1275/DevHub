import type { ThemeOption } from './types'

// Localized display names for each palette slug. Lives in shared so BOTH the
// renderer (theme-language.ts re-exports this) and the main process
// (R8RuntimeService.statusAggregate) resolve the same human-readable theme name
// without the main process importing renderer code. Keyed by ThemeOption so
// adding a palette to the union forces a matching display name here.
export const PALETTE_DISPLAY_NAMES: Record<ThemeOption, string> = {
  constructivism: '构成主义',
  'modern-light': '现代明亮',
  'warm-light': '暖光',
  cyberpunk: '赛博朋克',
  swiss: '瑞士极简',
  dark: '暗色控制台',
  light: '浅色控制台'
}

// Resolve a raw palette slug to its localized display name, tolerating unknown
// or empty slugs (e.g. a future palette read off the DOM before this module updates).
export function getPaletteDisplayName(slug: string | null | undefined): string {
  if (!slug) return PALETTE_DISPLAY_NAMES.constructivism
  return (PALETTE_DISPLAY_NAMES as Record<string, string>)[slug] ?? slug
}
