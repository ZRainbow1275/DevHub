import { QueuedRecordingEventStream } from './RecordingEventStream'

export class StdinStream extends QueuedRecordingEventStream {
  constructor(filePath: string) {
    super('stdin', filePath)
  }
}
