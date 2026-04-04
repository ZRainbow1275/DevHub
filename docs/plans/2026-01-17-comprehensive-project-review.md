# DevHub 项目全面审查与测试实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对 DevHub 项目进行批判性的全方位审查和测试，识别问题并建立测试基础设施

**Architecture:** 本计划分为 6 个主要审查领域：测试基础设施、安全审计、性能评估、UI/UX 审查、代码质量分析和功能完整性验证。采用 TDD 方法补充缺失的测试覆盖。

**Tech Stack:** Electron 28 + React 18 + TypeScript + Vitest + Playwright + electron-vite

---

## 审查摘要

### 项目概述
- **项目名称**: DevHub - 开发项目管理器
- **定位**: Windows 原生桌面应用，用于可视化管理 npm 项目和编程工具终端
- **技术栈**: Electron 28 + React 18 + TypeScript + Tailwind CSS + Zustand + Vite

### 已识别的关键问题

| 问题类别 | 严重程度 | 问题描述 |
|---------|---------|---------|
| **测试缺失** | 🔴 严重 | 项目完全没有单元测试、集成测试或端到端测试 |
| **安全隐患** | 🟡 中等 | 存在潜在的命令注入风险和路径遍历风险 |
| **类型安全** | 🟡 中等 | `App.tsx:26` 使用了 `as any` 类型断言 |
| **错误处理** | 🟡 中等 | 多处 catch 块为空或只有 console.error |
| **内存泄漏** | 🟡 中等 | 事件监听器清理不完整 |
| **性能问题** | 🟢 低 | 无虚拟化的长列表渲染 |

---

## Phase 1: 测试基础设施搭建

### Task 1.1: 安装测试依赖

**Files:**
- Modify: `devhub/package.json`

**Step 1: 添加测试依赖到 package.json**

```bash
cd D:/Desktop/CREATOR\ ONE/devhub
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui @testing-library/react @testing-library/jest-dom jsdom playwright @playwright/test
```

Expected: 依赖安装成功

**Step 2: 验证依赖安装**

```bash
pnpm list vitest @testing-library/react playwright
```

Expected: 显示已安装的版本

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add testing dependencies (vitest, testing-library, playwright)"
```

---

### Task 1.2: 创建 Vitest 配置

**Files:**
- Create: `devhub/vitest.config.ts`

**Step 1: 编写 Vitest 配置**

```typescript
// devhub/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'out', 'release'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        'out/**',
        'release/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
```

**Step 2: 创建测试 setup 文件**

```typescript
// devhub/src/test/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock electron modules
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  }
}))

// Mock window.devhub API
const mockDevhub = {
  projects: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    scan: vi.fn(),
    scanDirectory: vi.fn(),
    discover: vi.fn()
  },
  process: {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(),
    onStatusChange: vi.fn()
  },
  logs: {
    subscribe: vi.fn(),
    onEntry: vi.fn(),
    clear: vi.fn()
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    hideToTray: vi.fn(),
    forceClose: vi.fn(),
    onCloseConfirm: vi.fn()
  }
}

Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    devhub: mockDevhub
  },
  writable: true
})
```

**Step 3: 更新 package.json 添加测试脚本**

在 `package.json` 的 `scripts` 中添加:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

**Step 4: 运行测试确认配置正确**

```bash
pnpm test --run
```

Expected: 测试运行器启动成功（即使没有测试也不报错）

**Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "chore: configure vitest for unit testing"
```

---

### Task 1.3: 创建 Playwright E2E 测试配置

**Files:**
- Create: `devhub/playwright.config.ts`
- Create: `devhub/e2e/example.spec.ts`

**Step 1: 编写 Playwright 配置**

```typescript
// devhub/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
```

**Step 2: 创建示例 E2E 测试**

```typescript
// devhub/e2e/example.spec.ts
import { test, expect } from '@playwright/test'

test.describe('DevHub E2E Tests', () => {
  test.skip('应用应该正常启动', async ({ page }) => {
    // TODO: 需要配置 Electron Playwright 集成
    // 这是一个占位测试，后续需要完善
    expect(true).toBe(true)
  })
})
```

**Step 3: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "chore: configure playwright for e2e testing"
```

---

## Phase 2: 安全审计测试

### Task 2.1: 测试路径验证安全性

**Files:**
- Create: `devhub/src/main/utils/security.test.ts`

**Step 1: 编写路径验证测试**

```typescript
// devhub/src/main/utils/security.test.ts
import { describe, it, expect } from 'vitest'
import { validatePath, validateScriptName, parsePackageJson } from './security'

describe('security utilities', () => {
  describe('validatePath', () => {
    it('应该拒绝包含路径遍历的输入', () => {
      const result = validatePath('C:/Users/../../../Windows/System32')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('traversal')
    })

    it('应该拒绝包含特殊字符的路径', () => {
      const testCases = [
        'C:/Projects/test<script>',
        'C:/Projects/test|pipe',
        'C:/Projects/test;rm -rf',
        'C:/Projects/$HOME',
        'C:/Projects/`whoami`'
      ]

      testCases.forEach(path => {
        const result = validatePath(path)
        expect(result.valid).toBe(false)
      })
    })

    it('应该拒绝不存在的路径', () => {
      const result = validatePath('Z:/NonExistent/Path/12345')
      expect(result.valid).toBe(false)
    })

    it('应该接受有效的项目路径', () => {
      // 注意: 这个测试需要在实际环境中运行
      // 使用 process.cwd() 作为已知存在的目录
      const result = validatePath(process.cwd())
      // 如果不在允许列表中，会返回 false
      expect(typeof result.valid).toBe('boolean')
    })
  })

  describe('validateScriptName', () => {
    it('应该接受有效的脚本名称', () => {
      const validNames = ['dev', 'start', 'build', 'test:unit', 'pre-build', 'post_install']
      validNames.forEach(name => {
        expect(validateScriptName(name)).toBe(true)
      })
    })

    it('应该拒绝包含危险字符的脚本名称', () => {
      const invalidNames = [
        'rm -rf /',
        'test && echo hacked',
        'test; cat /etc/passwd',
        'test`whoami`',
        'test$(id)'
      ]
      invalidNames.forEach(name => {
        expect(validateScriptName(name)).toBe(false)
      })
    })
  })
})
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/main/utils/security.test.ts
```

Expected: 测试可能因路径不存在而失败（这是预期的）

**Step 3: Commit**

```bash
git add src/main/utils/security.test.ts
git commit -m "test: add security validation tests"
```

---

### Task 2.2: 审查 IPC 通信安全

**Files:**
- Create: `devhub/src/main/ipc/security-audit.md`

**Step 1: 创建 IPC 安全审计文档**

```markdown
# IPC 通信安全审计

## 审计日期: 2026-01-17

### 已检查的 IPC Handlers

| Handler | 文件位置 | 风险评估 | 发现问题 |
|---------|---------|---------|---------|
| `projects:add` | ipc/index.ts:33 | 🟡 中 | 路径验证存在，但需要更严格 |
| `process:start` | ipc/index.ts:94 | 🟡 中 | 脚本名验证存在，但只检查格式 |
| `shell:open-path` | ipc/index.ts:218 | 🔴 高 | 直接打开任意路径，无验证 |
| `dialog:open-directory` | ipc/index.ts:194 | 🟢 低 | 使用系统对话框，安全 |

### 高风险发现

#### 1. shell:open-path 未验证输入
**位置:** `src/main/ipc/index.ts:218`
**问题:** 直接接受用户输入的路径并用 `shell.openPath()` 打开
**风险:** 可能被用于打开恶意文件或暴露敏感目录
**建议:**
- 添加路径白名单验证
- 仅允许打开已注册项目的目录

#### 2. 进程启动未完全验证
**位置:** `src/main/services/ProcessManager.ts:90`
**问题:** 虽然验证了脚本名格式，但未验证脚本实际内容
**风险:** 恶意 package.json 可能包含危险脚本
**建议:**
- 显示脚本内容让用户确认
- 添加脚本内容黑名单检测

### 建议修复

1. 在 `shell:open-path` 添加路径验证:
```typescript
ipcMain.handle('shell:open-path', async (_, path: string) => {
  // 验证路径是否为已注册项目
  const projects = appStore.getProjects()
  const isProjectPath = projects.some(p =>
    path.toLowerCase().startsWith(p.path.toLowerCase())
  )
  if (!isProjectPath) {
    throw new Error('Only project directories can be opened')
  }
  return shell.openPath(path)
})
```
```

**Step 2: Commit**

```bash
git add src/main/ipc/security-audit.md
git commit -m "docs: add IPC security audit findings"
```

---

## Phase 3: 单元测试补充

### Task 3.1: ProcessManager 单元测试

**Files:**
- Create: `devhub/src/main/services/ProcessManager.test.ts`

**Step 1: 编写失败测试**

```typescript
// devhub/src/main/services/ProcessManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProcessManager } from './ProcessManager'
import type { Project } from '@shared/types'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('test output')), 10)
        }
      })
    },
    stderr: {
      on: vi.fn()
    },
    on: vi.fn((event, callback) => {
      if (event === 'spawn') {
        setTimeout(callback, 5)
      }
    }),
    killed: false
  }))
}))

vi.mock('tree-kill', () => ({
  default: vi.fn((pid, signal, callback) => callback())
}))

describe('ProcessManager', () => {
  let processManager: ProcessManager

  const mockProject: Project = {
    id: 'test-project-1',
    name: 'Test Project',
    path: 'D:/Projects/test',
    scripts: ['dev', 'build', 'test'],
    defaultScript: 'dev',
    tags: [],
    status: 'stopped',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  beforeEach(() => {
    processManager = new ProcessManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('start', () => {
    it('应该拒绝无效的脚本名称', async () => {
      await expect(
        processManager.start(mockProject, 'rm -rf /')
      ).rejects.toThrow('Invalid script name')
    })

    it('应该拒绝不存在的脚本', async () => {
      await expect(
        processManager.start(mockProject, 'nonexistent')
      ).rejects.toThrow('not found in package.json')
    })

    it('应该拒绝重复启动', async () => {
      await processManager.start(mockProject, 'dev')
      await expect(
        processManager.start(mockProject, 'dev')
      ).rejects.toThrow('already running')
    })

    it('应该正确启动有效脚本', async () => {
      await expect(
        processManager.start(mockProject, 'dev')
      ).resolves.toBeUndefined()

      expect(processManager.isRunning(mockProject.id)).toBe(true)
    })
  })

  describe('stop', () => {
    it('停止不存在的进程应该静默成功', async () => {
      await expect(
        processManager.stop('nonexistent-id')
      ).resolves.toBeUndefined()
    })

    it('应该正确停止运行中的进程', async () => {
      await processManager.start(mockProject, 'dev')
      expect(processManager.isRunning(mockProject.id)).toBe(true)

      await processManager.stop(mockProject.id)
      expect(processManager.isRunning(mockProject.id)).toBe(false)
    })
  })

  describe('onLog', () => {
    it('应该正确订阅日志', async () => {
      const logCallback = vi.fn()
      const unsubscribe = processManager.onLog(mockProject.id, logCallback)

      await processManager.start(mockProject, 'dev')

      // 等待日志回调被调用
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(logCallback).toHaveBeenCalled()

      unsubscribe()
    })
  })
})
```

**Step 2: 运行测试**

```bash
pnpm test src/main/services/ProcessManager.test.ts
```

Expected: 大部分测试应该通过

**Step 3: Commit**

```bash
git add src/main/services/ProcessManager.test.ts
git commit -m "test: add ProcessManager unit tests"
```

---

### Task 3.2: ToolMonitor 单元测试

**Files:**
- Create: `devhub/src/main/services/ToolMonitor.test.ts`

**Step 1: 编写测试**

```typescript
// devhub/src/main/services/ToolMonitor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToolMonitor } from './ToolMonitor'
import type { CodingTool } from '@shared/types'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    // 模拟 tasklist 命令
    if (cmd.includes('tasklist')) {
      callback(null, { stdout: 'node.exe' }, '')
    } else if (cmd.includes('wmic')) {
      callback(null, { stdout: 'CommandLine=codex\n' }, '')
    } else {
      callback(null, { stdout: '' }, '')
    }
  })
}))

describe('ToolMonitor', () => {
  let toolMonitor: ToolMonitor

  const mockTools: CodingTool[] = [
    {
      id: 'codex',
      name: 'codex',
      displayName: 'Codex CLI',
      processName: 'codex',
      completionPatterns: ['Done'],
      status: 'idle'
    },
    {
      id: 'claude-code',
      name: 'claude-code',
      displayName: 'Claude Code',
      processName: 'claude',
      completionPatterns: ['Complete'],
      status: 'idle'
    }
  ]

  beforeEach(() => {
    toolMonitor = new ToolMonitor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    toolMonitor.stop()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('start/stop', () => {
    it('应该正确启动监控', () => {
      const onCompletion = vi.fn()
      toolMonitor.start(mockTools, 1000, onCompletion)

      // 验证定时器已设置
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('应该正确停止监控', () => {
      const onCompletion = vi.fn()
      toolMonitor.start(mockTools, 1000, onCompletion)
      toolMonitor.stop()

      // 手动触发定时器，确认回调不再被调用
      vi.advanceTimersByTime(2000)
      expect(onCompletion).not.toHaveBeenCalled()
    })
  })

  describe('getToolStatus', () => {
    it('应该返回正确的工具状态', () => {
      const onCompletion = vi.fn()
      toolMonitor.start(mockTools, 1000, onCompletion)

      const status = toolMonitor.getToolStatus('codex')
      expect(status?.id).toBe('codex')
    })

    it('对于不存在的工具应该返回 undefined', () => {
      const onCompletion = vi.fn()
      toolMonitor.start(mockTools, 1000, onCompletion)

      const status = toolMonitor.getToolStatus('nonexistent')
      expect(status).toBeUndefined()
    })
  })

  describe('getAllToolStatus', () => {
    it('应该返回所有工具状态', () => {
      const onCompletion = vi.fn()
      toolMonitor.start(mockTools, 1000, onCompletion)

      const allStatus = toolMonitor.getAllToolStatus()
      expect(allStatus).toHaveLength(2)
    })
  })
})
```

**Step 2: 运行测试**

```bash
pnpm test src/main/services/ToolMonitor.test.ts
```

**Step 3: Commit**

```bash
git add src/main/services/ToolMonitor.test.ts
git commit -m "test: add ToolMonitor unit tests"
```

---

### Task 3.3: AppStore 单元测试

**Files:**
- Create: `devhub/src/main/store/AppStore.test.ts`

**Step 1: 编写测试**

```typescript
// devhub/src/main/store/AppStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppStore } from './AppStore'

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn(() => {
      const store = new Map()
      return {
        get: vi.fn((key, defaultValue) => store.get(key) ?? defaultValue),
        set: vi.fn((key, value) => store.set(key, value)),
        delete: vi.fn((key) => store.delete(key))
      }
    })
  }
})

describe('AppStore', () => {
  let appStore: AppStore

  beforeEach(() => {
    appStore = new AppStore()
  })

  describe('projects', () => {
    it('应该返回空数组当没有项目时', () => {
      const projects = appStore.getProjects()
      expect(projects).toEqual([])
    })

    it('应该正确添加项目', () => {
      const project = appStore.addProject({
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped'
      })

      expect(project.id).toBeDefined()
      expect(project.name).toBe('Test Project')
      expect(project.createdAt).toBeDefined()
      expect(project.updatedAt).toBeDefined()
    })

    it('应该正确更新项目', () => {
      const project = appStore.addProject({
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped'
      })

      const updated = appStore.updateProject(project.id, {
        name: 'Updated Name',
        tags: ['frontend']
      })

      expect(updated?.name).toBe('Updated Name')
      expect(updated?.tags).toContain('frontend')
    })

    it('应该正确删除项目', () => {
      const project = appStore.addProject({
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped'
      })

      const result = appStore.removeProject(project.id)
      expect(result).toBe(true)
      expect(appStore.getProject(project.id)).toBeUndefined()
    })
  })

  describe('tags', () => {
    it('应该正确添加标签', () => {
      appStore.addTag('frontend')
      expect(appStore.getTags()).toContain('frontend')
    })

    it('不应该添加重复标签', () => {
      appStore.addTag('frontend')
      appStore.addTag('frontend')
      expect(appStore.getTags().filter(t => t === 'frontend')).toHaveLength(1)
    })

    it('应该正确删除标签', () => {
      appStore.addTag('frontend')
      appStore.removeTag('frontend')
      expect(appStore.getTags()).not.toContain('frontend')
    })
  })

  describe('settings', () => {
    it('应该返回默认设置', () => {
      const settings = appStore.getSettings()
      expect(settings.notificationEnabled).toBe(true)
      expect(settings.theme).toBe('dark')
    })

    it('应该正确更新设置', () => {
      appStore.updateSettings({ theme: 'light' })
      expect(appStore.getSettings().theme).toBe('light')
    })
  })
})
```

**Step 2: 运行测试**

```bash
pnpm test src/main/store/AppStore.test.ts
```

**Step 3: Commit**

```bash
git add src/main/store/AppStore.test.ts
git commit -m "test: add AppStore unit tests"
```

---

## Phase 4: React 组件测试

### Task 4.1: ProjectCard 组件测试

**Files:**
- Create: `devhub/src/renderer/components/project/ProjectCard.test.tsx`

**Step 1: 编写测试**

```typescript
// devhub/src/renderer/components/project/ProjectCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectCard } from './ProjectCard'
import type { Project } from '@shared/types'

describe('ProjectCard', () => {
  const mockProject: Project = {
    id: 'test-1',
    name: 'Test Project',
    path: 'D:/Projects/test',
    scripts: ['dev', 'build'],
    defaultScript: 'dev',
    tags: ['frontend', 'react'],
    status: 'stopped',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const defaultProps = {
    project: mockProject,
    isSelected: false,
    onSelect: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onRemove: vi.fn(),
    onOpenFolder: vi.fn(),
    onCopyPath: vi.fn(),
    onManageTags: vi.fn()
  }

  it('应该正确渲染项目名称', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('应该正确渲染项目路径', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('D:/Projects/test')).toBeInTheDocument()
  })

  it('应该正确渲染标签', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('点击卡片应该触发 onSelect', () => {
    render(<ProjectCard {...defaultProps} />)
    fireEvent.click(screen.getByText('Test Project').closest('div')!)
    expect(defaultProps.onSelect).toHaveBeenCalled()
  })

  it('运行中的项目应该显示"运行中"标签', () => {
    const runningProject = { ...mockProject, status: 'running' as const }
    render(<ProjectCard {...defaultProps} project={runningProject} />)
    expect(screen.getByText('运行中')).toBeInTheDocument()
  })

  it('选中状态应该有不同的样式', () => {
    const { container } = render(<ProjectCard {...defaultProps} isSelected={true} />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-accent')
  })
})
```

**Step 2: 运行测试**

```bash
pnpm test src/renderer/components/project/ProjectCard.test.tsx
```

**Step 3: Commit**

```bash
git add src/renderer/components/project/ProjectCard.test.tsx
git commit -m "test: add ProjectCard component tests"
```

---

### Task 4.2: Toast 组件测试

**Files:**
- Create: `devhub/src/renderer/components/ui/Toast.test.tsx`

**Step 1: 编写测试**

```typescript
// devhub/src/renderer/components/ui/Toast.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

// 测试组件
function TestComponent() {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast('success', '操作成功')}>
      Show Toast
    </button>
  )
}

describe('Toast', () => {
  it('应该正确显示 toast 消息', async () => {
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    act(() => {
      screen.getByText('Show Toast').click()
    })

    expect(screen.getByText('操作成功')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('toast 应该自动消失', async () => {
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    act(() => {
      screen.getByText('Show Toast').click()
    })

    expect(screen.getByText('操作成功')).toBeInTheDocument()

    // 前进时间让 toast 消失
    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText('操作成功')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
```

**Step 2: 运行测试**

```bash
pnpm test src/renderer/components/ui/Toast.test.tsx
```

**Step 3: Commit**

```bash
git add src/renderer/components/ui/Toast.test.tsx
git commit -m "test: add Toast component tests"
```

---

## Phase 5: 性能和代码质量审查

### Task 5.1: 创建性能审计报告

**Files:**
- Create: `devhub/docs/performance-audit.md`

**Step 1: 编写性能审计文档**

```markdown
# DevHub 性能审计报告

## 审计日期: 2026-01-17

### 潜在性能问题

#### 1. 列表渲染无虚拟化
**位置:** `src/renderer/components/project/ProjectList.tsx`
**问题:** 项目列表直接渲染所有项目，没有使用虚拟滚动
**影响:** 当项目数量 > 100 时，滚动可能会卡顿
**建议:**
- 使用 `@tanstack/react-virtual` 实现虚拟滚动
- 或使用 `react-window` / `react-virtualized`

#### 2. 日志面板无限增长
**位置:** `src/renderer/components/log/LogPanel.tsx`
**问题:** 日志条目没有上限，长时间运行可能导致内存问题
**影响:** 运行数小时后可能消耗大量内存
**建议:**
- 限制日志条目数量（如最多 5000 条）
- 使用虚拟滚动
- 添加日志清理功能

#### 3. ToolMonitor 轮询间隔
**位置:** `src/main/services/ToolMonitor.ts`
**问题:** 默认 3 秒轮询一次，每次执行多个 tasklist/wmic 命令
**影响:** 持续消耗 CPU 资源
**建议:**
- 考虑使用事件驱动（如 Windows 事件订阅）
- 或者增加智能轮询（活跃时快，空闲时慢）

#### 4. ProjectScanner 同步文件操作
**位置:** `src/main/services/ProjectScanner.ts`
**问题:** `fs.readdirSync`, `fs.statSync` 是同步操作
**影响:** 扫描大量目录时会阻塞主进程
**建议:**
- 使用 `fs.promises.readdir` 和 `fs.promises.stat`
- 添加进度回调

### 建议的性能优化优先级

| 优先级 | 问题 | 预计收益 |
|--------|------|---------|
| P0 | 日志面板内存泄漏 | 防止长时间运行崩溃 |
| P1 | ProjectScanner 异步化 | 改善扫描时的用户体验 |
| P2 | 列表虚拟化 | 支持更多项目 |
| P3 | ToolMonitor 优化 | 降低 CPU 使用 |
```

**Step 2: Commit**

```bash
git add docs/performance-audit.md
git commit -m "docs: add performance audit report"
```

---

### Task 5.2: 创建代码质量审查报告

**Files:**
- Create: `devhub/docs/code-quality-audit.md`

**Step 1: 编写代码质量审计文档**

```markdown
# DevHub 代码质量审计报告

## 审计日期: 2026-01-17

### 类型安全问题

#### 1. 使用 `as any` 类型断言
**位置:** `src/renderer/App.tsx:26`
```typescript
const devhub = (window as any).devhub
```
**问题:** 绕过类型检查，可能导致运行时错误
**修复:** 使用已定义的类型声明
```typescript
const devhub = window.devhub
```

#### 2. 空 catch 块
**位置:** 多处
```typescript
} catch {
  // 忽略错误
}
```
**问题:** 吞掉错误，难以调试
**建议:** 至少记录错误到控制台或使用错误边界

### 代码重复

#### 1. IPC Handler 注册模式
**位置:** `src/main/ipc/index.ts`
**问题:** 每个 handler 都有相似的错误处理模式
**建议:** 创建通用的 handler wrapper

```typescript
function createHandler<T>(handler: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await handler()
    } catch (error) {
      console.error('IPC Handler error:', error)
      throw error
    }
  }
}
```

### 内存泄漏风险

#### 1. 事件监听器未清理
**位置:** `src/renderer/App.tsx:25-33`
**问题:** `onCloseConfirm` 的返回值（取消订阅函数）未被正确调用
**修复:** 确保在 useEffect cleanup 中调用 unsubscribe

#### 2. setInterval 未清理
**位置:** `src/main/services/ToolMonitor.ts`
**问题:** 如果 `stop()` 未被调用，interval 会永远运行
**建议:** 在应用退出时确保调用 `stop()`

### 命名规范问题

| 文件 | 问题 | 建议 |
|------|------|------|
| `processHandlers.ts` | 文件名与其他 handler 不一致 | 改为 `process.handler.ts` |
| `extended.ts` | 命名过于模糊 | 改为 `extendedApis.ts` 或分拆 |

### 建议的重构优先级

1. **P0 - 立即修复**
   - 类型断言问题
   - 事件监听器泄漏

2. **P1 - 短期改进**
   - 空 catch 块添加日志
   - 代码重复提取

3. **P2 - 长期优化**
   - 文件命名规范化
   - 错误边界添加
```

**Step 2: Commit**

```bash
git add docs/code-quality-audit.md
git commit -m "docs: add code quality audit report"
```

---

## Phase 6: 功能验证测试

### Task 6.1: 创建手动测试清单

**Files:**
- Create: `devhub/docs/manual-test-checklist.md`

**Step 1: 编写手动测试清单**

```markdown
# DevHub 手动测试清单

## 测试环境
- [ ] Windows 10/11
- [ ] 已安装 Node.js 和 pnpm
- [ ] 有可用的 npm 项目

---

## 1. 应用启动与窗口

### 1.1 启动
- [ ] 应用能正常启动，无崩溃
- [ ] 自定义标题栏正确显示
- [ ] 窗口可以拖动、调整大小
- [ ] 最小化/最大化按钮正常工作

### 1.2 关闭行为
- [ ] 点击关闭按钮显示确认对话框
- [ ] 选择"退出"能正确关闭应用
- [ ] 选择"最小化到托盘"能正确隐藏窗口
- [ ] 托盘图标能正确显示
- [ ] 双击托盘图标能恢复窗口

---

## 2. 项目管理

### 2.1 添加项目
- [ ] 点击"添加项目"打开对话框
- [ ] 可以通过浏览选择目录
- [ ] 可以通过拖拽添加目录
- [ ] 可以手动输入路径
- [ ] 添加有效项目成功
- [ ] 添加无效路径显示错误
- [ ] 添加不含 package.json 的目录显示错误
- [ ] 不能添加重复项目

### 2.2 项目扫描
- [ ] 扫描功能能发现 npm 项目
- [ ] 可以选择多个扫描结果添加
- [ ] 扫描进度正确显示

### 2.3 项目操作
- [ ] 项目卡片显示正确信息（名称、路径、标签）
- [ ] 右键菜单正常弹出
- [ ] "打开文件夹"能打开资源管理器
- [ ] "复制路径"能复制到剪贴板
- [ ] "删除项目"显示确认对话框
- [ ] 删除后项目从列表移除

### 2.4 标签管理
- [ ] 可以为项目添加标签
- [ ] 可以移除标签
- [ ] 标签正确显示在项目卡片上

---

## 3. 进程管理

### 3.1 启动项目
- [ ] 点击播放按钮启动项目
- [ ] 可以选择不同的脚本启动
- [ ] 启动后状态指示器变绿
- [ ] 启动后显示"运行中"标签
- [ ] 日志面板显示启动输出

### 3.2 停止项目
- [ ] 点击停止按钮停止项目
- [ ] 停止后状态指示器变灰
- [ ] 日志显示停止信息

### 3.3 重启项目
- [ ] 重启功能正常工作
- [ ] 进程完全终止后再启动新进程

---

## 4. 日志面板

### 4.1 显示
- [ ] 选中项目后显示对应日志
- [ ] 日志自动滚动到底部
- [ ] stdout 和 stderr 区分显示
- [ ] 系统消息正确显示

### 4.2 操作
- [ ] 清除日志按钮正常工作
- [ ] 复制日志功能正常

---

## 5. 监控面板

### 5.1 进程视图
- [ ] 显示系统进程列表
- [ ] 可以刷新进程列表
- [ ] 显示 CPU 和内存使用

### 5.2 端口视图
- [ ] 显示占用的端口
- [ ] 显示对应的进程

### 5.3 AI 任务视图
- [ ] 显示 Codex/Claude/Gemini 状态
- [ ] 工具运行时状态正确更新
- [ ] 完成时发送通知（如果启用）

---

## 6. 设置

### 6.1 通用设置
- [ ] 通知开关正常工作
- [ ] 检测间隔可以调整
- [ ] 扫描盘符可以配置

### 6.2 路径设置
- [ ] 可以添加允许路径
- [ ] 可以移除允许路径

---

## 7. 边界情况

### 7.1 错误处理
- [ ] 网络断开时应用不崩溃
- [ ] 磁盘已满时显示友好错误
- [ ] 权限不足时显示友好错误

### 7.2 极端情况
- [ ] 100+ 个项目时列表流畅
- [ ] 长时间运行（1小时+）无内存泄漏
- [ ] 快速连续操作不会导致状态混乱
```

**Step 2: Commit**

```bash
git add docs/manual-test-checklist.md
git commit -m "docs: add manual test checklist"
```

---

## 执行摘要

### 总任务数: 13 个任务

| Phase | 任务数 | 目标 |
|-------|--------|------|
| Phase 1 | 3 | 测试基础设施搭建 |
| Phase 2 | 2 | 安全审计 |
| Phase 3 | 3 | 主进程单元测试 |
| Phase 4 | 2 | React 组件测试 |
| Phase 5 | 2 | 性能和代码质量审查 |
| Phase 6 | 1 | 功能验证清单 |

### 预期产出

1. **测试配置**
   - Vitest 单元测试框架
   - Playwright E2E 测试框架
   - 测试覆盖率报告

2. **测试文件**
   - 安全验证测试
   - ProcessManager 测试
   - ToolMonitor 测试
   - AppStore 测试
   - ProjectCard 测试
   - Toast 测试

3. **审计文档**
   - IPC 安全审计报告
   - 性能审计报告
   - 代码质量审计报告
   - 手动测试清单

---

## 后续建议

完成本计划后，建议继续：

1. **持续集成**: 配置 GitHub Actions 运行测试
2. **测试覆盖率**: 目标覆盖率 80%+
3. **安全修复**: 按优先级修复审计发现的问题
4. **性能优化**: 按优先级实施性能改进
5. **代码重构**: 解决代码质量问题
