import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scanRoots = ['src', 'scripts']
const scanExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.md'])
const ignoredDirs = new Set(['node_modules', 'dist', 'out', 'release', 'coverage'])
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue
      }

      files.push(...await collectFiles(path.join(dir, entry.name)))
      continue
    }

    if (scanExtensions.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name))
    }
  }

  return files
}

async function findEmojiViolations(filePath) {
  const content = await readFile(filePath, 'utf8')
  const lines = content.split(/\r?\n/u)
  const matches = []

  lines.forEach((line, index) => {
    if (!emojiPattern.test(line)) {
      return
    }

    const column = line.search(emojiPattern)
    matches.push(`${path.relative(repoRoot, filePath)}:${index + 1}:${column + 1} ${line.trim()}`)
  })

  return matches
}

async function main() {
  const files = []
  for (const root of scanRoots) {
    files.push(...await collectFiles(path.join(repoRoot, root)))
  }

  const violations = []
  for (const filePath of files) {
    violations.push(...await findEmojiViolations(filePath))
  }

  if (violations.length > 0) {
    console.error('Emoji characters are forbidden in devhub source assets:')
    for (const violation of violations) {
      console.error(`  - ${violation}`)
    }
    process.exit(1)
  }

  console.log(`No emoji found in ${files.length} files.`)
}

await main()
