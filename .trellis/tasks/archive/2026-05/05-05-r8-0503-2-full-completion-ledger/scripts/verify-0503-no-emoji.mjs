import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = join(taskDir, '..', '..', '..')
const researchDir = join(taskDir, 'research')

const promptRoots = [
  join(repoRoot, 'prompts', '0503'),
  join(repoRoot, 'prompts', '0503-2')
]

const reportFiles = [
  join(researchDir, '0503-acceptance-pack.md'),
  join(researchDir, '0503-checkbox-manifest.md'),
  join(researchDir, '0503-completion-audit.md'),
  join(researchDir, '0503-completion-status.md'),
  join(researchDir, '0503-owner-action-queue.md'),
  join(researchDir, '0503-owner-closure-bundles.md'),
  join(researchDir, '0503-strict-completion-report.md')
]

const promptExtensions = new Set(['.md'])
const taskArtifactExtensions = new Set(['.json', '.jsonl', '.md'])
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const selfTest = process.argv.includes('--self-test')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function relativeRepoPath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/')
}

function listTextFiles(root, extensions) {
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
      } else if (entry.isFile() && extensions.has(extname(entry.name))) {
        files.push(fullPath)
      }
    }
  }
  visit(root)
  return files
}

function findEmojiLines(files, pathFormatter = relativeRepoPath) {
  const hits = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      if (emojiPattern.test(line)) {
        hits.push({
          file: pathFormatter(file),
          line: index + 1,
          text: line
        })
      }
    }
  }
  return hits
}

function runSelfTest() {
  assert(reportFiles.some(file => file.endsWith('0503-owner-closure-bundles.md')), 'self-test should keep owner closure bundles in generated report scan list')
  const root = mkdtempSync(join(tmpdir(), '0503-no-emoji-'))
  try {
    const cleanFile = join(root, 'clean.md')
    const dirtyFile = join(root, 'dirty.md')
    const dirtyJson = join(root, 'dirty.json')
    const dirtyJsonl = join(root, 'dirty.jsonl')
    writeFileSync(cleanFile, '# Clean\nNo icon here.\n', 'utf8')
    writeFileSync(dirtyFile, '# Dirty\nContains 🟢 marker.\n', 'utf8')
    writeFileSync(dirtyJson, '{"status":"✅"}\n', 'utf8')
    writeFileSync(dirtyJsonl, '{"status":"❌"}\n', 'utf8')
    assert(findEmojiLines([cleanFile], file => file).length === 0, 'self-test should accept clean markdown')
    const hits = findEmojiLines([dirtyFile], file => file)
    assert(hits.length === 1, 'self-test should find one emoji line')
    assert(hits[0].line === 2, 'self-test should report emoji line number')
    assert(listTextFiles(root, taskArtifactExtensions).some(file => file === dirtyJson), 'self-test should include generated JSON artifacts')
    assert(listTextFiles(root, taskArtifactExtensions).some(file => file === dirtyJsonl), 'self-test should include active task JSONL artifacts')
    assert(findEmojiLines([dirtyJson], file => file).length === 1, 'self-test should reject emoji in generated JSON artifacts')
    assert(findEmojiLines([dirtyJsonl], file => file).length === 1, 'self-test should reject emoji in active task JSONL artifacts')
    console.log('0503 no-emoji verifier self-test passed.')
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const files = [
    ...new Set([
      ...promptRoots.flatMap(root => listTextFiles(root, promptExtensions)),
    ...listTextFiles(taskDir, taskArtifactExtensions),
    ...reportFiles
  ])
]

const hits = findEmojiLines(files)
if (hits.length > 0) {
  const sample = hits.slice(0, 80).map(hit => `${hit.file}:${hit.line}: ${hit.text}`).join('\n')
  throw new Error(`0503 no-emoji verification failed: ${hits.length} line(s)\n${sample}`)
}

console.log(`0503 no-emoji verification passed: ${files.length} prompt/report text files scanned.`)
