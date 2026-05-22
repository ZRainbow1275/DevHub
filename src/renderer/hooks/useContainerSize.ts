import { RefObject, useEffect, useState } from 'react'

export type ContainerBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ContainerDensity = 'compact' | 'standard' | 'comfortable'

export interface ContainerSize {
  width: number
  height: number
  breakpoint: ContainerBreakpoint
  density: ContainerDensity
}

export function classifyContainerBreakpoint(width: number): ContainerBreakpoint {
  if (width < 360) return 'xs'
  if (width < 560) return 'sm'
  if (width < 900) return 'md'
  if (width < 1200) return 'lg'
  return 'xl'
}

export function classifyContainerDensity(width: number, height: number): ContainerDensity {
  if (width < 900 || height < 620) return 'compact'
  if (width >= 1280 && height >= 860) return 'comfortable'
  return 'standard'
}

export function getContainerSize(width: number, height: number): ContainerSize {
  return {
    width,
    height,
    breakpoint: classifyContainerBreakpoint(width),
    density: classifyContainerDensity(width, height)
  }
}

const INITIAL_SIZE: ContainerSize = getContainerSize(0, 0)

export function useContainerSize(ref: RefObject<HTMLElement>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>(INITIAL_SIZE)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const update = (width: number, height: number) => {
      setSize(current => {
        const next = getContainerSize(Math.round(width), Math.round(height))
        return current.width === next.width &&
          current.height === next.height &&
          current.breakpoint === next.breakpoint &&
          current.density === next.density
          ? current
          : next
      })
    }

    const rect = node.getBoundingClientRect()
    update(rect.width, rect.height)

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [ref])

  return size
}
