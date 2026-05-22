export interface CsvLaunchMetadata {
  devhubCsvVersion: string
  runner: 'devhub' | 'python' | 'cli'
  author?: string
  totalTimeoutMs?: number
  concurrentMax: number
}

const DEFAULT_METADATA: CsvLaunchMetadata = {
  devhubCsvVersion: '1.0',
  runner: 'devhub',
  concurrentMax: 3
}

export class CsvMetadataReader {
  static fromRecords(records: readonly { fields: readonly string[] }[]): CsvLaunchMetadata {
    const metadata = { ...DEFAULT_METADATA }
    const comment = records.find(record => record.fields[0]?.trim().startsWith('# devhub-csv-version='))?.fields[0]?.trim()
    if (!comment) return metadata
    for (const part of comment.replace(/^#\s*/, '').split(';')) {
      const [rawKey, rawValue] = part.split('=')
      const key = rawKey?.trim()
      const value = rawValue?.trim()
      if (!key || !value) continue
      if (key === 'devhub-csv-version') metadata.devhubCsvVersion = value
      if (key === 'runner' && (value === 'devhub' || value === 'python' || value === 'cli')) metadata.runner = value
      if (key === 'author') metadata.author = value
      if (key === 'concurrentMax') {
        const parsed = Number(value)
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 16) metadata.concurrentMax = parsed
      }
      if (key === 'totalTimeoutMs') {
        const parsed = Number(value)
        if (Number.isInteger(parsed) && parsed > 0) metadata.totalTimeoutMs = parsed
      }
    }
    return metadata
  }
}
