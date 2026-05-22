# spec/20 - AI 工具品牌 Logo 系统（NO EMOJI）
> 严重度：P2
> 对应验收项：`P5.2`、`X4`
> 当前状态：`[TEST-PASS]`，`E2E-P5.2` / `E2E-X4-no-emoji` 已完成，尚缺用户手测

---

## 一、目标

R7 对 AI 任务面板的要求不是“看起来像图标”，而是：

- 不允许再出现 Emoji、字符占位或纯文本代替图标。
- 所有已识别 AI 工具必须渲染真实品牌标识。
- 未识别工具必须有稳定的 SVG fallback，且 fallback 也不能退回 Emoji。
- 无 Emoji 约束必须进入持续校验链，而不是依赖人工记忆。

---

## 二、当前真实实现

### 2.1 真实入口

- 品牌 Logo 组件：`devhub/src/renderer/components/icons/AIToolBrandLogo.tsx`
- 当前渲染接入点：`devhub/src/renderer/components/monitor/AITaskView.tsx`
- 当前单测：`devhub/src/renderer/components/icons/AIToolBrandLogo.test.tsx`
- 当前无 Emoji 守卫：`devhub/scripts/check-no-emoji.mjs`

### 2.2 当前真实工具枚举

`AIToolType` 以 `devhub/src/shared/types-extended.ts` 为准：

- `codex`
- `claude-code`
- `gemini-cli`
- `cursor`
- `opencode`
- `aider`
- `windsurf`
- `continue-dev`
- `cline`
- `other`

旧文档中出现的 `roo`、`aichat`、`gpt-cli`、`codex-cli`、`cursor-cli`、`continue` 等名称，均不是当前代码中的真实枚举，后续不得再作为 R7 的验收口径。

---

## 三、Logo 渲染契约

### 3.1 组件契约

`AIToolBrandLogo` 负责统一输出带 `data-tool-logo` 标记的品牌标识容器。

要求：

- 外层容器负责 `role="img"` 与 `aria-label`。
- 内层如使用位图或 SVG 资产，视为装饰性内容，保持空 `alt` 与 `aria-hidden`。
- 组件必须支持 `size`、`className`、`title`。
- 所有品牌工具输出 `<img>` 或 `<svg>`，不得输出 Emoji 文本节点。

### 3.2 当前真实映射

| toolType | 渲染来源 | 当前实现 | 说明 |
|---|---|---|---|
| `claude-code` | simple-icons 组件 | `SiClaude` | 直接使用当前安装图标库 |
| `gemini-cli` | simple-icons 组件 | `SiGooglegemini` | 直接使用当前安装图标库 |
| `cursor` | simple-icons 组件 | `SiCursor` | 直接使用当前安装图标库 |
| `windsurf` | simple-icons 组件 | `SiWindsurf` | 直接使用当前安装图标库 |
| `cline` | simple-icons 组件 | `SiCline` | 直接使用当前安装图标库 |
| `codex` | 仓内 SVG 资产 | `brand-logos/openai-symbol.svg` | 当前安装库无 `SiOpenai` 导出 |
| `opencode` | 仓内 SVG 资产 | `brand-logos/opencode-logo-dark-square.svg` | 当前安装库无 `SiOpenCode` 导出 |
| `aider` | 仓内 SVG 资产 | `brand-logos/aider.svg` | 当前采用轻量化仓内 wordmark 资产 |
| `continue-dev` | 仓内 SVG 资产 | `brand-logos/continue.svg` | 当前安装库无 `SiContinue` 导出 |
| `other` | fallback SVG 组件 | `GearIcon` | 非品牌工具统一 fallback |

### 3.3 本地依赖真值

以当前 `devhub/package.json` 和本地运行结果为准：

- `@icons-pack/react-simple-icons`: `^13.13.0`
- `simple-icons`: `^16.17.0`

本轮在本地执行导出检查后确认：

- 存在：`SiClaude`、`SiGooglegemini`、`SiCursor`、`SiWindsurf`、`SiCline`
- 不存在：`SiOpenai`、`SiOpenCode`、`SiAider`、`SiContinue`

因此 `codex` / `opencode` / `aider` / `continue-dev` 继续使用仓内 SVG 资产是当前 lockfile 下的真实实现要求，而不是临时兜底。

---

## 四、仓内品牌资产

当前仓内资产目录：`devhub/src/renderer/components/icons/brand-logos/`

已落地文件：

- `openai-symbol.svg`
- `opencode-logo-dark-square.svg`
- `continue.svg`
- `aider.svg`

约束：

- 不新增 Emoji 占位图。
- 不把品牌资产放回 `TOOL_INFO` 这类字符串配置表中直接拼接渲染。
- 所有资产必须通过 `AIToolBrandLogo` 统一出口渲染。

---

## 五、无 Emoji 守卫

### 5.1 构建期守卫

`devhub/scripts/check-no-emoji.mjs` 已接入：

- `pnpm check:no-emoji`
- `pnpm lint`（前置执行 `pnpm check:no-emoji`）

当前规则会扫描源码中的 Emoji 码点并直接失败，不允许“先渲染后人工发现”。

### 5.2 源码字面量治理

`devhub/src/shared/types-extended.ts` 中原本用于 AI 状态检测的符号字符，已统一替换为 Unicode 转义：

- `\u2713`
- `\u2714`
- `\u2717`
- `\u2718`
- `\u276f`

这样既保持运行时匹配语义，又避免源码层面再次命中 Emoji 扫描。

---

## 六、测试与验证

### 6.1 单元测试

`AIToolBrandLogo.test.tsx` 当前覆盖：

- 所有品牌工具都能渲染 `data-tool-logo`
- 品牌工具渲染结果中至少存在 `<img>` 或 `<svg>`
- `other` 会走 `GearIcon` SVG fallback
- 输出结果不匹配 `EMOJI_RE`

### 6.2 本轮真实验证结果（2026-04-22）

在 `D:\Desktop\CREATOR ONE\devhub` 执行：

```powershell
pnpm check:no-emoji
pnpm typecheck
pnpm lint
pnpm exec vitest run
pnpm build
pnpm test:e2e
```

结果：

- `pnpm check:no-emoji`：通过，`168 files`，`No emoji found`
- `pnpm typecheck`：通过
- `pnpm lint`：通过
- `pnpm exec vitest run`：通过，`22` 个测试文件、`295` 个测试全部通过
- `pnpm build`：通过，Electron main / preload / renderer 生产构建完成
- `pnpm test:e2e`：通过，`2 passed`，已覆盖主窗口启动、AI 任务面板无 Emoji 与品牌标识结构合法性
---

## 七、验收状态

### 7.1 P5.2

当前可以提升为：`[TEST-PASS]`

理由：

- `AITaskView` 已切换为 `AIToolBrandLogo`
- 品牌工具映射与 fallback 已完成
- 本地单测与静态校验已通过
- 无 Emoji 守卫已进入 lint 链路
- `E2E-P5.2` 已完成并通过

当前状态：

- 自动化验收已达到 `[TEST-PASS]`。
- 用户手测尚未由用户确认，因此不能标记为 `[USER-VERIFIED]`。

### 7.2 X4

当前可以提升为：`[TEST-PASS]`

理由：

- 当前源码扫描为零命中
- 检测关键字中的历史符号字符已完成源码转义治理
- `pnpm lint` 已把 no-emoji 守卫纳入持续验证
- `E2E-X4-no-emoji` 已完成并通过

当前状态：

- no-emoji 自动化验收已达到 `[TEST-PASS]`。
- 用户级回归手测尚未由用户确认，因此不能标记为 `[USER-VERIFIED]`。

---

## 八、Drift 修正记录

本文件替换了以下过时口径：

- 不再使用 `ToolLogo.tsx` / `AITaskCard.tsx` 作为当前主路径描述
- 不再把 `Roo`、`Aichat`、`GPT CLI` 作为本轮验收对象
- 不再要求“所有品牌都来自 brand-logos 目录”；当前真实实现是“部分来自 simple-icons，部分来自仓内 SVG 资产”
- 不再把 `P5.2` 维持为目标态描述，而是记录已落地的真实代码与验证结果

后续若继续扩充品牌覆盖，必须先更新 `AIToolType`、`AIToolBrandLogo`、单测、无 Emoji 校验，再更新本 spec。
