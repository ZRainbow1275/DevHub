export const A11Y_FOCUS_RING_VALUES = ['thin', 'normal', 'thick'] as const

export type A11yFocusRingThickness = typeof A11Y_FOCUS_RING_VALUES[number]

export const A11Y_LIMITS = {
  WCAG_AA_TEXT: 4.5,
  WCAG_AA_LARGE: 3,
  WCAG_AAA_TEXT: 7,
  ANNOUNCEMENT_QUEUE_MAX: 20,
  ANNOUNCEMENT_DEDUPE_MS: 500,
  SELF_CHECK_FINDING_MAX: 100,
} as const

export const A11Y_IMPACT_VALUES = ['minor', 'moderate', 'serious', 'critical'] as const

export type A11yImpact = typeof A11Y_IMPACT_VALUES[number]
