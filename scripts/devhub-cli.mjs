#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'

function usage() {
  console.error('Usage: devhub run-csv <file> [--runner devhub|python|cli] [--concurrent N] [--resume] [--dry-run]')
}

function parseArgs(argv) {
  const [, , command, csvPath, ...rest] = argv
  if (command !== 'run-csv' || !csvPath) {
    usage()
    process.exitCode = 2
    return null
  }
  const options = { command, csvPath: resolve(csvPath), runner: 'devhub', concurrent: 3, resume: false, dryRun: false }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (token === '--runner') options.runner = rest[++index] ?? options.runner
    else if (token === '--concurrent') options.concurrent = Number(rest[++index] ?? options.concurrent)
    else if (token === '--resume') options.resume = true
    else if (token === '--dry-run') options.dryRun = true
    else {
      console.error(`Unknown option: ${token}`)
      process.exitCode = 2
      return null
    }
  }
  return options
}

function countRows(csvPath) {
  return new Promise((resolveCount, reject) => {
    let rows = 0
    const parser = Papa.parse(Papa.NODE_STREAM_INPUT, { header: false, comments: '#', skipEmptyLines: 'greedy' })
    parser.on('data', () => { rows += 1 })
    parser.once('error', reject)
    parser.once('finish', () => resolveCount(Math.max(rows - 1, 0)))
    createReadStream(csvPath).once('error', reject).pipe(parser)
  })
}

const options = parseArgs(process.argv)
if (options) {
  if (!existsSync(options.csvPath)) {
    console.error(`CSV file not found: ${options.csvPath}`)
    process.exitCode = 1
  } else {
    const rowCount = await countRows(options.csvPath)
    console.log(JSON.stringify({
      ok: true,
      command: options.command,
      csvPath: options.csvPath,
      runner: options.runner,
      concurrent: options.concurrent,
      resume: options.resume,
      dryRun: options.dryRun,
      rowCount,
      note: 'CLI entry validated the CSV path and parsed rows locally; execution is coordinated by DevHub runtime.'
    }))
  }
}
