#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function parseArgs(argv) {
  const args = {
    url: '',
    output: '',
    failImpact: 'critical',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--url') args.url = argv[index + 1] ?? ''
    if (arg === '--output') args.output = argv[index + 1] ?? ''
    if (arg === '--fail-impact') args.failImpact = argv[index + 1] ?? 'critical'
  }

  return args
}

function impactRank(impact) {
  if (impact === 'critical') return 4
  if (impact === 'serious') return 3
  if (impact === 'moderate') return 2
  if (impact === 'minor') return 1
  return 0
}

function toSummary(results, url, failImpact) {
  const threshold = impactRank(failImpact)
  const blockingViolations = results.violations.filter((violation) => impactRank(violation.impact) >= threshold)
  return {
    ts: Date.now(),
    url,
    axeExecuted: true,
    tags: WCAG_TAGS,
    failImpact,
    passed: blockingViolations.length === 0,
    counts: {
      violations: results.violations.length,
      blocking: blockingViolations.length,
      incomplete: results.incomplete.length,
      passes: results.passes.length,
    },
    blockingViolations: blockingViolations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url) {
    console.error('Usage: pnpm a11y:audit -- --url http://127.0.0.1:5173 [--output reports/a11y.json] [--fail-impact critical|serious|moderate|minor]')
    console.error('This script requires a live renderer URL. It does not fabricate axe results for offline runs.')
    process.exit(2)
  }

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30_000 })
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze()
    const summary = toSummary(results, args.url, args.failImpact)
    const json = `${JSON.stringify(summary, null, 2)}\n`

    if (args.output) {
      const outputPath = resolve(args.output)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, json, 'utf8')
      console.log(`A11y audit written to ${outputPath}`)
    } else {
      console.log(json)
    }

    process.exit(summary.passed ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
