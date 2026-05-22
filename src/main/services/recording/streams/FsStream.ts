import { QueuedRecordingEventStream } from './RecordingEventStream'

export class FsStream extends QueuedRecordingEventStream {
  constructor(filePath: string) {
    super('fs', filePath)
  }
}
