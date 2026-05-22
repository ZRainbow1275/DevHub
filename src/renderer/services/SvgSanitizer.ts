import DOMPurify from 'dompurify'
import { validateSanitizedSvgContent, type SvgValidationResult } from '@shared/theme-decorations'

export class SvgSanitizer {
  sanitize(content: string): SvgValidationResult {
    validateSanitizedSvgContent(content)
    const clean = DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'style', 'foreignObject', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'href', 'xlink:href', 'src', 'style'],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM: false
    })

    return validateSanitizedSvgContent(clean)
  }
}

export const svgSanitizer = new SvgSanitizer()
