# Project Overview: CREATOR ONE / DevHub

## Purpose
DevHub is a Windows desktop application for managing npm projects and monitoring coding tools. It is built as an Electron app with a React frontend.

## Tech Stack
- **Runtime**: Electron 28 (Node.js + Chromium)
- **Build Tool**: electron-vite + Vite 5
- **Frontend**: React 18 + TypeScript 5 (strict mode)
- **State Management**: Zustand 4
- **Styling**: TailwindCSS 3 + PostCSS
- **Visualization**: @xyflow/react (flow diagrams), D3 (force/drag/zoom)
- **Testing**: Vitest (unit), Playwright (e2e)
- **Linting**: ESLint 9 (flat config) + typescript-eslint
- **Package Manager**: pnpm (workspace mode)
- **License**: AGPL-3.0-or-later

## Architecture
Electron 3-process architecture:
- `src/main/` — Main process (Node.js): IPC handlers, services, store, utils
- `src/preload/` — Preload scripts (bridge between main and renderer)
- `src/renderer/` — Renderer process (React): components, hooks, stores, styles, types, utils
- `src/shared/` — Shared types between main and renderer
- `src/test/` — Test files

## Path Aliases
- `@/*` → `src/*`
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`

## Key Dependencies
- `chokidar` — File system watching
- `electron-store` — Persistent storage
- `@tanstack/react-virtual` — Virtualized lists
- `fast-xml-parser`, `js-yaml`, `@iarna/toml` — Config file parsers
- `tree-kill` — Process management
- `uuid` — ID generation
