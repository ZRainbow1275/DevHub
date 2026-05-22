import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const DEFAULT_DURATION_MINUTES = 30
const DEFAULT_EXPECTED_COMPLETIONS = 6
const DEFAULT_SAMPLE_INTERVAL_MS = 5000
const DEFAULT_ACTIVE_SLEEP_SECONDS = 20
const DEFAULT_MAX_BUDGET_USD = '2.00'

function optionNumber(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(name + '='))
  const value = Number(arg ? arg.slice(name.length + 1) : NaN)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function optionString(name, fallback = '') {
  const arg = process.argv.find((item) => item.startsWith(name + '='))
  return arg ? arg.slice(name.length + 1).trim() : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(filePath)) return
    await sleep(250)
  }
  throw new Error('Timed out waiting for benchmark readiness file: ' + filePath)
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function killProcessTree(pid) {
  if (!pid || process.platform !== 'win32') return
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    // Claude may already have exited after the benchmark window.
  }
}

function shellQuote(value) {
  return '"' + String(value).split(String.fromCharCode(92)).join('/').replace(/"/g, '\\"') + '"'
}

function resolveClaudeCommand() {
  const appData = process.env.APPDATA
  if (!appData) throw new Error('APPDATA is not set; cannot locate claude.exe')
  const claudeExe = join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  if (!existsSync(claudeExe)) throw new Error('Claude executable not found: ' + claudeExe)
  return claudeExe
}

function spawnLogged(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    shell: options.shell ?? false,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const chunks = []
  child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  child.stderr.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  return { child, output: chunks }
}

function waitForExit(child, label) {
  return new Promise((resolvePromise) => {
    child.on('exit', (code, signal) => {
      resolvePromise({ code, label, signal })
    })
    child.on('error', (error) => {
      resolvePromise({ code: 1, error: error.message, label, signal: null })
    })
  })
}

function claudePrompt(label, sleepSeconds, doneToken) {
  const sleepMs = Math.max(0, Math.floor(sleepSeconds * 1000))
  return [
    'You are running DevHub P4.2-b real acceptance workload ' + label + '.',
    'Use the Bash tool to run exactly this command and wait for it to finish:',
    'node -e "setTimeout(() => {}, ' + sleepMs + ')"',
    'After the command returns, reply exactly ' + doneToken + '.',
    'Do not edit files. Do not start subagents.'
  ].join('\n')
}

function spawnClaudeWorkload({ alias, doneToken, label, logPath, maxBudgetUsd, prompt, settingsPath }) {
  const args = [
    '-p',
    '--settings', settingsPath,
    '--permission-mode', 'bypassPermissions',
    '--allowedTools', 'Bash',
    '--max-budget-usd', maxBudgetUsd,
    '--output-format', 'json',
    '--name', label,
    prompt
  ]
  const env = {
    ...process.env,
    DEVHUB_CLAUDE_ORACLE_ALIAS: alias
  }
  const launched = spawnLogged(resolveClaudeCommand(), args, { env })
  waitForExit(launched.child, label).then((result) => {
    const output = Buffer.concat(launched.output).toString('utf8')
    writeFileSync(logPath, JSON.stringify({ ...result, alias, doneToken, output }, null, 2), 'utf8')
  })
  return launched.child
}

async function runActiveLoop(options) {
  const started = []
  const durationMs = options.durationMinutes * 60_000
  const latestStartOffset = Math.max(10_000, durationMs - 60_000)
  const intervalMs = options.expectedCompletions <= 1
    ? 0
    : Math.floor(latestStartOffset / options.expectedCompletions)
  const loopStartedAt = Date.now()

  for (let index = 1; index <= options.expectedCompletions; index++) {
    const targetOffset = Math.max(5_000, (index - 1) * intervalMs + 5_000)
    const waitMs = loopStartedAt + targetOffset - Date.now()
    if (waitMs > 0) await sleep(waitMs)

    const label = 'p4-active-' + index
    const doneToken = 'P4_ACTIVE_' + index + '_DONE'
    const child = spawnClaudeWorkload({
      alias: 'p4-active',
      doneToken,
      label,
      logPath: join(options.reportDir, label + '.json'),
      maxBudgetUsd: options.maxBudgetUsd,
      prompt: claudePrompt(label, options.activeSleepSeconds, doneToken),
      settingsPath: options.settingsPath
    })
    started.push({ label, pid: child.pid })
  }

  return started
}

async function main() {
  const durationMinutes = optionNumber('--duration-minutes', DEFAULT_DURATION_MINUTES)
  const expectedCompletions = optionNumber('--expected-completions', DEFAULT_EXPECTED_COMPLETIONS)
  const sampleIntervalMs = optionNumber('--sample-interval-ms', DEFAULT_SAMPLE_INTERVAL_MS)
  const activeSleepSeconds = optionNumber('--active-sleep-seconds', DEFAULT_ACTIVE_SLEEP_SECONDS)
  const idleSleepSeconds = optionNumber('--idle-sleep-seconds', Math.ceil(durationMinutes * 60 + 300))
  const maxBudgetUsd = optionString('--max-budget-usd', DEFAULT_MAX_BUDGET_USD)
  const allowShort = hasFlag('--allow-short')

  if (!existsSync('out/main/index.js')) {
    throw new Error('Missing out/main/index.js. Run pnpm build before P4.2-b acceptance.')
  }

  const reportDir = join('perf-reports', 'p4-acceptance-' + timestampForFile())
  mkdirSync(reportDir, { recursive: true })
  const eventsPath = join(reportDir, 'claude-completion-events.jsonl')
  const settingsPath = join(reportDir, 'claude-hooks.settings.json')
  const readyPath = join(reportDir, 'bench-ready.json')
  writeFileSync(eventsPath, '', 'utf8')

  const hookCommand = [
    'node',
    shellQuote('scripts/claude-completion-oracle.mjs'),
    '--out=' + shellQuote(eventsPath)
  ].join(' ')
  const hook = { type: 'command', command: hookCommand }
  writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      Stop: [{ hooks: [hook] }],
      SubagentStop: [{ hooks: [hook] }],
      TaskCompleted: [{ hooks: [hook] }]
    }
  }, null, 2), 'utf8')

  const idleLabel = 'p4-idle'
  const idleChild = spawnClaudeWorkload({
    alias: 'p4-idle',
    doneToken: 'P4_IDLE_DONE',
    label: idleLabel,
    logPath: join(reportDir, idleLabel + '.json'),
    maxBudgetUsd,
    prompt: claudePrompt(idleLabel, idleSleepSeconds, 'P4_IDLE_DONE'),
    settingsPath
  })

  await sleep(5000)

  const benchArgs = [
    './scripts/bench-p4-ai-accuracy.mjs',
    '--duration-minutes=' + durationMinutes,
    '--sample-interval-ms=' + sampleIntervalMs,
    '--expected-completions=' + expectedCompletions,
    '--active-alias=p4-active',
    '--idle-alias=p4-idle',
    '--completion-events=' + eventsPath,
    '--ready-file=' + readyPath
  ]
  if (allowShort) benchArgs.push('--allow-short')
  const bench = spawnLogged(process.execPath, benchArgs, { env: process.env })
  await waitForFile(readyPath, 60000)
  const activeLoop = runActiveLoop({
    activeSleepSeconds,
    durationMinutes,
    expectedCompletions,
    maxBudgetUsd,
    reportDir,
    settingsPath
  })
  const benchResult = await waitForExit(bench.child, 'bench-p4-ai-accuracy')
  const activeStarted = await activeLoop

  killProcessTree(idleChild.pid)

  const benchOutput = Buffer.concat(bench.output).toString('utf8')
  const summary = {
    activeStarted,
    activeSleepSeconds,
    allowShort,
    benchResult,
    durationMinutes,
    eventsPath,
    expectedCompletions,
    idlePid: idleChild.pid,
    idleSleepSeconds,
    readyPath,
    reportDir,
    sampleIntervalMs,
    settingsPath
  }
  writeFileSync(join(reportDir, 'acceptance-run-summary.json'), JSON.stringify({ ...summary, benchOutput }, null, 2), 'utf8')
  console.log(JSON.stringify(summary, null, 2))

  if (benchResult.code !== 0) process.exitCode = benchResult.code ?? 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
