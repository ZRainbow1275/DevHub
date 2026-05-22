import chokidar, { type FSWatcher } from 'chokidar'

export interface CsvFileWatcherEvent {
  kind: 'add' | 'change' | 'unlink'
  filePath: string
  observedAt: number
}

export class CsvFileWatcher {
  private watcher: FSWatcher | null = null

  start(rootPath: string, onEvent: (event: CsvFileWatcherEvent) => void): void {
    this.close()
    this.watcher = chokidar.watch(rootPath, {
      persistent: false,
      ignoreInitial: true,
      ignored: (filePath) => !filePath.toLowerCase().endsWith('.csv'),
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      atomic: true,
      depth: 1,
      followSymlinks: false,
      ignorePermissionErrors: true
    })
    this.watcher.on('add', filePath => onEvent({ kind: 'add', filePath, observedAt: Date.now() }))
    this.watcher.on('change', filePath => onEvent({ kind: 'change', filePath, observedAt: Date.now() }))
    this.watcher.on('unlink', filePath => onEvent({ kind: 'unlink', filePath, observedAt: Date.now() }))
  }

  close(): void {
    const current = this.watcher
    this.watcher = null
    if (current) void current.close()
  }
}
