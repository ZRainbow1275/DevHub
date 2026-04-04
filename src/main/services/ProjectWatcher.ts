/**
 * ProjectWatcher - File system watcher for automatic project discovery.
 *
 * Watches configured root directories for project marker file changes
 * (creation/deletion) and emits events when new projects appear or
 * existing projects are removed.
 *
 * Uses chokidar for cross-platform file watching with debounce
 * to prevent event flooding.
 */
import { watch, type FSWatcher } from 'chokidar'
import * as path from 'path'
import { detectProjectTypes, PROJECT_MARKER_FILES, type DetectionResult } from './projectDetectors'

export interface WatcherEvent {
  type: 'added' | 'removed'
  dirPath: string
  detections: DetectionResult[]
}

type WatcherCallback = (events: WatcherEvent[]) => void

export class ProjectWatcher {
  private watcher: FSWatcher | null = null
  private watchPaths: string[] = []
  private onChangeCallback: WatcherCallback | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingChanges: Map<string, 'add' | 'unlink'> = new Map()
  private readonly debounceMs: number
  private readonly watchDepth: number
  private _isRunning = false

  constructor(options?: { debounceMs?: number; watchDepth?: number }) {
    this.debounceMs = options?.debounceMs ?? 3000
    this.watchDepth = options?.watchDepth ?? 2
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  /**
   * Register callback for project change events.
   */
  onChange(callback: WatcherCallback): void {
    this.onChangeCallback = callback
  }

  /**
   * Start watching the given root directories.
   * Watches for project marker files up to `watchDepth` levels deep.
   */
  async start(rootPaths: string[]): Promise<void> {
    if (this._isRunning) {
      await this.stop()
    }

    this.watchPaths = rootPaths.filter(p => p && typeof p === 'string')
    if (this.watchPaths.length === 0) return

    // Build glob patterns for marker files at various depths
    const watchGlobs: string[] = []
    for (const rootPath of this.watchPaths) {
      const normalizedRoot = path.normalize(rootPath)
      for (const marker of PROJECT_MARKER_FILES) {
        // Watch at depth 0, 1, and 2 (configurable)
        for (let d = 0; d <= this.watchDepth; d++) {
          const pattern = d === 0
            ? path.join(normalizedRoot, marker)
            : path.join(normalizedRoot, ...Array(d).fill('*'), marker)
          watchGlobs.push(pattern.replace(/\\/g, '/'))
        }
      }
    }

    this.watcher = watch(watchGlobs, {
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      // Ignore node_modules, .git, and other heavy dirs
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/vendor/**',
        '**/__pycache__/**',
      ],
      // Use polling on Windows for better reliability (30s interval to reduce CPU load on large directories)
      usePolling: process.platform === 'win32',
      interval: 30000,
    })

    this.watcher.on('add', (filePath: string) => {
      this.handleFileEvent(filePath, 'add')
    })

    this.watcher.on('unlink', (filePath: string) => {
      this.handleFileEvent(filePath, 'unlink')
    })

    this.watcher.on('error', (error: unknown) => {
      console.error('ProjectWatcher error:', error instanceof Error ? error.message : error)
    })

    this._isRunning = true
  }

  /**
   * Stop watching and clean up all resources.
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    this.pendingChanges.clear()
    this._isRunning = false
  }

  /**
   * Handle a file event, accumulating changes for debounce.
   */
  private handleFileEvent(filePath: string, eventType: 'add' | 'unlink'): void {
    const dirPath = path.dirname(filePath)
    this.pendingChanges.set(dirPath, eventType)

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.processPendingChanges()
    }, this.debounceMs)
  }

  /**
   * Process accumulated file changes after debounce period.
   */
  private async processPendingChanges(): Promise<void> {
    const changes = new Map(this.pendingChanges)
    this.pendingChanges.clear()

    const events: WatcherEvent[] = []

    for (const [dirPath, eventType] of changes) {
      try {
        if (eventType === 'add') {
          const detections = await detectProjectTypes(dirPath)
          if (detections.length > 0) {
            events.push({ type: 'added', dirPath, detections })
          }
        } else {
          // For 'unlink', re-detect to see if any project types remain
          const detections = await detectProjectTypes(dirPath)
          events.push({
            type: detections.length > 0 ? 'added' : 'removed',
            dirPath,
            detections
          })
        }
      } catch (error) {
        console.error(`ProjectWatcher: failed to process change at ${dirPath}:`, error)
      }
    }

    if (events.length > 0 && this.onChangeCallback) {
      this.onChangeCallback(events)
    }
  }

  /**
   * Update the watched paths at runtime.
   */
  async updatePaths(newPaths: string[]): Promise<void> {
    if (this._isRunning) {
      await this.stop()
      await this.start(newPaths)
    } else {
      this.watchPaths = newPaths
    }
  }
}
