# DevHub v2 — Round 5 手动测试总览

> 日期: 2026-04-15
> 测试人: ZRainbow
> 测试方式: `pnpm dev` 启动后长时间真实使用 + 截图证据
> 前序轮次: R1 (0410) / R2 (0410-2) / R3-R4 (0411) / Code Review (0413)
> 本轮归档: `prompts/0415/` (本目录)

---

## 一、本轮测试背景

第 5 轮手动测试。核心目的：验证 Round 3/4 + Code Review 修复后的整体质量，判断 DevHub v2 是否已经达到"可用"标准。

**结论**：依然 **未达可用标准**。两类问题并存：
1. **长期顽疾四轮未修复**（AI 窗口自命名、分组/布局、感测准确性）
2. **本轮新暴露的 Runtime Killer**（PowerShell 资源爆炸、IPC 死循环、设计定位错误）

---

## 二、问题分类总索引

### A. R5 新发现（本轮首次暴露）

| # | 文档 | 症状 | 严重性 |
|---|------|------|--------|
| N1 | `01-runtime-resource-explosion.md` | PowerShell CIM 调用爆炸 + 僵尸进程遗留，长时间运行系统卡顿 | **P0-Blocker** |
| N2 | `02-ipc-rate-limit-loop.md` | `process:get-history` IPC 被渲染层高频调用 971 次被限流 | **P0-Blocker** |
| N3 | `03-project-card-dropdown-overlay.md` | 项目卡片下拉菜单被下方卡片遮挡，功能残缺 | P1 |
| N4 | `04-process-detail-unavailable.md` | PID 9148 可见于列表但详情面板报"无法获取进程信息" | P1 |
| N5 | `07-ai-task-icons-and-duplicates.md`（含重复 bug） | AI 任务列表出现两张 `Codex CLI-1` 卡片，PID 不同 | P2 |

### B. R5 需求澄清 / 设计定位校准（本轮最重要）

| # | 文档 | 内容 | 严重性 |
|---|------|------|--------|
| C1 | `08-topology-flow-design-intent.md` | **拓扑图 / 流程图应为进程/端口/窗口的附属功能**（点击对象后以该对象为中心展示关系），现在被独立成顶级模块违背设计意图 | P0-Design |

> 这是对 R1 PRD §2.5 (进程关系图) 和 §2.7 (端口拓扑) 的**根本性需求校准**，会改写整条拓扑线的实现路径。

### C. R1-R4 已识别但四轮依旧未修复

| # | 文档 | R1-R4 出处 | 本轮状态 |
|---|------|-----------|----------|
| O1 | `06-window-management-unmet-needs.md` §1 | R1 PRD §2.1 (AI 窗口自命名) | **第 5 次反馈，仍未实现** |
| O2 | `06-window-management-unmet-needs.md` §2 | R1 PRD §2.2 (分组 / 布局) | **第 5 次反馈，仍不可用** |
| O3 | `06-window-management-unmet-needs.md` §3 | R1 PRD §2.3 + R4 AI 感测 | **仍存在迟报/漏报/错报** |
| O4 | `09-responsive-and-theme-depth.md` §1 | R3/R4 响应式布局 | **过小尺寸仍挤压不缩放** |
| O5 | `09-responsive-and-theme-depth.md` §2 | R1 PRD §2.8 (主题不只换色) | **仍只换了 palette，布局/组件无差异** |
| O6 | `05-port-scroll-layout-timeout.md` | R3 端口性能 | **新增查询超时 + 滚动失效 + 布局挤压** |

---

## 三、R5 新优先级矩阵

```
═════════════════════════════════════════════════════════════
批次 0 — Runtime 救火（在谈下轮任何 feature 前必须做）
═════════════════════════════════════════════════════════════
  N1  PowerShell CIM 爆炸 + 僵尸进程           [P0-Blocker]
  N2  process:get-history IPC 死循环           [P0-Blocker]
        ↑ 不修这两个任何长时间手测都会复现系统卡死

═════════════════════════════════════════════════════════════
批次 1 — 需求校准（影响整条设计线，必须先对齐再动手）
═════════════════════════════════════════════════════════════
  C1  拓扑/流程图 → 附属功能而非独立模块       [P0-Design]
        ↑ 直接影响 R1 PRD §2.5 + §2.7 + R3 spec 的重写

═════════════════════════════════════════════════════════════
批次 2 — 四轮未实现的核心需求（阻塞用户日常使用）
═════════════════════════════════════════════════════════════
  O1  AI 窗口自命名 + 通知携带名称            [P0-Critical]
  O2  分组 + 布局功能真正可用                  [P0-Critical]
  O3  AI 任务感测准确性（误报/漏报/迟报）      [P0-Critical]

═════════════════════════════════════════════════════════════
批次 3 — 显性 Bug（影响观感 / 数据正确性）
═════════════════════════════════════════════════════════════
  N3  项目卡片下拉遮挡                         [P1]
  N4  PID 详情获取失败                         [P1]
  O6  端口窗口滚动 + 布局 + 查询超时           [P1]
  N5  AI 任务卡片重复显示                      [P2]

═════════════════════════════════════════════════════════════
批次 4 — 视觉体验（R1 老问题）
═════════════════════════════════════════════════════════════
  O4  小尺寸响应式缩放                         [P2]
  O5  主题从"换色"到"完整设计语言"             [P2]
  AI-2 AI 任务图标改用官方 Logo 替代 Emoji     [P2]
```

---

## 四、源码定位（用于下对话快速进入）

| 问题域 | 关键源码 | Gitnexus 切入点 |
|-------|----------|----------------|
| N1 资源爆炸 | `src/main/services/SystemProcessScanner.ts` (52KB), `AITaskTracker.ts` (39KB), `WindowManager.ts` (37KB) | `gitnexus_impact({target:"SystemProcessScanner"})`, 搜 `Get-CimInstance` / `powershell.exe` 所有调用点 |
| N2 IPC 循环 | 日志指向 `devhub/out/main/index.js:1356`（编译产物，需回溯 src IPC handler 定义） | `gitnexus_query({query:"process:get-history handler"})` |
| O1/O2 窗口管理 | `WindowManager.ts`, `windowStore.ts`, IPC channel `window:rename` (R4 确认缺失) | R4 `prompts/0413/06-window-rename-chain.md` 已有方案待落地 |
| O3 AI 感测 | `AITaskTracker.ts`, `ToolMonitor.ts`, `aiTaskStore.ts` | R4 `prompts/0413/02-terminal-signal-fusion.md` 与 `07-aitask-confidence-state.md` 已有方案 |
| C1 拓扑附属化 | `src/renderer/components/monitor/` + 当前独立 `拓扑` / `流程图` 顶级 Tab | 需重新组织 IA（信息架构） |
| O5 主题深度 | `tailwind.config.js`, `src/renderer/styles/`, `useTheme` | R4 `prompts/0413/03-theme-runtime-manager.md` 已有 runtime token 方案 |

---

## 五、证据锚点

### 运行时证据（日志）
- 后台进程 ID: `bw1n9enib`
- 输出文件: `C:\Users\HP\AppData\Local\Temp\claude\D--Desktop-CREATOR-ONE\5cb524c1-2323-4546-84a7-6fbe43665f20\tasks\bw1n9enib.output`
- 大小: 2.3 MB / 16613 行
- Rate limit 出现次数: **971 次**
- PowerShell "内存不足" HRESULT: `0x80041006` (CimException) + `0x800705AF` (System.Data 加载失败)
- 应用退出方式: `BackgroundScannerManager` 正常 stop（exit code 0），非崩溃

### 系统残留证据（用户长时间运行后的真实代价）
应用已关闭但遗留 **9 个 PowerShell 僵尸进程**，其中：
- PID 2512: **90 MB**
- PID 42572: **90 MB**
- PID 61484: 65 MB
- PID 57388: 59 MB
- PID 68992: 25 MB
- 其余 4 个 ~2-3 MB

总遗留 ≈ **330 MB**，直接对应用户反映的"系统极其卡顿"。

### 截图锚点（见用户附件）

| Image | 问题 |
|-------|------|
| #1 | 项目卡片下拉菜单被下方卡片遮挡 |
| #2 | PID 9148 无法获取进程信息 |
| #3 | 端口监控卡片区无滚动 |
| #4 | 端口卡片布局挤压 + `查询超时 - 显示缓存数据` |
| #5 | 窗口管理器卡片溢出、分组 0、布局 0 |
| #6 | AI 任务卡片显示 Emoji + `Codex CLI-1` 重复 |
| #7 | 拓扑图节点挤在左上角 |
| #8 | 流程图布局溢出 + 右下异常色块（minimap 故障？）|
| #9 + #10 | 两套"不同主题"只是换色，布局组件完全一致 |

---

## 六、给下一个对话的建议流程

1. **读完** `prompts/0415/00-round5-overview.md`（本文件）
2. **对齐 C1** — 先和用户确认拓扑/流程图附属化的设计方案（影响最大）
3. **做 N1 + N2** — 用 gitnexus impact 定位资源爆炸根因，写出限流/缓存/单例化方案
4. **做 O1 + O2 + O3** — 启用 `prompts/0413/` 已有方案（02/06/07）真正落地
5. **其他问题** 按批次 3/4 顺序做

> 不要跳过第 2 步直接动代码。拓扑定位方案一变，§2.5/§2.7 的进程神经流线图与端口拓扑全部要重构。
