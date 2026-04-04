# Task: code-review-high-fixes

## Overview
修复代码审查中剩余的 5 个 HIGH 优先级问题，涉及子进程超时、类型安全、性能优化、竞态条件和代码可读性。

## Requirements

### HIGH-5: WindowManager.ts execFileAsync 缺少 timeout
- **文件**: `devhub/src/main/services/WindowManager.ts`
- **问题**: 除 `scanWindows`（第156行，已有 `timeout: 15000`）外，其余 6 处 `execFileAsync` 调用缺少 timeout 参数
- **修复**: 在第246、280、300、320、340、511行的 `execFileAsync` 选项中添加 `timeout: 15000`
- **影响范围**: `focusWindow`、`moveWindow`、`minimizeWindow`、`maximizeWindow`、`closeWindow`、`batchGetProcessNames`

### HIGH-6: PortScanner.ts normalizeState 未知状态处理不当
- **文件**: `devhub/src/main/services/PortScanner.ts`
- **问题**: `normalizeState` 方法（第129-137行）将未知 TCP 状态默认为 `LISTENING`，这会导致误报
- **修复方案**: 在 `parseNetstatOutput` 中跳过 `normalizeState` 无法匹配的行（返回 `null` 并在调用侧过滤）
- **类型依赖**: `PortState` 定义在 `devhub/src/shared/types-extended.ts` 第40行
- **注意**: `portStore.ts` 中有同名但不同用途的本地 `PortState` 接口（Zustand store 状态），修改时需区分
- **测试**: `PortScanner.test.ts` 第61行断言未知状态默认为 LISTENING，需同步更新

### HIGH-7: ProjectWatcher.ts Windows polling 性能问题
- **文件**: `devhub/src/main/services/ProjectWatcher.ts`
- **问题**: 第92-93行 `usePolling: true` 配合 `interval: 5000`（5秒），对大目录过于频繁
- **修复**: 将 `interval` 从 `5000` 改为 `30000`（30秒）
- **背景**: Windows 上 `fs.watch` 不可靠，必须使用 polling，但可以降低频率

### HIGH-8: WindowView.tsx showSystemWindows 切换竞态条件
- **文件**: `devhub/src/renderer/components/monitor/WindowView.tsx`
- **问题**: 第804-810行 `handleToggleSystemWindows` 中 `scan(next)` 是异步调用，快速切换时旧 scan 结果可能覆盖新结果
- **修复**: 用 `useRef` 存储递增计数器，每次 scan 前递增，scan 回调返回后检查计数器一致性，不一致则丢弃结果
- **相关文件**: `useWindows.ts` 中的 `scan` 函数直接调用 `setWindows` 无竞态保护
- **注意**: 代码库中无现有竞态处理模式，此为首次引入

### HIGH-9: useTheme.ts 多层类型断言可读性差
- **文件**: `devhub/src/renderer/hooks/useTheme.ts`
- **问题**: 第22行 `(s as Record<string, unknown> | null)?.theme as string` 嵌套类型断言可读性差
- **修复**: 提取类型守卫函数如 `isLegacySettings(s): s is { theme: string }` 或安全提取函数 `extractThemeValue(s): string`

## Acceptance Criteria

- [ ] HIGH-5: WindowManager.ts 中所有 execFileAsync 调用均包含 `timeout: 15000`
- [ ] HIGH-6: PortScanner.ts 的 normalizeState 返回 `null`（或类似标识）表示未知状态，调用侧正确过滤
- [ ] HIGH-6: PortScanner.test.ts 测试用例已更新，验证未知状态不再默认为 LISTENING
- [ ] HIGH-7: ProjectWatcher.ts 的 polling interval 已改为 30000ms
- [ ] HIGH-8: WindowView.tsx 使用 useRef 追踪 scan 版本，旧 scan 结果不会覆盖新结果
- [ ] HIGH-9: useTheme.ts 中多层类型断言已替换为类型守卫函数
- [ ] 所有修改文件通过 TypeScript 编译（tsc --noEmit）
- [ ] 无引入新的 lint 警告

## Technical Notes

1. **HIGH-5**: `scanWindows` 已有 timeout，是其余调用的参照模板。所有 PowerShell 调用使用相同的 15000ms 超时。

2. **HIGH-6 实现策略**: 推荐方案 (b) — 在 `parseNetstatOutput` 中跳过未匹配行，而非扩展 `PortState` 类型。理由：
   - 不影响下游消费者（portStore、UI 组件）
   - 避免引入 `UNKNOWN` 状态后需要在各处处理
   - `normalizeState` 改为返回 `PortState | null`，`parseNetstatOutput` 中 filter 掉 null

3. **HIGH-8 实现策略**: 在 `WindowView.tsx` 层包装 scan 调用：
   - 添加 `scanVersionRef = useRef(0)`
   - `handleToggleSystemWindows` 中递增 version 并捕获当前值
   - scan 完成后比对 version，不一致则 return 不写入 store
   - 可能需要修改 `useWindows.ts` 的 `scan` 使其返回数据而非直接写入 store，或在 WindowView 层拦截

4. **portStore.ts 命名注意**: 本地接口 `PortState`（store 状态）与 `types-extended.ts` 的 `PortState`（TCP 状态联合类型）同名但无关。修改 TCP 状态类型时不会影响 store 接口。

## Out of Scope
- 其他服务文件（PortScanner.ts、SystemProcessScanner.ts、ProjectScanner.ts 等）中的 execFileAsync timeout（本任务仅限 WindowManager.ts）
- 扩展 PortState 类型为完整 TCP 状态集（仅跳过未知状态）
- 重构 useWindows.ts 的整体架构
- 修复 LOW/MEDIUM 优先级的代码审查问题
