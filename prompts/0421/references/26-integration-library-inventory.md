# references/26 — 集成库清单与选型依据

> 目的：列出所有 spec 依赖的三方库及选型依据，避免"造轮子"
> 原则（CLAUDE.md）：在最大程度保留原本功能设计的基础上做集成，特别注意端口映射、模块匹配、数据模型一致性、权限控制

---

## 一、Runtime 稳定性层

| 需求 | 库 | 版本 | 选型依据 |
|------|-----|------|---------|
| tree-kill PowerShell child | `tree-kill` | ^1.2.2 | 事实标准，Electron 社区公认 |
| child_process promisify | Node builtin `util.promisify(execFile)` | - | 避免 execSync |
| AbortController | Node 16+ builtin | - | 原生支持 |
| Semaphore 并发控制 | `async-mutex` | ^0.5.0 | 轻量，API 简洁 |
| 指数退避 + Jitter | `p-retry` | ^6.2.0 | 可配置策略 |
| 结构化 logger | `pino` | ^9.0.0 | 高性能；已被社区广泛采用 |
| 日志切片 + 归档 | `pino-rotating-file` | - | 无依赖 |

## 二、IPC / 调度层

| 需求 | 库 | 备选 | 依据 |
|------|-----|------|------|
| 限流 bucket | 自建 `TokenBucket`（~60 LoC） | `bottleneck` | 避免引重量级包 |
| 批量合并 | 自建 `BroadcastBatcher` | - | 非公共需求，内部类足矣 |
| Schema 校验 | `zod` | `valibot`, `yup` | TypeScript 生态首选；已在项目使用 |

## 三、窗口操作（Win32）

| 需求 | 库 | 依据 |
|------|-----|------|
| FFI 调用 user32.dll | `koffi` | **首选**——active-maintain，koffi > node-ffi-napi（node-ffi 已不维护） |
| Windows API 类型定义 | `@types/node-ffi-napi` or 自建 | koffi 自带类型 |
| EnumWindows 枚举 | koffi 调 user32.EnumWindows | - |
| SetWindowPos / SetWindowText | koffi | - |
| 多显示器 DPI | `electron.screen.getAllDisplays()` | 内置 |
| 活跃窗口 hook | `active-win` | npm 成熟库 |
| 窗口标题替代方案 | `node-window-manager` | 备选 |

## 四、d3 / 拓扑 / 流程图

| 需求 | 库 | 依据 |
|------|-----|------|
| Force layout | `d3-force` (已用) | NeuralGraphEngine 基础 |
| React 图表层 | `@xyflow/react` (React Flow) | 备选 — 若决定重写 |
| 图布局算法 | `dagre` / `elkjs` | 层次图 / 大型图专用 |
| 画布虚拟化 | `@visx/visx` | 备选 |
| ResizeObserver hook | `use-resize-observer` | 成熟库 |

## 五、UI / UX 组件

| 需求 | 库 | 依据 |
|------|-----|------|
| Dropdown / Popover / Dialog / Tooltip | `@radix-ui/react-*` | **首选** — Headless + 可访问性 |
| 表单 / 复杂 UI | `shadcn/ui` | 基于 Radix，社区热 |
| 虚拟列表 | `@tanstack/react-virtual` | API 简洁 |
| Virtuoso | `react-virtuoso` | 备选 — 简单场景更快 |
| 动画 | `framer-motion` | 声明式 |
| 拖拽 | `@dnd-kit/core` | 现代替代 react-dnd |
| Resizable split pane | `react-resizable-panels` | 首选 |
| Command palette | `cmdk` | Raycast 开源版 |
| Markdown | `react-markdown` + `remark-gfm` | 已用 |
| Toast | `sonner` | Radix 风格 + 简洁 |

## 六、Icon / 品牌

| 需求 | 库 | 依据 |
|------|-----|------|
| 主 icon set | `lucide-react` | 已用 |
| 品牌 logo | `@icons-pack/react-simple-icons` | 3000+ logos |
| 自建品牌 | `brand-logos/*.svg` | spec/20 |

## 七、持久化

| 需求 | 库 | 依据 |
|------|-----|------|
| electron-store | `electron-store` | 已用 |
| Schema migration | 自建（在 Store.ts 中） | 简单需求 |
| 文件系统操作 | `fs-extra` | 已用 |
| 缓存 | `lru-cache` | 替代自建 BoundedCache（可选） |

## 八、AI 任务检测

| 需求 | 库 | 依据 |
|------|-----|------|
| State machine | `xstate` | **首选** — 工业级 FSM；spec/08 直接使用 |
| Rxjs-like 事件流 | 自建 `EventBus` + `rxjs`（可选） | - |
| 正则库 | Native | - |
| 进程 stdout 采集 | `node-pty` | 若需真正 PTY；当前设计不用 |

## 九、PowerShell / WMI

| 需求 | 库 | 依据 |
|------|-----|------|
| `execFileAsync` | `util.promisify(execFile)` | - |
| 备选 PowerShell client | `node-powershell` | 不建议 — 进程复用有泄漏史 |
| 推荐：**每次新进程** | `execFile('powershell.exe', ...)` | 干净简单 |

## 十、测试

| 需求 | 库 | 依据 |
|------|-----|------|
| 单元/集成测试 | `vitest` | 已用 |
| Electron E2E | `@playwright/test` + `electron` launch | 社区推荐 |
| Mock 文件系统 | `memfs` | 少量单测用 |
| 快照 | 内置 `expect(...).toMatchSnapshot` | - |

## 十一、开发工具

| 需求 | 库 | 依据 |
|------|-----|------|
| Lint | `eslint` + `@typescript-eslint` | 已用 |
| Format | `prettier` | 已用 |
| Husky | `husky` | 已用 |
| Commit lint | `commitlint` | 建议引入 |

---

## 十二、禁用 / 淘汰清单

| 库 | 原因 | 替代 |
|----|------|------|
| `node-ffi-napi` | 不再维护（2022+ 无更新） | `koffi` |
| `node-powershell` | 进程复用泄漏 | `execFile` |
| `electron-builder` (若有版本过旧) | 需 ≥ 24.x | 升级 |
| 任意 emoji 引用 | CLAUDE.md | lucide-react |

---

## 十三、依赖总规模估算

| 分类 | 预计新增 | 总体积（gzipped） |
|------|---------|-----------------|
| Radix UI 组件 | +8 包 | ~180 KB |
| framer-motion | +1 包 | ~45 KB |
| xstate | +1 包 | ~35 KB |
| koffi | +1 包 | native |
| react-resizable-panels | +1 包 | ~15 KB |
| react-virtuoso | +1 包 | ~25 KB |
| 其他 | +5 包 | ~30 KB |
| **合计** | **~18 包** | **~330 KB** |

对 Electron 桌面应用而言可接受。

---

## 十四、license 审计

| 类别 | 数量 | License |
|------|-----|---------|
| MIT | ~15 | 允许商业 |
| Apache-2.0 | ~3 | 允许商业 |
| ISC | ~2 (lucide 等) | 允许商业 |
| BSD-3-Clause | ~2 | 允许商业 |

无 GPL/AGPL 依赖，符合商业分发要求。

---

## 十五、引入新包的流程

1. 搜现有替代（Serena / GitNexus 确认无自建）
2. 检查 npmjs 周下载、维护活跃度、open issues
3. 检查 license 兼容
4. 与 spec/22 的数据模型对齐（是否需要新类型）
5. 更新本文件 + `package.json`
6. 在相关 spec 末尾 "参考实现 / 库" 小节提及
