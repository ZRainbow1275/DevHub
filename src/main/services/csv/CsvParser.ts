import { fromZodIssue } from 'zod-validation-error'
import Papa from 'papaparse'
import {
  CSV_COLUMN_NAMES,
  buildCsvTemplateRows,
  csvTaskRow18Schema,
  validateCsvHeader,
  type CsvHeaderValidationResult,
  type CsvTaskRow18
} from '@shared/schemas/csv-task-row'
import { CsvMetadataReader } from '../csv-launcher/CsvMetadataReader'

export interface CsvParseError {
  line: number
  column: string
  message: string
}

export interface CsvMetadata {
  devhubCsvVersion: string
  runner: 'devhub' | 'python' | 'cli'
  author?: string
  totalTimeoutMs?: number
  concurrentMax: number
}

export interface CsvParsedRow {
  rowIndex: number
  line: number
  raw: Record<string, string>
  row: CsvTaskRow18 | null
  errors: CsvParseError[]
}

export interface CsvParsedDocument {
  header: string[]
  headerValidation: CsvHeaderValidationResult
  rows: CsvParsedRow[]
  metadata: CsvMetadata
  errors: CsvParseError[]
}

export interface CsvRawRecord {
  line: number
  fields: string[]
}

export class CsvParser {
  parse(text: string): CsvParsedDocument {
    const normalized = text.replace(/^\uFEFF/, '')
    const records = this.parseRecords(normalized)
    return this.parseRecordSet(records)
  }

  async parseStream(input: NodeJS.ReadableStream): Promise<CsvParsedDocument> {
    const records: CsvRawRecord[] = []
    let nextRecordLine = 1
    const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
      delimiter: ',',
      header: false,
      dynamicTyping: false,
      skipEmptyLines: false,
      comments: false
    })
    parser.on('data', (row: unknown) => {
      const fields = this.normalizePapaRow(row)
      records.push({ line: nextRecordLine, fields })
      nextRecordLine += 1 + this.countEmbeddedLineBreaks(fields)
    })
    await new Promise<void>((resolve, reject) => {
      input.once('error', reject)
      parser.once('error', reject)
      parser.once('finish', resolve)
      input.pipe(parser)
    })
    return this.parseRecordSet(records)
  }

  parseRecordSet(records: readonly CsvRawRecord[]): CsvParsedDocument {
    const metadata = CsvMetadataReader.fromRecords(records)
    const dataRecords = records.filter(record => !this.isIgnorableRecord(record))
    const header = dataRecords[0]?.fields.map(field => field.trim()) ?? []
    const headerValidation = validateCsvHeader(header)
    const errors: CsvParseError[] = []
    if (!headerValidation.valid) {
      errors.push(...headerValidation.orderErrors.map(error => ({
        line: dataRecords[0]?.line ?? 1,
        column: error.expected,
        message: `CSV header mismatch at column ${error.index + 1}: expected ${error.expected}, got ${error.actual ?? 'missing'}`
      })))
      errors.push(...headerValidation.extra.map(column => ({ line: dataRecords[0]?.line ?? 1, column, message: `unexpected CSV column ${column}` })))
      errors.push(...headerValidation.missing.map(column => ({ line: dataRecords[0]?.line ?? 1, column, message: `missing CSV column ${column}` })))
    }

    const rows = dataRecords.slice(1).filter(record => record.fields.some(field => field.trim().length > 0)).map((record, rowIndex) => {
      const rowErrors: CsvParseError[] = []
      if (record.fields.length < CSV_COLUMN_NAMES.length) {
        rowErrors.push({ line: record.line, column: '__row__', message: `expected 18 columns, got ${record.fields.length}` })
      }
      if (record.fields.length > CSV_COLUMN_NAMES.length) {
        rowErrors.push({ line: record.line, column: '__row__', message: `extra columns truncated from ${record.fields.length} to 18` })
      }
      const raw = this.recordFromFields(record.fields.slice(0, CSV_COLUMN_NAMES.length))
      const parsed = record.fields.length >= CSV_COLUMN_NAMES.length ? csvTaskRow18Schema.safeParse(raw) : { success: false as const, error: null }
      if (!parsed.success) {
        if (parsed.error) {
          rowErrors.push(...parsed.error.issues.map(issue => ({
            line: record.line,
            column: issue.path.join('.') || '__row__',
            message: fromZodIssue(issue, { prefix: undefined }).message
          })))
        }
        return { rowIndex, line: record.line, raw, row: null, errors: rowErrors }
      }
      return { rowIndex, line: record.line, raw, row: parsed.data, errors: rowErrors }
    })

    return { header, headerValidation, rows, metadata, errors }
  }

  stringifyTemplate(nowIso = new Date(0).toISOString()): string {
    return buildCsvTemplateRows(nowIso).map(row => row.map(field => this.escapeField(field)).join(',')).join('\n') + '\n'
  }

  stringifyRows(rows: readonly CsvTaskRow18[]): string {
    return [[...CSV_COLUMN_NAMES], ...rows.map(row => CSV_COLUMN_NAMES.map(column => String(row[column] ?? '')))]
      .map(row => row.map(field => this.escapeField(field)).join(','))
      .join('\n') + '\n'
  }

  private parseRecords(text: string): CsvRawRecord[] {
    const records: CsvRawRecord[] = []
    let fields: string[] = []
    let field = ''
    let inQuotes = false
    let line = 1
    let recordLine = 1

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index]
      const next = text[index + 1]
      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }
      if (char === ',' && !inQuotes) {
        fields.push(field)
        field = ''
        continue
      }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        fields.push(field)
        records.push({ line: recordLine, fields })
        field = ''
        fields = []
        if (char === '\r' && next === '\n') index += 1
        line += 1
        recordLine = line
        continue
      }
      if (char === '\n') line += 1
      field += char
    }

    if (inQuotes) throw new Error('E_PARSE:unterminated CSV quote')
    if (field.length > 0 || fields.length > 0) {
      fields.push(field)
      records.push({ line: recordLine, fields })
    }
    return records
  }

  private recordFromFields(fields: readonly string[]): Record<string, string> {
    const record: Record<string, string> = {}
    CSV_COLUMN_NAMES.forEach((column, index) => {
      record[column] = fields[index]?.trim() ?? ''
    })
    return record
  }

  private isIgnorableRecord(record: { fields: string[] }): boolean {
    const first = record.fields[0]?.trim() ?? ''
    return first.length === 0 || first.startsWith('#')
  }

  private escapeField(field: string): string {
    return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
  }

  private normalizePapaRow(row: unknown): string[] {
    if (Array.isArray(row)) return row.map(field => this.normalizePapaField(field))
    if (row === null || row === undefined) return ['']
    if (typeof row === 'object') return Object.values(row).map(field => this.normalizePapaField(field))
    return [this.normalizePapaField(row)]
  }

  private normalizePapaField(field: unknown): string {
    if (field === null || field === undefined) return ''
    return typeof field === 'string' ? field : String(field)
  }

  private countEmbeddedLineBreaks(fields: readonly string[]): number {
    return fields.reduce((count, field) => count + (field.match(/\r\n|\r|\n/g)?.length ?? 0), 0)
  }
}
