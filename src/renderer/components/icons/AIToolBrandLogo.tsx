import { SiCline, SiClineHex, SiCursor, SiCursorHex, SiWindsurf, SiWindsurfHex } from '@icons-pack/react-simple-icons'
import type { CSSProperties } from 'react'
import type { AIToolType } from '@shared/types-extended'
import { BrandLogo, type BrandIconName } from '../icon'
import { GearIcon } from './index'
import aiderLogoUrl from './brand-logos/aider.svg'
import continueLogoUrl from './brand-logos/continue.svg'
import openCodeLogoUrl from './brand-logos/opencode-logo-dark-square.svg'

type BrandComponent = typeof SiCursor

type BrandLogoEntry =
  | { kind: 'component'; Icon: BrandComponent; color: string }
  | { kind: 'asset'; src: string }
  | { kind: 'brand-token'; brand: BrandIconName }
  | { kind: 'fallback'; Icon: typeof GearIcon; className: string }

const TOOL_BRAND_LOGOS: Record<AIToolType, BrandLogoEntry> = {
  'codex': { kind: 'brand-token', brand: 'OpenAI' },
  'claude-code': { kind: 'brand-token', brand: 'Claude' },
  'gemini-cli': { kind: 'brand-token', brand: 'GoogleGemini' },
  'cursor': { kind: 'component', Icon: SiCursor, color: SiCursorHex },
  'opencode': { kind: 'asset', src: openCodeLogoUrl },
  'aider': { kind: 'asset', src: aiderLogoUrl },
  'windsurf': { kind: 'component', Icon: SiWindsurf, color: SiWindsurfHex },
  'continue-dev': { kind: 'asset', src: continueLogoUrl },
  'cline': { kind: 'component', Icon: SiCline, color: SiClineHex },
  'other': { kind: 'fallback', Icon: GearIcon, className: 'text-text-muted' },
}

export const BRAND_LOGO_TOOL_TYPES = Object.freeze(
  Object.keys(TOOL_BRAND_LOGOS) as AIToolType[],
)

export interface AIToolBrandLogoProps {
  toolType: AIToolType
  size?: number
  className?: string
  title?: string
}

export function AIToolBrandLogo({
  toolType,
  size = 20,
  className = '',
  title,
}: AIToolBrandLogoProps) {
  const entry = TOOL_BRAND_LOGOS[toolType]
  const ariaLabel = title ?? `${toolType} logo`
  const wrapperClassName = ['inline-flex items-center justify-center shrink-0', className]
    .filter(Boolean)
    .join(' ')
  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
  }

  if (entry.kind === 'asset') {
    return (
      <span
        aria-label={ariaLabel}
        className={wrapperClassName}
        data-tool-logo={toolType}
        role="img"
        style={wrapperStyle}
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          draggable={false}
          src={entry.src}
        />
      </span>
    )
  }

  if (entry.kind === 'brand-token') {
    return (
      <span
        aria-label={ariaLabel}
        className={wrapperClassName}
        data-tool-logo={toolType}
        role="img"
        style={wrapperStyle}
      >
        <BrandLogo
          brand={entry.brand}
          decorative
          size={size}
          className="h-full w-full"
        />
      </span>
    )
  }

  if (entry.kind === 'component') {
    const Icon = entry.Icon

    return (
      <span
        aria-label={ariaLabel}
        className={wrapperClassName}
        data-tool-logo={toolType}
        role="img"
        style={wrapperStyle}
      >
        <Icon color={entry.color} size={size} title="" />
      </span>
    )
  }

  const FallbackIcon = entry.Icon

  return (
    <span
      aria-label={ariaLabel}
      className={wrapperClassName}
      data-tool-logo={toolType}
      role="img"
      style={wrapperStyle}
    >
      <FallbackIcon className={entry.className} size={size} />
    </span>
  )
}
