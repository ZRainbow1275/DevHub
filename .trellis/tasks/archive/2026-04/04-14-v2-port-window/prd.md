# Team 2: Port-Window -- T4 Port Panel i18n + T5 Window Management

## Project Context

DevHub is an Electron desktop app at `devhub/` subdirectory (electron-vite + React 18 + TypeScript + Zustand + TailwindCSS).

## Scope

- T4: Port Panel Internationalization + Performance Optimization
- T5: Window Management Full Enhancement

---

## T4 Requirements

### Current Problem

`PortFocusPanel.tsx` has ALL hardcoded English labels: "BASIC INFO", "Port", "Protocol", "State", "Local", "Process", "PID", "Service", "PROCESS DETAILS", "SIBLING PORTS", "CONNECTIONS", "CHILD PROCESSES", "CONFLICTING PROCESSES", "Query timed out - showing cached data", "Showing cached data", "Port conflict", "Focus Process", "View in Graph", "Retry", "Refresh".

### T4.1 Complete Chinese Translation

Replace ALL English in `src/renderer/components/monitor/PortFocusPanel.tsx`:

| English | Chinese |
|---------|---------|
| BASIC INFO | 基本信息 |
| Port | 端口 |
| Protocol | 协议 |
| State | 状态 |
| Local | 本地地址 |
| Process | 进程 |
| PID | 进程 ID |
| Service | 服务 |
| PROCESS DETAILS | 进程详情 |
| CPU | CPU |
| Memory | 内存 |
| Threads | 线程数 |
| Handles | 句柄数 |
| User | 用户 |
| Command | 命令 |
| SIBLING PORTS (N) | 关联端口 (N) |
| CONNECTIONS (N) | 网络连接 (N) |
| CHILD PROCESSES (N) | 子进程 (N) |
| CONFLICTING PROCESSES (N) | 冲突进程 (N) |
| Query timed out - showing cached data | 查询超时 - 显示缓存数据 |
| Showing cached data | 显示缓存数据 |
| Port conflict: N processes listening on :PORT | 端口冲突: N 个进程监听 :PORT |
| Failed to load port data | 加载端口数据失败 |
| Retry | 重试 |
| Focus Process | 聚焦进程 |
| View in Graph | 在图中查看 |
| Refresh (title) | 刷新 |

Also scan `PortView.tsx` for any remaining English labels and translate them.

### T4.2 Expand portLabels.ts

Add 30+ common port labels in Chinese to `src/renderer/utils/portLabels.ts`:

```
20, 21 -> "FTP"
22 -> "SSH"
23 -> "Telnet"
25 -> "SMTP"
53 -> "DNS"
80 -> "HTTP 服务"
110 -> "POP3"
143 -> "IMAP"
443 -> "HTTPS 服务"
465 -> "SMTPS"
587 -> "SMTP 提交"
993 -> "IMAPS"
995 -> "POP3S"
1433 -> "SQL Server"
1521 -> "Oracle"
2375, 2376 -> "Docker API"
3000 -> "开发服务"
3001 -> "开发服务(备)"
3306 -> "MySQL"
3389 -> "RDP 远程桌面"
4200 -> "Angular 开发"
5000 -> "Flask 开发"
5173 -> "Vite 开发服务"
5174 -> "Vite HMR"
5432 -> "PostgreSQL"
5672 -> "RabbitMQ"
6379 -> "Redis"
7077 -> "Spark Master"
8000 -> "HTTP 备用"
8080 -> "HTTP 代理"
8081 -> "HTTP 代理 2"
8443 -> "HTTPS 代理"
8888 -> "Jupyter"
9000 -> "SonarQube"
9090 -> "Prometheus"
9092 -> "Kafka"
9200 -> "Elasticsearch"
11211 -> "Memcached"
15672 -> "RabbitMQ 管理"
27017 -> "MongoDB"
```

### T4.3 Port Security Indicators

In `PortFocusPanel.tsx`, add security/type badges next to port number:

- **Privileged port** (< 1024): show badge "特权端口" (warning color)
- **Ephemeral port** (>= 49152): show badge "临时端口" (muted color)
- **External binding** (localAddress NOT starting with `127.0.0.1` or `::1`): show badge "对外暴露" (error color) with tooltip

### T4.4 Port Query Performance

In `src/main/services/PortScanner.ts` and `src/main/ipc/portHandlers.ts`:

- Add timeout wrapper: every PowerShell call wrapped in 3s timeout
- Tiered cache TTL:
  - Basic port list: TTL 5s
  - Process details per port: TTL 15s
  - Connection list: TTL 10s
- Ensure cancelPortQuery actually cancels in-flight queries

---

## T5 Requirements

### Current Problem

- AI windows can't be user-renamed; notifications don't include window name
- AI task completion detection error-prone (false positives/negatives)
- Group/Layout buttons exist but don't work
- Monitoring progress too basic
- Too few window operations

### T5.1 AI Window Alias System

In `src/renderer/components/monitor/AIWindowAlias.tsx`:

- Inline edit mode: click pencil icon -> text input appears
- Enter to save, Esc to cancel
- Save via IPC `ai-task:set-alias` -> `AIAliasManager.setAlias(hwnd, alias)`
- Show alias prominently in window card title: `[alias] original title`
- Auto-suggest alias from workingDir basename if empty (user sees placeholder)
- Clear alias button (trash icon)
- Validate alias length (<= `ALIAS_MAX_LENGTH`) and forbidden chars (`ALIAS_FORBIDDEN_CHARS`)

### T5.2 Window Grouping

Existing `WindowManager.ts` has groups persistence. Wire up UI in `WindowView.tsx`:

- "Create Group" button: pick from selected windows -> enter name -> call IPC `window:create-group`
- Group listed in sidebar with expand/collapse
- Right-click group: [重命名] [批量最小化] [批量恢复] [批量关闭] [删除分组]
- Drag window card into group card to add
- "Group by Process" view (existing ProcessGroupCard) -- ensure it works correctly

### T5.3 Layout Snapshots

Wire up layout UI in `WindowView.tsx`:

- "Save Current Layout" button -> prompts for name -> IPC `window:save-layout`
- Layout list panel: each layout has [预览] [恢复] [删除] buttons
- Restore: moves all windows to saved positions using `WindowManager.moveWindow(hwnd, x, y, w, h)`
- `LayoutPreview.tsx`: mini visualization of window positions on a scaled-down desktop

### T5.4 Batch Window Operations

In `WindowView.tsx`, add:

- Checkbox on each window card (top-right corner)
- Batch toolbar (appears when > 0 selected):
  - [全选] / [取消全选]
  - [批量最小化]
  - [批量恢复]
  - [批量关闭] (with confirm)
  - [批量置顶切换]
  - [级联排列] (stagger positioning)
  - [平铺排列] (divide screen equally)
  - [堆叠排列] (same position)

### T5.5 Window Advanced Features

Per-window controls (in card context menu or right-click):

- **Transparency slider** (0-100%): calls IPC `window:set-opacity` -> `WindowManager.setOpacity(hwnd, alpha)`. Backend helper already has SetOpacity method.
- **Topmost toggle** (pin icon): calls IPC `window:set-topmost` -> `WindowManager.setTopmost(hwnd, bool)`. Backend helper has SetTopmost.
- **Screenshot button**: Windows only, best-effort via PrintWindow API

Add new IPC handlers in `windowHandlers.ts`:
- `window:set-opacity(hwnd, alpha)`
- `window:set-topmost(hwnd, topmost)`
- `window:arrange(hwnds, arrangement)` where arrangement = 'cascade' | 'tile' | 'stack'

### T5.6 AI Progress Enhancement

In `AIProgressTimeline.tsx`:

- Status change timeline (horizontal): shows state transitions over time
- Phase labels: 思考中 / 生成中 / 编译中 / 测试中 (from `PHASE_LABELS` already in types)
- Real-time CPU mini chart per AI tool
- Real-time write-rate chart (bytes/sec) showing output activity
- Elapsed time for current phase

---

## Acceptance Criteria

### T4 Acceptance
- [ ] PortFocusPanel fully Chinese, no English labels visible
- [ ] portLabels.ts has 30+ entries
- [ ] Privileged/ephemeral/external port badges display correctly
- [ ] No query takes > 3 seconds before timeout fallback

### T5 Acceptance
- [ ] AI window alias editable inline, shown in title, persisted
- [ ] Notifications include alias prefix when set
- [ ] Create/delete/operate groups functional
- [ ] Save/restore layout snapshots functional
- [ ] Batch selection + all 7 batch operations functional
- [ ] Transparency slider and topmost toggle work
- [ ] AI progress timeline shows phases and real-time charts

---

## Critical Rules

- **NO deletion** of existing code/components/functions
- **NO mock data**
- **NO emoji icons** -- use SVG icons from `src/renderer/components/icons/`
- TypeScript strict mode
- All UI in Chinese
- Run `cd devhub && npx tsc --noEmit` before completing

## Files In Scope

### Frontend
- `devhub/src/renderer/components/monitor/PortFocusPanel.tsx` -- T4 i18n
- `devhub/src/renderer/components/monitor/PortView.tsx` -- T4 verify translations, open panel
- `devhub/src/renderer/components/monitor/WindowView.tsx` -- T5 major enhancement
- `devhub/src/renderer/components/monitor/AIWindowAlias.tsx` -- T5 alias editor
- `devhub/src/renderer/components/monitor/AIProgressTimeline.tsx` -- T5 timeline
- `devhub/src/renderer/components/monitor/LayoutPreview.tsx` -- T5 layout preview
- `devhub/src/renderer/utils/portLabels.ts` -- T4 port labels
- `devhub/src/renderer/stores/windowStore.ts` -- T5 window state
- `devhub/src/renderer/stores/aliasStore.ts` -- T5 alias state
- `devhub/src/renderer/hooks/useWindows.ts` -- T5 window hook

### Backend
- `devhub/src/main/services/PortScanner.ts` -- T4 performance
- `devhub/src/main/services/WindowManager.ts` -- T5 arrange/opacity/topmost (SetOpacity/SetTopmost already in C# helper)
- `devhub/src/main/services/AIAliasManager.ts` -- T5 alias CRUD (mostly existing)
- `devhub/src/main/ipc/portHandlers.ts` -- T4 timeout + cache
- `devhub/src/main/ipc/windowHandlers.ts` -- T5 new IPC endpoints

### Preload
- `devhub/src/preload/extended.ts` -- expose new IPC endpoints

### Shared
- `devhub/src/shared/types-extended.ts` -- ADDITIONS ONLY (add T5 types)

## Out of Scope

- ToolMonitor / AITaskTracker / NotificationService (Team 1 owns)
- ProcessDetailPanel, ProcessView (Team 1 owns)
- Topology/Flow graphs (Team 3)
- ProjectCard, ProjectList, Sidebar, HeroStats (Team 4)
- Theme CSS variables, globals.css, tokens/*.css (Team 5)
