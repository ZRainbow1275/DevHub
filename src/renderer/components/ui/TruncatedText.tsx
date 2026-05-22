import { memo, useRef, useState, useEffect, useCallback, type MouseEvent, type CSSProperties, type RefObject } from 'react'

interface TruncatedTextProps {
  text: string
  className?: string
  /** Max width as CSS value (e.g. '180px', '100%', '12rem'). Omit to use parent width. */
  maxWidth?: string
  /** HTML tag to render. Defaults to 'span'. */
  as?: 'span' | 'p' | 'div'
  /** Truncate by characters before CSS width truncation. */
  maxChars?: number
  /** Allow double click to toggle marquee mode for long titles. */
  enableMarquee?: boolean
  /** Optional test id for interaction checks. */
  testId?: string
}

/**
 * Renders text with ellipsis truncation.
 * Shows a native title tooltip on hover only when the text is actually truncated.
 */
export const TruncatedText = memo(function TruncatedText({
  text,
  className = '',
  maxWidth,
  as: Tag = 'span',
  maxChars,
  enableMarquee = false,
  testId
}: TruncatedTextProps) {
  const ELLIPSIS = '\u2026'
  const ref = useRef<HTMLElement>(null)
  const lastClickDetailToggleAtRef = useRef(0)
  const lastPlainClickAtRef = useRef(0)
  const [isTruncated, setIsTruncated] = useState(false)
  const [isMarquee, setIsMarquee] = useState(false)
  const [marqueeDistance, setMarqueeDistance] = useState(0)

  const isCharTruncated = typeof maxChars === 'number' && text.length > maxChars
  const displayText = !isMarquee && isCharTruncated
    ? `${text.slice(0, maxChars)}${ELLIPSIS}`
    : text

  const checkTruncation = useCallback(() => {
    const el = ref.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth
    setIsTruncated(overflow)
    setMarqueeDistance(overflow ? el.scrollWidth - el.clientWidth : 0)
  }, [])

  useEffect(() => {
    checkTruncation()
  }, [displayText, checkTruncation])

  // Re-check on resize since container width can change
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(checkTruncation)
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkTruncation])

  useEffect(() => {
    if (!enableMarquee || (!isCharTruncated && !isTruncated)) {
      setIsMarquee(false)
    }
  }, [enableMarquee, isCharTruncated, isTruncated])

  const shouldShowTooltip = isCharTruncated || isTruncated
  const canToggleMarquee = enableMarquee && (isCharTruncated || isTruncated)

  const toggleMarquee = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!canToggleMarquee) return false
    event.stopPropagation()
    setIsMarquee((current) => !current)
    return true
  }, [canToggleMarquee])

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!canToggleMarquee) return
    event.stopPropagation()
    const isSecondPlainClick = lastPlainClickAtRef.current > 0 && event.timeStamp - lastPlainClickAtRef.current <= 500
    if (event.detail !== 2 && !isSecondPlainClick) {
      lastPlainClickAtRef.current = event.timeStamp
      return
    }
    lastPlainClickAtRef.current = 0
    if (toggleMarquee(event)) {
      lastClickDetailToggleAtRef.current = event.timeStamp
    }
  }, [canToggleMarquee, toggleMarquee])

  const handleDoubleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    if (Math.abs(event.timeStamp - lastClickDetailToggleAtRef.current) < 50) return
    toggleMarquee(event)
  }, [toggleMarquee])

  const style: CSSProperties & { '--truncated-text-marquee-distance'?: string } = {
    ...(maxWidth ? { maxWidth } : {}),
    ...(isMarquee ? { '--truncated-text-marquee-distance': `${marqueeDistance}px` } : {})
  }

  return (
    <Tag
      ref={ref as RefObject<never>}
      className={`block ${isMarquee ? 'overflow-hidden whitespace-nowrap' : 'truncate'} ${className}`}
      style={style}
      title={shouldShowTooltip ? text : undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-testid={testId}
      data-marquee-active={isMarquee ? 'true' : 'false'}
    >
      {isMarquee ? (
        <span className="truncated-text-marquee-track">
          {text}
        </span>
      ) : (
        displayText
      )}
    </Tag>
  )
})
