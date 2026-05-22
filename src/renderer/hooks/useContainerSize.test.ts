import { describe, expect, it } from 'vitest'
import { classifyContainerBreakpoint, classifyContainerDensity, getContainerSize } from './useContainerSize'

describe('useContainerSize classifiers', () => {
  it('classifies container breakpoints using panel width, not global viewport names', () => {
    expect(classifyContainerBreakpoint(320)).toBe('xs')
    expect(classifyContainerBreakpoint(480)).toBe('sm')
    expect(classifyContainerBreakpoint(720)).toBe('md')
    expect(classifyContainerBreakpoint(960)).toBe('lg')
    expect(classifyContainerBreakpoint(1280)).toBe('xl')
  })

  it('uses compact density for small or short containers', () => {
    expect(classifyContainerDensity(880, 900)).toBe('compact')
    expect(classifyContainerDensity(1200, 540)).toBe('compact')
  })

  it('uses comfortable density only when both dimensions have room', () => {
    expect(classifyContainerDensity(1280, 860)).toBe('comfortable')
    expect(classifyContainerDensity(1100, 860)).toBe('standard')
  })

  it('returns a complete size model for renderer layout data attributes', () => {
    expect(getContainerSize(899, 620)).toEqual({
      width: 899,
      height: 620,
      breakpoint: 'md',
      density: 'compact'
    })
  })
})
