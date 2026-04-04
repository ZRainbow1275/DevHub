# DevHub - 开发项目管理器

> 一个 Windows 原生桌面应用，用于可视化管理 npm 项目和编程工具终端

## 1. 项目概述

### 1.1 背景
开发者在日常工作中需要同时运行多个 npm 项目，并使用多个 PowerShell 窗口运行 Codex、Claude Code、Gemini CLI 等编程工具。这导致：
- 难以追踪哪些项目正在运行
- PowerShell 窗口杂乱无章
- 无法及时知道编程工具是否完成任务

### 1.2 目标
开发一个 Electron 桌面应用 **DevHub**，实现：
1. **npm 项目管理** - 可视化管理本地 npm 项目的启动/停止
2. **编程工具监控** - 检测 Codex/Claude Code/Gemini CLI 的运行状态
3. **Windows 通知** - 任务完成时发送系统通知

---

## 2. 功能需求

### 2.1 npm 项目管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 项目录入 | 支持拖拽目录、浏览选择、手动输入路径 | P0 |
| 项目扫描 | 自动检测目录下的 package.json | P0 |
| 一键启停 | 启动/停止 npm 脚本（dev、start 等） | P0 |
| 日志查看 | 实时显示项目控制台输出 | P0 |
| 状态监控 | 显示运行状态（运行中/已停止/错误） | P0 |
| 标签分组 | 为项目添加标签，按标签分组显示 | P1 |
| 批量操作 | 按分组批量启动/停止项目 | P1 |
| 端口检测 | 显示项目占用的端口号 | P2 |

### 2.2 编程工具监控

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 进程检测 | 检测 codex/claude/gemini 进程状态 | P0 |
| 完成检测 | 检测工具是否完成任务（进程退出/输出特征） | P0 |
| Windows 通知 | 任务完成时发送系统通知 | P0 |
| 历史记录 | 记录工具运行历史和耗时 | P2 |

### 2.3 安全与权限

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 路径验证 | 验证项目路径合法性，防止路径注入 | P0 |
| 命令过滤 | 只允许执行预定义的 npm 脚本 | P0 |
| 进程隔离 | 子进程独立运行，崩溃不影响主进程 | P0 |
| 配置加密 | 敏感配置使用加密存储 | P1 |

---

## 3. 技术架构

### 3.1 技术栈

```
┌─────────────────────────────────────────────────────────┐
│                     DevHub Desktop                       │
├─────────────────────────────────────────────────────────┤
│  Frontend (Renderer Process)                            │
│  ┌─────────────────────────────────────────────────────┐│
│  │  React 18 + TypeScript + Tailwind CSS               ││
│  │  - 项目列表视图                                      ││
│  │  - 日志面板                                          ││
│  │  - 设置界面                                          ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  IPC Bridge (Electron IPC)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │  contextBridge + ipcRenderer/ipcMain                ││
│  │  - 安全的进程间通信                                  ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  Backend (Main Process)                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Node.js + child_process                            ││
│  │  - 进程管理器                                        ││
│  │  - 文件系统操作                                      ││
│  │  - Windows 通知                                      ││
│  │  - 配置持久化 (electron-store)                       ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
devhub/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口文件
│   │   ├── ipc/                 # IPC 处理器
│   │   │   ├── project.ipc.ts   # 项目管理 IPC
│   │   │   ├── process.ipc.ts   # 进程管理 IPC
│   │   │   └── notification.ipc.ts
│   │   ├── services/            # 业务服务
│   │   │   ├── ProjectManager.ts
│   │   │   ├── ProcessManager.ts
│   │   │   ├── ToolMonitor.ts   # 编程工具监控
│   │   │   └── NotificationService.ts
│   │   ├── utils/               # 工具函数
│   │   │   ├── security.ts      # 安全相关
│   │   │   └── path.ts          # 路径处理
│   │   └── store/               # 数据持久化
│   │       └── config.ts
│   │
│   ├── renderer/                # React 前端
│   │   ├── App.tsx
│   │   ├── components/          # UI 组件
│   │   │   ├── ProjectList/
│   │   │   ├── LogPanel/
│   │   │   ├── TagManager/
│   │   │   └── ToolMonitor/
│   │   ├── hooks/               # 自定义 hooks
│   │   ├── stores/              # Zustand 状态管理
│   │   └── styles/              # Tailwind 样式
│   │
│   ├── preload/                 # 预加载脚本
│   │   └── index.ts
│   │
│   └── shared/                  # 共享类型定义
│       └── types.ts
│
├── electron-builder.json        # 打包配置
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 3.3 核心数据结构

```typescript
// 项目定义
interface Project {
  id: string;                    // 唯一 ID
  name: string;                  // 项目名称
  path: string;                  // 项目路径
  scripts: string[];             // 可用脚本列表
  defaultScript: string;         // 默认启动脚本
  tags: string[];                // 标签列表
  group?: string;                // 所属分组
  status: 'stopped' | 'running' | 'error';
  port?: number;                 // 占用端口
  pid?: number;                  // 进程 ID
  createdAt: number;
  updatedAt: number;
}

// 编程工具定义
interface CodingTool {
  id: string;
  name: 'codex' | 'claude-code' | 'gemini-cli' | 'custom';
  processName: string;           // 进程名称（用于检测）
  completionPatterns: string[];  // 完成检测的输出特征
  status: 'idle' | 'running' | 'completed';
  lastRunAt?: number;
  lastCompletedAt?: number;
}

// 配置
interface AppConfig {
  projects: Project[];
  tools: CodingTool[];
  tags: string[];
  groups: string[];
  settings: {
    autoStartOnBoot: boolean;
    minimizeToTray: boolean;
    notificationEnabled: boolean;
    checkInterval: number;       // 检测间隔（ms）
  };
}
```

---

## 4. 安全设计

### 4.1 路径安全

```typescript
// 路径白名单验证
const ALLOWED_ROOTS = [
  process.env.USERPROFILE,
  'C:\\Projects',
  'D:\\Projects',
  // 用户可配置的白名单
];

function validatePath(inputPath: string): boolean {
  const normalized = path.normalize(inputPath);

  // 防止路径遍历攻击
  if (normalized.includes('..')) return false;

  // 检查是否在允许的根目录下
  return ALLOWED_ROOTS.some(root =>
    normalized.startsWith(path.normalize(root))
  );
}
```

### 4.2 命令安全

```typescript
// 只允许执行 package.json 中定义的脚本
const ALLOWED_COMMANDS = ['npm', 'pnpm', 'yarn', 'bun'];

function executeScript(project: Project, script: string): ChildProcess {
  // 验证脚本存在于 package.json
  if (!project.scripts.includes(script)) {
    throw new SecurityError('Script not in package.json');
  }

  // 使用 spawn 而非 exec，避免 shell 注入
  return spawn('npm', ['run', script], {
    cwd: project.path,
    shell: false,  // 重要：禁用 shell
    env: { ...process.env, NODE_ENV: 'development' }
  });
}
```

### 4.3 IPC 安全

```typescript
// preload.ts - 只暴露必要的 API
contextBridge.exposeInMainWorld('devhub', {
  // 项目管理（只读操作）
  getProjects: () => ipcRenderer.invoke('projects:list'),
  getProject: (id: string) => ipcRenderer.invoke('projects:get', id),

  // 项目管理（写操作，需验证）
  addProject: (path: string) => ipcRenderer.invoke('projects:add', path),
  removeProject: (id: string) => ipcRenderer.invoke('projects:remove', id),

  // 进程管理
  startProject: (id: string, script: string) =>
    ipcRenderer.invoke('process:start', id, script),
  stopProject: (id: string) =>
    ipcRenderer.invoke('process:stop', id),

  // 日志订阅
  onLog: (callback: (log: LogEntry) => void) =>
    ipcRenderer.on('log:entry', (_, log) => callback(log)),

  // 通知
  onToolComplete: (callback: (tool: CodingTool) => void) =>
    ipcRenderer.on('tool:complete', (_, tool) => callback(tool)),
});
```

---

## 5. 编程工具检测策略

### 5.1 检测方式

| 工具 | 进程名 | 完成检测方式 |
|------|--------|--------------|
| Codex CLI | `codex` | 进程退出 + 输出包含 "Done" |
| Claude Code | `claude` | 进程退出 + 输出包含特定模式 |
| Gemini CLI | `gemini` | 进程退出 |

### 5.2 检测实现

```typescript
class ToolMonitor {
  private intervals: Map<string, NodeJS.Timer> = new Map();

  startMonitoring(tool: CodingTool) {
    const interval = setInterval(async () => {
      const isRunning = await this.isProcessRunning(tool.processName);

      if (tool.status === 'running' && !isRunning) {
        // 进程从运行变为停止 = 完成
        tool.status = 'completed';
        this.sendNotification(tool);
      } else if (isRunning) {
        tool.status = 'running';
      }
    }, config.settings.checkInterval);

    this.intervals.set(tool.id, interval);
  }

  private async isProcessRunning(name: string): Promise<boolean> {
    // Windows: tasklist 命令
    const result = await execPromise(
      `tasklist /FI "IMAGENAME eq ${name}.exe" /NH`
    );
    return result.stdout.includes(name);
  }

  private sendNotification(tool: CodingTool) {
    new Notification({
      title: 'DevHub',
      body: `${tool.name} 任务已完成`,
      icon: path.join(__dirname, 'assets/icon.png')
    }).show();
  }
}
```

---

## 6. UI 设计

### 6.1 主界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  DevHub                                            _ □ ✕        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────────────────────────────────┐ │
│  │  侧边栏      │  │  项目列表 / 日志面板                       │ │
│  │             │  │                                           │ │
│  │  📁 全部项目  │  │  ┌─────────────────────────────────────┐  │ │
│  │  🏷️ 前端     │  │  │ [▶] my-react-app     :3000  运行中   │  │ │
│  │  🏷️ 后端     │  │  │ [■] my-api-server    :8080  已停止   │  │ │
│  │  🏷️ 工具     │  │  │ [▶] admin-dashboard  :4000  运行中   │  │ │
│  │             │  │  └─────────────────────────────────────┘  │ │
│  │  ─────────  │  │                                           │ │
│  │  🔧 工具监控  │  │  ┌─────────────────────────────────────┐  │ │
│  │  ⚙️ 设置     │  │  │ 日志输出                              │  │ │
│  │             │  │  │ > Starting development server...      │  │ │
│  │             │  │  │ > Compiled successfully!              │  │ │
│  └─────────────┘  │  └─────────────────────────────────────┘  │ │
│                   └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  🟢 Codex: 空闲  │  🟡 Claude: 运行中  │  🟢 Gemini: 空闲      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 交互设计

- **添加项目**: 拖拽目录到窗口 / 点击 "+" 按钮浏览选择
- **启动项目**: 点击项目行的播放按钮，或右键菜单选择脚本
- **查看日志**: 点击项目行展开日志面板
- **标签管理**: 右键项目 → 编辑标签
- **批量操作**: 选中分组 → 右键批量启动/停止

---

## 7. 开发计划

### Phase 1: 基础框架 (MVP)
- [ ] Electron + React + TypeScript 项目初始化
- [ ] 基础 IPC 通信架构
- [ ] 项目录入与列表显示
- [ ] 单项目启动/停止

### Phase 2: 核心功能
- [ ] 日志实时显示
- [ ] 标签与分组管理
- [ ] 批量操作
- [ ] 配置持久化

### Phase 3: 工具监控
- [ ] 编程工具进程检测
- [ ] 完成状态检测
- [ ] Windows 通知集成

### Phase 4: 优化与打包
- [ ] UI 美化
- [ ] 性能优化
- [ ] electron-builder 打包
- [ ] 自动更新支持

---

## 8. 依赖清单

```json
{
  "dependencies": {
    "electron-store": "^8.1.0",      // 配置持久化
    "uuid": "^9.0.0",                // ID 生成
    "tree-kill": "^1.2.2",           // 进程树终止
    "ps-list": "^8.1.1"              // 进程列表
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.15.0",
    "@types/react": "^18.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.4.0",
    "typescript": "^5.3.0"
  }
}
```
