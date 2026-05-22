import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Theme seasonal/visual contract failed: ${message}`)
    process.exit(1)
  }
}

function parseDeclarations(block) {
  const declarations = new Map()
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  for (const match of block.matchAll(pattern)) {
    declarations.set(match[1], match[2].trim())
  }
  return declarations
}

function paletteBlock(css, palette) {
  const escaped = palette.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`\\[data-palette="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  return match?.[1] ?? ''
}

function themeBlock(css, theme) {
  const escaped = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`\\[data-theme="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  return match?.[1] ?? ''
}

function parseHexColor(value) {
  const normalized = value.trim().toLowerCase()
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  assert(Boolean(match), `expected hex color but got ${value}`)
  const raw = match?.[1] ?? ''
  const expanded = raw.length === 3 ? raw.split('').map(char => `${char}${char}`).join('') : raw
  return {
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255
  }
}

function linearizeChannel(channel) {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(value) {
  const color = parseHexColor(value)
  return 0.2126 * linearizeChannel(color.r) + 0.7152 * linearizeChannel(color.g) + 0.0722 * linearizeChannel(color.b)
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function requireToken(declarations, token, palette) {
  const value = declarations.get(token)
  assert(Boolean(value), `missing ${token} for high-contrast palette ${palette}`)
  return value
}

const themeLanguage = read('src/renderer/theme/theme-language.ts')
const settingsDialog = read('src/renderer/components/settings/SettingsDialog.tsx')
const colorsCss = read('src/renderer/styles/tokens/colors.css')
const tokensCss = read('src/renderer/styles/tokens/theme-tokens.css')
const sparkline = read('src/renderer/components/monitor/process/ProcessSparkline.tsx')
const dagCanvas = read('src/renderer/components/dag-editor/DagCanvas.tsx')
const topologyMini = read('src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx')
const graphCanvas = read('src/renderer/components/topology/GraphCanvas.tsx')

for (const holidayId of ['spring-festival', 'christmas', 'halloween']) {
  assert(themeLanguage.includes(`id: '${holidayId}'`), `missing holiday theme ${holidayId}`)
}

assert(themeLanguage.includes('promptHolidayThemeIfNeeded'), 'missing annual holiday prompt resolver')
assert(settingsDialog.includes('HOLIDAY_THEME_DEFINITIONS.map'), 'settings panel does not render the holiday registry')
assert(settingsDialog.includes('data-testid="holiday-theme-list"'), 'settings panel missing holiday list marker')
assert(settingsDialog.includes('holidayFocusMode'), 'missing focus work mode setting')
assert(settingsDialog.includes('holidayDecorationsEnabled'), 'missing holiday enable setting')

const requiredPaletteTokens = [
  '--chart-series-1',
  '--chart-axis-color',
  '--chart-text-color',
  '--topology-node-process',
  '--topology-node-port',
  '--topology-node-window',
  '--topology-node-ai',
  '--topology-node-label',
  '--topology-edge-default',
  '--topology-edge-network',
  '--topology-edge-neural',
  '--topology-edge-flow'
]

for (const palette of ['constructivism', 'modern-light', 'warm-light', 'cyberpunk', 'swiss', 'dark', 'light']) {
  const block = paletteBlock(tokensCss, palette)
  assert(block.length > 0, `missing data-palette block for ${palette}`)
  for (const token of requiredPaletteTokens) {
    assert(block.includes(token), `missing ${token} in ${palette}`)
  }
}

for (const palette of ['cyberpunk', 'swiss']) {
  const declarations = new Map([
    ...parseDeclarations(themeBlock(colorsCss, palette)),
    ...parseDeclarations(paletteBlock(tokensCss, palette))
  ])
  const surface = requireToken(declarations, '--surface-950', palette)
  const textPairs = [
    ['--chart-text-color', 4.5],
    ['--topology-node-label', 4.5]
  ]
  const graphPairs = [
    ['--chart-series-1', 3],
    ['--chart-series-2', 3],
    ['--topology-node-process', 3],
    ['--topology-node-port', 3],
    ['--topology-node-window', 3],
    ['--topology-node-ai', 3],
    ['--topology-edge-default', 3],
    ['--topology-edge-network', 3],
    ['--topology-edge-neural', 3],
    ['--topology-edge-flow', 3]
  ]

  for (const [token, minimum] of [...textPairs, ...graphPairs]) {
    const ratio = contrastRatio(requireToken(declarations, token, palette), surface)
    assert(ratio >= minimum, `${palette} ${token} contrast ${ratio.toFixed(2)} is below ${minimum}:1 against --surface-950`)
  }
}

for (const token of ['--holiday-accent', '--holiday-secondary', '--holiday-surface']) {
  assert(themeLanguage.includes(token), `holiday definition missing ${token}`)
}

assert(sparkline.includes("color = 'var(--chart-series-1)'"), 'sparkline default color is not theme-chart tokenized')
assert(sparkline.includes('var(--chart-grid-color)'), 'sparkline missing chart grid token')
assert(dagCanvas.includes('--topology-node-process'), 'DAG/Cytoscape renderer missing topology node token usage')
assert(dagCanvas.includes('--topology-edge-default'), 'DAG/Cytoscape renderer missing topology edge token usage')
assert(topologyMini.includes('data-theme-sync="topology-palette"'), 'dashboard topology mini widget missing theme sync marker')
assert(graphCanvas.includes('data-theme-sync="topology-palette"'), 'fullscreen graph canvas missing theme sync marker')

console.log('Theme seasonal/visual contract ok: 3 holiday themes, 7 palette chart/topology token sets, high-contrast WCAG ratios, focus suppression, and renderer token usage verified.')
