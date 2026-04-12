import { memo, useRef, useState, useEffect, useCallback } from 'react'

interface TruncatedTextProps {
  text: string
  className?: string
  /** Max width as CSS value (e.g. '180px', '100%', '12rem'). Omit to use parent width. */
  maxWidth?: string
  /** HTML tag to render. Defaults to 'span'. */
  as?: 'span' | 'p' | 'div'
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
}: TruncatedTextProps) {
  const ref = useRef<HTMLElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const checkTruncation = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [])

  useEffect(() => {
    checkTruncation()
  }, [text, checkTruncation])

  // Re-check on resize since container width can change
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(checkTruncation)
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkTruncation])

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`block truncate ${className}`}
      style={maxWidth ? { maxWidth } : undefined}
      title={isTruncated ? text : undefined}
    >
      {text}
    </Tag>
  )
})
