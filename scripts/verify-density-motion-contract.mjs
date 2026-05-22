import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const themeCssPath = resolve(root, 'src/renderer/styles/tokens/theme-tokens.css')

const densities = ['compact', 'standard', 'comfortable']
const motions = ['reduced', 'balanced', 'expressive']

const densityTokens = [
  '--density-card-min-height',
  '--density-list-row-height',
  '--density-grid-gap',
  '--space-card-padding',
  '--space-section-gap',
  '--space-content-gap',
  '--container-padding',
  '--card-gap',
  '--project-list-row-height',
  '--project-card-min-height',
  '--project-card-min-width'
]

const motionTokens = [
  '--motion-scale',
  '--motion-duration-fast',
  '--motion-duration-normal',
  '--motion-duration-slow',
  '--transition-default',
  '--transition-fast',
  '--animation-card-enter',
  '--duration-theme'
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findBlock(css, selector) {
  const pattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const match = css.match(pattern)
  if (!match) throw new Error(`Missing CSS block for ${selector}`)
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

function requireToken(variables, token, selector) {
  const value = variables.get(token)
  if (!value) throw new Error(`${selector} is missing ${token}`)
  return value
}

function parsePx(value, label) {
  const match = value.match(/(-?\d+(?:\.\d+)?)px/)
  if (!match) throw new Error(`${label} must contain px: ${value}`)
  return Number(match[1])
}

function parseMs(value, label) {
  const match = value.match(/(-?\d+(?:\.\d+)?)ms/)
  if (!match) throw new Error(`${label} must contain ms: ${value}`)
  return Number(match[1])
}

function buildDensityContract(css) {
  return densities.map((density) => {
    const selector = `[data-density="${density}"]`
    const variables = parseVariables(findBlock(css, selector))
    const tokens = Object.fromEntries(densityTokens.map(token => [token, requireToken(variables, token, selector)]))
    return {
      density,
      tokens,
      cardMinHeightPx: parsePx(tokens['--density-card-min-height'], `${density} card min height`),
      listRowHeightPx: parsePx(tokens['--density-list-row-height'], `${density} list row height`),
      gridGapPx: parsePx(tokens['--density-grid-gap'], `${density} grid gap`),
      projectListRowHeightPx: parsePx(tokens['--project-list-row-height'], `${density} project list row height`),
      projectCardMinHeightPx: parsePx(tokens['--project-card-min-height'], `${density} project card min height`),
      projectCardMinWidthPx: parsePx(tokens['--project-card-min-width'], `${density} project card min width`)
    }
  })
}

function buildMotionContract(css) {
  return motions.map((motion) => {
    const selector = `html[data-motion-level="${motion}"]`
    const variables = parseVariables(findBlock(css, selector))
    const tokens = Object.fromEntries(motionTokens.map(token => [token, requireToken(variables, token, selector)]))
    return {
      motion,
      tokens,
      scale: Number(tokens['--motion-scale']),
      fastMs: parseMs(tokens['--motion-duration-fast'], `${motion} fast motion`),
      normalMs: parseMs(tokens['--motion-duration-normal'], `${motion} normal motion`),
      slowMs: parseMs(tokens['--motion-duration-slow'], `${motion} slow motion`),
      themeMs: parseMs(tokens['--duration-theme'], `${motion} theme duration`)
    }
  })
}

function assertIncreasing(values, label) {
  for (let i = 1; i < values.length; i += 1) {
    if (!(values[i - 1] < values[i])) {
      throw new Error(`${label} must increase strictly: ${values.join(', ')}`)
    }
  }
}

function assertDensityContract(contract) {
  assertIncreasing(contract.map(item => item.cardMinHeightPx), 'density card min height')
  assertIncreasing(contract.map(item => item.listRowHeightPx), 'density list row height')
  assertIncreasing(contract.map(item => item.gridGapPx), 'density grid gap')
  assertIncreasing(contract.map(item => item.projectListRowHeightPx), 'project list row height')
  assertIncreasing(contract.map(item => item.projectCardMinHeightPx), 'project card min height')
  assertIncreasing(contract.map(item => item.projectCardMinWidthPx), 'project card min width')
}

function assertMotionContract(contract, css) {
  const reduced = contract.find(item => item.motion === 'reduced')
  const balanced = contract.find(item => item.motion === 'balanced')
  const expressive = contract.find(item => item.motion === 'expressive')
  if (!reduced || !balanced || !expressive) throw new Error('Missing motion contract rows')

  for (const key of ['fastMs', 'normalMs', 'slowMs', 'themeMs']) {
    if (reduced[key] !== 0) throw new Error(`reduced ${key} must be 0ms`)
  }
  if (reduced.tokens['--transition-default'] !== 'none' || reduced.tokens['--animation-card-enter'] !== 'none') {
    throw new Error('reduced motion must disable transitions and card-enter animation')
  }
  if (!(balanced.normalMs > reduced.normalMs && expressive.normalMs > balanced.normalMs)) {
    throw new Error(`motion normal durations must increase: ${reduced.normalMs}, ${balanced.normalMs}, ${expressive.normalMs}`)
  }
  if (!css.includes('@media (prefers-reduced-motion: reduce)')) {
    throw new Error('Missing CSS prefers-reduced-motion media override')
  }
}

function renderMarkdown(densityContract, motionContract) {
  const densityTable = [
    '| Density | card min | row height | grid gap | project list row | project card min | project card width |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...densityContract.map(item => `| ${item.density} | ${item.cardMinHeightPx}px | ${item.listRowHeightPx}px | ${item.gridGapPx}px | ${item.projectListRowHeightPx}px | ${item.projectCardMinHeightPx}px | ${item.projectCardMinWidthPx}px |`)
  ].join('\n')

  const motionTable = [
    '| Motion | scale | fast | normal | slow | theme | transition | animation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...motionContract.map(item => `| ${item.motion} | ${item.scale} | ${item.fastMs}ms | ${item.normalMs}ms | ${item.slowMs}ms | ${item.themeMs}ms | ${item.tokens['--transition-default']} | ${item.tokens['--animation-card-enter']} |`)
  ].join('\n')

  return `${densityTable}\n\n${motionTable}`
}

const css = readFileSync(themeCssPath, 'utf8')
const densityContract = buildDensityContract(css)
const motionContract = buildMotionContract(css)
assertDensityContract(densityContract)
assertMotionContract(motionContract, css)

if (process.argv.includes('--print-markdown')) {
  console.log(renderMarkdown(densityContract, motionContract))
} else {
  console.log(`Density and motion contract ok: ${densityContract.length} density levels, ${motionContract.length} motion levels.`)
}
