import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ThemeDecorationConfig, ThemeDecorationKind, ThemeDecorationPosition } from '@shared/types'
import { useDecoration } from '../../hooks/useDecoration'

const BUILTIN_DECORATION_KINDS: Exclude<ThemeDecorationKind, 'none' | 'custom-svg'>[] = [
  'soviet-geo',
  'diagonals',
  'paper',
  'scanline',
  'grid',
  'golden',
  'noise',
  'blocks',
]

export const THEME_DECORATION_BUILTIN_COUNT = BUILTIN_DECORATION_KINDS.length

export interface ThemeDecorationProps {
  className?: string
  config?: ThemeDecorationConfig
  position?: ThemeDecorationPosition
}

interface ThemeDecorationContentProps extends Omit<ThemeDecorationProps, 'config'> {
  activeConfig: ThemeDecorationConfig
}

function getLayerStyle(config: ThemeDecorationConfig): CSSProperties {
  return {
    opacity: config.opacity,
    mixBlendMode: config.blendMode,
    transform: `scale(${config.scale})`,
    transformOrigin: 'center',
    zIndex: 'var(--z-tier-base, 0)',
  }
}

function DiagonalsDecoration() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'repeating-linear-gradient(135deg, var(--surface-700) 0 1px, transparent 1px 18px)',
      }}
    />
  )
}

function BlocksDecoration() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[6%] top-[12%] h-20 w-32 bg-accent" />
      <div className="absolute right-[10%] top-[20%] h-12 w-48 bg-gold" />
      <div className="absolute bottom-[14%] left-[28%] h-16 w-16 bg-error" />
    </div>
  )
}

function PaperDecoration() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'var(--deco-pattern-image), linear-gradient(90deg, rgba(255,255,255,0.12), transparent)',
        backgroundSize: '40px 40px, 100% 100%',
      }}
    />
  )
}

function ScanlineDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 2px, rgba(255,255,255,0.18) 2px 3px)',
        }}
      />
      <div
        className="absolute left-0 right-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--deco-glow-color, rgba(0,255,255,0.5)), transparent)',
          animation: 'scanline 6s linear infinite',
        }}
      />
    </div>
  )
}

function GridDecoration() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'linear-gradient(var(--surface-600) 1px, transparent 1px), linear-gradient(90deg, var(--surface-600) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
  )
}

function GoldenDecoration() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M61.8 0 V100" stroke="var(--gold)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      <path d="M0 38.2 H100" stroke="var(--gold)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      <path d="M61.8 38.2 C61.8 72 38.2 100 0 100" fill="none" stroke="var(--gold)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function NoiseDecoration() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.12) 0 1px, transparent 1px)',
        backgroundSize: '17px 19px, 23px 29px',
      }}
    />
  )
}

function SovietGeoDecoration() {
  return (
    <div className="absolute inset-0">
      <DiagonalsDecoration />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="0,0 32,0 0,42" fill="var(--red-500)" />
        <polygon points="100,100 68,100 100,58" fill="var(--gold)" />
        <line x1="0" y1="100" x2="100" y2="0" stroke="var(--red-500)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function CustomSvgDecoration({ customSvgId }: { customSvgId?: string }) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!customSvgId) {
      setContent(null)
      return undefined
    }

    const contentPromise = window.devhub?.r8?.themeDecoration?.getCustomSvgContent?.(customSvgId)
    if (!contentPromise) {
      setContent(null)
      return () => {
        cancelled = true
      }
    }

    void contentPromise.then(entry => {
        if (!cancelled) setContent(entry?.sanitizedContent ?? null)
      })
      .catch(() => {
        if (!cancelled) setContent(null)
      })

    return () => {
      cancelled = true
    }
  }, [customSvgId])

  if (!content) return null

  return (
    <div
      className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
      data-testid="theme-decoration-custom-svg"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

function renderDecoration(config: ThemeDecorationConfig): ReactNode {
  const { kind } = config
  switch (kind) {
    case 'soviet-geo':
      return <SovietGeoDecoration />
    case 'diagonals':
      return <DiagonalsDecoration />
    case 'paper':
      return <PaperDecoration />
    case 'scanline':
      return <ScanlineDecoration />
    case 'grid':
      return <GridDecoration />
    case 'golden':
      return <GoldenDecoration />
    case 'noise':
      return <NoiseDecoration />
    case 'blocks':
      return <BlocksDecoration />
    case 'custom-svg':
      return <CustomSvgDecoration customSvgId={config.customSvgId} />
    case 'none':
    default:
      return null
  }
}

function ThemeDecorationContent({
  className = '',
  activeConfig,
  position = 'global-background',
}: ThemeDecorationContentProps) {
  const content = renderDecoration(activeConfig)

  if (!content || !activeConfig.positions.includes(position)) return null

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      data-decoration-kind={activeConfig.kind}
      data-decoration-position={position}
      style={getLayerStyle(activeConfig)}
      aria-hidden="true"
    >
      {content}
    </div>
  )
}

function ThemeDecorationFromSettings(props: Omit<ThemeDecorationProps, 'config'>) {
  const decoration = useDecoration()
  return <ThemeDecorationContent {...props} activeConfig={decoration.config} />
}

export function ThemeDecoration({ config, ...props }: ThemeDecorationProps) {
  if (config) return <ThemeDecorationContent {...props} activeConfig={config} />
  return <ThemeDecorationFromSettings {...props} />
}

export default ThemeDecoration
