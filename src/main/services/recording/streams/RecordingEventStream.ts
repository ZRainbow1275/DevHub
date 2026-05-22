import { mkdir, open, type FileHandle } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RecordingEvent, RecordingStreamKind } from '@shared/schemas/recording'

export interface RecordingEventStream {
  readonly kind: RecordingStreamKind
  append(event: RecordingEvent): void
  flush(): Promise<void>
  close(): Promise<void>
}

export class QueuedRecordingEventStream implements RecordingEventStream {
  private handle: FileHandle | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    readonly kind: RecordingStreamKind,
    private readonly filePath: string
  ) {}

  append(event: RecordingEvent): void {
    const line = `${JSON.stringify(event)}\n`
    const next = this.writeQueue.then(async () => {
      const handle = await this.openHandle()
      await handle.write(line, undefined, 'utf8')
    })
    this.writeQueue = next.catch(() => undefined)
  }

  async flush(): Promise<void> {
    await this.writeQueue
  }

  async close(): Promise<void> {
    await this.flush()
    if (!this.handle) return
    const handle = this.handle
    this.handle = null
    await handle.close()
  }

  private async openHandle(): Promise<FileHandle> {
    if (this.handle) return this.handle
    await mkdir(dirname(this.filePath), { recursive: true })
    this.handle = await open(this.filePath, 'a')
    return this.handle
  }
}
