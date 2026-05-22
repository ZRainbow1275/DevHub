import type { CSSProperties } from 'react'
import { useIcon, useIconDefaults } from './useIcon'

export interface IconProps {
  className?: string
  color?: string
  decorative?: boolean
  label?: string
  size?: number
  strokeWidth?: number
  style?: CSSProperties
  token: string
}

export function Icon({
  className = '',
  color,
  decorative = true,
  label,
  size,
  strokeWidth,
  style,
  token,
}: IconProps) {
  const resolution = useIcon(token)
  const defaults = useIconDefaults()
  const accessibleLabel = decorative ? undefined : label ?? resolution.token
  const effectiveSize = size ?? defaults.size
  const effectiveStrokeWidth = strokeWidth ?? defaults.strokeWidth

  if (!decorative && !label && import.meta.env.DEV) {
    console.warn(`Icon rendered without explicit label: ${token}`)
  }

  const wrapperStyle: CSSProperties = {
    width: effectiveSize,
    height: effectiveSize,
    color,
    ...style,
  }

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      aria-label={accessibleLabel}
      className={['inline-flex shrink-0 items-center justify-center', defaults.motionClassName, className].filter(Boolean).join(' ')}
      data-icon-available={resolution.available ? 'true' : 'false'}
      data-icon-density={defaults.density}
      data-icon-fallback-token={resolution.fallbackToken ?? undefined}
      data-icon-motion-level={defaults.motionLevel}
      data-icon-radius-family={defaults.radiusFamily}
      data-icon-requested-token={resolution.requestedToken}
      data-icon-token={resolution.token}
      role={decorative ? undefined : 'img'}
      style={wrapperStyle}
    >
      {resolution.entry.kind === 'asset' ? (
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          draggable={false}
          src={resolution.entry.src}
        />
      ) : resolution.entry.render?.({
        className: 'h-full w-full shrink-0',
        color,
        size: effectiveSize,
        strokeWidth: effectiveStrokeWidth,
      })}
    </span>
  )
}
