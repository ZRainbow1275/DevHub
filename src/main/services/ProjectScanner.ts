import * as fs from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ProjectType } from '@shared/types'
import type { GitInfo, GitCommitSummary, ProjectDependencies, DependencyEntry, LockfileType } from '@shared/types-extended'
import { detectProjectTypes, type DetectionResult } from './projectDetectors'

const execFileAsync = promisify(execFile)

// Cache for git info and dependencies
const gitInfoCache = new Map<string, { data: GitInfo; timestamp: number }>()
const depCache = new Map<string, { data: ProjectDependencies; timestamp: number }>()
const GIT_CACHE_TTL = 10_000   // 10 seconds
const DEP_CACHE_TTL = 30_000   // 30 seconds

export interface ScanResult {
  path: string
  name: string
  scripts: string[]
  projectType: ProjectType
  hasPackageJson: boolean
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stats = await fs.stat(p)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Convert a DetectionResult to a ScanResult bound to a specific directory.
 */
function detectionToScanResult(dirPath: string, detection: DetectionResult): ScanResult {
  const nodeTypes: ProjectType[] = ['npm', 'pnpm', 'yarn']
  return {
    path: dirPath,
    name: detection.name,
    scripts: detection.scripts,
    projectType: detection.projectType,
    hasPackageJson: nodeTypes.includes(detection.projectType)
  }
}

export class ProjectScanner {
  private readonly maxDepth = 4
  private readonly excludeDirs = new Set([
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'coverage',
    '__pycache__',
    '.cache',
    'target',       // Rust/Maven build output
    'vendor',       // Go vendor
    '.venv',        // Python venv
    'venv',
  ])

  /**
   * Scan a directory recursively for projects of any supported type.
   * Returns one ScanResult per detected project type per directory.
   */
  async scanDirectory(rootPath: string, depth = 0): Promise<ScanResult[]> {
    const results: ScanResult[] = []

    if (depth > this.maxDepth) return results

    try {
      const normalizedRoot = path.normalize(rootPath)

      if (!(await pathExists(normalizedRoot))) {
        return results
      }

      if (!(await isDirectory(normalizedRoot))) {
        return results
      }

      // Detect all project types in this directory
      const detections = await detectProjectTypes(normalizedRoot)

      if (detections.length > 0) {
        for (const detection of detections) {
          results.push(detectionToScanResult(normalizedRoot, detection))
        }
        // Found project(s) here, don't scan deeper into this directory
        return results
      }

      // No project found here, scan subdirectories
      const entries = await fs.readdir(normalizedRoot, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (this.excludeDirs.has(entry.name)) continue
        if (entry.name.startsWith('.')) continue

        const subPath = path.join(normalizedRoot, entry.name)
        const subResults = await this.scanDirectory(subPath, depth + 1)
        results.push(...subResults)
      }
    } catch (error) {
      console.error(`Error scanning ${rootPath}:`, error)
    }

    return results
  }

  async getAvailableDrives(): Promise<string[]> {
    try {
      // Migrated from deprecated wmic to Get-CimInstance Win32_LogicalDisk
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_LogicalDisk | Select-Object -ExpandProperty DeviceID`
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, timeout: 15000, encoding: 'utf8' }
      )
      const drives = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^[A-Z]:$/.test(line))
        .map(line => line.replace(':', ''))
      return drives
    } catch (err) {
      console.error('getAvailableDrives failed:', err instanceof Error ? err.message : err)
      // Fallback: probe common drive letters
      const commonDrives = ['C', 'D', 'E', 'F', 'G']
      const available: string[] = []
      for (const drive of commonDrives) {
        if (await pathExists(`${drive}:\\`)) {
          available.push(drive)
        }
      }
      return available
    }
  }

  async scanCommonLocations(customDrives?: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = []
    const userProfile = process.env.USERPROFILE || ''

    const userPaths = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Documents'),
      path.join(userProfile, 'Projects'),
      path.join(userProfile, 'workspace'),
      path.join(userProfile, 'dev'),
      path.join(userProfile, 'code')
    ]

    for (const scanPath of userPaths) {
      if (await pathExists(scanPath)) {
        const found = await this.scanDirectory(scanPath)
        results.push(...found)
      }
    }

    const drives = customDrives || ['C', 'D']
    const commonFolders = ['Projects', 'Desktop', 'workspace', 'dev', 'code', 'work']

    for (const drive of drives) {
      for (const folder of commonFolders) {
        const scanPath = `${drive}:\\${folder}`
        if (await pathExists(scanPath)) {
          const found = await this.scanDirectory(scanPath)
          results.push(...found)
        }
      }
    }

    const uniqueResults = this.deduplicateResults(results)
    return uniqueResults
  }

  private deduplicateResults(results: ScanResult[]): ScanResult[] {
    const seen = new Set<string>()
    return results.filter(r => {
      // Use path + projectType as the dedup key
      const key = `${r.path.toLowerCase()}::${r.projectType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  async discoverProjectsIntelligently(customDrives?: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = []
    const discoveredPaths = new Set<string>()

    const commonResults = await this.scanCommonLocations(customDrives)
    for (const r of commonResults) {
      const key = `${r.path.toLowerCase()}::${r.projectType}`
      discoveredPaths.add(key)
      results.push(r)
    }

    const vscodePaths = await this.getVSCodeRecentProjects()
    for (const projectPath of vscodePaths) {
      const scanResults = await this.scanDirectory(projectPath, 0)
      for (const r of scanResults) {
        const key = `${r.path.toLowerCase()}::${r.projectType}`
        if (!discoveredPaths.has(key)) {
          discoveredPaths.add(key)
          results.push(r)
        }
      }
    }

    const pnpmPaths = await this.getPnpmLinkedProjects()
    for (const projectPath of pnpmPaths) {
      const scanResults = await this.scanDirectory(projectPath, 0)
      for (const r of scanResults) {
        const key = `${r.path.toLowerCase()}::${r.projectType}`
        if (!discoveredPaths.has(key)) {
          discoveredPaths.add(key)
          results.push(r)
        }
      }
    }

    const npmPaths = await this.getNpmCacheProjects()
    for (const projectPath of npmPaths) {
      const scanResults = await this.scanDirectory(projectPath, 0)
      for (const r of scanResults) {
        const key = `${r.path.toLowerCase()}::${r.projectType}`
        if (!discoveredPaths.has(key)) {
          discoveredPaths.add(key)
          results.push(r)
        }
      }
    }

    return results
  }

  private async getVSCodeRecentProjects(): Promise<string[]> {
    const paths: string[] = []
    const userProfile = process.env.USERPROFILE || ''
    const appData = process.env.APPDATA || ''

    const vscodePaths = [
      path.join(appData, 'Code', 'User', 'globalStorage', 'storage.json'),
      path.join(appData, 'Code', 'storage.json'),
      path.join(userProfile, '.vscode-server', 'data', 'User', 'globalStorage', 'storage.json')
    ]

    for (const storagePath of vscodePaths) {
      try {
        if (await pathExists(storagePath)) {
          const content = await fs.readFile(storagePath, 'utf-8')
          const storage = JSON.parse(content)

          if (storage.openedPathsList?.workspaces3) {
            for (const item of storage.openedPathsList.workspaces3) {
              if (typeof item === 'string' && item.startsWith('file://')) {
                const projectPath = decodeURIComponent(item.replace('file:///', '').replace(/\//g, '\\'))
                if (await pathExists(projectPath)) {
                  paths.push(projectPath)
                }
              } else if (item?.folderUri?.startsWith('file://')) {
                const projectPath = decodeURIComponent(item.folderUri.replace('file:///', '').replace(/\//g, '\\'))
                if (await pathExists(projectPath)) {
                  paths.push(projectPath)
                }
              }
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return paths
  }

  private async getPnpmLinkedProjects(): Promise<string[]> {
    const paths: string[] = []

    try {
      const { stdout } = await execFileAsync('pnpm', ['store', 'path'], { windowsHide: true })
      const storePath = stdout.trim()

      if (storePath && await pathExists(storePath)) {
        const linksPath = path.join(storePath, '..', 'links')
        if (await pathExists(linksPath)) {
          const entries = await fs.readdir(linksPath, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isSymbolicLink()) {
              try {
                const realPath = await fs.realpath(path.join(linksPath, entry.name))
                if (await pathExists(realPath)) {
                  paths.push(realPath)
                }
              } catch {
                // Ignore invalid symlinks
              }
            }
          }
        }
      }
    } catch {
      // pnpm may not be installed
    }

    return paths
  }

  /**
   * Get Git repository info for a project path.
   * Returns null if the path is not a git repository.
   * Results are cached for 10 seconds.
   */
  async getGitInfo(projectPath: string): Promise<GitInfo | null> {
    const cached = gitInfoCache.get(projectPath)
    if (cached && Date.now() - cached.timestamp < GIT_CACHE_TTL) {
      return cached.data
    }

    try {
      // Check if it's a git repo
      await execFileAsync('git', ['rev-parse', '--git-dir'], {
        cwd: projectPath,
        windowsHide: true,
        timeout: 5000
      })

      // Get current branch
      const { stdout: branchOut } = await execFileAsync(
        'git', ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: projectPath, windowsHide: true, timeout: 5000 }
      )
      const branch = branchOut.trim()

      // Get uncommitted changes count
      const { stdout: statusOut } = await execFileAsync(
        'git', ['status', '--porcelain'],
        { cwd: projectPath, windowsHide: true, timeout: 5000 }
      )
      const uncommittedCount = statusOut.trim() === '' ? 0 : statusOut.trim().split('\n').length

      // Get recent 10 commits
      const recentCommits: GitCommitSummary[] = []
      try {
        const { stdout: logOut } = await execFileAsync(
          'git', ['log', '--oneline', '--format=%H|%s|%an|%ai', '-10'],
          { cwd: projectPath, windowsHide: true, timeout: 5000 }
        )
        for (const line of logOut.trim().split('\n')) {
          if (!line) continue
          const parts = line.split('|')
          if (parts.length >= 4) {
            recentCommits.push({
              hash: parts[0].substring(0, 7),
              message: parts[1],
              author: parts[2],
              date: parts[3]
            })
          }
        }
      } catch {
        // Empty repo or no commits yet
      }

      // Get ahead/behind
      let ahead = 0
      let behind = 0
      try {
        const { stdout: abOut } = await execFileAsync(
          'git', ['rev-list', '--count', '--left-right', '@{upstream}...HEAD'],
          { cwd: projectPath, windowsHide: true, timeout: 5000 }
        )
        const abParts = abOut.trim().split(/\s+/)
        if (abParts.length === 2) {
          behind = parseInt(abParts[0], 10) || 0
          ahead = parseInt(abParts[1], 10) || 0
        }
      } catch {
        // No upstream configured
      }

      const info: GitInfo = { branch, uncommittedCount, recentCommits, aheadBehind: { ahead, behind } }
      gitInfoCache.set(projectPath, { data: info, timestamp: Date.now() })
      return info
    } catch {
      return null
    }
  }

  /**
   * Parse dependencies from package.json at the given path.
   * Returns null if no package.json exists.
   * Results are cached for 30 seconds.
   */
  async getDependencies(projectPath: string): Promise<ProjectDependencies | null> {
    const cached = depCache.get(projectPath)
    if (cached && Date.now() - cached.timestamp < DEP_CACHE_TTL) {
      return cached.data
    }

    const pkgPath = path.join(projectPath, 'package.json')
    try {
      if (!(await pathExists(pkgPath))) {
        return null
      }

      const content = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(content) as Record<string, unknown>

      const parseDeps = (raw: unknown): DependencyEntry[] => {
        if (!raw || typeof raw !== 'object') return []
        return Object.entries(raw as Record<string, string>).map(([name, version]) => ({
          name,
          version: typeof version === 'string' ? version : 'unknown'
        })).sort((a, b) => a.name.localeCompare(b.name))
      }

      const dependencies = parseDeps(pkg.dependencies)
      const devDependencies = parseDeps(pkg.devDependencies)

      // Detect lockfile type
      let lockfileType: LockfileType = 'none'
      if (await pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        lockfileType = 'pnpm'
      } else if (await pathExists(path.join(projectPath, 'yarn.lock'))) {
        lockfileType = 'yarn'
      } else if (await pathExists(path.join(projectPath, 'package-lock.json'))) {
        lockfileType = 'npm'
      }

      const result: ProjectDependencies = { dependencies, devDependencies, lockfileType }
      depCache.set(projectPath, { data: result, timestamp: Date.now() })
      return result
    } catch {
      return null
    }
  }

  private async getNpmCacheProjects(): Promise<string[]> {
    const paths: string[] = []
    const userProfile = process.env.USERPROFILE || ''

    try {
      const { stdout } = await execFileAsync('npm', ['config', 'get', 'prefix'], { windowsHide: true })
      const npmPrefix = stdout.trim()

      if (npmPrefix) {
        const globalModules = path.join(npmPrefix, 'node_modules')
        if (await pathExists(globalModules)) {
          const entries = await fs.readdir(globalModules, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isSymbolicLink()) {
              try {
                const realPath = await fs.realpath(path.join(globalModules, entry.name))
                if (await pathExists(realPath)) {
                  paths.push(realPath)
                }
              } catch {
                // Ignore invalid symlinks
              }
            }
          }
        }
      }

      const npmrcPath = path.join(userProfile, '.npmrc')
      if (await pathExists(npmrcPath)) {
        const npmrcContent = await fs.readFile(npmrcPath, 'utf-8')
        const lines = npmrcContent.split('\n')
        for (const line of lines) {
          if (line.includes('prefix=') || line.includes('workspaces=')) {
            const match = line.match(/=(.+)/)
            if (match && match[1]) {
              const configPath = match[1].trim()
              if (await pathExists(configPath)) {
                paths.push(configPath)
              }
            }
          }
        }
      }
    } catch {
      // npm may not be installed or config is broken
    }

    return paths
  }
}
