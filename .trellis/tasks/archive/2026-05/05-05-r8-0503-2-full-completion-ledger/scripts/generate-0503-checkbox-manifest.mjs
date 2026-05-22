import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = join(taskDir, '..', '..', '..')
const researchDir = join(taskDir, 'research')
const outputJsonPath = join(researchDir, '0503-checkbox-manifest.json')
const outputMarkdownPath = join(researchDir, '0503-checkbox-manifest.md')
const checkboxManifestSchemaVersion = 'devhub-0503-checkbox-manifest-v1'

const promptRoots = [
  { scope: 'prompts/0503', path: join(repoRoot, 'prompts', '0503') },
  { scope: 'prompts/0503-2', path: join(repoRoot, 'prompts', '0503-2') }
]

const selfTest = process.argv.includes('--self-test')
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizePath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/')
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function tableCell(value) {
  return String(value ?? '')
    .replace(emojiPattern, '')
    .replaceAll('|', '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength = 240) {
  const text = tableCell(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function parseHeading(line) {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
  if (!match) return null
  return {
    depth: match[1].length,
    text: match[2].trim()
  }
}

function parseCheckbox(line) {
  const match = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line)
  if (!match) return null
  const checked = match[1].toLowerCase() === 'x'
  const text = match[2].trim()
  return {
    checked,
    status: checked ? 'checked' : 'open',
    text,
    textHash: sha256(text)
  }
}

function classifyClosure(row) {
  if (row.checked) {
    return {
      closureKind: 'checked',
      closureRationale: 'The source checkbox is already checked.',
      localClosurePossible: false,
      requiredOwner: 'none'
    }
  }

  if (row.file === 'prompts/0503-2/00-r8-implementation-quickstart.md') {
    return {
      closureKind: 'process-instruction',
      closureRationale: 'Quickstart checklist item is a process instruction, not standalone implementation evidence.',
      localClosurePossible: false,
      requiredOwner: 'operator'
    }
  }

  if (row.file === 'prompts/0503-2/R8.B/spec-02-port-floating-window.md' && row.text.includes('ASSERT_BROWSERWINDOW_SECOND_DISPLAY')) {
    return {
      closureKind: 'hardware-verification',
      closureRationale: 'Second-display assertion requires a real secondary display and packaged BrowserWindow placement evidence.',
      localClosurePossible: false,
      requiredOwner: 'operator'
    }
  }

  if (row.file === 'prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md' && /Windows Service/i.test(row.text)) {
    return {
      closureKind: 'admin-service-verification',
      closureRationale: 'Windows Service install or uninstall verification requires an Administrator shell and real service state.',
      localClosurePossible: false,
      requiredOwner: 'operator'
    }
  }

  if (row.file === 'prompts/0503/24-legal-compliance-survey.md') {
    return {
      closureKind: 'legal-product-acceptance',
      closureRationale: 'Legal compliance survey choices require explicit legal or product-owner evidence.',
      localClosurePossible: false,
      requiredOwner: 'legal-product'
    }
  }

  if (row.file === 'prompts/0503/28-final-acceptance-checklist.md' || row.file === 'prompts/0503/22-user-journey-storyboard.md') {
    return {
      closureKind: 'user-product-acceptance',
      closureRationale: 'User-facing acceptance cannot be closed by local code tests alone.',
      localClosurePossible: false,
      requiredOwner: 'user-product'
    }
  }

  if (row.scope === 'prompts/0503') {
    return {
      closureKind: 'survey-context',
      closureRationale: 'Open survey checkbox remains upstream planning context unless converted into executable PRD/spec work.',
      localClosurePossible: false,
      requiredOwner: 'product'
    }
  }

  return {
    closureKind: 'implementation-follow-up',
    closureRationale: 'Open executable prompt checkbox needs implementation or verification evidence before closure.',
    localClosurePossible: true,
    requiredOwner: 'agent'
  }
}

function listMarkdownFiles(root) {
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
    }
  }
  visit(root)
  return files.sort()
}

function renderRows(rows, emptyText, columns, mapper) {
  if (rows.length === 0) return `\n${emptyText}\n`
  const header = `| ${columns.join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${mapper(row).map(tableCell).join(' | ')} |`).join('\n')
  return `\n${header}\n${divider}\n${body}\n`
}

function countBy(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function scanPromptRoot(root) {
  const rows = []
  const files = listMarkdownFiles(root.path)
  for (const filePath of files) {
    const file = normalizePath(filePath)
    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    let heading = null
    lines.forEach((line, index) => {
      const parsedHeading = parseHeading(line)
      if (parsedHeading) heading = parsedHeading
      const checkbox = parseCheckbox(line)
      if (!checkbox) return
      const baseRow = {
        ...checkbox,
        file,
        heading: heading?.text ?? null,
        headingDepth: heading?.depth ?? null,
        line: index + 1,
        scope: root.scope
      }
      rows.push({
        ...baseRow,
        ...classifyClosure(baseRow)
      })
    })
  }
  return {
    files,
    rows
  }
}

function summarizeByFile(rows) {
  const byFile = new Map()
  for (const row of rows) {
    const current = byFile.get(row.file) ?? {
      checked: 0,
      file: row.file,
      open: 0,
      scope: row.scope,
      total: 0
    }
    current.total += 1
    if (row.checked) current.checked += 1
    else current.open += 1
    byFile.set(row.file, current)
  }
  return [...byFile.values()].sort((left, right) => {
    if (right.open !== left.open) return right.open - left.open
    return left.file.localeCompare(right.file)
  })
}

function summarizeOpenRowsByOwnerAndFile(rows) {
  const byOwnerFile = new Map()
  for (const row of rows.filter(item => !item.checked)) {
    const key = `${row.requiredOwner}\u0000${row.closureKind}\u0000${row.file}`
    const current = byOwnerFile.get(key) ?? {
      closureKind: row.closureKind,
      file: row.file,
      open: 0,
      requiredOwner: row.requiredOwner,
      scope: row.scope
    }
    current.open += 1
    byOwnerFile.set(key, current)
  }
  return [...byOwnerFile.values()].sort((left, right) => {
    if (left.requiredOwner !== right.requiredOwner) return left.requiredOwner.localeCompare(right.requiredOwner)
    if (left.closureKind !== right.closureKind) return left.closureKind.localeCompare(right.closureKind)
    if (right.open !== left.open) return right.open - left.open
    return left.file.localeCompare(right.file)
  })
}

function buildOpenActionIndex(rows) {
  const openRows = rows.filter(row => !row.checked)
  return {
    legalProductRows: openRows.filter(row => row.requiredOwner === 'legal-product'),
    operatorRows: openRows.filter(row => row.requiredOwner === 'operator'),
    ownerFileCounts: summarizeOpenRowsByOwnerAndFile(rows),
    productFileCounts: summarizeOpenRowsByOwnerAndFile(rows).filter(row => row.requiredOwner === 'product'),
    userProductFileCounts: summarizeOpenRowsByOwnerAndFile(rows).filter(row => row.requiredOwner === 'user-product')
  }
}

function buildManifest() {
  const scannedRoots = promptRoots.map(scanPromptRoot)
  const rows = scannedRoots.flatMap(result => result.rows)
  const openRows = rows.filter(row => !row.checked)
  const fileSummaries = summarizeByFile(rows)
  const scopeCounts = Object.fromEntries(promptRoots.map(root => {
    const rootRows = rows.filter(row => row.scope === root.scope)
    return [root.scope, {
      checked: rootRows.filter(row => row.checked).length,
      files: scannedRoots.find(result => result.files.some(file => normalizePath(file).startsWith(root.scope)))?.files.length ?? 0,
      open: rootRows.filter(row => !row.checked).length,
      total: rootRows.length
    }]
  }))

  return {
    schemaVersion: checkboxManifestSchemaVersion,
    generatedAt: new Date().toISOString(),
    nonCompletionBoundary: [
      'Checkbox inventory is not completion evidence by itself.',
      'Open survey checkboxes under prompts/0503 remain upstream choices unless converted into executable PRD/spec work.',
      'Open prompts/0503-2 checkboxes remain implementation or external-verification work until closed by real evidence.'
    ],
    rows,
    scopeCounts,
    localClosureBlockedOpenRows: openRows.filter(row => !row.localClosurePossible).length,
    localClosurePossibleOpenRows: openRows.filter(row => row.localClosurePossible).length,
    openClosureKindCounts: countBy(openRows.map(row => row.closureKind)),
    openActionIndex: buildOpenActionIndex(rows),
    openOwnerCounts: countBy(openRows.map(row => row.requiredOwner)),
    statusCounts: countBy(rows.map(row => row.status)),
    topOpenFiles: fileSummaries.filter(row => row.open > 0).slice(0, 20),
    totalChecked: rows.filter(row => row.checked).length,
    totalOpen: openRows.length,
    totalRows: rows.length
  }
}

function renderMarkdown(manifest) {
  return [
    '# 0503 Checkbox Manifest',
    '',
    `Schema version: ${manifest.schemaVersion}`,
    '',
    `Generated at: ${manifest.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total checkbox rows: ${manifest.totalRows}`,
    `- Open checkbox rows: ${manifest.totalOpen}`,
    `- Checked checkbox rows: ${manifest.totalChecked}`,
    `- Local-closure possible open rows: ${manifest.localClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${manifest.localClosureBlockedOpenRows}`,
    `- prompts/0503 rows: ${manifest.scopeCounts['prompts/0503'].total}`,
    `- prompts/0503 open rows: ${manifest.scopeCounts['prompts/0503'].open}`,
    `- prompts/0503 checked rows: ${manifest.scopeCounts['prompts/0503'].checked}`,
    `- prompts/0503-2 rows: ${manifest.scopeCounts['prompts/0503-2'].total}`,
    `- prompts/0503-2 open rows: ${manifest.scopeCounts['prompts/0503-2'].open}`,
    `- prompts/0503-2 checked rows: ${manifest.scopeCounts['prompts/0503-2'].checked}`,
    '',
    '## Open Closure Classification',
    renderRows(
      Object.entries(manifest.openClosureKindCounts).map(([closureKind, count]) => ({ closureKind, count })),
      'No open closure kinds.',
      ['Closure kind', 'Open rows'],
      row => [row.closureKind, row.count]
    ),
    '',
    '## Open Owner Counts',
    renderRows(
      Object.entries(manifest.openOwnerCounts).map(([owner, count]) => ({ owner, count })),
      'No open owner rows.',
      ['Required owner', 'Open rows'],
      row => [row.owner, row.count]
    ),
    '',
    '## Top Open Files',
    renderRows(
      manifest.topOpenFiles,
      'No open checkbox rows.',
      ['File', 'Scope', 'Open', 'Checked', 'Total'],
      row => [row.file, row.scope, row.open, row.checked, row.total]
    ),
    '',
    '## Operator Exact Open Rows',
    renderRows(
      manifest.openActionIndex.operatorRows,
      'No operator-owned open checkbox rows.',
      ['File', 'Line', 'Closure kind', 'Text', 'Rationale'],
      row => [row.file, row.line, row.closureKind, truncate(row.text, 180), truncate(row.closureRationale, 180)]
    ),
    '',
    '## Legal-Product Exact Open Rows',
    renderRows(
      manifest.openActionIndex.legalProductRows,
      'No legal-product open checkbox rows.',
      ['File', 'Line', 'Heading', 'Text'],
      row => [row.file, row.line, row.heading, truncate(row.text, 180)]
    ),
    '',
    '## Product And User Acceptance File Index',
    renderRows(
      [
        ...manifest.openActionIndex.productFileCounts,
        ...manifest.openActionIndex.userProductFileCounts
      ],
      'No product or user-product open checkbox rows.',
      ['Owner', 'Closure kind', 'File', 'Open rows'],
      row => [row.requiredOwner, row.closureKind, row.file, row.open]
    ),
    '',
    '## Non-Completion Boundary',
    '',
    ...manifest.nonCompletionBoundary.map(item => `- ${item}`),
    '',
    '## Machine-Readable Details',
    '',
    '- Full checkbox rows are written to `0503-checkbox-manifest.json` under `rows`.',
    '- Each row includes `scope`, `file`, `line`, `heading`, `status`, `checked`, `text`, `textHash`, `closureKind`, `requiredOwner`, `localClosurePossible`, and `closureRationale`.',
    '- `openActionIndex` groups remaining rows by required owner, exact operator/legal rows, and product/user acceptance file counts.',
    ''
  ].join('\n')
}

function runSelfTest() {
  assert(parseHeading('### Section')?.text === 'Section', 'parseHeading should parse markdown headings')
  assert(parseCheckbox('- [ ] Open item')?.status === 'open', 'parseCheckbox should parse open rows')
  assert(parseCheckbox('- [x] Done item')?.checked === true, 'parseCheckbox should parse checked rows')
  assert(parseCheckbox('plain text') === null, 'parseCheckbox should ignore non-checkbox rows')
  assert(tableCell('🟢锚定 [Must]') === '锚定 [Must]', 'tableCell should remove emoji from markdown output')
  assert(classifyClosure({ checked: true }).closureKind === 'checked', 'checked rows should classify as checked')
  assert(classifyClosure({ checked: false, file: 'prompts/0503/24-legal-compliance-survey.md', scope: 'prompts/0503', text: 'x' }).requiredOwner === 'legal-product', 'legal survey rows should require legal-product owner')
  assert(classifyClosure({ checked: false, file: 'prompts/0503-2/R8.B/spec-02-port-floating-window.md', scope: 'prompts/0503-2', text: '验收 ASSERT_BROWSERWINDOW_SECOND_DISPLAY 通过' }).closureKind === 'hardware-verification', 'second display rows should classify as hardware-verification')
  const actionIndex = buildOpenActionIndex([
    { checked: false, closureKind: 'hardware-verification', file: 'a.md', requiredOwner: 'operator', scope: 's' },
    { checked: false, closureKind: 'legal-product-acceptance', file: 'b.md', requiredOwner: 'legal-product', scope: 's' },
    { checked: false, closureKind: 'survey-context', file: 'c.md', requiredOwner: 'product', scope: 's' }
  ])
  assert(actionIndex.operatorRows.length === 1, 'open action index should expose operator rows')
  assert(actionIndex.legalProductRows.length === 1, 'open action index should expose legal-product rows')
  assert(actionIndex.productFileCounts.length === 1, 'open action index should summarize product file counts')
  const manifest = buildManifest()
  assert(manifest.schemaVersion === checkboxManifestSchemaVersion, 'manifest should expose schemaVersion')
  assert(
    manifest.localClosureBlockedOpenRows + manifest.localClosurePossibleOpenRows === manifest.totalOpen,
    'local closure counts should partition open rows'
  )
  assert(truncate('abcdef', 5) === 'ab...', 'truncate should cap long values')
  console.log('0503 checkbox manifest self-test passed.')
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const manifest = buildManifest()
mkdirSync(researchDir, { recursive: true })
writeFileSync(outputJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
writeFileSync(outputMarkdownPath, renderMarkdown(manifest), 'utf8')
console.log(`0503 checkbox manifest generated: rows=${manifest.totalRows}; open=${manifest.totalOpen}; checked=${manifest.totalChecked}`)
