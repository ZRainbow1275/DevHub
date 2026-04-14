# DevHub V2 Code-Review 第五轮修复 — PRD

> 日期: 2026-04-14
> 执行人: ZRainbow
> 工作模式: `/trellis:parallel` — 3 个独立 Agent Team 并行
> 子模块: `devhub/` (branch: `master`, 最后提交: `21b42ad`)
> 基线: TypeScript 0 errors, ESLint 2 errors + 1 warning, Vitest 254/254

---

## 一、背景

### 1.1 历史脉络

| 轮次 | 日期 | 产出 | 状态 |
|------|------|------|------|
| Round 1-2 | 2026-04-10 | 主进程 code-review 11 问题 (`CODE_REVIEW_REPORT.md`) | CRITICAL+HIGH 5 已修复 |
| Round 3 | 2026-04-11 | 6 大模块 spec (`prompts/0411/`) | 6 agent teams 已完成 |
| Round 4 | 2026-04-12 | 手测回归确认 + 性能安全后置 | 核心功能已修复 |
| **Round 5** | **2026-04-14** | **本次：剩余代码质量 + lint 基线修复** | **待执行** |

### 1.2 本轮 Code-Review 发现

使用 GitNexus + Serena + ABCoder 深度扫描后确认：

**✅ 已修复的旧问题**（4/6，无需再处理）:
- #7 TaskHistoryHandlers 日期解析 → `validateDateString()` 已加入
- #8 PortScanner CSV 解析 → `parseCsvLine()` 重写为完整 CSV 解析器
- #10 ProcessManager 错误堆栈 → 已包含 `error.stack`
- #11 WindowHelper C# 主体 → `HELPER_ADD_TYPE` 静态常量已缓存（部分）

**🔴 本轮必修**（基线问题 + 真实代码质量缺陷）:

| # | 问题 | 文件/位置 | 严重级别 | Team |
|---|------|----------|---------|------|
| L1 | ESLint 报错：`require()` 风格导入被禁止 | `resources/splash-preload.js:1` | **P0** | Team A |
| L2 | ESLint 报错：`require` 全局未定义 | `resources/splash-preload.js:1` | **P0** | Team A |
| L3 | ESLint 警告：`console.log` 不允许 | `src/main/services/BackgroundScannerManager.ts:232` | **P1** | Team A |
| T1 | 裸类型断言 `as unknown as AIWindowAlias` | `src/main/ipc/aiTaskHandlers.ts:233` | **P1** | Team B |
| T2 | 裸类型断言 `as unknown as Record<string, unknown>` | `src/main/store/AppStore.ts:201` | **P1** | Team B |
| T3 | 裸类型断言 `as unknown as Store<...>` | `src/main/store/AppStore.ts:225` | **P1** | Team B |
| T4 | 设置合并多处裸断言 | `src/shared/types.ts:291, 331-333` | **P2** | Team B |
| T5 | ScannerCache 裸断言（Record 转换） | `src/main/services/ScannerCache.ts:57-58` | **P2** | Team B |
| P1 | `scanWindows` 的 C# 代码每次内联编译 | `src/main/services/WindowManager.ts:113-156` | **P1** | Team C |

---

## 二、目标 & 非目标

### 2.1 目标（Must Have）

1. ✅ ESLint 通过（0 errors 0 warnings），为 CI 解锁
2. ✅ 消除主进程边界处所有裸 `as unknown as` → 改用类型守卫 (`isAIWindowAlias`, `isAppSettingsShape`, `hasWindowBounds` 等)
3. ✅ 提取 `WindowManager.scanWindows` 的 C# 代码为静态常量 `HELPER_WINDOW_ENUMERATOR`（与现有 `HELPER_ADD_TYPE` 一致）
4. ✅ 所有改动保持 TypeScript 0 errors + Vitest 254/254 通过
5. ✅ 每个被修改符号先做 `gitnexus_impact` 分析
6. ✅ 提交前 `gitnexus_detect_changes` 验证影响范围

### 2.2 非目标（Won't Do This Round）

- ❌ 不新增功能
- ❌ 不重构目录结构
- ❌ 不改动渲染器 React 组件（除非 TypeCheck 要求级联）
- ❌ 不处理已存档的测试轮次遗留 P2/P3（由 04-10-devhub-v2-testing-findings 单独追踪）

---

## 三、Agent Team 分工（/trellis:parallel）

> 三个 team 在独立 git worktree 中工作，互不冲突；文件修改范围无交集。

### Team A — Lint 基线修复（ 最小范围，最早完成）

**负责文件**:
- `resources/splash-preload.js`（修复 require 错误）
- `eslint.config.js`（添加 preload 脚本的 CommonJS 例外规则）
- `src/main/services/BackgroundScannerManager.ts:232`（`console.log` → `console.info` 或删除）

**验收标准**:
- [x] `pnpm run lint` 退出码 = 0，0 errors 0 warnings
- [x] preload 脚本仍能被 Electron 正常加载
- [x] BackgroundScannerManager 恢复日志保留但不触发 lint 规则

**关键实现**:
```js
// eslint.config.js: 为 preload 脚本豁免（CommonJS）
{
  files: ['resources/**/*.js'],
  languageOptions: {
    globals: { ...globals.node },
    sourceType: 'commonjs'
  },
  rules: {
    '@typescript-eslint/no-require-imports': 'off'
  }
}
```

---

### Team B — 类型安全改造（中等范围，影响主进程类型边界）

**负责文件**:
- `src/main/ipc/aiTaskHandlers.ts`（行 230-241）
- `src/main/store/AppStore.ts`（行 198-228）
- `src/shared/types.ts`（行 280-335，settings 合并函数）
- `src/main/services/ScannerCache.ts`（行 55-60）
- `src/shared/types-extended.ts`（新增 `isAIWindowAlias` 类型守卫）

**验收标准**:
- [x] 不再出现 `as unknown as X`（测试文件可保留）
- [x] 每处转换由 `isX()` 类型守卫或 Zod schema 替代
- [x] IPC 边界错误消息更具业务语义（如 "Invalid alias schema: missing matchCriteria"）
- [x] TypeScript 0 errors
- [x] Vitest 相关用例全部通过

**关键实现**:
```ts
// types-extended.ts — 新增类型守卫
export function isAIWindowAlias(v: unknown): v is AIWindowAlias {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return typeof a.id === 'string'
    && typeof a.alias === 'string'
    && typeof a.matchCriteria === 'object'
    && a.matchCriteria !== null
}

// aiTaskHandlers.ts — 用类型守卫替换裸断言
validateObject(alias, 'alias')
guardProtoPollution(alias)
if (!isAIWindowAlias(alias)) {
  throw new Error('Invalid alias: schema mismatch')
}
// 此处 alias 已是 AIWindowAlias 类型，无需 as
return aliasManager.set(alias)
```

**Impact 预期**: 均为 d=1 直接调用点；修改 public type guard 会波及 2-3 处 import。

---

### Team C — WindowManager C# 缓存优化（独立文件，性能改进）

**负责文件**:
- `src/main/services/WindowManager.ts`（仅影响 `scanWindows` 方法和静态常量区块）

**验收标准**:
- [x] `scanWindows` 内的 C# 代码提取为类 `HELPER_WINDOW_ENUMERATOR` 静态常量
- [x] 代码风格与现有 `HELPER_ADD_TYPE` 常量一致（单行 here-string）
- [x] PowerShell 调用语义无变化（仍然是新进程，C# 每次仍会 JIT，但源码侧只存一份）
- [x] 窗口扫描功能端到端验证：启动应用 → 窗口视图能枚举可见窗口
- [x] TypeScript 0 errors

**关键实现**:
```ts
// 添加到 HELPER_ADD_TYPE 附近
private static readonly HELPER_WINDOW_ENUMERATOR = `Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class WindowEnumerator { /* ... */ }
"@`

// scanWindows 内
const script = `$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${WindowManager.HELPER_WINDOW_ENUMERATOR}
[WindowEnumerator]::GetWindows()`
```

**Impact 预期**: `scanWindows` 被 `windowHandlers.ts` 调用；d=1 无破坏性变化。

---

## 四、验收 & 验证

### 4.1 Dispatcher 统一验证（3 个 team 完成后串行）

```bash
cd devhub
pnpm run typecheck    # 期望: 0 errors
pnpm run lint         # 期望: 0 errors 0 warnings
pnpm test --run       # 期望: 254/254 passed
```

### 4.2 GitNexus 影响闭环

```
每 team 完成后:
  gitnexus_detect_changes({scope: "unstaged", repo: "devhub"})
  → 验证只影响预期符号

Dispatcher 合并后:
  gitnexus_detect_changes({scope: "all", repo: "devhub"})
  → 确认无跨 team 副作用
```

### 4.3 功能回归清单（手测确认）

- [ ] 应用启动正常（splash-preload 不报错）
- [ ] AI 别名保存/读取正常（AIAliasManager CRUD）
- [ ] 设置读写正常（AppStore getSettings/updateSettings）
- [ ] 窗口扫描正常（WindowManager scanWindows）
- [ ] 背景扫描器恢复机制可观测（BackgroundScannerManager 重试日志）

---

## 五、风险 & 回滚

| 风险 | 概率 | 缓解 |
|------|------|------|
| 类型守卫误拒合法数据 | LOW | 先保留 Zod parse 兜底；失败时记录完整 payload 再抛 |
| ESLint 配置例外引入其他误报 | LOW | 限定 `files: ['resources/**/*.js']` 最小 glob |
| WindowManager 重构改变换行/编码 | LOW | 保持与 HELPER_ADD_TYPE 完全一致的 here-string 写法 |
| Agent team 合并冲突 | 极低 | 文件范围互不相交，但 dispatcher 负责最终 rebase |

**回滚策略**: 三个 worktree 独立；任一 team 失败不影响其他 team 合入；dispatcher 在合并前可选择性回退单个 team。

---

## 六、交付物

- `devhub/` 一个合并提交（或 3 个连续提交对应 3 个 team）
- 本 PRD 归档到 `.trellis/tasks/archive/2026-04/`
- `devhub/CODE_REVIEW_ROUND5_SUMMARY.md`（新增，记录本轮修复详情和 before/after）
- GitNexus 索引更新（`npx gitnexus analyze --embeddings` 由 post-commit hook 自动触发）

---

## 七、Dispatcher 工作流（本次执行）

```
Phase 0: 准备
  └─ /trellis:parallel 创建 3 个 worktree

Phase 1: 并行开发（3 team 同时）
  ├─ Team A: Lint 修复
  ├─ Team B: 类型安全改造
  └─ Team C: WindowManager 缓存

Phase 2: 串行验证（dispatcher）
  ├─ 合并 3 个 worktree 到主分支（最小冲突）
  ├─ typecheck + lint + test
  ├─ gitnexus_detect_changes 全量扫描
  └─ 生成 ROUND5_SUMMARY

Phase 3: 清理
  └─ 清理 worktree，归档任务
```
