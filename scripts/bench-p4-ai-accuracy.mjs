import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'

const APP_MAIN = 'out/main/index.js'
const DEFAULT_DURATION_MINUTES = 30
const DEFAULT_SAMPLE_INTERVAL_MS = 5000
const DEFAULT_EXPECTED_COMPLETIONS = 6
const MAX_FALSE_POSITIVES = 1
const MAX_DELAY_MS = 5000

function optionNumber(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`))
  const envName = name.replace(/^--/, 'DEVHUB_').replace(/-/g, '_').toUpperCase()
  const raw = arg ? arg.slice(name.length + 1) : process.env[envName]
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function optionString(name, fallback = '') {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`))
  const envName = name.replace(/^--/, 'DEVHUB_').replace(/-/g, '_').toUpperCase()
  const raw = arg ? arg.slice(name.length + 1) : process.env[envName]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const ORACLE_SOURCES = new Set(['claude-code-hook', 'bench', 'runtime'])

function textOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrUndefined(value) {
  const text = textOrEmpty(value)
  return text.length > 0 ? text : undefined
}

function normalizeCompletionEvent(item, index) {
  const completedAt = parseTimestamp(item.completedAt ?? item.ts ?? item.timestamp)
  if (completedAt == null) {
    throw new Error(`completion event ${index} is missing completedAt/ts/timestamp`)
  }

  const source = ORACLE_SOURCES.has(item.source) ? item.source : 'claude-code-hook'
  const hookEventName = textOrEmpty(item.hookEventName ?? item.hook_event_name ?? item.eventName ?? item.event) || 'Stop'
  const alias = textOrEmpty(item.alias ?? item.taskAlias ?? item.taskSubject ?? item.taskKey ?? item.sessionId)

  return {
    alias,
    completedAt,
    cwd: textOrUndefined(item.cwd),
    hookEventName,
    raw: item,
    sessionId: textOrUndefined(item.sessionId ?? item.session_id),
    source,
    taskKey: textOrUndefined(item.taskKey ?? item.task_id ?? item.taskId),
    transcriptPath: textOrUndefined(item.transcriptPath ?? item.transcript_path)
  }
}

function parseCompletionJsonLines(text, filePath) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const parsed = []
  for (const [index, line] of lines.entries()) {
    try {
      parsed.push(JSON.parse(line))
    } catch (error) {
      if (index === lines.length - 1) break
      throw new Error(`Failed to parse completion event line ${index + 1} from ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return parsed
}

function readCompletionEvents(filePath) {
  if (!filePath) return []
  const absolutePath = resolve(filePath)
  if (!existsSync(absolutePath)) return []
  const text = readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '').trim()
  if (!text) return []

  const parsed = text.startsWith('[')
    ? JSON.parse(text)
    : parseCompletionJsonLines(text, absolutePath)

  const items = Array.isArray(parsed) ? parsed : [parsed]
  return items.map((item, index) => normalizeCompletionEvent(item, index))
}

async function waitForMainWindow(electronApp) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const page = electronApp.windows().find((candidate) => candidate.url().includes('/out/renderer/index.html'))
    if (page) {
      await page.waitForLoadState('domcontentloaded')
      return page
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Timed out while waiting for DevHub main window')
}

async function prepareMonitor(window) {
  const skip = window.locator('button').filter({ hasText: '璺宠繃' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await window.locator('button').filter({ hasText: '鐩戞帶' }).first().click({ timeout: 15000 }).catch(() => {})
  await window.evaluate(async () => {
    window.devhub?.scanner?.subscribe?.()
    await window.devhub?.scanner?.getSnapshot?.().catch(() => null)
    await window.devhub?.aiTask?.scan?.().catch(() => [])
  })
}

async function readAiTaskSnapshot(window) {
  return window.evaluate(async () => {
    await window.devhub?.systemProcess?.scan?.().catch(() => null)
    const scanned = await window.devhub?.aiTask?.scan?.().catch(() => []) ?? []
    const active = await window.devhub?.aiTask?.getActive?.().catch(() => []) ?? []
    const history = await window.devhub?.aiTask?.getHistory?.(250).catch(() => []) ?? []
    const activeById = new Map()
    for (const task of [...active, ...scanned]) {
      if (task?.id) activeById.set(task.id, task)
    }
    const mergedActive = Array.from(activeById.values())
    const reportKeys = new Set()
    for (const task of mergedActive) {
      if (task?.id) reportKeys.add(task.id)
    }
    for (const entry of history.slice(-250)) {
      if (entry?.id) reportKeys.add(entry.id)
    }
    const reports = []
    for (const taskKey of reportKeys) {
      const report = await window.devhub?.aiTask?.getConfidenceReport?.(taskKey).catch(() => null)
      if (report) reports.push(report)
    }
    return { active: mergedActive, history, reports }
  })
}

function displayName(taskOrHistory) {
  return taskOrHistory?.alias ?? taskOrHistory?.taskAlias ?? taskOrHistory?.id ?? ''
}

function matchesAlias(item, alias) {
  if (!alias) return false
  return normalizeText(displayName(item)).includes(normalizeText(alias))
}

function selectClaudePair(tasks, activeAlias, idleAlias) {
  const claudeTasks = tasks.filter((task) => task.toolType === 'claude-code')
  const active = activeAlias
    ? claudeTasks.find((task) => matchesAlias(task, activeAlias))
    : claudeTasks[0]
  const idle = idleAlias
    ? claudeTasks.find((task) => matchesAlias(task, idleAlias))
    : claudeTasks.find((task) => task.id !== active?.id)
  return { active, idle, claudeTasks }
}

function newHistory(history, startedAt) {
  return history.filter((entry) => Number(entry.endTime ?? 0) >= startedAt && entry.toolType === 'claude-code')
}

function matchEventsToHistory(events, history, aliasFallback) {
  const unusedHistory = history
    .filter((entry) => entry.status === 'completed')
    .sort((a, b) => Number(a.endTime ?? 0) - Number(b.endTime ?? 0))

  return events.map((event) => {
    const requiredAlias = normalizeText(event.alias || aliasFallback)
    const matchIndex = unusedHistory.findIndex((entry) => {
      if (requiredAlias && !normalizeText(displayName(entry)).includes(requiredAlias)) return false
      const endTime = Number(entry.endTime ?? 0)
      return Number.isFinite(endTime) && endTime >= event.completedAt - MAX_DELAY_MS
    })
    const historyEntry = matchIndex >= 0 ? unusedHistory.splice(matchIndex, 1)[0] : null
    const rawDelayMs = historyEntry ? Number(historyEntry.endTime ?? 0) - event.completedAt : null
    return {
      event,
      historyEntry,
      delayMs: typeof rawDelayMs === 'number' && Number.isFinite(rawDelayMs) ? Math.max(0, rawDelayMs) : null
    }
  })
}

function completionEventKey(event) {
  return event.sessionId
    ? `${event.alias}:${event.sessionId}`
    : event.taskKey
      ? `${event.alias}:${event.taskKey}`
      : `${event.alias}:${event.completedAt}:${event.hookEventName}`
}

function completionEventWithinBounds(event, startedAt, finishedAt = Date.now()) {
  if (!startedAt) return true
  const upperBound = finishedAt + MAX_DELAY_MS
  return event.completedAt >= startedAt - MAX_DELAY_MS && event.completedAt <= upperBound
}

function toOraclePayload(event) {
  return {
    alias: event.alias,
    completedAt: event.completedAt,
    cwd: event.cwd,
    hookEventName: event.hookEventName,
    sessionId: event.sessionId,
    source: event.source,
    taskKey: event.taskKey,
    transcriptPath: event.transcriptPath
  }
}

async function flushCompletionOracleEvents(window, filePath, seenKeys, startedAt, finishedAt = Date.now()) {
  const events = readCompletionEvents(filePath).filter((event) => completionEventWithinBounds(event, startedAt, finishedAt))
  const freshEvents = []
  for (const event of events) {
    const key = completionEventKey(event)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    freshEvents.push(toOraclePayload(event))
  }
  if (freshEvents.length === 0) return { errors: [], records: [] }

  return window.evaluate(async (eventsToRecord) => {
    if (!window.devhub?.aiTask?.recordCompletionOracle) {
      throw new Error('window.devhub.aiTask.recordCompletionOracle is unavailable')
    }

    const result = { errors: [], records: [] }
    for (const event of eventsToRecord) {
      try {
        const record = await window.devhub.aiTask.recordCompletionOracle(event)
        if (record) result.records.push(record)
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error))
      }
    }
    return result
  }, freshEvents)
}

function check(pass, message, details = {}) {
  return { details, message, pass: Boolean(pass) }
}

async function main() {
  const durationMinutes = optionNumber('--duration-minutes', DEFAULT_DURATION_MINUTES)
  const sampleIntervalMs = optionNumber('--sample-interval-ms', DEFAULT_SAMPLE_INTERVAL_MS)
  const expectedCompletions = optionNumber('--expected-completions', DEFAULT_EXPECTED_COMPLETIONS)
  const activeAlias = optionString('--active-alias')
  const idleAlias = optionString('--idle-alias')
  const completionEventsPath = optionString('--completion-events')
  const readyFile = optionString('--ready-file')
  const allowShort = hasFlag('--allow-short') || process.env.DEVHUB_P4_ALLOW_SHORT === '1'
  const durationMs = durationMinutes * 60000
  let runStartedAt = 0
  let runFinishedAt = 0
  let completionEvents = []
  const samples = []
  const seenCompletionEventKeys = new Set()
  const oracleIngestionErrors = []

  if (!existsSync(APP_MAIN)) throw new Error(`Missing ${APP_MAIN}. Run pnpm build first.`)

  const electronApp = await electron.launch({
    args: [APP_MAIN, '--enable-dev-obs'],
    env: { ...process.env, ENABLE_DEV_OBS: '1' }
  })

  let selectedActive = null
  let selectedIdle = null

  try {
    const window = await waitForMainWindow(electronApp)
    await prepareMonitor(window)
    runStartedAt = Date.now()
    if (readyFile) {
      const readyPath = resolve(readyFile)
      mkdirSync(dirname(readyPath), { recursive: true })
      writeFileSync(readyPath, JSON.stringify({ pid: process.pid, runStartedAt }, null, 2), 'utf8')
    }

    while (Date.now() - runStartedAt < durationMs) {
      const oracleFlush = await flushCompletionOracleEvents(window, completionEventsPath, seenCompletionEventKeys, runStartedAt)
      oracleIngestionErrors.push(...oracleFlush.errors)
      const snapshot = await readAiTaskSnapshot(window)
      const selected = selectClaudePair(snapshot.active, activeAlias, idleAlias)
      selectedActive = selected.active ?? selectedActive
      selectedIdle = selected.idle ?? selectedIdle

      samples.push({
        elapsedMs: Date.now() - runStartedAt,
        activeCount: snapshot.active.length,
        claudeCount: selected.claudeTasks.length,
        selectedActive: selectedActive ? { id: selectedActive.id, alias: selectedActive.alias, state: selectedActive.status?.state } : null,
        selectedIdle: selectedIdle ? { id: selectedIdle.id, alias: selectedIdle.alias, state: selectedIdle.status?.state } : null,
        confidenceReports: snapshot.reports,
        history: newHistory(snapshot.history, runStartedAt),
        oracleRecords: oracleFlush.records.length,
        ts: Date.now()
      })

      await new Promise((resolve) => setTimeout(resolve, sampleIntervalMs))
    }

    const finalOracleFlush = await flushCompletionOracleEvents(window, completionEventsPath, seenCompletionEventKeys, runStartedAt, Date.now())
    oracleIngestionErrors.push(...finalOracleFlush.errors)
    const finalSnapshot = await readAiTaskSnapshot(window)
    const finalSelected = selectClaudePair(finalSnapshot.active, activeAlias, idleAlias)
    selectedActive = finalSelected.active ?? selectedActive
    selectedIdle = finalSelected.idle ?? selectedIdle
    samples.push({
      elapsedMs: Date.now() - runStartedAt,
      activeCount: finalSnapshot.active.length,
      claudeCount: finalSelected.claudeTasks.length,
      confidenceReports: finalSnapshot.reports,
      final: true,
      history: newHistory(finalSnapshot.history, runStartedAt),
      oracleRecords: finalOracleFlush.records.length,
      selectedActive: selectedActive ? { id: selectedActive.id, alias: selectedActive.alias, state: selectedActive.status?.state } : null,
      selectedIdle: selectedIdle ? { id: selectedIdle.id, alias: selectedIdle.alias, state: selectedIdle.status?.state } : null,
      ts: Date.now()
    })
  } finally {
    runFinishedAt = Date.now()
    await electronApp.close().catch(() => {})
  }

  completionEvents = readCompletionEvents(completionEventsPath).filter((event) => (
    completionEventWithinBounds(event, runStartedAt, runFinishedAt || Date.now())
  ))

  const observedHistory = newHistory(samples.at(-1)?.history ?? [], runStartedAt || Date.now())
  const activeCompletions = observedHistory.filter((entry) => {
    if (entry.status !== 'completed') return false
    if (activeAlias) return matchesAlias(entry, activeAlias)
    return true
  })
  const idleCompletions = observedHistory.filter((entry) => {
    if (entry.status !== 'completed') return false
    if (idleAlias) return matchesAlias(entry, idleAlias)
    return selectedIdle ? displayName(entry) === displayName(selectedIdle) || entry.id === selectedIdle.id : false
  })
  const eventMatches = matchEventsToHistory(completionEvents, observedHistory, activeAlias)
  const missedEvents = eventMatches.filter((match) => !match.historyEntry)
  const delaySamples = eventMatches
    .map((match) => match.delayMs)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  const maxDelayMs = delaySamples.length > 0 ? Math.max(...delaySamples) : null
  const activeReports = samples.flatMap((sample) => sample.confidenceReports ?? []).filter((report) => {
    if (activeAlias) return normalizeText(report.taskKey).includes(normalizeText(activeAlias)) || normalizeText(report.taskId).includes(normalizeText(activeAlias))
    return selectedActive ? report.taskKey === selectedActive.id || report.taskId === selectedActive.id : true
  })
  const strongReportCount = activeReports.filter((report) => {
    const signalCount = report.signalContributions?.filter((item) => Number(item.weightedContribution ?? 0) > 0).length ?? report.activeIndicators?.length ?? 0
    return Number(report.completionScore ?? 0) >= 0.75 && signalCount >= 3
  }).length
  const acceptanceEligible = durationMinutes >= 30 && expectedCompletions >= 6 && completionEvents.length >= expectedCompletions

  const checks = [
    check(acceptanceEligible || allowShort, '30 minute acceptance window and completion events are present, or allow-short is explicit', {
      acceptanceEligible,
      completionEvents: completionEvents.length,
      durationMinutes,
      expectedCompletions
    }),
    check(samples.some((sample) => sample.claudeCount >= 2), 'two real Claude Code instances were observed by DevHub', {
      maxClaudeCount: Math.max(0, ...samples.map((sample) => sample.claudeCount))
    }),
    check(activeCompletions.length >= expectedCompletions, 'active Claude instance produced all expected completion notifications', {
      activeCompletions: activeCompletions.length,
      expectedCompletions
    }),
    check(idleCompletions.length <= MAX_FALSE_POSITIVES, 'idle Claude instance did not produce false completion notifications', {
      falsePositives: idleCompletions.length,
      limit: MAX_FALSE_POSITIVES
    }),
    check(oracleIngestionErrors.length === 0, 'completion oracle events were ingested through DevHub IPC without errors', {
      errors: oracleIngestionErrors.slice(0, 5),
      errorCount: oracleIngestionErrors.length
    }),
    check(completionEvents.length > 0 && missedEvents.length === 0, 'all external real completion events were matched by DevHub history', {
      completionEvents: completionEvents.length,
      missedEvents: missedEvents.length
    }),
    check(maxDelayMs !== null && maxDelayMs < MAX_DELAY_MS, 'completion notification delay stayed below 5000ms', {
      maxDelayMs,
      limit: MAX_DELAY_MS
    }),
    check(strongReportCount > 0, 'active ConfidenceReport reached score >= 0.75 with at least three real signals', {
      strongReportCount
    })
  ]

  const passed = checks.every((item) => item.pass)
  const report = {
    acceptanceEligible,
    activeAlias,
    checks,
    completionEventsPath: completionEventsPath || null,
    durationMinutes,
    expectedCompletions,
    idleAlias,
    label: 'BENCH-P4.2-b',
    oracleIngestionErrors,
    runFinishedAt,
    runStartedAt,
    passed,
    sampleIntervalMs,
    samples,
    summary: {
      activeCompletions: activeCompletions.length,
      falsePositives: idleCompletions.length,
      maxDelayMs,
      missedEvents: missedEvents.length,
      oracleIngestionErrors: oracleIngestionErrors.length,
      sampleCount: samples.length,
      strongReportCount
    }
  }

  const reportDir = join(process.cwd(), 'perf-reports')
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, `bench-p4-ai-accuracy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify({ ...report, reportPath, samples: `[${samples.length} samples omitted from console]` }, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
