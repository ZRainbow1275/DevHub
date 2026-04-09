/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ProjectScanner, ScanResult } from './ProjectScanner'

describe('ProjectScanner', () => {
  let scanner: ProjectScanner

  beforeEach(() => {
    vi.clearAllMocks()
    scanner = new ProjectScanner()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('scanDirectory', () => {
    it('should return empty array when depth exceeds max', async () => {
      const results = await scanner.scanDirectory('C:\\deep\\path', 5)
      expect(results).toEqual([])
    })

    it('should handle non-existent path gracefully', async () => {
      const results = await scanner.scanDirectory('C:\\definitely\\not\\existing\\path\\' + Date.now())
      expect(results).toEqual([])
    })
  })

  describe('deduplicateResults', () => {
    it('should remove duplicate paths (case-insensitive)', () => {
      const results: ScanResult[] = [
        { path: 'C:\\Projects\\App', name: 'app', scripts: [], projectType: 'npm', hasPackageJson: true },
        { path: 'c:\\projects\\app', name: 'app', scripts: [], projectType: 'npm', hasPackageJson: true },
        { path: 'C:\\Projects\\Other', name: 'other', scripts: [], projectType: 'npm', hasPackageJson: true }
      ]

      const deduplicated = (scanner as any).deduplicateResults(results)

      expect(deduplicated).toHaveLength(2)
      expect(deduplicated[0].path).toBe('C:\\Projects\\App')
      expect(deduplicated[1].path).toBe('C:\\Projects\\Other')
    })

    it('should preserve first occurrence when duplicates exist', () => {
      const results: ScanResult[] = [
        { path: 'C:\\Projects\\First', name: 'first', scripts: ['dev'], projectType: 'npm', hasPackageJson: true },
        { path: 'c:\\projects\\first', name: 'second', scripts: ['build'], projectType: 'npm', hasPackageJson: true }
      ]

      const deduplicated = (scanner as any).deduplicateResults(results)

      expect(deduplicated).toHaveLength(1)
      expect(deduplicated[0].name).toBe('first')
      expect(deduplicated[0].scripts).toEqual(['dev'])
    })

    it('should handle empty array', () => {
      const deduplicated = (scanner as any).deduplicateResults([])
      expect(deduplicated).toEqual([])
    })
  })

  describe('discoverProjectsIntelligently', () => {
    it('should combine results from multiple sources and deduplicate', async () => {
      const commonResults: ScanResult[] = [
        { path: 'C:\\Projects\\app1', name: 'app1', scripts: ['dev'], projectType: 'npm', hasPackageJson: true }
      ]
      const vscodeResults: ScanResult[] = [
        { path: 'C:\\Projects\\app2', name: 'app2', scripts: ['start'], projectType: 'npm', hasPackageJson: true }
      ]

      vi.spyOn(scanner, 'scanCommonLocations').mockResolvedValue(commonResults)
      vi.spyOn(scanner as any, 'getVSCodeRecentProjects').mockResolvedValue(['C:\\Projects\\app2'])
      vi.spyOn(scanner as any, 'getPnpmLinkedProjects').mockResolvedValue([])
      vi.spyOn(scanner as any, 'getNpmCacheProjects').mockResolvedValue([])
      vi.spyOn(scanner, 'scanDirectory').mockResolvedValue(vscodeResults)

      const results = await scanner.discoverProjectsIntelligently()

      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.some(r => r.name === 'app1')).toBe(true)
      expect(results.some(r => r.name === 'app2')).toBe(true)
    })

    it('should deduplicate results from different sources', async () => {
      const samePath = 'C:\\Projects\\shared'
      const sharedResult: ScanResult = { path: samePath, name: 'shared', scripts: [], projectType: 'npm', hasPackageJson: true }

      vi.spyOn(scanner, 'scanCommonLocations').mockResolvedValue([sharedResult])
      vi.spyOn(scanner as any, 'getVSCodeRecentProjects').mockResolvedValue([samePath])
      vi.spyOn(scanner as any, 'getPnpmLinkedProjects').mockResolvedValue([])
      vi.spyOn(scanner as any, 'getNpmCacheProjects').mockResolvedValue([])
      vi.spyOn(scanner, 'scanDirectory').mockResolvedValue([sharedResult])

      const results = await scanner.discoverProjectsIntelligently()

      const sharedCount = results.filter(r => r.path.toLowerCase() === samePath.toLowerCase()).length
      expect(sharedCount).toBe(1)
    })

    it('should handle empty results from all sources', async () => {
      vi.spyOn(scanner, 'scanCommonLocations').mockResolvedValue([])
      vi.spyOn(scanner as any, 'getVSCodeRecentProjects').mockResolvedValue([])
      vi.spyOn(scanner as any, 'getPnpmLinkedProjects').mockResolvedValue([])
      vi.spyOn(scanner as any, 'getNpmCacheProjects').mockResolvedValue([])

      const results = await scanner.discoverProjectsIntelligently()

      expect(results).toEqual([])
    })
  })

  describe('scanCommonLocations', () => {
    it('should call scanDirectory for discovered paths', async () => {
      const scanSpy = vi.spyOn(scanner, 'scanDirectory').mockResolvedValue([])

      await scanner.scanCommonLocations(['C'])

      // Should have been called at least once
      expect(scanSpy).toHaveBeenCalled()
    })

    it('should return deduplicated results', async () => {
      const mockResult: ScanResult = {
        path: 'C:\\Projects\\test',
        name: 'test',
        scripts: ['dev'],
        projectType: 'npm',
        hasPackageJson: true
      }

      vi.spyOn(scanner, 'scanDirectory').mockResolvedValue([mockResult, mockResult])

      const results = await scanner.scanCommonLocations(['C'])

      // Results should be deduplicated
      const uniquePaths = new Set(results.map(r => r.path.toLowerCase()))
      expect(results.length).toBe(uniquePaths.size)
    })
  })

  describe('getAvailableDrives', () => {
    it('should return array of drive letters', async () => {
      const drives = await scanner.getAvailableDrives()

      expect(Array.isArray(drives)).toBe(true)
      // Should contain at least one drive (C: is almost always present)
      expect(drives.length).toBeGreaterThan(0)
      // Drive letters should be uppercase single letters
      drives.forEach(drive => {
        expect(drive).toMatch(/^[A-Z]$/)
      })
    })
  })

  describe('getVSCodeRecentProjects', () => {
    it('should return array of paths', async () => {
      const paths = await (scanner as any).getVSCodeRecentProjects()

      expect(Array.isArray(paths)).toBe(true)
      // Paths should be strings if any exist
      paths.forEach((p: unknown) => {
        expect(typeof p).toBe('string')
      })
    })
  })

  describe('getPnpmLinkedProjects', () => {
    it('should return array of paths', async () => {
      const paths = await (scanner as any).getPnpmLinkedProjects()

      expect(Array.isArray(paths)).toBe(true)
    })
  })

  describe('getNpmCacheProjects', () => {
    it('should return array of paths', async () => {
      const paths = await (scanner as any).getNpmCacheProjects()

      expect(Array.isArray(paths)).toBe(true)
    })
  })

  describe('excludeDirs configuration', () => {
    it('should have common directories in exclude list', () => {
      const excludeDirs = (scanner as any).excludeDirs as Set<string>

      expect(excludeDirs.has('node_modules')).toBe(true)
      expect(excludeDirs.has('.git')).toBe(true)
      expect(excludeDirs.has('dist')).toBe(true)
      expect(excludeDirs.has('build')).toBe(true)
      expect(excludeDirs.has('.next')).toBe(true)
    })
  })

  describe('maxDepth configuration', () => {
    it('should have reasonable max depth', () => {
      const maxDepth = (scanner as any).maxDepth

      expect(maxDepth).toBeGreaterThan(0)
      expect(maxDepth).toBeLessThanOrEqual(10)
    })
  })
})
