<p align="center">
  <img src="resources/icon.png" width="120" alt="DevHub" />
</p>

<h1 align="center">DevHub</h1>

<p align="center">
  <strong>Developer Project Manager & AI Tool Monitor</strong>
  <br />
  A Windows-native desktop app for managing npm projects and monitoring AI coding assistants.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License" />
  <img src="https://img.shields.io/github/actions/workflow/status/ZRainbow/DevHub/ci.yml?branch=main&label=CI" alt="CI" />
  <img src="https://img.shields.io/github/stars/ZRainbow/DevHub?style=social" alt="Stars" />
</p>

---

## What is DevHub?

DevHub is a desktop application built for developers who juggle multiple npm projects and AI coding tools simultaneously. Instead of switching between terminals, DevHub provides a unified control center.

**Core capabilities:**

- **Project Management** — Add, organize, and control multiple npm projects from one interface. One-click start/stop with real-time log streaming.
- **AI Tool Monitoring** — Automatically detects running AI coding assistants (Codex, Claude Code, Gemini CLI) and sends Windows notifications when tasks complete.
- **System Monitoring** — Live views of system processes, port usage, and window management with conflict detection.
- **Security First** — Sandboxed renderer, CSP headers, IPC rate limiting, input validation, and path whitelisting.

---

## Screenshots

> *Coming soon — run `pnpm dev` to see the app in action.*

---

## Design Philosophy

DevHub's visual identity draws from **Soviet Constructivism** — bold geometric forms, high-contrast color palettes, and function-driven aesthetics. The interface combines:

| Influence | Expression |
|-----------|------------|
| Soviet Constructivism | Diagonal tension, bold red accents, propaganda-inspired typography |
| Swiss Rationalism | Strict grid system (4px base), clear hierarchy |
| Digital Constructivism | Pixel-perfect components, monospace data displays |
| Eastern Minimalism | Breathing space, restraint in decoration |

**Color palette:** Soviet Red (`#C41E3A`) · Carbon Black (`#0D0D0D`) · Pure White (`#FAFAFA`)

---

## Architecture

```
devhub/
  src/
    main/               # Electron main process
      services/         #   ProcessManager, PortScanner, AITaskTracker,
                        #   SystemProcessScanner, WindowManager, ToolMonitor
      ipc/              #   IPC handlers with rate limiting & validation
      store/            #   Persistent storage (electron-store)
      utils/            #   Security, validation, rate limiting
    preload/            # Context bridge (sandboxed API exposure)
    renderer/           # React frontend
      components/       #   UI components (project, monitor, layout, ui)
      hooks/            #   Custom React hooks with proper cleanup
      stores/           #   Zustand state management (6 stores)
    shared/             # Cross-layer type definitions & constants
```

**Key architectural decisions:**

- `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false`
- All IPC channels rate-limited (scan: 12/min, action: 30/min, query: 60/min)
- Unified validation layer with TypeScript assertion functions
- Structured error returns (`ServiceResult<T>`) across all service boundaries
- Independent `ErrorBoundary` per monitor view for fault isolation

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 8+
- **Windows** 10/11 (native system APIs used for process/window management)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/ZRainbow/DevHub.git
cd DevHub

# Install dependencies
pnpm install

# Start development mode (hot reload)
pnpm dev
```

### Build & Package

```bash
# Production build
pnpm build

# Package as Windows installer (.exe)
pnpm package:win
```

---

## Development

```bash
pnpm dev              # Development mode with hot reload
pnpm build            # Production build
pnpm lint             # ESLint (flat config, strict TypeScript)
pnpm typecheck        # TypeScript strict mode check
pnpm test             # Vitest unit tests
pnpm test:ui          # Vitest UI panel
pnpm test:coverage    # Coverage report (v8)
pnpm test:e2e         # Playwright E2E tests
pnpm check:license    # Production dependency license policy
pnpm check:sbom       # Generate and validate a CycloneDX SBOM
pnpm check:no-cloud-deps
pnpm check:no-ocr-deps
pnpm check:zero-egress-capture:preflight
```

### 60-second zero-egress verification

DevHub R8 is designed as a local-first desktop app. The fastest local verification is:

```bash
pnpm check:no-cloud-deps
pnpm check:no-ocr-deps
pnpm exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "without opening outbound network clients"
```

For the packet-level Windows acceptance check, run the capture verifier from an Administrator shell. It starts `pktmon` counters, launches `pnpm dev`, observes startup for 60 seconds, writes JSON evidence under `out/zero-egress-capture`, and fails if any packet counter is non-zero:

```powershell
pnpm check:zero-egress-capture:preflight
pnpm check:zero-egress-capture
```

The verifier exits with code `2` when Windows, `pktmon`, or Administrator privileges are missing. That state is a blocked acceptance precondition, not a pass. Expected result for idle launch is zero captured packets unless the operator explicitly starts an update, feedback, or external-link action.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 28 + electron-vite |
| Frontend | React 18, Zustand, Tailwind CSS 3 |
| Language | TypeScript (strict mode) |
| Build | Vite 5, electron-builder |
| Testing | Vitest, Playwright, Testing Library |
| Linting | ESLint 9 (flat config), typescript-eslint |

---

## Features

### Project Management
- Scan and discover npm projects across drives
- Tag and group projects for batch operations
- One-click `npm run <script>` execution
- Real-time stdout/stderr log streaming
- Port conflict detection per project

### AI Tool Monitoring
- Auto-detect Codex, Claude Code, Gemini CLI processes
- Task completion scoring (CPU idle + window title + idle duration)
- Windows native notifications on task completion
- Task history with statistics

### System Monitoring
- **Process View** — Live system process list, zombie detection, resource usage
- **Port View** — TCP port scanning, conflict detection, one-click release
- **Window View** — Window enumeration, grouping, layout save/restore
- **AI Task View** — Real-time AI tool tracking with completion metrics

### Security
- Sandboxed renderer with strict CSP
- IPC rate limiting on all channels
- Centralized input validation (assertion functions)
- Path traversal prevention with symlink checks
- Script name whitelisting
- Prototype pollution guards

---

## Project Structure

```
src/main/
  index.ts                    # App lifecycle, window creation, tray
  ipc/
    index.ts                  # Core IPC handlers (projects, settings, tags)
    processHandlers.ts        # System process scanning & management
    portHandlers.ts           # Port scanning & conflict resolution
    windowHandlers.ts         # Window enumeration & layout management
    aiTaskHandlers.ts         # AI tool task tracking
    notificationHandlers.ts   # Notification config & history
    taskHistoryHandlers.ts    # Task record persistence
  services/
    ProcessManager.ts         # npm script execution & lifecycle
    PortScanner.ts            # netstat parsing & port management
    SystemProcessScanner.ts   # WMI process enumeration
    AITaskTracker.ts          # AI tool detection & completion scoring
    WindowManager.ts          # PowerShell window API
    ToolMonitor.ts            # Smart polling tool detection
    NotificationService.ts    # Notification queue & history
    TaskHistoryStore.ts       # Debounced disk persistence
    ProjectScanner.ts         # Directory scanning & project discovery
  store/
    AppStore.ts               # electron-store wrapper
  utils/
    security.ts               # Path validation, script whitelisting
    validation.ts             # Unified assertion validators
    rateLimiter.ts            # Per-channel rate limiting

src/renderer/
  components/
    layout/                   # TitleBar, Sidebar, StatusBar
    project/                  # ProjectList, ProjectCard, AddProjectDialog
    monitor/                  # MonitorPanel, ProcessView, PortView, etc.
    settings/                 # SettingsDialog
    ui/                       # StatCard, Toast, ConfirmDialog, etc.
  hooks/                      # useProjects, useLogs, usePorts, etc.
  stores/                     # Zustand stores (project, port, process, etc.)
```

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the public quarterly roadmap and current monthly plan.

## Governance

- Security disclosure: [SECURITY.md](SECURITY.md)
- Privacy policy: [PRIVACY.md](PRIVACY.md)
- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Third-party notices: [NOTICE](NOTICE)

## Trademark and fair-use notice

DevHub may display names or logos for third-party developer tools such as OpenAI, Claude, Gemini, Cursor, GitHub Copilot, npm, Node.js, Electron, React, and TypeScript solely to identify user-installed tools, dependency ecosystems, or compatibility targets. Those names and marks remain the property of their respective owners. DevHub is not endorsed by or affiliated with those vendors unless a written agreement says otherwise.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with Electron, React, and a touch of Soviet Constructivism.
</p>
