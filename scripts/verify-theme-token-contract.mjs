import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const colorCssPath = resolve(root, 'src/renderer/styles/tokens/colors.css')
const themeCssPath = resolve(root, 'src/renderer/styles/tokens/theme-tokens.css')

const palettes = [
  'constructivism',
  'modern-light',
  'warm-light',
  'cyberpunk',
  'swiss',
  'dark',
  'light'
]

const colorTokens = [
  '--surface-50',
  '--surface-500',
  '--surface-900',
  '--text-primary',
  '--red-500',
  '--gold-500',
  '--steel-500'
]

const designTokens = {
  radius: '--radius-card',
  border: '--border-card',
  shadow: '--shadow-card',
  font: '--typo-heading-family',
  spacing: '--spacing-base',
  motion: '--motion-duration-normal'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findThemeBlock(css, palette) {
  const pattern = new RegExp(`(?:^|\\n)[^{}]*\\[data-theme="${escapeRegExp(palette)}"\\][^{]*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const match = css.match(pattern)
  if (!match) throw new Error(`Missing CSS block for [data-theme="${palette}"]`)
  return match[1]
}

function parseVariables(cssBlock) {
  const variables = new Map()
  const pattern = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g
  let match
  while ((match = pattern.exec(cssBlock)) !== null) {
    variables.set(match[1], match[2].trim())
  }
  return variables
}

function requireToken(variables, token, palette, source) {
  const value = variables.get(token)
  if (!value) throw new Error(`${source} ${palette} is missing ${token}`)
  return value
}

function parsePx(value, label) {
  const match = value.match(/(-?\d+(?:\.\d+)?)px/)
  if (!match) throw new Error(`${label} must contain a px value: ${value}`)
  return Number(match[1])
}

function parseMs(value, label) {
  const match = value.match(/(-?\d+(?:\.\d+)?)ms/)
  if (!match) throw new Error(`${label} must contain an ms value: ${value}`)
  return Number(match[1])
}

function buildContract() {
  const colorCss = readFileSync(colorCssPath, 'utf8')
  const themeCss = readFileSync(themeCssPath, 'utf8')

  return palettes.map((palette) => {
    const colorVars = parseVariables(findThemeBlock(colorCss, palette))
    const themeVars = parseVariables(findThemeBlock(themeCss, palette))
    const colors = Object.fromEntries(colorTokens.map(token => [token, requireToken(colorVars, token, palette, 'colors.css')]))
    const design = Object.fromEntries(Object.entries(designTokens).map(([axis, token]) => [axis, requireToken(themeVars, token, palette, 'theme-tokens.css')]))

    return {
      palette,
      colors,
      design,
      colorSignature: colorTokens.map(token => colors[token]).join('|'),
      radiusPx: parsePx(design.radius, `${palette} radius`),
      borderWidthPx: design.border === 'none' ? 0 : parsePx(design.border, `${palette} border`),
      shadowSignature: design.shadow,
      fontSignature: design.font,
      spacingPx: parsePx(design.spacing, `${palette} spacing`),
      motionMs: parseMs(design.motion, `${palette} motion`)
    }
  })
}

function compareThemes(left, right) {
  const changed = {
    color: left.colorSignature !== right.colorSignature,
    radius: left.radiusPx !== right.radiusPx,
    border: left.design.border !== right.design.border || left.borderWidthPx !== right.borderWidthPx,
    shadow: left.shadowSignature !== right.shadowSignature,
    font: left.fontSignature !== right.fontSignature,
    spacing: left.spacingPx !== right.spacingPx,
    motion: left.motionMs !== right.motionMs
  }
  const changedAxes = Object.entries(changed)
    .filter(([, isChanged]) => isChanged)
    .map(([axis]) => axis)

  return {
    pair: `${left.palette} -> ${right.palette}`,
    changed,
    changedAxes,
    changedCount: changedAxes.length,
    radiusDeltaPx: Math.abs(left.radiusPx - right.radiusPx),
    borderDeltaPx: Math.abs(left.borderWidthPx - right.borderWidthPx),
    spacingDeltaPx: Math.abs(left.spacingPx - right.spacingPx),
    motionDeltaMs: Math.abs(left.motionMs - right.motionMs)
  }
}

function pairwiseComparisons(contract) {
  const pairs = []
  for (let i = 0; i < contract.length; i += 1) {
    for (let j = i + 1; j < contract.length; j += 1) {
      pairs.push(compareThemes(contract[i], contract[j]))
    }
  }
  return pairs
}

function assertContract(contract, pairs) {
  if (contract.length !== palettes.length) {
    throw new Error(`Expected ${palettes.length} palettes, found ${contract.length}`)
  }

  const missingColorDeltas = pairs.filter(pair => !pair.changed.color)
  if (missingColorDeltas.length > 0) {
    throw new Error(`Theme pairs without visible color deltas: ${missingColorDeltas.map(pair => pair.pair).join(', ')}`)
  }

  const colorOnlyPairs = pairs.filter(pair => pair.changedCount < 2)
  if (colorOnlyPairs.length > 0) {
    throw new Error(`Theme pairs with color-only deltas: ${colorOnlyPairs.map(pair => pair.pair).join(', ')}`)
  }

  const weakPairs = pairs.filter(pair => pair.changedCount < 7)
  if (weakPairs.length > 0) {
    throw new Error(`Theme pairs with weak visual deltas (<7 axes): ${weakPairs.map(pair => pair.pair).join(', ')}`)
  }

  const constructivismToModern = pairs.find(pair => pair.pair === 'constructivism -> modern-light')
  if (!constructivismToModern) throw new Error('Missing constructivism -> modern-light comparison')
  for (const axis of ['color', 'radius', 'border', 'shadow', 'font', 'spacing', 'motion']) {
    if (!constructivismToModern.changed[axis]) {
      throw new Error(`constructivism -> modern-light must differ on ${axis}`)
    }
  }
}

function renderMarkdown(contract, pairs) {
  const paletteRows = contract.map(item => [
    item.palette,
    item.colors['--surface-900'],
    item.colors['--red-500'],
    `${item.radiusPx}px`,
    `${item.borderWidthPx}px`,
    item.shadowSignature,
    item.fontSignature,
    `${item.spacingPx}px`,
    `${item.motionMs}ms`
  ])

  const pairRows = pairs.map(pair => [
    pair.pair,
    pair.changedAxes.join(', '),
    `${pair.radiusDeltaPx}px`,
    `${pair.borderDeltaPx}px`,
    `${pair.spacingDeltaPx}px`,
    `${pair.motionDeltaMs}ms`
  ])

  const paletteTable = [
    '| Palette | surface-900 | accent | radius | border | shadow | font | spacing | motion |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...paletteRows.map(row => `| ${row.join(' | ')} |`)
  ].join('\n')

  const pairTable = [
    '| Pair | Changed axes | radius delta | border delta | spacing delta | motion delta |',
    '| --- | --- | --- | --- | --- | --- |',
    ...pairRows.map(row => `| ${row.join(' | ')} |`)
  ].join('\n')

  return `${paletteTable}\n\n${pairTable}`
}

const contract = buildContract()
const pairs = pairwiseComparisons(contract)
assertContract(contract, pairs)

if (process.argv.includes('--print-markdown')) {
  console.log(renderMarkdown(contract, pairs))
} else {
  const minChanged = Math.min(...pairs.map(pair => pair.changedCount))
  console.log(`Theme token contract ok: ${contract.length} palettes, ${pairs.length} pairwise comparisons, minimum changed axes ${minChanged}.`)
}
