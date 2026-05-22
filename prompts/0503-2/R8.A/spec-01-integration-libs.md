# R8.A spec-01 — 集成库引入与封装（Integration Libraries）

> **batch**: R8.A | **rank**: #1 (foundation, blocks all other R8.A specs)
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-10.* (用户已答) + V2-Q-13/14/19/20 + refs/source-snapshot-v2.md
> **signed**: ZRainbow 2026-05-03

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V1-Q-10.J.3
  raw: "B. 仅核心模块自研，其他集成"
  delta: 用户改默认 A(全集成) -> B(核心自研 + 其他集成)

  - source: V1-Q-10.A.1
  raw: "F. wmi-client + PowerShell 混合"
  impact: 高频取数走 wmi-client；深度查询 fallback PowerShell

  - source: V1-Q-10.A.2
  raw: "A 默认 + B 兜底, 使用 taskkill 务必要谨慎，一次一条命令杀一个特定的进程"
  impact: 强制 SafeTaskKill adapter 校验单 PID

  - source: V1-Q-10.B.5
  raw: "A. 不实现"
  impact: OCR 库不引入，仅保留接口签名

  - source: V1-Q-10.B.1
  raw: "F. node-window-manager + koffi + win32-displayconfig"
  impact: 三库合用

  - source: V1-Q-10.B.2
  raw: "E. nut.js + koffi + node-pty"
  impact: nut.js 仅在 R8.A 引入，inject 启用在 R8.C-spec-18

  - source: V1-Q-10.E.1
  raw: "A 默认 + B 备选（NeuralGraphEngine + xyflow 双引擎）"
  impact: 同时安装 @xyflow/react + d3-force + dagre + elkjs（V1-Q-10.E.2 选 E）

  - source: V1-Q-10.F.1/F.2/F.3/F.4/F.5
  raw: "cmdk / react-resizable-panels / radix-ui dialog / react-grid-layout / tanstack-table+virtual"
  impact: 全部引入

  - source: V2-Q-19.A.1
  raw: "10 段 z-index 方案"
  impact: 必须新增 z-index-tokens.css 全局规范

  - source: V2-Q-13.J.1
  raw: 已实现但用户未感知 = 等于未实现
  impact: 4 套图标库 + Drawer + Popout 组件必须可一键访问，集成必到位
```

### 1.2 工程背景

`devhub/package.json` 当前依赖见 refs/source-snapshot-v2.md。R8.A/B/C 三批次依赖的库需在本 spec 一次性写入并以 adapter 模式封装，保证：
- 上层组件不直接 import 第三方包，全部走 `src/main/services/integrations/*` 或 `src/renderer/integrations/*`
- 每个集成点配 feature flag（命名 `R8.A.libs.{slug}`）
- 失败 fallback 明确（V1-Q-10 系列已指定）
- license 严格审计（MIT / ISC / BSD / Apache-2.0 / MPL-2.0 仅）

### 1.3 为什么放在 #1

R8.A 其余 10 个 spec 全部依赖此 spec 的 adapter 与依赖落地，是 batch 内的"地基" spec。

---

## 2. affected_source

```yaml
files:
  - path: devhub/package.json
  lines: "30-50 (dependencies) / 51-90 (devDependencies)"
  op: ADD
  detail: 新增 R8.A 必装依赖 + R8.B/R8.C 预声明

  - path: devhub/src/main/services/SystemProcessScanner.ts
  lines: "1-100 / 862-1000"
  op: WIRE_IN
  detail: 高频路径切到 WmiClientAdapter；PowerShell 仅作 fallback

  - path: devhub/src/main/services/runtime/PowerShellGateway.ts
  lines: "全文"
  op: KEEP
  detail: 不删，仅降级为深度查询/兜底通道

  - path: devhub/src/main/services/elevation/AdminRelaunch.ts
  lines: "全文"
  op: KEEP
  detail: 不删，"全程提权"路径保留；spec-03 引入"单次 spawn"

  - path: devhub/src/main/services/integrations/
  lines: NEW_DIR
  op: CREATE
  detail: adapter 封装层根目录

  - path: devhub/src/main/services/integrations/WmiClientAdapter.ts
  op: CREATE
  - path: devhub/src/main/services/integrations/SafeTaskKill.ts
  op: CREATE
  detail: 强制单 PID + Zod 验证 + 审计
  - path: devhub/src/main/services/integrations/TreeKillAdapter.ts
  op: CREATE
  - path: devhub/src/main/services/integrations/SudoSpawn.ts
  op: CREATE
  detail: sudo-prompt 包装；spec-03 调用
  - path: devhub/src/main/services/integrations/NodeWindowManagerAdapter.ts
  op: CREATE
  - path: devhub/src/main/services/integrations/KoffiAdapter.ts
  op: CREATE
  detail: user32 / kernel32 / advapi32 FFI 桩
  - path: devhub/src/main/services/integrations/NutJsAdapter.ts
  op: CREATE
  detail: 仅声明 + flag default OFF；R8.C spec-18 启用
  - path: devhub/src/main/services/integrations/index.ts
  op: CREATE
  detail: barrel export

  - path: devhub/src/shared/feature-flags.ts
  op: CREATE
  detail: flag 注册表 + Zod schema

  - path: devhub/src/shared/integration-manifest.ts
  op: CREATE

  - path: devhub/src/renderer/integrations/
  op: CREATE
  - path: devhub/src/renderer/integrations/icons-bridge.ts
  op: CREATE
  detail: 4 套图标库统一接口（lucide-react + tabler-icons-react + radix-ui-icons + heroicons）
  - path: devhub/src/renderer/integrations/cmdk-bridge.tsx
  op: CREATE
  - path: devhub/src/renderer/integrations/panels-bridge.tsx
  op: CREATE
  detail: react-resizable-panels 封装
  - path: devhub/src/renderer/integrations/grid-bridge.tsx
  op: CREATE
  detail: react-grid-layout 封装
  - path: devhub/src/renderer/integrations/arborist-bridge.tsx
  op: CREATE
  detail: react-arborist 封装
  - path: devhub/src/renderer/integrations/motion-bridge.tsx
  op: CREATE
  detail: framer-motion 封装

  - path: devhub/src/renderer/styles/z-index-tokens.css
  op: CREATE
  detail: 10 段 z-index 全局规范（V2-Q-19.A.1）

  - path: devhub/scripts/check-no-emoji.mjs
  lines: "全文"
  op: KEEP
  - path: devhub/scripts/check-license.mjs
  op: CREATE
  detail: license 白名单校验
```

---

## 3. data_contracts

### 3.1 IntegrationManifest schema

```typescript
import { z } from 'zod';

export const LICENSE = z.enum([
  'MIT','ISC','BSD-2-Clause','BSD-3-Clause','Apache-2.0','MPL-2.0',
]);

export const integrationLibrarySchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\^?[0-9]+\.[0-9]+\.[0-9]+/),
  purpose: z.string().min(8),
  license: LICENSE,
  dependency_block: z.enum(['dependencies','devDependencies']),
  flag: z.string().regex(/^R8\.[A-C]\.libs\.[a-z0-9-]+$/),
  fallback: z.string().nullable(),
  required_in_batch: z.enum(['R8.A','R8.B','R8.C']),
  notes: z.string().optional(),
});

export const integrationManifestSchema = z.object({
  generation: z.literal('R8.A'),
  generated_at: z.string().datetime(),
  libraries: z.array(integrationLibrarySchema).min(1),
});

export type IntegrationLibrary = z.infer<typeof integrationLibrarySchema>;
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
```

### 3.2 R8.A required production dependencies

```yaml
production_dependencies:
  # 进程信息（V1-Q-10.A.1 F）
  - name: wmi-client
  version: ^0.5.0
  purpose: "Node 直接调 WMI；高频取数主路径"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.wmi-client
  fallback: PowerShellGateway
  required_in_batch: R8.A

  # UAC 单次提权（spec-03 主用）
  - name: sudo-prompt
  version: ^9.2.1
  purpose: "Win UAC spawn 子进程"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.sudo-prompt
  fallback: AdminRelaunch
  required_in_batch: R8.A

  # 进程 kill（V1-Q-10.A.2 A 默认 + B 兜底）
  - name: tree-kill
  version: ^1.2.2
  purpose: "递归杀进程树（仅在用户确认 + 无关键服务时启用）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.tree-kill
  fallback: SafeTaskKill (单 PID)
  required_in_batch: R8.A

  # 窗口管理（V1-Q-10.B.1 F）
  - name: node-window-manager
  version: ^2.2.4
  purpose: "Win 窗口枚举 / focus / move"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.node-window-manager
  fallback: WindowManager (现有 koffi 调用)
  required_in_batch: R8.A
  - name: koffi
  version: ^2.8.0
  purpose: "FFI；user32 / kernel32 / advapi32 直调"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.koffi
  fallback: null
  required_in_batch: R8.A
  - name: win32-displayconfig
  version: ^0.1.5
  purpose: "多屏 + DPI 配置"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.win32-displayconfig
  fallback: null
  required_in_batch: R8.A

  # 文本注入（V1-Q-10.B.2 E；R8.A 仅声明，R8.C-spec-18 启用）
  - name: nut-js
  version: ^4.2.0
  purpose: "跨平台键鼠注入"
  license: Apache-2.0
  dependency_block: dependencies
  flag: R8.A.libs.nut-js
  fallback: WINDOW_SEND_KEYS (现有 IPC)
  required_in_batch: R8.A
  notes: "default flag OFF；R8.C 启用"
  - name: node-pty
  version: ^1.0.0
  purpose: "终端式接管（V1-Q-10.C.1 D）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.node-pty
  fallback: child_process
  required_in_batch: R8.A

  # 图引擎（V1-Q-10.E.1/E.2/E.3）
  - name: '@xyflow/react'
  version: ^12.3.5
  purpose: "大图备选引擎"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.xyflow
  fallback: NeuralGraphEngine
  required_in_batch: R8.A
  - name: 'd3-force'
  version: ^3.0.0
  purpose: "力导向布局（已使用）"
  license: ISC
  dependency_block: dependencies
  flag: R8.A.libs.d3-force
  fallback: null
  required_in_batch: R8.A
  - name: '@dagrejs/dagre'
  version: ^1.1.4
  purpose: "层级布局"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.dagre
  fallback: null
  required_in_batch: R8.A
  - name: elkjs
  version: ^0.9.3
  purpose: "精确分层布局"
  license: EPL-2.0
  dependency_block: dependencies
  flag: R8.A.libs.elkjs
  fallback: dagre
  required_in_batch: R8.A
  notes: "EPL-2.0 不在白名单 -> 走 license 例外审批；若不批 fallback dagre"
  - name: webcola
  version: ^3.4.0
  purpose: "约束布局"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.webcola
  fallback: null
  required_in_batch: R8.A

  # UI 框架与组件（V1-Q-10.F.* + V2-Q-19/20）
  - name: cmdk
  version: ^1.0.4
  purpose: "命令面板（V1-Q-10.F.1）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.cmdk
  fallback: null
  required_in_batch: R8.A
  - name: react-resizable-panels
  version: ^2.1.7
  purpose: "可拖拽分栏（V1-Q-10.F.2）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.resizable-panels
  fallback: null
  required_in_batch: R8.A
  - name: '@radix-ui/react-dialog'
  version: ^1.1.2
  purpose: "Drawer / Modal 基类（V1-Q-10.F.3）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.radix-dialog
  fallback: null
  required_in_batch: R8.A
  - name: '@radix-ui/react-dropdown-menu'
  version: ^2.1.2
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.radix-dropdown
  fallback: null
  required_in_batch: R8.A
  - name: '@radix-ui/react-tooltip'
  version: ^1.1.4
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.radix-tooltip
  fallback: null
  required_in_batch: R8.A
  - name: react-grid-layout
  version: ^1.5.0
  purpose: "可拖拽仪表板（V1-Q-10.F.4）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.grid-layout
  fallback: null
  required_in_batch: R8.A
  - name: '@tanstack/react-table'
  version: ^8.20.5
  purpose: "表格（V1-Q-10.F.5）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.tanstack-table
  fallback: null
  required_in_batch: R8.A
  - name: '@tanstack/react-virtual'
  version: ^3.10.8
  purpose: "虚拟滚动（V1-Q-10.F.5）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.tanstack-virtual
  fallback: null
  required_in_batch: R8.A
  - name: react-arborist
  version: ^3.4.0
  purpose: "树形列表 / 进程树（V1-Q-4.A.1 E + V1-Q-4.D.3）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.arborist
  fallback: null
  required_in_batch: R8.A
  - name: framer-motion
  version: ^11.11.17
  purpose: "动效（V2-Q-20.A.2 view-transition fallback）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.framer-motion
  fallback: CSS transitions
  required_in_batch: R8.A
  - name: react-hook-form
  version: ^7.53.2
  purpose: "表单（V1-Q-10.F.6）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.react-hook-form
  fallback: null
  required_in_batch: R8.A
  - name: date-fns
  version: ^4.1.0
  purpose: "时间格式化（V1-Q-10.F.7）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.date-fns
  fallback: null
  required_in_batch: R8.A

  # 图标库（4 套，统一接口）
  - name: lucide-react
  version: ^0.460.0
  purpose: "主图标库（已使用）"
  license: ISC
  dependency_block: dependencies
  flag: R8.A.libs.lucide
  fallback: null
  required_in_batch: R8.A
  - name: '@tabler/icons-react'
  version: ^3.21.0
  purpose: "技术图标补充"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.tabler-icons
  fallback: lucide-react
  required_in_batch: R8.A
  - name: '@radix-ui/react-icons'
  version: ^1.3.2
  purpose: "Radix 配套图标"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.radix-icons
  fallback: lucide-react
  required_in_batch: R8.A
  - name: '@heroicons/react'
  version: ^2.2.0
  purpose: "Tailwind 风装饰图标"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.heroicons
  fallback: lucide-react
  required_in_batch: R8.A

  # 任务队列预声明（R8.C 主用）
  - name: better-queue
  version: ^3.8.12
  purpose: "本地任务队列（V1-Q-10.D.1）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.better-queue
  fallback: null
  required_in_batch: R8.A
  notes: "default flag OFF；R8.C 启用"
  - name: graphlib
  version: ^2.1.8
  purpose: "DAG 拓扑排序（V1-Q-10.D.2 A）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.graphlib
  fallback: null
  required_in_batch: R8.A
  - name: papaparse
  version: ^5.4.1
  purpose: "CSV 解析（V1-Q-10.D.3 A）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.papaparse
  fallback: null
  required_in_batch: R8.A
  - name: chokidar
  version: ^4.0.1
  purpose: "文件监听（V1-Q-10.D.4 A）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.chokidar
  fallback: fs.watch
  required_in_batch: R8.A
  - name: xstate
  version: ^5.18.2
  purpose: "AI 三层状态机（V1-Q-10.G.1）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.xstate
  fallback: null
  required_in_batch: R8.A

  # 流程图（V1-Q-10.E.3）
  - name: mermaid
  version: ^11.4.0
  purpose: "声明式流程图（默认）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.mermaid
  fallback: null
  required_in_batch: R8.A
  - name: vis-timeline
  version: ^7.7.3
  purpose: "时间线图（加分项）"
  license: 'Apache-2.0'
  dependency_block: dependencies
  flag: R8.A.libs.vis-timeline
  fallback: mermaid
  required_in_batch: R8.A

  # 拓扑视觉
  - name: react-sparklines
  version: ^1.7.0
  purpose: "Sparkline 渲染（V1-Q-10.A.3 C）"
  license: MIT
  dependency_block: dependencies
  flag: R8.A.libs.sparklines
  fallback: null
  required_in_batch: R8.A
```

### 3.3 R8.A required dev dependencies

```yaml
dev_dependencies:
  - name: react-scan
  version: ^0.0.49
  purpose: "渲染性能监控（V1-Q-10.H.2）"
  license: MIT
  dependency_block: devDependencies
  flag: R8.A.libs.react-scan
  fallback: null
  required_in_batch: R8.A
  notes: "dev-only"
  - name: license-checker-rseidelsohn
  version: ^4.4.2
  purpose: "license 白名单校验"
  license: BSD-3-Clause
  dependency_block: devDependencies
  flag: R8.A.libs.license-checker
  fallback: null
  required_in_batch: R8.A
```

### 3.4 禁止引入清单

```yaml
forbidden:
  - name: tesseract.js
  reason: "V1-Q-10.B.5 用户改默认 -> A 不实现"
  - name: 'azure-cognitiveservices-computervision'
  reason: "云端 + V1-Q-J.3 用户要求绝不连云端"
  - name: bullmq
  reason: "Redis 依赖；V1-Q-10.D.1 选 E better-queue"
  - name: 'react-joyride'
  reason: "V2-Q-13.C.2 在 R8.B-spec 决定，本批次不引入"
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: integrations:list-libraries
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: integrationManifestSchema
  purpose: "渲染层读取 manifest 用于 health view"

  - name: integrations:flag-get
  direction: renderer -> main
  request_schema: z.object({ key: z.string() })
  response_schema: z.object({ key: z.string(), value: z.boolean(), source: z.enum(['default','env','user']) })

  - name: integrations:flag-set
  direction: renderer -> main
  request_schema: z.object({ key: z.string(), value: z.boolean() })
  response_schema: z.object({ ok: z.boolean(), error_code: z.string().nullable() })
  requires_audit: true

  - name: integrations:health-check
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: z.object({
  libraries: z.array(z.object({
  name: z.string(),
  loaded: z.boolean(),
  version: z.string().nullable(),
  last_error: z.string().nullable(),
  })),
  })

unchanged_channels:
  - PROCESS_KILL: kept; SafeTaskKill 在 main side 拦截校验
  - WINDOW_SEND_KEYS: kept; nut.js 注入仅在 R8.C-spec-18 启用
```

---

## 5. error_matrix

| condition | error_code | severity | user_message | recovery |
|-----------|------------|----------|--------------|----------|
| wmi-client 加载失败 | R8A_LIB_WMI_LOAD_FAIL | warn | 切换到 PowerShell 兜底 | 自动 fallback PowerShellGateway |
| sudo-prompt UAC 取消 | R8A_LIB_UAC_CANCELLED | info | 用户取消提权 | 不重试；保留普通字段集 |
| tree-kill 检测到关键服务 | R8A_LIB_KILL_BLOCKED | error | 拒绝杀关键服务 | 强制走 SafeTaskKill 单 PID 路径 |
| nut-js 启动失败 | R8A_LIB_NUTJS_LOAD_FAIL | warn | 注入功能不可用 | flag OFF + UI banner |
| @xyflow/react 不存在 | R8A_LIB_XYFLOW_MISSING | error | 大图模式不可用 | fallback NeuralGraphEngine |
| license 不在白名单 | R8A_LIB_LICENSE_DENIED | error | 构建失败 | 修依赖或申请例外 |
| flag 名称不符合正则 | R8A_LIB_FLAG_INVALID | error | 配置错误 | 启动期 fail-fast |
| koffi 调用失败 | R8A_LIB_KOFFI_CALL_FAIL | error | 系统调用失败 | 记录 + 弹 toast |
| 依赖版本与 manifest 不符 | R8A_LIB_VERSION_MISMATCH | error | 集成清单失效 | 启动期 fail-fast |
| z-index hardcoded | R8A_LIB_ZINDEX_HARDCODE | error | 必须使用 token | ESLint 禁止 |

---

## 6. acceptance_gwt

```gherkin
Feature: R8.A spec-01 Integration libraries

Scenario A1: integration manifest 已生成且 schema 校验通过
  Given Repo 已经 pnpm install 完成
  When 启动期 main 进程加载 src/shared/integration-manifest.ts
  Then integrationManifestSchema.parse(manifest) 不抛错
  And 所有 library 的 license 在 LICENSE 白名单内（elkjs 走 exception list）

Scenario A2: WMI fallback 工作
  Given wmi-client 实例化抛错
  When 调用 SystemProcessScanner.scan()
  Then PowerShellGateway 被调用
  And 错误码 R8A_LIB_WMI_LOAD_FAIL 被记录到审计

Scenario A3: SafeTaskKill 拒绝多 PID
  Given 调用 SafeTaskKill.kill({ pids: [1234, 5678] })
  When 入口 schema 校验
  Then Zod 抛错
  And taskkill 进程未被 spawn

Scenario A4: tree-kill 关键服务拦截
  Given pid=4 (System) 或 pid=0 (Idle)
  When 调用 TreeKillAdapter.kill(pid)
  Then 拒绝执行
  And 错误码 R8A_LIB_KILL_BLOCKED 返回

Scenario A5: nut.js 默认 OFF
  Given R8.A 部署完成
  When 渲染端调用 integrations:flag-get { key: 'R8.A.libs.nut-js' }
  Then 返回 { value: false, source: 'default' }

Scenario A6: license-checker 在 CI fail-fast
  Given 一个新依赖 license=GPL-3.0
  When 运行 pnpm run check-license
  Then 进程退出码 != 0
  And stderr 包含 "license not in whitelist"

Scenario A7: cmdk + react-resizable-panels barrel import
  Given 渲染端组件 import { CommandPalette } from 'integrations/cmdk-bridge'
  When 编译
  Then tsc 不抛错
  And 第三方 import 不出现在组件源文件中（仅 bridge 内部 import）

Scenario A8: z-index token 强制使用
  Given 任意组件 style={{ zIndex: 9999 }}
  When ESLint 检测
  Then rule "no-hardcode-zindex" 报 error
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-01-integration-libs.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('R8.A spec-01 integration libs', () => {
  test('manifest endpoint returns valid schema', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const manifest = await win.evaluate(async () => {
  return await window.devhub.integrations.listLibraries();
  });
  expect(manifest.generation).toBe('R8.A');
  expect(manifest.libraries.length).toBeGreaterThanOrEqual(30);
  await app.close();
  });

  test('flag toggle audit', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const r1 = await win.evaluate(async () =>
  window.devhub.integrations.flagSet({ key: 'R8.A.libs.nut-js', value: true })
  );
  expect(r1.ok).toBe(true);
  const audit = await win.evaluate(async () =>
  window.devhub.audit.tail({ limit: 10 })
  );
  expect(audit.entries.some((e: any) => e.action === 'flag_set' && e.target === 'R8.A.libs.nut-js')).toBe(true);
  await app.close();
  });

  test('SafeTaskKill rejects multiple pids', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const result = await win.evaluate(async () =>
  window.devhub.process.kill({ pids: [1234, 5678] }).catch((e: Error) => e.message)
  );
  expect(result).toContain('exactly one PID');
  await app.close();
  });
});
```

---

## 8. reference_impl

| library | upstream | adapter file | doc |
|---------|----------|--------------|-----|
| wmi-client | https://github.com/dpadula78/wmi-client | WmiClientAdapter.ts | https://www.npmjs.com/package/wmi-client |
| sudo-prompt | https://github.com/jorangreef/sudo-prompt | SudoSpawn.ts | https://www.npmjs.com/package/sudo-prompt |
| tree-kill | https://github.com/pkrumins/node-tree-kill | TreeKillAdapter.ts | — |
| node-window-manager | https://github.com/sentialx/node-window-manager | NodeWindowManagerAdapter.ts | — |
| koffi | https://github.com/Koromix/koffi | KoffiAdapter.ts | https://koromix.dev/koffi |
| nut-js | https://github.com/nut-tree/nut.js | NutJsAdapter.ts | https://nutjs.dev |
| @xyflow/react | https://github.com/xyflow/xyflow | (renderer/integrations) | https://reactflow.dev |
| cmdk | https://github.com/pacocoursey/cmdk | cmdk-bridge.tsx | https://cmdk.paco.me |
| react-resizable-panels | https://github.com/bvaughn/react-resizable-panels | panels-bridge.tsx | — |
| @radix-ui/* | https://www.radix-ui.com | (renderer/integrations) | — |
| react-grid-layout | https://github.com/react-grid-layout/react-grid-layout | grid-bridge.tsx | — |
| @tanstack/react-table | https://tanstack.com/table | (renderer/integrations) | — |
| @tanstack/react-virtual | https://tanstack.com/virtual | (renderer/integrations) | — |
| react-arborist | https://github.com/brimdata/react-arborist | arborist-bridge.tsx | — |
| framer-motion | https://www.framer.com/motion | motion-bridge.tsx | — |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 1200
breakdown:
  manifest_schema: 120
  feature_flags_module: 110
  WmiClientAdapter: 180
  SafeTaskKill: 90
  TreeKillAdapter: 60
  SudoSpawn: 80
  NodeWindowManagerAdapter: 110
  KoffiAdapter: 140
  NutJsAdapter: 60
  icons_bridge: 90
  cmdk_bridge: 70
  panels_bridge: 60
  grid_bridge: 60
  arborist_bridge: 60
  motion_bridge: 50
  z_index_tokens_css: 40
  check_license_script: 80
  IPC handlers: 90
files_touched: ~22
risk_radius:
  - PROCESS_KILL: SafeTaskKill 拦截改变现有杀进程行为；现有 callers 必须迁移
  - SystemProcessScanner: 切到 wmi-client 后字段映射需测试
  - bundle size: 4 套图标库 tree-shaking 必须验证（target +5 MB max）
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 src/shared/feature-flags.ts + Zod schema + 默认值表
  - step_02: 创建 src/shared/integration-manifest.ts + 写入 §3.2/§3.3 数据
  - step_03: pnpm add 全部 production_dependencies（按列表逐条）
  - step_04: pnpm add -D 全部 dev_dependencies
  - step_05: 创建 src/main/services/integrations/ 目录 + 各 adapter
  - step_06: 创建 src/renderer/integrations/ 目录 + 各 bridge
  - step_07: 创建 src/renderer/styles/z-index-tokens.css 并在 main.css 引入
  - step_08: 创建 ESLint rule no-hardcode-zindex
  - step_09: 创建 scripts/check-license.mjs + 接入 prebuild
  - step_10: 注册 4 个新 IPC channel + Zod 验证
  - step_11: SystemProcessScanner 切到 WmiClientAdapter（保留 fallback）
  - step_12: 写 vitest 单测覆盖每个 adapter 的 fallback 路径
  - step_13: 写 Playwright e2e 草案（§7）
  - step_14: 验证 bundle size delta < 8MB（master §10）
verify:
  - pnpm typecheck
  - pnpm lint
  - pnpm test --filter integrations
  - pnpm run check-license
  - pnpm run check-no-emoji
  - pnpm run e2e --grep "spec-01"
```

---

## 11. dependencies

```yaml
blocks:
  - spec-02-process-unified-vm.md  # 需要 WmiClientAdapter
  - spec-03-process-uac-elevation.md # 需要 SudoSpawn
  - spec-04-process-card-list-parity.md
  - spec-05-topology-discoverability.md  # 需要 cmdk + xyflow
  - spec-06-theme-4d-axis-exposure.md  # 需要 framer-motion + radix
  - spec-07-theme-default-distance.md
  - spec-08-window-always-on-top.md  # 需要 koffi + node-window-manager
  - spec-09-port-card-improvement.md  # 需要 panels-bridge
  - spec-10-audit-log.md  # 需要 tanstack-table
  - spec-11-permission-prompts.md  # 需要 radix-dialog
  - R8.B/* and R8.C/*：本 spec 是全 R8 的依赖图根
blocked_by: []
```

---

## 12. fallback_strategy

```yaml
on_full_failure:
  trigger: "pnpm install 失败 / license-checker 不通过 / koffi 在目标 Win 版本崩溃"
  action:
  - 关闭对应 flag
  - 退回到 fallback 列表中的现有模块
  - SystemProcessScanner -> PowerShellGateway
  - WindowManager -> 现有实现
  - 不阻断启动；UI 显示 "集成 X 不可用" banner

on_license_exception:
  trigger: "elkjs EPL-2.0 不在白名单"
  action:
  - 默认 flag OFF
  - fallback dagre
  - 在 docs/license-exceptions.md 记录并请用户审批

on_bundle_overrun:
  trigger: "renderer bundle delta > 8MB"
  action:
  - tree-shake 验证 4 套图标库
  - 移除未用 export
  - 如仍超 -> 删 heroicons（最低优先级）
```

---

## 13. performance_budget

```yaml
budgets:
  install_time_after_pnpm_install: <= 90s on dev machine
  cold_start_main_process_extra: <= 200ms
  cold_start_renderer_extra: <= 300ms
  bundle_size_renderer_delta: <= 8MB
  bundle_size_main_delta: <= 4MB
  rss_idle_delta_main: <= 30MB
  rss_idle_delta_renderer: <= 50MB
  wmi_query_p95: <= 250ms (vs PowerShell 800ms baseline)
  fps_drop_when_loading_xyflow_500_nodes: < 5
  z_index_token_count: 10
verification:
  - 启动 5 次取 cold_start 中位数
  - 通过 react-scan 观察 renderer fps
  - 通过 process.memoryUsage() 取 RSS
```
