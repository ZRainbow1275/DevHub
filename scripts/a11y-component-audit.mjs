#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rendererRoot = resolve(repoRoot, 'src/renderer')

const auditSurfaces = [
  {
    id: 'panel-splitter-separator',
    source: 'src/renderer/components/ui/PanelSplitter.tsx',
    summary: 'Resizable panel separator has name, orientation, and value state.',
    checks: [
      ['role separator', /role="separator"/],
      ['accessible label', /aria-label=/],
      ['orientation', /aria-orientation=/],
      ['value state', /aria-valuenow=/],
    ],
  },
  {
    id: 'project-card-button',
    source: 'src/renderer/components/project/ProjectCard.tsx',
    summary: 'Project card keeps custom button keyboard activation and explicit card label.',
    checks: [
      ['role button', /role="button"/],
      ['explicit label', /aria-label=\{`\$\{project\.name\} 项目卡片/],
      ['keyboard activation', /onKeyDown=\{\(e\) =>/],
    ],
  },
  {
    id: 'settings-toggle-switch',
    source: 'src/renderer/components/settings/SettingsDialog.tsx',
    summary: 'Settings toggle uses switch semantics and keyboard activation.',
    checks: [
      ['role switch', /role="switch"/],
      ['checked state', /aria-checked=\{checked\}/],
      ['accessible label', /aria-label=\{label\}/],
      ['keyboard activation', /onKeyDown=\{\(e\) =>/],
    ],
  },
  {
    id: 'monitor-window-card',
    source: 'src/renderer/components/monitor/MonitorWindowCards.tsx',
    summary: 'Monitor cards expose explicit names while retaining Enter and Space activation.',
    checks: [
      ['role button', /role="button"/],
      ['explicit label', /aria-label=\{`\$\{TOOL_LABELS\[card\.tool\]\} 监控卡片/],
      ['keyboard activation', /onKeyDown=\{event =>/],
    ],
  },
  {
    id: 'port-list-scroll-region',
    source: 'src/renderer/components/monitor/PortView.tsx',
    summary: 'Focusable port scroll containers are named regions in both detail and non-detail branches.',
    checks: [
      ['two scroll containers', /data-testid="port-list-scroll"/g, 2],
      ['two named regions', /aria-label="端口列表滚动区域"/g, 2],
      ['region role', /role="region"/],
    ],
  },
  {
    id: 'process-treemap-tile',
    source: 'src/renderer/components/monitor/process/ProcessTreemapTile.tsx',
    summary: 'SVG treemap tile has explicit button name, selected state, and keyboard activation.',
    checks: [
      ['role button', /role="button"/],
      ['explicit label', /aria-label=\{tileLabel\}/],
      ['selected state', /aria-pressed=\{selected\}/],
      ['keyboard activation', /onKeyDown=\{handleKeyDown\}/],
    ],
  },
  {
    id: 'process-treemap-inline-svg',
    source: 'src/renderer/components/monitor/process/ProcessTreemapView.tsx',
    summary: 'Bulk-rendered SVG treemap path writes escaped aria labels for real tiles.',
    checks: [
      ['aria label in markup', /<g aria-label="\$\{label\} PID \$\{node\.pid\}"/],
      ['keyboard delegation', /onTreemapKeyDown/],
      ['dirty name escaping', /escapeSvg\(node\.exe\)/],
    ],
  },
  {
    id: 'keyboard-nav-group',
    source: 'src/renderer/components/a11y/KeyboardNavGroup.tsx',
    summary: 'Reusable roving tabindex group keeps role, label, and arrow-key navigation.',
    checks: [
      ['role passthrough', /role=\{role\}/],
      ['accessible label', /aria-label=\{ariaLabel\}/],
      ['roving logic', /getNextRovingIndex/],
    ],
  },
  {
    id: 'command-palette-dialog',
    source: 'src/renderer/components/command/R8CommandPalette.tsx',
    summary: 'Command palette dialog has modal semantics and named command groups.',
    checks: [
      ['dialog role', /role="dialog"/],
      ['modal state', /aria-modal="true"/],
      ['dialog label', /aria-label="R8 命令面板"/],
      ['group keyboard nav', /KeyboardNavGroup/],
    ],
  },
  {
    id: 'a11y-live-regions',
    source: 'src/renderer/components/a11y/AnnouncementProvider.tsx',
    summary: 'Live regions expose polite and assertive channels with atomic updates.',
    checks: [
      ['polite live region', /aria-live="polite"/],
      ['assertive live region', /aria-live="assertive"/],
      ['atomic updates', /aria-atomic="true"/],
    ],
  },
]

function parseArgs(argv) {
  const args = {
    output: '',
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') args.output = argv[index + 1] ?? ''
    if (arg === '--json') args.json = true
  }

  return args
}

function listTsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) return listTsxFiles(fullPath)
    if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) return []
    return [fullPath]
  })
}

function countMatches(content, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  return Array.from(content.matchAll(new RegExp(regex.source, flags))).length
}

function findLine(content, regex) {
  const match = content.match(regex)
  if (!match || match.index === undefined) return 0
  return content.slice(0, match.index).split(/\r?\n/).length
}

function checkSurface(surface) {
  const absolutePath = resolve(repoRoot, surface.source)
  const content = readFileSync(absolutePath, 'utf8')
  const missing = surface.checks.flatMap(([label, regex, minimum = 1]) => {
    const count = countMatches(content, regex)
    return count >= minimum ? [] : [{ label, expected: minimum, actual: count }]
  })
  const firstLine = surface.checks
    .map(([, regex]) => findLine(content, regex))
    .find(line => line > 0) ?? 0

  return {
    ...surface,
    line: firstLine,
    passed: missing.length === 0,
    missing,
  }
}

function toMarkdown(report) {
  const rows = report.surfaces.map(surface => {
    const result = surface.passed ? 'pass' : `fail: ${surface.missing.map(item => item.label).join(', ')}`
    const location = surface.line > 0 ? `${surface.source}:${surface.line}` : surface.source
    return `| ${surface.id} | \`${location}\` | ${result} | ${surface.summary} |`
  }).join('\n')

  return `# R8.B spec-16 Component ARIA Audit

This report is produced from the current renderer source tree by \`pnpm a11y:component-audit\`.

- Renderer TSX files scanned: ${report.rendererTsxFileCount}
- Production \`tabIndex={0}\` entries: ${report.tabIndexZeroCount}
- Audited ARIA surfaces: ${report.surfaces.length}
- Blocking findings: ${report.blockingFindings}

| Surface | Source | Result | Evidence |
|---|---|---|---|
${rows}

## Scope Boundary

- This is a component/source audit for renderer ARIA naming, keyboard activation, dialog semantics, live regions, and focusable scroll regions.
- Live WCAG rule execution remains covered by \`pnpm a11y:audit -- --url <renderer-url>\` and the Electron spec-16 Playwright path.
- No fabricated browser state or mock axe result is used by this report.
`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rendererFiles = listTsxFiles(rendererRoot)
  const tabIndexZeroCount = rendererFiles.reduce((total, file) => {
    const content = readFileSync(file, 'utf8')
    return total + countMatches(content, /tabIndex=\{0\}/g)
  }, 0)
  const surfaces = auditSurfaces.map(checkSurface)
  const blockingFindings = surfaces.reduce((total, surface) => total + surface.missing.length, 0)
  const report = {
    rendererTsxFileCount: rendererFiles.length,
    tabIndexZeroCount,
    surfaces,
    blockingFindings,
    sourceRoot: relative(process.cwd(), rendererRoot).replaceAll('\\', '/'),
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const markdown = toMarkdown(report)
    if (args.output) {
      const outputPath = resolve(args.output)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, markdown, 'utf8')
      console.log(`Component ARIA audit written to ${outputPath}`)
    } else {
      console.log(markdown)
    }
  }

  process.exit(blockingFindings === 0 ? 0 : 1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
