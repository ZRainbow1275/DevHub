#!/usr/bin/env node
// Reverse i18n scanner: detect hard-coded English UI strings in renderer TSX
// that should be wrapped with t().
//
// Sibling to i18n-check-coverage.mjs (which scans CJK literals for catalog
// completeness). This script enforces the opposite direction so that EN
// fragments cannot silently leak through a CN locale.

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const rendererRoot = path.join(root, 'src', 'renderer')
const sourceExtensions = new Set(['.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', 'coverage', '.vite'])
const testPathPattern = /(?:\.test\.|\.spec\.|\/fixtures\/|\/__tests__\/|\/__mocks__\/)/

const args = new Set(process.argv.slice(2))
const outputJson = args.has('--json')
const failOnLeak = args.has('--fail-on-leak')
const printHelp = args.has('--help') || args.has('-h')

if (printHelp) {
  console.log(`Usage: node scripts/i18n-extract-english.mjs [--json] [--fail-on-leak]

Scans devhub/src/renderer/**/*.tsx for hard-coded English UI literals that
should be wrapped with t(). Skips brand/identifier whitelist, shortcuts,
file paths, error codes, and translation fallbacks.

  --json           emit machine-readable JSON instead of markdown table
  --fail-on-leak   exit 1 when any leak is found (CI mode)
`)
  process.exit(0)
}

// ---------- whitelist ----------

const brandWhitelist = new Set([
  'DEVHUB', 'CMDK', 'VSCode', 'Cursor', 'Ctrl', 'Bash', 'JSON', 'HTML', 'CSS',
  'API', 'URL', 'UI', 'UX', 'ID', 'VS', 'TS', 'JS', 'GitHub', 'MIT', 'R8', 'OK',
  'Dagre', 'Cose', 'Cola', 'Circle', 'Preset', 'Network', 'Neural',
  'CSV', 'YAML', 'XML', 'TSX', 'JSX', 'CJK', 'CI', 'CLI', 'RSS', 'CPU', 'GPU',
  'RAM', 'IPC', 'PID', 'TTY', 'OS', 'DOM', 'DPI', 'SSD', 'HDD', 'USB',
])

const keyboardShortcutPattern = /^(?:Ctrl|Shift|Alt|Cmd|Meta|Win|Option)(?:\+(?:Ctrl|Shift|Alt|Cmd|Meta|Win|Option|[A-Z0-9]|F\d+|Tab|Enter|Esc|Space|Up|Down|Left|Right|Backspace|Delete|Home|End|PageUp|PageDown))+$/i

const filePathPattern = /[\\/]|\.[a-z0-9]{1,5}$/i
const urlPattern = /^https?:\/\/|^mailto:|^[a-z]+:\/\//i
const errorCodePattern = /^E_[A-Z][A-Z0-9_]*$/
const versionPattern = /^v?\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?$/i
const numericOnlyPattern = /^[\d\s.,+\-:%]+$/
const mimeLikePattern = /^[a-z]+\/[a-z0-9.+-]+$/i

function isWhitelisted(text) {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.length < 4) return true
  if (brandWhitelist.has(trimmed)) return true
  if (keyboardShortcutPattern.test(trimmed)) return true
  if (urlPattern.test(trimmed)) return true
  if (errorCodePattern.test(trimmed)) return true
  if (versionPattern.test(trimmed)) return true
  if (numericOnlyPattern.test(trimmed)) return true
  if (mimeLikePattern.test(trimmed)) return true
  if (filePathPattern.test(trimmed) && !/\s/.test(trimmed)) return true
  // Pure brand+brand combos like "VS Code", "GitHub MIT" -- if every word is in whitelist, skip.
  const words = trimmed.split(/[\s./_-]+/).filter(Boolean)
  if (words.length > 0 && words.every(w => brandWhitelist.has(w))) return true
  return false
}

// ---------- walker ----------

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files)
      continue
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}

// ---------- comment stripper ----------

// Strip // line comments and /* block comments */ from a single line of text,
// while preserving columns by replacing comment chars with spaces. This keeps
// match indices aligned with the original line.
function stripComments(line) {
  let out = ''
  let i = 0
  let inLineComment = false
  let inBlockComment = false
  let inString = null
  while (i < line.length) {
    const ch = line[i]
    const next = line[i + 1]
    if (inLineComment) {
      out += ' '
      i += 1
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        out += '  '
        i += 2
        inBlockComment = false
        continue
      }
      out += ' '
      i += 1
      continue
    }
    if (inString) {
      out += ch
      if (ch === '\\' && i + 1 < line.length) {
        out += line[i + 1]
        i += 2
        continue
      }
      if (ch === inString) inString = null
      i += 1
      continue
    }
    if (ch === '/' && next === '/') {
      inLineComment = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out += ch
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

// ---------- t() fallback detection ----------

// Detect whether a literal sits inside a t() call's second positional argument
// (i.e. an explicit English fallback). We do a cheap lookbehind on the current
// line for `t\(\s*['"`][^'"`]+['"`]\s*,\s*` ending right before the literal.
function isWithinTFallback(line, literalStart) {
  const before = line.slice(0, literalStart)
  // Match t('key', or t("key",
  return /\bt\(\s*(['"`])[^'"`]+\1\s*,\s*$/.test(before)
}

// ---------- pattern definitions ----------

// Each pattern returns matches with { type, text, captureStart } relative to
// the cleaned (comment-stripped) line.
const attributePatterns = [
  { type: 'aria-label', re: /\baria-label\s*=\s*"([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)"/g },
  { type: 'title', re: /\btitle\s*=\s*"([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)"/g },
  { type: 'placeholder', re: /\bplaceholder\s*=\s*"([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)"/g },
  // Curly-brace attribute string: aria-label={"Foo"} / placeholder={'Bar'}
  { type: 'aria-label', re: /\baria-label\s*=\s*\{\s*(['"`])([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)\1\s*\}/g, group: 2 },
  { type: 'title', re: /\btitle\s*=\s*\{\s*(['"`])([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)\1\s*\}/g, group: 2 },
  { type: 'placeholder', re: /\bplaceholder\s*=\s*\{\s*(['"`])([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*)\1\s*\}/g, group: 2 },
]

// JSX text node: a literal sitting between `>` and `</` (closing tag), the
// element's closing tag — this distinguishes real JSX content from TypeScript
// generics like `Promise<DagCanvasPngExport>` where the trailing `<` does not
// start a closing tag. We further require the text to either contain a space
// (multi-word) or be reasonably JSX-shaped; bare single Capitalized tokens
// like "Promise" alone between angle brackets are virtually always TS
// generics and produce too many false positives, so they're skipped.
const jsxTextPattern = />\s*([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]{2,})\s*<\/[a-zA-Z]/g

// sr-only span: <span className="sr-only">Submit</span>
const srOnlyPattern = /<span\s+className\s*=\s*"sr-only"\s*>\s*([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]{2,})\s*<\/span>/g

// Template literal with English content (must contain at least one space and
// start with capital, or contain ${} interpolation around English words).
const templateLiteralPattern = /`([A-Z][a-zA-Z][a-zA-Z\s\-+/.,!?:&()'"%]*\$\{[^}]+\}[a-zA-Z\s\-+/.,!?:&()'"%]*|[A-Z][a-zA-Z]+(?:\s+[a-zA-Z]+){1,})`/g

// ---------- scanner ----------

function scanLine(rawLine, cleanedLine) {
  const matches = []

  for (const { type, re, group } of attributePatterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(cleanedLine)) !== null) {
      const text = (group ? m[group] : m[1]).trim()
      const captureStart = m.index
      if (isWhitelisted(text)) continue
      if (isWithinTFallback(cleanedLine, captureStart)) continue
      matches.push({ type, text, column: captureStart })
    }
  }

  srOnlyPattern.lastIndex = 0
  let sm
  while ((sm = srOnlyPattern.exec(cleanedLine)) !== null) {
    const text = sm[1].trim()
    if (isWhitelisted(text)) continue
    matches.push({ type: 'sr-only', text, column: sm.index })
  }

  jsxTextPattern.lastIndex = 0
  let jm
  while ((jm = jsxTextPattern.exec(cleanedLine)) !== null) {
    const text = jm[1].trim()
    if (isWhitelisted(text)) continue
    // Skip if this looks like a closing tag context "</Foo>" or "/>"
    if (cleanedLine.slice(jm.index, jm.index + 2) === '</') continue
    matches.push({ type: 'jsx-text', text, column: jm.index })
  }

  templateLiteralPattern.lastIndex = 0
  let tm
  while ((tm = templateLiteralPattern.exec(cleanedLine)) !== null) {
    const text = tm[1].trim()
    if (isWhitelisted(text)) continue
    if (isWithinTFallback(cleanedLine, tm.index)) continue
    matches.push({ type: 'template-literal', text, column: tm.index })
  }

  return matches
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)
  const findings = []
  let inBlockComment = false
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    // Carry block-comment state across lines.
    let cleaned = raw
    if (inBlockComment) {
      const endIdx = cleaned.indexOf('*/')
      if (endIdx === -1) {
        cleaned = ' '.repeat(cleaned.length)
      } else {
        cleaned = ' '.repeat(endIdx + 2) + cleaned.slice(endIdx + 2)
        inBlockComment = false
      }
    }
    // Detect block-comment start on this (post-trim) line — but only if not
    // inside a string. We approximate by running stripComments which handles
    // strings, then check the tail: if a /* survived without closing, that
    // means it's outside strings and unclosed.
    cleaned = stripComments(cleaned)
    // After stripComments, any unclosed /* would have been consumed; but our
    // implementation stops at end-of-line, so we need to detect manually here.
    // Re-scan original line for unmatched /* outside strings:
    if (!inBlockComment) {
      const m = /\/\*(?![^]*\*\/)/.exec(raw)
      if (m) inBlockComment = true
    }
    const lineFindings = scanLine(raw, cleaned)
    for (const f of lineFindings) {
      findings.push({ line: i + 1, ...f })
    }
  }
  return findings
}

// ---------- main ----------

if (!fs.existsSync(rendererRoot)) {
  console.error(`Renderer root not found: ${rendererRoot}`)
  process.exit(2)
}

const files = walk(rendererRoot)
const report = {}
let totalLeaks = 0
let scannedFiles = 0

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, '/')
  if (testPathPattern.test(relative)) continue
  scannedFiles += 1
  const findings = scanFile(file)
  if (findings.length === 0) continue
  for (const f of findings) {
    const key = `${relative}:${f.line}`
    if (!report[key]) report[key] = []
    report[key].push({ type: f.type, text: f.text })
    totalLeaks += 1
  }
}

if (outputJson) {
  console.log(JSON.stringify({
    scannedRoot: path.relative(root, rendererRoot).replace(/\\/g, '/'),
    scannedFiles,
    totalLeaks,
    locations: Object.keys(report).length,
    report,
  }, null, 2))
} else {
  const lines = []
  lines.push(`# i18n hard-coded English scan`)
  lines.push(``)
  lines.push(`Scanned root: \`${path.relative(root, rendererRoot).replace(/\\/g, '/')}\``)
  lines.push(`Scanned .tsx files: ${scannedFiles}`)
  lines.push(`Locations with leaks: ${Object.keys(report).length}`)
  lines.push(`Total leak entries: ${totalLeaks}`)
  lines.push(``)
  if (totalLeaks === 0) {
    lines.push(`No hard-coded English literals detected.`)
  } else {
    lines.push(`| file:line | type | text |`)
    lines.push(`| --- | --- | --- |`)
    const sortedKeys = Object.keys(report).sort()
    for (const key of sortedKeys) {
      for (const entry of report[key]) {
        const safeText = entry.text.replace(/\|/g, '\\|')
        lines.push(`| ${key} | ${entry.type} | ${safeText} |`)
      }
    }
  }
  console.log(lines.join('\n'))
}

if (failOnLeak && totalLeaks > 0) {
  process.exit(1)
}
