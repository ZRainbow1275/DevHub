import { performance } from 'node:perf_hooks'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'
import { Icon } from './Icon'
import { resolveRendererIcon } from './IconResolver'
import { resolveIconDefaultsForTheme } from './useIcon'

describe('Icon', () => {
  it('renders decorative icons outside the accessibility tree', () => {
    const { container } = render(<Icon token="lucide:Search" decorative size={16} className="text-accent" />)
    const icon = container.querySelector('[data-icon-token="lucide:Search"]')

    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).not.toHaveAttribute('role')
    expect(icon?.querySelector('svg')).toBeInTheDocument()
  })

  it('renders semantic icons with an explicit accessible name', () => {
    render(<Icon token="heroicons:InformationCircle" decorative={false} label="Runtime information" />)

    const icon = screen.getByRole('img', { name: 'Runtime information' })
    expect(icon).toHaveAttribute('data-icon-token', 'heroicons:InformationCircle')
    expect(icon).not.toHaveAttribute('aria-hidden')
  })

  it('falls back to the registered help icon for unknown tokens', () => {
    const { container } = render(<Icon token="lucide:DoesNotExist" decorative size={18} />)
    const icon = container.querySelector('[data-icon-token="lucide:HelpCircle"]')

    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('data-icon-available', 'false')
    expect(icon).toHaveAttribute('data-icon-requested-token', 'lucide:DoesNotExist')
    expect(icon).toHaveAttribute('data-icon-fallback-token', 'lucide:HelpCircle')
  })

  it('renders the local OpenAI asset without emoji fallback', () => {
    render(<BrandLogo brand="OpenAI" decorative={false} label="OpenAI" />)

    const logo = screen.getByRole('img', { name: 'OpenAI' })
    expect(logo).toHaveAttribute('data-icon-token', 'brand:OpenAI')
    expect(logo.querySelector('img')).toBeInTheDocument()
  })

  it('derives default size, stroke, and motion from theme axes', () => {
    document.documentElement.dataset.density = 'comfortable'
    document.documentElement.dataset.radiusFamily = 'round'
    document.documentElement.dataset.motionLevel = 'expressive'

    const { container } = render(<Icon token="lucide:Search" decorative />)
    const icon = container.querySelector('[data-icon-token="lucide:Search"]')
    const svg = icon?.querySelector('svg')

    expect(icon).toHaveAttribute('data-icon-density', 'comfortable')
    expect(icon).toHaveAttribute('data-icon-radius-family', 'round')
    expect(icon).toHaveAttribute('data-icon-motion-level', 'expressive')
    expect(icon).toHaveStyle({ width: '20px', height: '20px' })
    expect(svg).toHaveAttribute('stroke-width', '1.35')
  })

  it('keeps mixed icon token rendering under the 1ms per icon budget', () => {
    const tokens = [
      'lucide:Search',
      'tabler:Box',
      'radix:Cross1',
      'heroicons:Bell',
      'brand:OpenAI',
    ] as const
    const iconCount = 100

    const icons = (
      <div>
        {Array.from({ length: iconCount }, (_, index) => (
          <Icon key={index} token={tokens[index % tokens.length]} decorative size={16} />
        ))}
      </div>
    )
    renderToStaticMarkup(icons)

    const startedAt = performance.now()
    const markup = renderToStaticMarkup(icons)
    const elapsedMs = performance.now() - startedAt

    expect(markup.match(/data-icon-token=/g)).toHaveLength(iconCount)
    expect(elapsedMs / iconCount).toBeLessThan(1)
  })
})

describe('resolveRendererIcon', () => {
  it('returns the renderer registry entry for a known token', () => {
    const resolved = resolveRendererIcon('radix:Gear')

    expect(resolved.available).toBe(true)
    expect(resolved.token).toBe('radix:Gear')
    expect(resolved.entry.kind).toBe('component')
  })
})

describe('resolveIconDefaultsForTheme', () => {
  it('maps non-color theme axes to deterministic icon defaults', () => {
    expect(resolveIconDefaultsForTheme({
      density: 'compact',
      radiusFamily: 'sharp',
      motionLevel: 'reduced',
    })).toMatchObject({
      size: 14,
      strokeWidth: 2,
      motionClassName: 'transition-none',
    })
  })
})
