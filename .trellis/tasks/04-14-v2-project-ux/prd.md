# Team 4: Project-UX -- T2 UI Layout + T8 Project Features

## Project Context

DevHub is an Electron desktop app at `devhub/` (electron-vite + React 18 + TypeScript + Zustand + TailwindCSS).

## Scope

- T2: UI Layout Responsive Beautification (HeroStats, Sidebar, ProjectCard, ProjectList, PanelSplitter)
- T8: Project Features Enrichment (ProjectCard + new ProjectDetailPanel, Git integration, dependencies, ports, logs, scripts, git, config)

---

## T2 Requirements

### Current Problem

Screenshot shows:
- Top HeroStats numbers are huge (0, 20243, 1, 0), BUT labels are vertically stacked and truncated (只显示 "运", "进", "端", "AI", "错")
- Project list shows only 1-2 character project names (e.g. "l..", "c..", "b..", "d..")
- Overall layout cramped on any non-wide window

### T2.1 HeroStats.tsx Redesign

Replace current vertical stack layout with inline horizontal:

```
Target (wide):
┌──────────────────────────────────────────────────────────────┐
│  ● 0 运行中  ● 206 进程  ● 178 端口  ● 2 AI工具  ● 0 错误   │
└──────────────────────────────────────────────────────────────┘

Target (narrow wraps):
┌─────────────────────────────────┐
│  ● 0 运行中   ● 206 进程        │
│  ● 178 端口   ● 2 AI工具        │
│          ● 0 错误               │
└─────────────────────────────────┘
```

Implementation:
- CSS Grid: `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- Each stat: `display: flex; align-items: baseline; gap: 8px`
- Number before label, on same line
- Number font-size auto-shrinks when digit count >= 5 (use `useResponsiveFontSize(digits)` helper)
- Labels never truncate (`white-space: nowrap; overflow: visible`)
- Keep existing `ResponsiveMetric` component but use in inline mode

### T2.2 ProjectCard.tsx / ProjectList.tsx

- Project name minimum visible chars: 16 (not the current ~2)
- Card minimum width: 240px
- Card grid: `repeat(auto-fill, minmax(240px, 1fr))`
- Name uses `TruncatedText` with tooltip for overflow
- Information hierarchy:
  - Line 1: Name (font-weight 700, larger) + Type Badge
  - Line 2: Path (text-xs, muted, truncated with tooltip)
  - Line 3: status indicators (git branch, port, CPU if running)
  - Line 4: quick action row

### T2.3 Sidebar.tsx Collapsible

- New collapsed state (48px wide, icons only)
- New expanded state (user-resizable 200-400px)
- Drag handle on right edge -> sets new width -> persist to settings
- Toggle button (top): collapse / expand
- Smooth transition 200ms

Persist width in settings via `window.devhub.settings.update({ ui: { sidebarWidth: N, sidebarCollapsed: bool } })`.

### T2.4 PanelSplitter.tsx

- Ensure drag works for horizontal and vertical splits
- Double-click splitter -> reset to 50/50
- Minimum pane size: 300px
- Persist ratio via settings
- Visual cue (hover highlight)

### T2.5 Density System

The `useDensity.ts` hook exists. Add UI toggle:
- Settings dialog -> 显示密度: [紧凑 | 标准 | 舒适]
- Apply CSS variable `--density-factor` to root
- Existing components auto-adapt if they use density-aware spacing

---

## T8 Requirements

### Current Problem

ProjectCard only supports: start/stop, open folder, copy path, manage tags, delete. No details view, no Git info, no dependency analysis, no log viewing, no port association.

### T8.1 Enhance ProjectCard.tsx

Add info rows (compact):
- Git branch indicator (if `.git` directory exists): `[git] main (+2 ahead)`
- Associated port(s) (from related processes): `[端口] :3000`
- CPU/memory if running: `[cpu] 1.2%  [mem] 128MB`
- Version from package.json: `v1.2.3`

Quick script buttons (instead of only dropdown):
- Row of small buttons for top 3 scripts: `[▶ dev] [□ test] [□ build]`
- Currently-running script highlighted
- Fallback: "更多..." dropdown with full script list

### T8.2 Create ProjectDetailPanel.tsx (NEW)

A slide-in panel (or modal) with 7 tabs:

**Tab 1: 概览 (Overview)**
```
名称: legalmind-caselist
路径: D:\Desktop\CaseList\prototype
类型: npm (package-lock.json 检测到)
版本: v1.2.3
许可证: MIT
状态: 运行中 (已运行 2小时 15分)
最近活动: 2分钟前
健康评分: 85/100
  (基于: 运行状态 30% + 错误率 30% + 依赖更新 40%)
```

**Tab 2: 脚本 (Scripts)**
- List all scripts from package.json
- Each with: [运行] button, last run time, last result (success/error)
- Custom arg input for each script

**Tab 3: 依赖 (Dependencies)**
- Tabs within: dependencies / devDependencies
- Table: name | version | (stale indicator)
- Total count
- Search filter

**Tab 4: 端口 (Ports)**
- List ports associated with project's processes
- Click port -> navigate to port focus panel (via store action)

**Tab 5: 日志 (Logs)**
- Show project's stdout/stderr (from useLogs hook if applicable)
- Log level filter (info/warn/error)
- Auto-scroll to latest
- Search within logs

**Tab 6: Git**
- Current branch
- Uncommitted changes count
- Recent 10 commits (oneline)
- Ahead/behind remote

**Tab 7: 配置 (Config)**
- Default script setting
- Auto-start toggle
- Tag management (reuse existing TagManagerDialog)
- Project notes/description (text area, persisted)

### T8.3 Backend: Git Info API

In `src/main/services/ProjectScanner.ts`, add method `getGitInfo(projectPath: string): Promise<GitInfo | null>`:

```typescript
export interface GitInfo {
  branch: string
  uncommittedCount: number
  recentCommits: { hash: string; message: string; timestamp: number }[]
  ahead: number
  behind: number
}

async getGitInfo(projectPath: string): Promise<GitInfo | null> {
  try {
    // git rev-parse --abbrev-ref HEAD
    // git status --porcelain
    // git log --oneline -10
    // git rev-list --count @{u}..HEAD (ahead)
    // git rev-list --count HEAD..@{u} (behind)
    // All via execFileAsync with cwd + 3s timeout
  } catch { return null }
}
```

Cache per-project for 10s (TTL).

### T8.4 Backend: Dependency API

In `src/main/services/ProjectScanner.ts`:

```typescript
export interface DependencyInfo {
  name: string
  version: string
  type: 'dependencies' | 'devDependencies'
}

async getDependencies(projectPath: string): Promise<DependencyInfo[]>
```

Parse `package.json` from disk. No network calls.

### T8.5 Backend: Related Ports API

Use existing `ProcessScanner.groupByProject(projects)` output to derive ports.

### T8.6 IPC Handlers

In `src/main/ipc/scannerHandlers.ts`:
- `project:get-git-info` -> getGitInfo
- `project:get-dependencies` -> getDependencies

### T8.7 Project Search/Sort in ProjectList

- Fuzzy match over name/path/tags (simple Levenshtein-like or substring OR)
- Search history (last 5 queries) in dropdown
- Sort dropdown: 名称 / 最近运行 / 状态 / 类型 / 创建时间
- Asc/desc toggle

### T8.8 Project Stats Dashboard

Above the project list, add a mini dashboard row:
- Total projects | Running | Error | Total ports used | Total CPU | Total memory

---

## Acceptance Criteria

### T2 Acceptance
- [ ] HeroStats shows labels inline with numbers, never truncated
- [ ] Project name shows min 16 chars before truncation
- [ ] Sidebar collapsible and resizable
- [ ] Panel splitter drag works
- [ ] Density toggle in settings changes spacing

### T8 Acceptance
- [ ] ProjectCard shows Git branch, port, CPU/memory
- [ ] ProjectDetailPanel 7 tabs all render, lazy-load per tab
- [ ] Git info loads within 2s
- [ ] Dependencies parsed from package.json
- [ ] Project search with fuzzy match
- [ ] 5 sort criteria functional

---

## Critical Rules

- **NO deletion** of existing code/components/functions
- **NO mock data** -- git via real `git` CLI, deps from real package.json
- **NO emoji icons** -- use SVG icons
- TypeScript strict mode
- All UI Chinese
- `execFileAsync('git', [...], { cwd })` only; NEVER `exec` (shell injection risk)
- Run `cd devhub && npx tsc --noEmit` before completing

## Files In Scope

### Frontend (primary)
- `devhub/src/renderer/components/ui/HeroStats.tsx` -- T2 redesign
- `devhub/src/renderer/components/ui/ResponsiveMetric.tsx` -- T2 support inline mode
- `devhub/src/renderer/components/ui/StatCard.tsx` -- T2 alignment
- `devhub/src/renderer/components/ui/PanelSplitter.tsx` -- T2 drag support
- `devhub/src/renderer/components/ui/ResizeHandle.tsx` -- T2 reusable handle
- `devhub/src/renderer/components/layout/Sidebar.tsx` -- T2 collapsible + resizable
- `devhub/src/renderer/components/layout/StatusBar.tsx` -- minor alignment
- `devhub/src/renderer/components/project/ProjectCard.tsx` -- T8 enrichment
- `devhub/src/renderer/components/project/ProjectList.tsx` -- T8 search/sort/stats
- `devhub/src/renderer/components/project/ProjectDetailPanel.tsx` -- T8 **NEW FILE**
- `devhub/src/renderer/stores/projectStore.ts` -- T8 add git/deps state
- `devhub/src/renderer/hooks/useProjects.ts` -- T8 new queries
- `devhub/src/renderer/hooks/useDensity.ts` -- T2 density reading
- `devhub/src/renderer/hooks/useBreakpoint.ts` -- T2 breakpoint
- `devhub/src/renderer/components/settings/SettingsDialog.tsx` -- T2 density toggle

### Backend
- `devhub/src/main/services/ProjectScanner.ts` -- T8 getGitInfo, getDependencies
- `devhub/src/main/ipc/scannerHandlers.ts` -- T8 new IPC
- `devhub/src/preload/extended.ts` -- T8 expose new IPC

### Shared
- `devhub/src/shared/types-extended.ts` -- ADDITIONS ONLY (GitInfo, DependencyInfo)

## Out of Scope

- ToolMonitor/ProcessDetailPanel (Team 1)
- PortFocusPanel/WindowView (Team 2)
- Topology/Flow graphs (Team 3)
- Theme CSS variables (Team 5)
