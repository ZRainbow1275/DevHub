export const DECORATION_LIMITS = {
  MAX_OPACITY: 0.5,
  MIN_OPACITY: 0,
  MAX_CUSTOM_SVG_KB: 200,
  MAX_CUSTOM_SVGS: 50,
  MAX_CUSTOM_SVG_NAME_LENGTH: 64,
  ALLOWED_SVG_TAGS: [
    'svg',
    'g',
    'path',
    'circle',
    'rect',
    'ellipse',
    'polygon',
    'polyline',
    'line',
    'defs',
    'pattern',
    'mask',
    'use',
    'symbol',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'title',
    'desc'
  ],
  FORBIDDEN_SVG_TAGS: [
    'script',
    'foreignObject',
    'iframe',
    'object',
    'embed',
    'audio',
    'video',
    'image',
    'animate',
    'animateTransform',
    'set',
    'style'
  ],
  FORBIDDEN_SVG_ATTRS: ['href', 'xlink:href', 'src', 'style']
} as const

export const THEME_DECORATION_I18N_KEYS = {
  'none': 'settings.appearance.decoration.none',
  'soviet-geo': 'settings.appearance.decoration.sovietGeo',
  'diagonals': 'settings.appearance.decoration.diagonals',
  'paper': 'settings.appearance.decoration.paper',
  'scanline': 'settings.appearance.decoration.scanline',
  'grid': 'settings.appearance.decoration.grid',
  'golden': 'settings.appearance.decoration.golden',
  'noise': 'settings.appearance.decoration.noise',
  'blocks': 'settings.appearance.decoration.blocks',
  'custom-svg': 'settings.appearance.decoration.customSvg'
} as const

export const THEME_DECORATION_POSITION_I18N_KEYS = {
  'card-background': 'settings.appearance.decoration.position.cardBackground',
  'detail-panel-background': 'settings.appearance.decoration.position.detailPanelBackground',
  'global-background': 'settings.appearance.decoration.position.globalBackground',
  'statusbar-background': 'settings.appearance.decoration.position.statusbarBackground',
  'empty-state': 'settings.appearance.decoration.position.emptyState',
  'header': 'settings.appearance.decoration.position.header'
} as const

export interface SvgValidationResult {
  sanitizedContent: string
  size: number
}

const utf8Encoder = new TextEncoder()

function byteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength
}

function forbiddenTagPattern(tag: string): RegExp {
  return new RegExp(`<\\s*\\/?\\s*${tag}(?:\\s|/|>)`, 'i')
}

function forbiddenAttributePattern(attr: string): RegExp {
  const escaped = attr.replace(':', '\\:')
  return new RegExp(`\\s${escaped}\\s*=`, 'i')
}

export function validateSanitizedSvgContent(input: string): SvgValidationResult {
  const sanitizedContent = input.trim()
  const size = byteLength(sanitizedContent)

  if (size === 0) {
    throw Object.assign(new Error('E_VALIDATION:SVG 内容为空'), { code: 'E_VALIDATION' })
  }
  if (size > DECORATION_LIMITS.MAX_CUSTOM_SVG_KB * 1024) {
    throw Object.assign(new Error('E_VALIDATION:SVG 超过 200KB'), { code: 'E_VALIDATION' })
  }
  if (!/^<svg(?:\s|>)/i.test(sanitizedContent)) {
    throw Object.assign(new Error('E_VALIDATION:不是合法 SVG'), { code: 'E_VALIDATION' })
  }
  if (/<!doctype|<!entity|<\?xml-stylesheet/i.test(sanitizedContent)) {
    throw Object.assign(new Error('E_SECURITY_SVG:SVG 含禁止的 XML 声明'), { code: 'E_SECURITY_SVG' })
  }

  for (const tag of DECORATION_LIMITS.FORBIDDEN_SVG_TAGS) {
    if (forbiddenTagPattern(tag).test(sanitizedContent)) {
      throw Object.assign(new Error(`E_SECURITY_SVG:SVG 含禁止标签：${tag}，请移除`), { code: 'E_SECURITY_SVG' })
    }
  }

  if (/\son[a-z]+\s*=/i.test(sanitizedContent)) {
    throw Object.assign(new Error('E_SECURITY_SVG:SVG 含事件处理属性，请移除'), { code: 'E_SECURITY_SVG' })
  }

  for (const attr of DECORATION_LIMITS.FORBIDDEN_SVG_ATTRS) {
    if (forbiddenAttributePattern(attr).test(sanitizedContent)) {
      throw Object.assign(new Error(`E_SECURITY_SVG:SVG 含禁止属性：${attr}，请移除`), { code: 'E_SECURITY_SVG' })
    }
  }

  if (/javascript:|vbscript:|data:text\/html|url\s*\(\s*['"]?\s*(?:https?:|javascript:|data:)/i.test(sanitizedContent)) {
    throw Object.assign(new Error('E_SECURITY_SVG:SVG 含外部链接或脚本 URL，请移除'), { code: 'E_SECURITY_SVG' })
  }

  return {
    sanitizedContent,
    size
  }
}
