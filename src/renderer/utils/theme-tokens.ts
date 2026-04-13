/**
 * CSS token access utilities.
 * Provides typed access to CSS custom properties from JavaScript.
 */

/**
 * Get a CSS custom property value from the document root.
 */
export function getToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Get a CSS custom property value as a number in milliseconds.
 * Parses values like "250ms", "0.25s", "250".
 */
export function getTokenMs(name: string, fallback: number): number {
  const raw = getToken(name)
  if (!raw) return fallback

  if (raw.endsWith('ms')) {
    const parsed = parseFloat(raw)
    return isFinite(parsed) ? parsed : fallback
  }
  if (raw.endsWith('s')) {
    const parsed = parseFloat(raw) * 1000
    return isFinite(parsed) ? parsed : fallback
  }

  const parsed = parseFloat(raw)
  return isFinite(parsed) ? parsed : fallback
}

/**
 * Get a CSS custom property value as a number (pixels, unitless).
 */
export function getTokenNumber(name: string, fallback: number): number {
  const raw = getToken(name)
  if (!raw) return fallback

  const parsed = parseFloat(raw)
  return isFinite(parsed) ? parsed : fallback
}
