import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AIToolType } from '@shared/types-extended'
import { AIToolBrandLogo, BRAND_LOGO_TOOL_TYPES } from './AIToolBrandLogo'

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const BRAND_TOOL_TYPES = BRAND_LOGO_TOOL_TYPES.filter((toolType) => toolType !== 'other') as AIToolType[]

describe('AIToolBrandLogo', () => {
  it.each(BRAND_TOOL_TYPES)('为 %s 渲染真实品牌标识容器', (toolType) => {
    const html = renderToStaticMarkup(<AIToolBrandLogo toolType={toolType} size={20} />)

    expect(html).toContain(`data-tool-logo="${toolType}"`)
    expect(html).toMatch(/<(img|svg)\b/)
    expect(html).not.toMatch(EMOJI_RE)
  })

  it('为 other 保留 SVG fallback，且不出现 Emoji', () => {
    const html = renderToStaticMarkup(<AIToolBrandLogo toolType="other" size={20} />)

    expect(html).toContain('data-tool-logo="other"')
    expect(html).toContain('<svg')
    expect(html).not.toMatch(EMOJI_RE)
  })

  it('将核心 AI 工具映射到 icon-library brand token', () => {
    const codex = renderToStaticMarkup(<AIToolBrandLogo toolType="codex" size={20} />)
    const claude = renderToStaticMarkup(<AIToolBrandLogo toolType="claude-code" size={20} />)
    const gemini = renderToStaticMarkup(<AIToolBrandLogo toolType="gemini-cli" size={20} />)

    expect(codex).toContain('data-icon-token="brand:OpenAI"')
    expect(claude).toContain('data-icon-token="brand:Claude"')
    expect(gemini).toContain('data-icon-token="brand:GoogleGemini"')
    expect(`${codex}${claude}${gemini}`).not.toMatch(EMOJI_RE)
  })
})
