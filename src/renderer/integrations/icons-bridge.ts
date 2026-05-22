import type { ComponentType, SVGProps } from 'react'
import * as HeroIconsOutline from '@heroicons/react/24/outline'
import * as LucideIcons from 'lucide-react'
import * as RadixIcons from '@radix-ui/react-icons'
import * as TablerIcons from '@tabler/icons-react'

export type R8IconLibraryId = 'lucide' | 'tabler' | 'radix-icons' | 'heroicons'
export type R8IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export interface R8IconLibrarySource {
  id: R8IconLibraryId
  packageName: string
  purpose: string
}

export const R8_ICON_LIBRARY_SOURCES: readonly R8IconLibrarySource[] = [
  { id: 'lucide', packageName: 'lucide-react', purpose: 'primary app and action icons' },
  { id: 'tabler', packageName: '@tabler/icons-react', purpose: 'technical and developer-tool icons' },
  { id: 'radix-icons', packageName: '@radix-ui/react-icons', purpose: 'primitive-aligned control icons' },
  { id: 'heroicons', packageName: '@heroicons/react', purpose: 'navigation and status icons' }
]

const iconLibraries: Record<R8IconLibraryId, Record<string, unknown>> = {
  lucide: LucideIcons,
  tabler: TablerIcons,
  'radix-icons': RadixIcons,
  heroicons: HeroIconsOutline
}

export function resolveIconComponent(libraryId: R8IconLibraryId, exportName: string): R8IconComponent | null {
  const candidate = iconLibraries[libraryId][exportName]
  return typeof candidate === 'function' ? candidate as R8IconComponent : null
}
