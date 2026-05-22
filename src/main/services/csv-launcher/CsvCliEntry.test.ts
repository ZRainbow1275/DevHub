import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CSV_COLUMN_NAMES, type CsvColumnName } from '@shared/schemas/csv-task-row'

type RowValues = Record<CsvColumnName, string>

function row(): RowValues {
  return {
    taskId: 'cli-001',
    taskName: 'CLI check',
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{"prompt":"run"}',
    outputDir: 'out',
    outputFormat: 'md',
    tags: 'cli',
    dependsOn: '',
    timeoutMs: '60000',
    retries: '0',
    concurrencyKey: 'cli',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: 'real cli'
  }
}

function csvDocument(rows: RowValues[]): string {
  return [
    '# devhub-csv-version=1.0; runner=cli; concurrentMax=3',
    CSV_COLUMN_NAMES.join(','),
    ...rows.map(values => CSV_COLUMN_NAMES.map(column => values[column]).join(','))
  ].join('\n') + '\n'
}

function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveRun, reject) => {
    execFile(process.execPath, [resolve(process.cwd(), 'scripts', 'devhub-cli.mjs'), ...args], { timeout: 5_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolveRun({ stdout, stderr })
    })
  })
}

describe('devhub run-csv CLI entry', () => {
  it('validates a real CSV path and reports parsed row count without spawning tool processes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-cli-'))
    const csvPath = join(root, 'tasks.csv')
    await mkdir(root, { recursive: true })
    await writeFile(csvPath, csvDocument([row()]), 'utf8')

    try {
      const result = await runCli(['run-csv', csvPath, '--runner', 'cli', '--concurrent', '3', '--dry-run'])
      const payload = JSON.parse(result.stdout) as { ok: boolean; rowCount: number; runner: string; dryRun: boolean }

      expect(result.stderr).toBe('')
      expect(payload).toMatchObject({ ok: true, rowCount: 1, runner: 'cli', dryRun: true })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
