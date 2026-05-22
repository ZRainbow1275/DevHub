import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(projectRoot, 'shim', 'codex', 'codex-shim.cjs')
const configPath = join(projectRoot, 'shim', 'codex', 'build.config.json')
const outputDir = join(projectRoot, 'resources', 'shims', 'codex')
const packageBin = join(projectRoot, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js')

function readTargetMode() {
  const index = process.argv.indexOf('--target')
  if (index === -1) return 'host'
  return process.argv[index + 1] ?? 'host'
}

function hostTargetId() {
  return `${process.platform}-${process.arch}`
}

function selectTargets(targets, mode) {
  if (mode === 'all') return targets
  if (mode === 'host') {
    const host = hostTargetId()
    return targets.filter(target => target.id === host)
  }
  return targets.filter(target => target.id === mode)
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    execFile(command, args, {
      cwd: projectRoot,
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 180_000,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([error.message, stdout, stderr].filter(Boolean).join('\n')))
        return
      }
      resolveRun({ stdout, stderr })
    })
  })
}

const mode = readTargetMode()
const config = JSON.parse(await readFile(configPath, 'utf8'))
const targets = selectTargets(config.targets, mode)

if (targets.length === 0) {
  throw new Error(`No codex shim target matched "${mode}" from host ${hostTargetId()}`)
}

if (!existsSync(packageBin)) {
  throw new Error('Missing @yao-pkg/pkg binary. Run pnpm install in devhub first.')
}

await mkdir(outputDir, { recursive: true })

const built = []
for (const target of targets) {
  const outputPath = join(outputDir, target.fileName)
  await run(process.execPath, [
    packageBin,
    sourcePath,
    '--targets',
    target.pkgTarget,
    '--output',
    outputPath
  ])
  const bytes = await readFile(outputPath)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(`${outputPath}.sha256`, `${sha256}  ${target.fileName}\n`, 'utf8')
  built.push({
    id: target.id,
    outputPath,
    pkgTarget: target.pkgTarget,
    sha256,
    size: bytes.length
  })
}

console.log(JSON.stringify({ built, mode, sourcePath }, null, 2))
