import type { RecordingStreamKind } from '@shared/schemas/recording'
import { QueuedRecordingEventStream } from './RecordingEventStream'

export class StdoutStream extends QueuedRecordingEventStream {
  constructor(filePath: string, kind: RecordingStreamKind = 'stdout') {
    super(kind, filePath)
  }
}
