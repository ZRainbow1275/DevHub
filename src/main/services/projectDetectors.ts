/**
 * Multi-ecosystem project type detectors.
 *
 * Each detector checks a directory for project-type-specific marker files
 * and extracts metadata (name, scripts/commands).
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ProjectType } from '@shared/types'

// Lazy-loaded parsers to avoid startup cost
let tomlParse: ((input: string) => Record<string, unknown>) | null = null
let yamlLoad: ((input: string) => unknown) | null = null
let xmlParse: ((input: string) => Record<string, unknown>) | null = null

async function loadToml(): Promise<typeof tomlParse> {
  if (!tomlParse) {
    const mod = await import('@iarna/toml')
    tomlParse = mod.parse as (input: string) => Record<string, unknown>
  }
  return tomlParse
}

async function loadYaml(): Promise<typeof yamlLoad> {
  if (!yamlLoad) {
    const mod = await import('js-yaml')
    yamlLoad = mod.load as (input: string) => unknown
  }
  return yamlLoad
}

async function loadXml(): Promise<typeof xmlParse> {
  if (!xmlParse) {
    const { XMLParser } = await import('fast-xml-parser')
    const parser = new XMLParser({ ignoreAttributes: true })
    xmlParse = (input: string) => parser.parse(input) as Record<string, unknown>
  }
  return xmlParse
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stats = await fs.stat(p)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export interface DetectionResult {
  projectType: ProjectType
  name: string
  scripts: string[]
}

/**
 * Detects all project types present in a given directory.
 * Returns an array of results, one per detected type.
 * When multiple types are detected (e.g., both package.json and Cargo.toml),
 * all are returned.
 */
export async function detectProjectTypes(dirPath: string): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []

  // Run all detectors in parallel
  const detections = await Promise.allSettled([
    detectNodeProject(dirPath),
    detectVenvProject(dirPath),
    detectCondaProject(dirPath),
    detectPoetryProject(dirPath),
    detectRustProject(dirPath),
    detectGoProject(dirPath),
    detectMavenProject(dirPath),
    detectGradleProject(dirPath),
  ])

  for (const detection of detections) {
    if (detection.status === 'fulfilled' && detection.value !== null) {
      results.push(detection.value)
    }
  }

  return results
}

/**
 * Detect npm/pnpm/yarn project from package.json + lock files.
 */
async function detectNodeProject(dirPath: string): Promise<DetectionResult | null> {
  const pkgPath = path.join(dirPath, 'package.json')
  if (!(await fileExists(pkgPath))) return null

  try {
    const content = await fs.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(content) as Record<string, unknown>
    const name = (pkg.name as string) || path.basename(dirPath)
    const scripts = pkg.scripts ? Object.keys(pkg.scripts as Record<string, unknown>) : []

    // Determine specific Node package manager by lock file
    const [hasPnpmLock, hasYarnLock, hasNpmLock] = await Promise.all([
      fileExists(path.join(dirPath, 'pnpm-lock.yaml')),
      fileExists(path.join(dirPath, 'yarn.lock')),
      fileExists(path.join(dirPath, 'package-lock.json')),
    ])

    let projectType: ProjectType = 'npm' // default
    if (hasPnpmLock) {
      projectType = 'pnpm'
    } else if (hasYarnLock) {
      projectType = 'yarn'
    } else if (hasNpmLock) {
      projectType = 'npm'
    }
    // If no lock file, check packageManager field
    else if (typeof pkg.packageManager === 'string') {
      const pm = (pkg.packageManager as string).toLowerCase()
      if (pm.startsWith('pnpm')) projectType = 'pnpm'
      else if (pm.startsWith('yarn')) projectType = 'yarn'
    }

    return { projectType, name, scripts }
  } catch {
    return null
  }
}

/**
 * Detect Python venv project: requirements.txt + (venv/ or .venv/)
 */
async function detectVenvProject(dirPath: string): Promise<DetectionResult | null> {
  const hasRequirements = await fileExists(path.join(dirPath, 'requirements.txt'))
  if (!hasRequirements) return null

  const hasVenv = await dirExists(path.join(dirPath, 'venv'))
  const hasDotVenv = await dirExists(path.join(dirPath, '.venv'))

  if (!hasVenv && !hasDotVenv) return null

  return {
    projectType: 'venv',
    name: path.basename(dirPath),
    scripts: ['install', 'run', 'test']
  }
}

/**
 * Detect Conda project: environment.yml or environment.yaml
 */
async function detectCondaProject(dirPath: string): Promise<DetectionResult | null> {
  const ymlPath = path.join(dirPath, 'environment.yml')
  const yamlPath = path.join(dirPath, 'environment.yaml')

  const [hasYml, hasYaml] = await Promise.all([
    fileExists(ymlPath),
    fileExists(yamlPath),
  ])

  const filePath = hasYml ? ymlPath : hasYaml ? yamlPath : null
  if (!filePath) return null

  try {
    const parse = await loadYaml()
    if (!parse) return null
    const content = await fs.readFile(filePath, 'utf-8')
    const data = parse(content) as Record<string, unknown> | null
    const name = (data?.name as string) || path.basename(dirPath)

    return {
      projectType: 'conda',
      name,
      scripts: ['create', 'activate', 'install']
    }
  } catch {
    return {
      projectType: 'conda',
      name: path.basename(dirPath),
      scripts: ['create', 'activate', 'install']
    }
  }
}

/**
 * Detect Poetry project: pyproject.toml with [tool.poetry] section
 */
async function detectPoetryProject(dirPath: string): Promise<DetectionResult | null> {
  const tomlPath = path.join(dirPath, 'pyproject.toml')
  if (!(await fileExists(tomlPath))) return null

  try {
    const parse = await loadToml()
    if (!parse) return null
    const content = await fs.readFile(tomlPath, 'utf-8')
    const data = parse(content)

    const tool = data.tool as Record<string, unknown> | undefined
    const poetry = tool?.poetry as Record<string, unknown> | undefined

    if (!poetry) return null

    const name = (poetry.name as string) || path.basename(dirPath)
    const poetryScripts = poetry.scripts as Record<string, unknown> | undefined
    const scripts = poetryScripts ? Object.keys(poetryScripts) : ['run', 'install', 'build', 'test']

    return { projectType: 'poetry', name, scripts }
  } catch {
    return null
  }
}

/**
 * Detect Rust project: Cargo.toml
 */
async function detectRustProject(dirPath: string): Promise<DetectionResult | null> {
  const cargoPath = path.join(dirPath, 'Cargo.toml')
  if (!(await fileExists(cargoPath))) return null

  try {
    const parse = await loadToml()
    if (!parse) return null
    const content = await fs.readFile(cargoPath, 'utf-8')
    const data = parse(content)

    const pkg = data.package as Record<string, unknown> | undefined
    const name = (pkg?.name as string) || path.basename(dirPath)

    return {
      projectType: 'rust',
      name,
      scripts: ['run', 'build', 'test', 'check', 'clippy']
    }
  } catch {
    return {
      projectType: 'rust',
      name: path.basename(dirPath),
      scripts: ['run', 'build', 'test', 'check', 'clippy']
    }
  }
}

/**
 * Detect Go project: go.mod
 */
async function detectGoProject(dirPath: string): Promise<DetectionResult | null> {
  const goModPath = path.join(dirPath, 'go.mod')
  if (!(await fileExists(goModPath))) return null

  try {
    const content = await fs.readFile(goModPath, 'utf-8')
    // Extract module name from first line: "module github.com/user/repo"
    const moduleMatch = content.match(/^module\s+(\S+)/m)
    const moduleName = moduleMatch ? moduleMatch[1] : path.basename(dirPath)
    // Use the last part of the module path as the name
    const name = moduleName.includes('/') ? moduleName.split('/').pop()! : moduleName

    return {
      projectType: 'go',
      name,
      scripts: ['run', 'build', 'test', 'vet']
    }
  } catch {
    return {
      projectType: 'go',
      name: path.basename(dirPath),
      scripts: ['run', 'build', 'test', 'vet']
    }
  }
}

/**
 * Detect Java Maven project: pom.xml
 */
async function detectMavenProject(dirPath: string): Promise<DetectionResult | null> {
  const pomPath = path.join(dirPath, 'pom.xml')
  if (!(await fileExists(pomPath))) return null

  try {
    const parse = await loadXml()
    if (!parse) return null
    const content = await fs.readFile(pomPath, 'utf-8')
    const data = parse(content)

    const project = data.project as Record<string, unknown> | undefined
    const artifactId = (project?.artifactId as string) || ''
    const groupId = (project?.groupId as string) || ''
    const name = artifactId || groupId || path.basename(dirPath)

    return {
      projectType: 'java-maven',
      name,
      scripts: ['compile', 'package', 'test', 'clean', 'install']
    }
  } catch {
    return {
      projectType: 'java-maven',
      name: path.basename(dirPath),
      scripts: ['compile', 'package', 'test', 'clean', 'install']
    }
  }
}

/**
 * Detect Java Gradle project: build.gradle or build.gradle.kts
 */
async function detectGradleProject(dirPath: string): Promise<DetectionResult | null> {
  const [hasGradle, hasGradleKts] = await Promise.all([
    fileExists(path.join(dirPath, 'build.gradle')),
    fileExists(path.join(dirPath, 'build.gradle.kts')),
  ])

  if (!hasGradle && !hasGradleKts) return null

  // Gradle project name is typically the directory name
  const name = path.basename(dirPath)

  return {
    projectType: 'java-gradle',
    name,
    scripts: ['build', 'run', 'test', 'clean', 'assemble']
  }
}

/**
 * List of all marker files used for project detection.
 * Used by ProjectWatcher to know which files to monitor.
 */
export const PROJECT_MARKER_FILES: readonly string[] = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'requirements.txt',
  'environment.yml',
  'environment.yaml',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
] as const
