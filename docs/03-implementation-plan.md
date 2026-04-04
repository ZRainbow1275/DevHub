# DevHub - 实施计划

> 基于多模型协作分析的 Step-by-Step 实施方案

---

## 1. 技术决策摘要

### 1.1 核心技术选型

| 领域 | 技术选择 | 理由 |
|------|----------|------|
| 框架 | Electron 28 + Vite | 最新稳定版，Vite 提供极速 HMR |
| 前端 | React 18 + TypeScript | 类型安全，生态丰富 |
| 状态管理 | Zustand | 轻量、无 boilerplate |
| 样式 | Tailwind CSS | 原子化 CSS，快速开发 |
| 持久化 | electron-store | 简单可靠，自动加密 |
| 进程管理 | child_process.spawn | 原生 Node.js，避免依赖 |
| 进程终止 | tree-kill | 可靠杀死进程树 |
| 通知 | Electron Notification | 原生 Windows 支持 |

### 1.2 关键技术方案

#### 进程管理
```typescript
// 使用 spawn + shell: false 避免命令注入
const proc = spawn('npm', ['run', script], {
  cwd: projectPath,
  shell: false,
  env: { ...process.env, FORCE_COLOR: '1' }
});

// 使用 tree-kill 确保干净退出
import kill from 'tree-kill';
kill(proc.pid, 'SIGTERM');
```

#### 编程工具检测
```typescript
// Windows tasklist 命令检测进程
async function isProcessRunning(name: string): Promise<boolean> {
  const { stdout } = await execPromise(
    `tasklist /FI "IMAGENAME eq ${name}.exe" /NH`
  );
  return stdout.toLowerCase().includes(name.toLowerCase());
}

// 轮询检测
setInterval(async () => {
  const codexRunning = await isProcessRunning('codex');
  const claudeRunning = await isProcessRunning('claude');
  const geminiRunning = await isProcessRunning('gemini');
  // 状态变化触发通知...
}, 3000);
```

#### IPC 安全架构
```typescript
// preload.ts - 最小化暴露 API
contextBridge.exposeInMainWorld('devhub', {
  // 读操作
  getProjects: () => ipcRenderer.invoke('projects:list'),

  // 写操作 - 主进程会验证所有参数
  addProject: (path: string) => ipcRenderer.invoke('projects:add', path),

  // 进程操作
  startProject: (id: string, script: string) =>
    ipcRenderer.invoke('process:start', id, script),
});

// main.ts - 严格验证
ipcMain.handle('projects:add', async (_, inputPath: string) => {
  // 1. 类型验证
  if (typeof inputPath !== 'string') throw new Error('Invalid path');

  // 2. 路径规范化
  const normalized = path.normalize(inputPath);

  // 3. 路径遍历检测
  if (normalized.includes('..')) throw new Error('Path traversal detected');

  // 4. 白名单验证
  if (!isAllowedPath(normalized)) throw new Error('Path not in whitelist');

  // 5. package.json 存在验证
  const pkgPath = path.join(normalized, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('Not a valid npm project');

  // 通过所有验证后添加项目
  return projectManager.addProject(normalized);
});
```

---

## 2. 项目结构

```
devhub/
├── package.json
├── electron-builder.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
│
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 入口
│   │   ├── window.ts                 # 窗口管理
│   │   ├── tray.ts                   # 系统托盘
│   │   │
│   │   ├── ipc/                      # IPC 处理器
│   │   │   ├── index.ts              # 注册所有处理器
│   │   │   ├── project.handler.ts    # 项目管理
│   │   │   ├── process.handler.ts    # 进程管理
│   │   │   └── settings.handler.ts   # 设置
│   │   │
│   │   ├── services/                 # 业务服务
│   │   │   ├── ProjectManager.ts     # 项目 CRUD
│   │   │   ├── ProcessManager.ts     # 进程启停
│   │   │   ├── ToolMonitor.ts        # 工具检测
│   │   │   └── NotificationService.ts
│   │   │
│   │   ├── store/                    # 数据持久化
│   │   │   └── AppStore.ts           # electron-store 封装
│   │   │
│   │   └── utils/                    # 工具函数
│   │       ├── security.ts           # 路径验证
│   │       ├── process.ts            # 进程工具
│   │       └── logger.ts             # 日志
│   │
│   ├── preload/                      # 预加载脚本
│   │   └── index.ts
│   │
│   ├── renderer/                     # React 前端
│   │   ├── index.html
│   │   ├── main.tsx                  # React 入口
│   │   ├── App.tsx                   # 主组件
│   │   │
│   │   ├── components/               # UI 组件
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TitleBar.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   │
│   │   │   ├── project/
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── AddProjectDialog.tsx
│   │   │   │   └── ProjectActions.tsx
│   │   │   │
│   │   │   ├── log/
│   │   │   │   ├── LogPanel.tsx
│   │   │   │   └── LogLine.tsx
│   │   │   │
│   │   │   ├── tag/
│   │   │   │   ├── TagManager.tsx
│   │   │   │   └── TagBadge.tsx
│   │   │   │
│   │   │   ├── tool/
│   │   │   │   ├── ToolMonitor.tsx
│   │   │   │   └── ToolStatus.tsx
│   │   │   │
│   │   │   └── ui/                   # 基础 UI 组件
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Dialog.tsx
│   │   │       └── Dropdown.tsx
│   │   │
│   │   ├── hooks/                    # 自定义 Hooks
│   │   │   ├── useProjects.ts
│   │   │   ├── useProcess.ts
│   │   │   ├── useLogs.ts
│   │   │   └── useToolStatus.ts
│   │   │
│   │   ├── stores/                   # Zustand Stores
│   │   │   ├── projectStore.ts
│   │   │   ├── logStore.ts
│   │   │   ├── toolStore.ts
│   │   │   └── settingsStore.ts
│   │   │
│   │   └── styles/
│   │       ├── globals.css           # Tailwind 入口
│   │       └── theme.css             # 构成主义主题变量
│   │
│   └── shared/                       # 共享类型
│       ├── types.ts                  # TypeScript 类型
│       └── constants.ts              # 常量
│
├── resources/                        # 静态资源
│   ├── icon.ico                      # Windows 图标
│   ├── icon.png                      # 通用图标
│   └── tray-icon.png                 # 托盘图标
│
└── scripts/                          # 构建脚本
    └── build.js
```

---

## 3. 开发阶段划分

### Phase 1: 基础框架 (Day 1-2)

**目标**: 搭建可运行的 Electron + React 项目骨架

**任务清单**:
- [ ] 初始化 Electron + Vite + React + TypeScript 项目
- [ ] 配置 Tailwind CSS 和构成主义主题
- [ ] 创建自定义标题栏（无边框窗口）
- [ ] 实现基础 IPC 通信架构
- [ ] 创建 electron-store 配置管理
- [ ] 实现系统托盘基础功能

**验收标准**:
- 应用可正常启动
- 自定义标题栏可拖拽
- 最小化到托盘正常工作

---

### Phase 2: 项目管理核心 (Day 3-4)

**目标**: 实现 npm 项目的添加、显示、启停

**任务清单**:
- [ ] ProjectManager 服务实现
  - 添加项目（路径验证 + package.json 解析）
  - 删除项目
  - 项目列表持久化
- [ ] ProcessManager 服务实现
  - 启动 npm 脚本
  - 停止进程（tree-kill）
  - 进程状态监控
- [ ] 项目列表 UI
  - ProjectCard 组件（构成主义设计）
  - 状态指示器
  - 启停按钮
- [ ] 添加项目对话框
  - 拖拽添加
  - 浏览选择
  - 手动输入

**验收标准**:
- 可添加有效的 npm 项目目录
- 无效目录会被拒绝并提示
- 可启动项目并看到"运行中"状态
- 可停止运行中的项目

---

### Phase 3: 日志与标签 (Day 5-6)

**目标**: 实现实时日志显示和标签分组功能

**任务清单**:
- [ ] 日志系统
  - LogPanel 组件（终端风格）
  - 实时日志流（IPC 事件）
  - 环形缓冲区（限制内存）
  - 虚拟滚动（性能优化）
- [ ] 标签管理
  - TagManager 组件
  - 为项目添加/移除标签
  - 按标签过滤项目列表
- [ ] 分组管理
  - 侧边栏分组导航
  - 批量启停操作

**验收标准**:
- 项目启动后日志实时滚动显示
- 可为项目添加多个标签
- 点击标签可过滤项目列表
- 批量启停功能正常

---

### Phase 4: 工具监控 (Day 7)

**目标**: 实现 Codex/Claude/Gemini 进程检测和完成通知

**任务清单**:
- [ ] ToolMonitor 服务
  - 进程检测（tasklist 命令）
  - 状态变化检测
  - 完成事件触发
- [ ] Windows 通知
  - Notification API 集成
  - 点击通知跳转
- [ ] ToolMonitor UI
  - 状态栏显示工具状态
  - 工具配置面板

**验收标准**:
- 状态栏正确显示工具运行状态
- 工具任务完成时弹出 Windows 通知
- 点击通知可聚焦应用窗口

---

### Phase 5: 优化与打包 (Day 8)

**目标**: 性能优化、UI 细化、打包发布

**任务清单**:
- [ ] 性能优化
  - React.memo 优化渲染
  - 日志虚拟滚动完善
  - 进程检测节流
- [ ] UI 完善
  - 动效实现（构成主义风格）
  - 响应式布局
  - 键盘快捷键
- [ ] 打包配置
  - electron-builder 配置
  - Windows 安装程序
  - 应用图标

**验收标准**:
- 管理 10+ 项目时 UI 流畅
- 安装程序可正常安装/卸载
- 应用图标正确显示

---

## 4. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 进程杀不干净 | 端口被占用 | 使用 tree-kill，失败时提示用户手动处理 |
| 日志量过大 | 内存溢出 | 环形缓冲区限制 + 虚拟滚动 |
| 工具检测误报 | 用户体验差 | 增加状态持续时间判断，避免闪烁 |
| 路径注入攻击 | 安全风险 | 严格路径验证 + 白名单机制 |

---

## 5. 依赖版本锁定

```json
{
  "dependencies": {
    "electron-store": "^8.1.0",
    "tree-kill": "^1.2.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "electron": "^28.1.0",
    "electron-builder": "^24.9.1",
    "electron-vite": "^2.0.0",
    "vite": "^5.0.10",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.7",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "typescript": "^5.3.3"
  }
}
```

---

## 6. 伪代码示例

### 6.1 ProcessManager 核心逻辑

```typescript
class ProcessManager {
  private processes = new Map<string, ChildProcess>();
  private logCallbacks = new Map<string, (line: string) => void>();

  async start(project: Project, script: string): Promise<void> {
    // 1. 验证脚本存在
    if (!project.scripts.includes(script)) {
      throw new Error(`Script "${script}" not found in package.json`);
    }

    // 2. 启动进程
    const proc = spawn('npm', ['run', script], {
      cwd: project.path,
      shell: false,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    // 3. 记录进程
    this.processes.set(project.id, proc);

    // 4. 日志转发
    proc.stdout?.on('data', (data) => {
      this.emitLog(project.id, data.toString());
    });

    proc.stderr?.on('data', (data) => {
      this.emitLog(project.id, data.toString());
    });

    // 5. 进程退出处理
    proc.on('exit', (code) => {
      this.processes.delete(project.id);
      this.emitStatusChange(project.id, 'stopped');
    });
  }

  async stop(projectId: string): Promise<void> {
    const proc = this.processes.get(projectId);
    if (!proc) return;

    return new Promise((resolve) => {
      kill(proc.pid!, 'SIGTERM', (err) => {
        this.processes.delete(projectId);
        resolve();
      });
    });
  }
}
```

### 6.2 ToolMonitor 核心逻辑

```typescript
class ToolMonitor {
  private previousStatus = new Map<string, boolean>();
  private interval: NodeJS.Timer | null = null;

  start(tools: CodingTool[], checkIntervalMs = 3000): void {
    this.interval = setInterval(async () => {
      for (const tool of tools) {
        const isRunning = await this.isProcessRunning(tool.processName);
        const wasRunning = this.previousStatus.get(tool.id) ?? false;

        // 从运行变为停止 = 任务完成
        if (wasRunning && !isRunning) {
          this.notifyCompletion(tool);
        }

        this.previousStatus.set(tool.id, isRunning);
      }
    }, checkIntervalMs);
  }

  private async isProcessRunning(name: string): Promise<boolean> {
    try {
      const { stdout } = await execPromise(
        `tasklist /FI "IMAGENAME eq ${name}.exe" /NH`,
        { windowsHide: true }
      );
      return stdout.toLowerCase().includes(name.toLowerCase());
    } catch {
      return false;
    }
  }

  private notifyCompletion(tool: CodingTool): void {
    new Notification({
      title: 'DevHub',
      body: `${tool.name} 任务已完成`,
      icon: path.join(__dirname, '../resources/icon.png')
    }).show();
  }
}
```

---

**Shall I proceed with this plan? (Y/N)**
