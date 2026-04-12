# Engineering Spec — DevHub 工程质量规格

> 优先级: CRITICAL / HIGH
> 影响范围: 全代码库

---

## ENG-01: 代码重复清理

**严重程度**: HIGH
**重复模式清单**:

### 1. 确认对话框模式（4 处）
- `ProjectCard.tsx` — 删除项目确认
- `ProcessView.tsx` ProcessCard — 杀进程确认
- `PortView.tsx` PortCard — 释放端口确认
- `WindowView.tsx` — 关闭窗口确认

**修复**: 提取 `useConfirmAction` hook 或扩展 `ConfirmDialog` 组件。

### 2. 视图模式切换（3 处）
- `ProcessView.tsx` — cards/list/grouped 三按钮
- `PortView.tsx` — cards/list 两按钮
- `WindowView.tsx` — 类似模式

**修复**: 提取 `ViewModeToggle` 组件:
```tsx
interface ViewModeToggleProps {
  modes: Array<{ key: string; icon: ReactNode; label: string }>;
  current: string;
  onChange: (mode: string) => void;
}
```

### 3. 原型污染检查（3 处）
- `notificationHandlers.ts`
- `taskHistoryHandlers.ts`
- `ipc/index.ts`

**修复**: 提取到 `utils/validation.ts`（见 SEC-05）。

### 4. StatCard / HeroStats 重复
- `ProcessView.tsx` — 内联 stat 卡片
- `PortView.tsx` — 内联 stat 卡片
- `ui/StatCard.tsx` — 已有组件但未充分复用

**修复**: 统一使用 `StatCard` 组件。

### 5. LoadingSpinner（5+ 处）
多个文件使用 `w-10 h-10 border-3 border-accent border-t-transparent animate-spin`

**修复**: 提取 `LoadingSpinner` 组件。

### 6. LastScanTime 显示（2 处）
- `ProcessView.tsx`
- `PortView.tsx`

**修复**: 提取 `LastScanTime` 组件。

### 7. 进程名称白名单（2 处）
- `scripts/update-toolmonitor.cjs` — VALID_PROCESS_NAMES
- `shared/types-extended.ts` — DEV_PROCESS_PATTERNS

**修复**: 统一到 `shared/types-extended.ts`，脚本从该文件读取。

---

## ENG-02: 错误处理缺陷

### 2a. 监控子视图无独立 ErrorBoundary
**位置**: `MonitorPanel.tsx` 中的 ProcessView/PortView/WindowView/AITaskView
**问题**: 任一子视图崩溃会导致整个监控面板不可用
**修复**: 为每个子视图包裹独立的 `ErrorBoundary`

### 2b. 未捕获的 Promise Rejection
| 位置 | 调用 | 缺失 |
|------|------|------|
| `ProjectList.tsx` | `window.devhub.shell.openPath()` | 无 try-catch |
| `SettingsDialog.tsx` | `devhub.settings.update()` | 无 catch |

### 2c. 静默吞掉异常
| 位置 | 问题 |
|------|------|
| `SystemProcessScanner.ts` | WMIC 失败只 console.error，不传播 |
| `WindowManager.ts` | PowerShell 失败返回 false，调用方不知道原因 |

**修复**: 添加结构化错误返回 `{ success: boolean; error?: string }`。

---

## ENG-03: 测试缺失

**现状**:
- `src/test/setup.ts` — 仅测试基础设施配置
- `e2e/example.spec.ts` — 仅 2 个占位测试
- **无实际单元测试文件**

**需要的测试**:

| 模块 | 测试类型 | 优先级 |
|------|----------|--------|
| ProcessManager | 单元测试 | P0 |
| PortScanner | 单元测试 | P0 |
| AITaskTracker | 单元测试 | P1 |
| IPC Handlers | 集成测试 | P1 |
| Zustand Stores | 单元测试 | P1 |
| 关键 Hooks | 单元测试 | P2 |
| E2E 核心流程 | E2E 测试 | P2 |

---

## ENG-04: 代码生成脚本风险

**位置**: `scripts/update-projectlist.cjs`, `update-sidebar.cjs`, `update-toolmonitor.cjs`

**问题**:
1. 这些脚本生成的文件（ProjectList.tsx, Sidebar.tsx, ToolMonitor.ts）可能被开发者手动修改后又被脚本覆盖
2. 脚本中硬编码的配置与 `shared/types-extended.ts` 重复
3. 无保护机制防止误执行

**修复方案**:
- 选项 A: 删除脚本，将当前生成的代码作为最终版本维护
- 选项 B: 在生成的文件头部添加 `// @generated - DO NOT EDIT` 注释，并在 CI 中检查一致性
- **推荐**: 选项 A（脚本已完成历史使命）

---

## ENG-05: Git 初始化

**问题**: 项目无 Git 仓库
**修复**:
1. `git init`
2. 确认 `.gitignore` 覆盖 `node_modules/`, `out/`, `release/`, `coverage/`, `tmpclaude-*`
3. 首次提交

---

## ENG-06: CI 配置补全

**位置**: `.github/workflows/ci.yml`

**缺失项**:
- E2E 测试步骤
- 覆盖率报告上传
- 构建制品上传
- 安全扫描步骤

**修复**: 补全 CI 配置（Batch 2 中执行）。
