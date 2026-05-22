import { QueuedRecordingEventStream } from './RecordingEventStream'

export class GitDiffStream extends QueuedRecordingEventStream {
  constructor(filePath: string) {
    super('git-diff', filePath)
  }
}
