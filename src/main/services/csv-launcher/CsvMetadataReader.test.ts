import { describe, expect, it } from 'vitest'
import { CsvMetadataReader } from './CsvMetadataReader'

describe('CsvMetadataReader', () => {
  it('parses the first DevHub CSV metadata comment and keeps safe defaults', () => {
    expect(CsvMetadataReader.fromRecords([
      { fields: ['# devhub-csv-version=1.0; runner=python; author=local; concurrentMax=4; totalTimeoutMs=90000'] },
      { fields: ['taskId', 'taskName'] }
    ])).toEqual({
      devhubCsvVersion: '1.0',
      runner: 'python',
      author: 'local',
      concurrentMax: 4,
      totalTimeoutMs: 90000
    })

    expect(CsvMetadataReader.fromRecords([{ fields: ['taskId', 'taskName'] }])).toMatchObject({
      devhubCsvVersion: '1.0',
      runner: 'devhub',
      concurrentMax: 3
    })
  })
})
