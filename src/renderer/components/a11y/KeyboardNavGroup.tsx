import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from 'react'

type Orientation = 'horizontal' | 'vertical' | 'both'

interface RovingChildProps {
  tabIndex?: number
  'data-roving-item'?: string
  onFocus?: (event: FocusEvent<HTMLElement>) => void
}

function isForwardKey(key: string, orientation: Orientation): boolean {
  return key === 'ArrowRight' && orientation !== 'vertical'
    || key === 'ArrowDown' && orientation !== 'horizontal'
}

function isBackwardKey(key: string, orientation: Orientation): boolean {
  return key === 'ArrowLeft' && orientation !== 'vertical'
    || key === 'ArrowUp' && orientation !== 'horizontal'
}

export function getNextRovingIndex(
  currentIndex: number,
  itemCount: number,
  direction: 1 | -1,
  loop: boolean
): number {
  if (itemCount <= 0) {
    return 0
  }
  const nextIndex = currentIndex + direction
  if (loop) {
    return (nextIndex + itemCount) % itemCount
  }
  return Math.max(0, Math.min(itemCount - 1, nextIndex))
}

export function KeyboardNavGroup({
  children,
  ariaLabel,
  role = 'toolbar',
  orientation = 'horizontal',
  loop = true,
  className = '',
  style,
}: {
  children: ReactNode
  ariaLabel: string
  role?: 'toolbar' | 'tablist' | 'listbox' | 'group'
  orientation?: Orientation
  loop?: boolean
  className?: string
  style?: CSSProperties
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (
      !isForwardKey(event.key, orientation)
      && !isBackwardKey(event.key, orientation)
      && event.key !== 'Home'
      && event.key !== 'End'
    ) {
      return
    }

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[data-roving-item="true"]:not([disabled]):not([aria-disabled="true"])'
      )
    )
    if (items.length === 0) {
      return
    }

    event.preventDefault()
    const currentDomIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement))
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : getNextRovingIndex(currentDomIndex, items.length, isForwardKey(event.key, orientation) ? 1 : -1, loop)

    setActiveIndex(nextIndex)
    items[nextIndex]?.focus()
  }, [loop, orientation])

  const rovingChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) {
      return child
    }

    const element = child as ReactElement<RovingChildProps>
    const existingOnFocus = element.props.onFocus
    return cloneElement(element, {
      'data-roving-item': 'true',
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: (event: FocusEvent<HTMLElement>) => {
        setActiveIndex(index)
        existingOnFocus?.(event)
      },
    })
  })

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      aria-orientation={orientation === 'both' ? undefined : orientation}
      className={className}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {rovingChildren}
    </div>
  )
}
