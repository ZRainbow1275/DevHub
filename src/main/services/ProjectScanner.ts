import * as fs from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ProjectType } from '@shared/types'
import { detectProjectTypes, type DetectionResult } from './projectDetectors'

const execFileAsync = promisify(execFile)

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
