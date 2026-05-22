import { describe, expect, it } from 'vitest'
import { SvgSanitizer } from './SvgSanitizer'

describe('SvgSanitizer', () => {
  it('keeps safe SVG geometry and returns validated storage metadata', () => {
    const sanitizer = new SvgSanitizer()
    const result = sanitizer.sanitize('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')

    expect(result.sanitizedContent).toContain('<svg')
    expect(result.size).toBeGreaterThan(0)
  })

  it('rejects script SVG after DOMPurify and strict validation', () => {
    const sanitizer = new SvgSanitizer()

    expect(() => sanitizer.sanitize('<svg><script>alert(1)</script></svg>')).toThrow(/不是合法 SVG|SVG 内容为空|禁止/)
  })

  it('rejects event attributes and external URL vectors', () => {
    const sanitizer = new SvgSanitizer()

    expect(() => sanitizer.sanitize('<svg><rect onload="alert(1)" width="10"/></svg>')).toThrow(/事件处理|不是合法 SVG|SVG 内容为空/)
    expect(() => sanitizer.sanitize('<svg><path d="M0 0" style="fill:url(http://example.com/a)"/></svg>')).toThrow(/外部链接|禁止属性|不是合法 SVG|SVG 内容为空/)
  })
})
