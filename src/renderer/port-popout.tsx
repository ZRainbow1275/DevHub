type BridgeStatus = 'connecting' | 'connected' | 'closed' | 'error'

interface TargetParts {
  pid: string | null
  port: string
}

interface PopoutViewState {
  bridgeStatus: BridgeStatus
  error: string | null
  heartbeatAt: number | null
  pinned: boolean
  screenNotice: string | null
  title: string
  windowId: string
}

interface ThemeSyncPayload {
  palette?: string
  density?: string
  radius?: string
  motion?: string
  decoration?: string
}

const params = new URLSearchParams(window.location.search)
const windowId = params.get('r8Popout')?.trim() ?? ''
const target = params.get('target')?.trim() ?? 'unknown'
const targetParts = parseTarget(target)
const rootElement = getRootElement()

const state: PopoutViewState = {
  bridgeStatus: windowId ? 'connecting' : 'error',
  error: windowId ? null : 'Missing r8Popout query parameter',
  heartbeatAt: null,
  pinned: false,
  screenNotice: null,
  title: `Port ${targetParts.port}`,
  windowId
}

installStyles()
render(rootElement, state)
removeSplash()
void hydrate()
startHeartbeat()
subscribeBridge()

function getRootElement(): HTMLElement {
  const element = document.getElementById('root')
  if (!element) throw new Error('port-popout root element is missing')
  return element
}

function parseTarget(value: string): TargetParts {
  const structured = value.match(/^port:(\d+):pid:(\d+)$/)
  if (structured) return { port: structured[1], pid: structured[2] }
  const numeric = value.match(/^\d+$/)
  if (numeric) return { port: numeric[0], pid: null }
  return { port: value, pid: null }
}

function removeSplash(): void {
  document.getElementById('pre-react-splash')?.remove()
}

function formatTime(ts: number | null): string {
  if (ts === null) return 'pending'
  return new Date(ts).toLocaleTimeString()
}

function getPopoutApi() {
  return window.devhub?.r8?.popout ?? null
}

async function hydrate(): Promise<void> {
  const api = getPopoutApi()
  if (!api || !state.windowId) return
  try {
    const popouts = await api.list()
    const current = popouts.find(popout => popout.windowId === state.windowId)
    if (current) {
      state.title = current.title
      state.pinned = current.pinned
      state.bridgeStatus = current.bridgeState === 'closed' ? 'closed' : 'connected'
    }
    render(rootElement, state)
  } catch (error) {
    state.bridgeStatus = 'error'
    state.error = stringifyError(error)
    render(rootElement, state)
  }
}

function startHeartbeat(): void {
  const sendHeartbeat = async (): Promise<void> => {
    const api = getPopoutApi()
    if (!api || !state.windowId || state.bridgeStatus === 'closed') return
    const at = Date.now()
    try {
      await api.bridgeMessage({ windowId: state.windowId, type: 'heartbeat', at })
      state.bridgeStatus = 'connected'
      state.heartbeatAt = at
      state.error = null
      render(rootElement, state)
    } catch (error) {
      state.bridgeStatus = 'error'
      state.error = stringifyError(error)
      render(rootElement, state)
      window.clearInterval(timer)
    }
  }

  const timer = window.setInterval(() => {
    void sendHeartbeat()
  }, 5_000)
  void sendHeartbeat()
}

function subscribeBridge(): void {
  const api = getPopoutApi()
  if (!api) return
  api.onBridgeMessage?.((message) => {
    if (message.type === 'sync' && message.key === 'theme-settings') {
      applyThemeSync(message.value)
    }
  })
  api.onScreenEvent?.((event) => {
    if (!event.affectedPopouts.includes(state.windowId)) return
    state.screenNotice = event.reflowAction === 'migrate-to-primary'
      ? 'Display changed; this popout was migrated to the primary work area.'
      : `Display event: ${event.type}`
    render(rootElement, state)
  })
}

function applyThemeSync(value: unknown): void {
  if (!isThemeSyncPayload(value)) return
  if (value.palette) document.documentElement.dataset.theme = value.palette
  if (value.density) document.documentElement.dataset.density = value.density
  if (value.radius) document.documentElement.dataset.radius = value.radius
  if (value.motion) document.documentElement.dataset.motion = value.motion
  if (value.decoration) document.documentElement.dataset.decoration = value.decoration
}

function isThemeSyncPayload(value: unknown): value is ThemeSyncPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return ['palette', 'density', 'radius', 'motion', 'decoration'].every(key => (
    record[key] === undefined || typeof record[key] === 'string'
  ))
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function render(container: HTMLElement, viewState: PopoutViewState): void {
  container.replaceChildren(buildShell(viewState))
}

function buildShell(viewState: PopoutViewState): HTMLElement {
  const shell = document.createElement('main')
  shell.className = 'port-popout-shell'
  shell.dataset.testid = 'port-popout-shell'

  const header = document.createElement('header')
  header.className = 'port-popout-header'
  const eyebrow = document.createElement('div')
  eyebrow.className = 'port-popout-eyebrow'
  eyebrow.textContent = 'DevHub Port BrowserWindow'
  const title = document.createElement('h1')
  title.textContent = viewState.title
  header.append(eyebrow, title)

  const status = document.createElement('section')
  status.className = 'port-popout-status'
  status.append(
    buildMetric('Port', targetParts.port, 'port-popout-port'),
    buildMetric('PID', targetParts.pid ?? 'unresolved', 'port-popout-pid'),
    buildMetric('Bridge', viewState.bridgeStatus, 'port-popout-bridge'),
    buildMetric('Heartbeat', formatTime(viewState.heartbeatAt), 'port-popout-heartbeat')
  )

  const controls = document.createElement('section')
  controls.className = 'port-popout-controls'
  controls.append(
    buildButton(viewState.pinned ? 'Unpin' : 'Pin', 'port-popout-pin-action', () => {
      void setPinned(!viewState.pinned)
    }),
    buildButton('Return To Main', 'port-popout-demote-action', () => {
      void demote()
    }),
    buildButton('Close', 'port-popout-close-action', () => {
      void closePopout()
    })
  )

  const detail = document.createElement('p')
  detail.className = 'port-popout-detail'
  detail.textContent = 'This window uses the dedicated port-popout preload and renderer entry. It keeps the real IPC heartbeat, pin, close, demote, screen-event, and theme bridge without loading the full main application bundle.'

  shell.append(header, status, controls, detail)
  if (viewState.screenNotice) shell.append(buildNotice(viewState.screenNotice, 'info'))
  if (viewState.error) shell.append(buildNotice(viewState.error, 'error'))
  return shell
}

function buildMetric(label: string, value: string, testId: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'port-popout-metric'
  item.dataset.testid = testId
  const labelElement = document.createElement('span')
  labelElement.textContent = label
  const valueElement = document.createElement('strong')
  valueElement.textContent = value
  item.append(labelElement, valueElement)
  return item
}

function buildButton(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'port-popout-button'
  button.dataset.testid = testId
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function buildNotice(message: string, variant: 'error' | 'info'): HTMLElement {
  const notice = document.createElement('p')
  notice.className = `port-popout-notice port-popout-notice-${variant}`
  notice.textContent = message
  return notice
}

async function setPinned(pinned: boolean): Promise<void> {
  const api = getPopoutApi()
  if (!api || !state.windowId) return
  try {
    const result = await api.pin(state.windowId, pinned)
    state.pinned = result?.pinned ?? pinned
    state.error = null
  } catch (error) {
    state.error = stringifyError(error)
  }
  render(rootElement, state)
}

async function demote(): Promise<void> {
  const api = getPopoutApi()
  if (!api || !state.windowId) return
  try {
    await api.demote(state.windowId)
    state.bridgeStatus = 'closed'
    window.close()
  } catch (error) {
    state.error = stringifyError(error)
    render(rootElement, state)
  }
}

async function closePopout(): Promise<void> {
  const api = getPopoutApi()
  if (!api || !state.windowId) return
  try {
    await api.close(state.windowId)
    state.bridgeStatus = 'closed'
    window.close()
  } catch (error) {
    state.error = stringifyError(error)
    render(rootElement, state)
  }
}

function installStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    :root {
      color-scheme: dark;
      background: #161413;
      font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    }
    body {
      margin: 0;
      min-width: 280px;
      min-height: 200px;
      background:
        linear-gradient(135deg, rgba(214, 69, 69, 0.08), transparent 34%),
        linear-gradient(315deg, rgba(201, 162, 39, 0.10), transparent 38%),
        #161413;
      color: #f4ead9;
    }
    .port-popout-shell {
      box-sizing: border-box;
      display: flex;
      min-height: 100vh;
      flex-direction: column;
      gap: 16px;
      padding: 24px;
    }
    .port-popout-header {
      display: grid;
      gap: 8px;
    }
    .port-popout-eyebrow {
      color: #b99b62;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: #f4ead9;
      font-size: 22px;
      line-height: 1.15;
    }
    .port-popout-status {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .port-popout-metric {
      border: 1px solid rgba(244, 234, 217, 0.12);
      border-radius: 14px;
      background: rgba(20, 18, 16, 0.76);
      padding: 12px;
    }
    .port-popout-metric span {
      display: block;
      color: #978b78;
      font-size: 11px;
      text-transform: uppercase;
    }
    .port-popout-metric strong {
      display: block;
      margin-top: 5px;
      overflow: hidden;
      color: #f4ead9;
      font-family: "JetBrains Mono Variable", Consolas, monospace;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .port-popout-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .port-popout-button {
      border: 1px solid rgba(244, 234, 217, 0.18);
      border-radius: 12px;
      background: rgba(244, 234, 217, 0.08);
      color: #f4ead9;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      padding: 9px 12px;
    }
    .port-popout-button:hover {
      border-color: rgba(244, 234, 217, 0.34);
      background: rgba(244, 234, 217, 0.13);
    }
    .port-popout-detail,
    .port-popout-notice {
      margin: 0;
      border-radius: 14px;
      color: #bfb19a;
      font-size: 12px;
      line-height: 1.55;
    }
    .port-popout-detail {
      border: 1px solid rgba(244, 234, 217, 0.10);
      background: rgba(20, 18, 16, 0.56);
      padding: 12px;
    }
    .port-popout-notice {
      padding: 10px 12px;
    }
    .port-popout-notice-info {
      background: rgba(74, 125, 168, 0.18);
      color: #c9d9e8;
    }
    .port-popout-notice-error {
      background: rgba(214, 69, 69, 0.16);
      color: #f0c6bd;
    }
  `
  document.head.append(style)
}
