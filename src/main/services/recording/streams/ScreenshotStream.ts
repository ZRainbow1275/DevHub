import { QueuedRecordingEventStream } from './RecordingEventStream'

export class ScreenshotStream extends QueuedRecordingEventStream {
  constructor(filePath: string) {
    super('screenshot', filePath)
  }
}
