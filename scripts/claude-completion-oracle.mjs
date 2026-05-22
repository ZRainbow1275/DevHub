import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const DEFAULT_EVENTS_PATH = '.devhub/claude-completion-events.jsonl'
const SUPPORTED_EVENTS = new Set(['Stop', 'SubagentStop', 'TaskCompleted'])

function optionValue(name, fallback = '') {
  const prefix = '--' + name + '='
  const arg = process.argv.find((item) => item.startsWith(prefix))
  if (arg) return arg.slice(prefix.length).trim()
  const envName = 'DEVHUB_CLAUDE_' + name.replace(/-/g, '_').toUpperCase()
  const value = process.env[envName]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function hasFlag(name) {
  return process.argv.includes('--' + name)
}

function shellQuote(value) {
  const backslash = String.fromCharCode(92)
  return '"' + String(value).replaceAll(backslash, '/').replace(/"/g, '\\"') + '"'
}

function printSettingsSnippet() {
  const scriptFile = resolve(process.argv[1])
  const command = [
    shellQuote(process.execPath),
    shellQuote(scriptFile),
    '--out=' + DEFAULT_EVENTS_PATH
  ].join(' ')
  const commandHook = { type: 'command', command }
  const snippet = {
    hooks: {
      Stop: [{ hooks: [commandHook] }],
      SubagentStop: [{ hooks: [commandHook] }],
      TaskCompleted: [{ hooks: [commandHook] }]
    }
  }
  console.log(JSON.stringify(snippet, null, 2))
}

function readHookInput() {
  const text = readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim()
  if (!text) throw new Error('Claude hook stdin was empty')
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Claude hook stdin must be a JSON object')
  }
  return parsed
}

function textOrNull(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function deriveAlias(input) {
  const configured = optionValue('alias') || process.env.DEVHUB_CLAUDE_ORACLE_ALIAS
  if (typeof configured === 'string' && configured.trim().length > 0) return configured.trim()

  const taskSubject = textOrNull(input.task_subject)
  if (taskSubject) return taskSubject

  const teammate = textOrNull(input.teammate_name)
  const team = textOrNull(input.team_name)
  if (teammate && team) return team + ':' + teammate
  if (teammate) return teammate

  const cwd = textOrNull(input.cwd)
  if (cwd) {
    const backslash = String.fromCharCode(92)
    return cwd.replaceAll(backslash, '/').split('/').filter(Boolean).at(-1) ?? cwd
  }

  return textOrNull(input.session_id) ?? String(input.hook_event_name ?? 'claude-code')
}

function normalizeCompletionEvent(input) {
  const hookEventName = String(input.hook_event_name ?? '')
  if (!SUPPORTED_EVENTS.has(hookEventName)) {
    throw new Error('Unsupported Claude completion hook event: ' + (hookEventName || '<missing>'))
  }

  const completedAt = Date.now()
  const alias = deriveAlias(input)
  const lastAssistantMessage = textOrNull(input.last_assistant_message)

  return {
    alias,
    completedAt,
    hookEventName,
    source: 'claude-code-hook',
    taskAlias: alias,
    taskKey: textOrNull(input.task_id) ?? textOrNull(input.session_id) ?? alias,
    timestamp: new Date(completedAt).toISOString(),
    agentId: textOrNull(input.agent_id),
    agentType: textOrNull(input.agent_type),
    cwd: textOrNull(input.cwd),
    permissionMode: textOrNull(input.permission_mode),
    sessionId: textOrNull(input.session_id),
    taskDescription: textOrNull(input.task_description),
    taskId: textOrNull(input.task_id),
    taskSubject: textOrNull(input.task_subject),
    teamName: textOrNull(input.team_name),
    teammateName: textOrNull(input.teammate_name),
    transcriptPath: textOrNull(input.transcript_path),
    hasLastAssistantMessage: Boolean(lastAssistantMessage),
    lastAssistantMessageLength: lastAssistantMessage?.length ?? 0
  }
}

function appendJsonLine(filePath, event) {
  const absolutePath = resolve(filePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  appendFileSync(absolutePath, JSON.stringify(event) + '\n', 'utf8')
  return absolutePath
}

function main() {
  if (hasFlag('print-settings-snippet')) {
    printSettingsSnippet()
    return
  }

  const input = readHookInput()
  const event = normalizeCompletionEvent(input)
  const outPath = optionValue('out', process.env.DEVHUB_COMPLETION_EVENTS || DEFAULT_EVENTS_PATH)

  if (hasFlag('dry-run')) {
    console.log(JSON.stringify(event, null, 2))
    return
  }

  appendJsonLine(outPath, event)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
