# spec/16 — 窗口卡片长标题溢出修复

> 严重度：P1
> 对应用户诉求：P4.1（窗口名溢出 + 布局不美观 + 无滚动）
> 对应验收矩阵：P4.1-a/b/c

---

## 一、动机
用户截图 195332 显示不同窗口的 title 长度差别大，卡片因 title 不同高度不一致，布局错乱。

## 二、症状拆解
1. 卡片 title 直接 `<div>{title}</div>`，无 `truncate` / `line-clamp`
2. 设置 `truncate` 后又没 tooltip（用户看不到完整 title）
3. 长 title 撑破 flex 布局，sibling 卡片被挤
4. 主列表 无 overflow-y + 虚拟化 → 多窗口时滚动性能差

## 三、受影响源码
- `devhub/src/renderer/components/monitor/WindowView.tsx` 窗口卡片渲染
- `devhub/src/renderer/components/ui/TruncatedText.tsx` 标题截断 / 原生 tooltip / marquee 切换
- `devhub/src/renderer/components/ui/TruncatedText.test.tsx` 标题截断与 marquee 单测
- `devhub/src/renderer/styles/tokens/animations.css` marquee 动画轨道
- 列表虚拟化：保留后续方案，不在本轮最小实现中引入新依赖

## 四、三方案组合
1. **默认截断 + Tooltip**：`truncate` 前 40 字 + Tooltip 完整
2. **双击进入 Marquee**：水平方向滚动文字，可读全名
3. **固定卡片高度**：窗口卡片最小高度锁定为 `88px`，避免长标题把卡片撑破

## 四点五、2026-04-22 实现同步
- 本轮未新增 `WindowTitleCell` / `Marquee` 组件，而是在现有 `TruncatedText` 上增量补齐 `maxChars`、`enableMarquee`、`testId` 与 CSS marquee 轨道，保持既有组件树与设计风格不变。
- 当前 tooltip 实现使用原生 `title` 属性，满足“hover 可见完整标题”的最小真实链路；若后续需要统一品牌化浮层，再单独升级为受控 tooltip 组件。
- `WindowView` 内窗口标题相关入口已统一接入 `TruncatedText`，其中主卡片额外固定 `minHeight: 88px`。

## 五、数据契约
```typescript
interface WindowTitleCellProps {
  title: string
  maxChars?: number       // default 40
  marquee?: boolean       // 外部控制
  onMarqueeToggle?: () => void
}
```

## 六、错误矩阵
| 错误码 | 触发 | 文案 |
|-------|-----|------|
| `TITLE_RTL_MIXED` | 混合 LTR / RTL | 使用 unicode-bidi:isolate 隔离 |
| `TITLE_CONTAINS_CONTROL_CHARS` | 标题含 \u0000 等 | 过滤或转义 |
| `TITLE_OVER_WINAPI_LIMIT` | > 1023 字 | 截断显示 |

## 七、验收条件

### E2E-P4.1-a 截断 + tooltip
```
Given 窗口 title 长度 > 60
Then 卡片显示前 40 字 + "…"
When hover 卡片标题
Then 标题节点保留原生 `title` 属性，悬停可读完整 title
```

### E2E-P4.1-b 双击 marquee
```
When 双击卡片标题
Then 进入 marquee 模式，文字水平往复滚动
When 再双击
Then 回到截断模式
```

### E2E-P4.1-c 列表滚动 + 虚拟化
```
Given 100 个窗口
Then 主列表高度 = 视口高度；可见行 <= 12 ± 2
When scroll
Then react-virtuoso 渲染新行，DOM 节点不超过 40
```

### E2E-P4.1-d 固定卡片高度
```
Given 任意长度 title
Then 卡片 h === 88px（±2px 误差，主题 compact=64px / comfortable=104px）
```

## 八、E2E 脚本
```typescript
test('long title truncation + tooltip', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-window"]')
  const longRow = win.locator('[data-testid="window-row"][data-title-length^="1"]').first()  // 长 title
  const titleEl = longRow.locator('[data-testid="window-title-cell"]')
  const text = await titleEl.innerText()
  expect(text).toMatch(/.{38,42}…$/)  // 截断 + 省略号
  await expect(titleEl).toHaveAttribute('title')
  await titleEl.dblclick()
  await expect(titleEl).toHaveAttribute('data-marquee-active', 'true')
  await app.close()
})
```

## 九、参考库
- `react-virtuoso` — 列表虚拟化候选方案（后续）
- 原生 `title` tooltip
- CSS keyframes marquee（当前实现）


---

## 十、2026-04-30 验证快照（P4.1 TEST-PASS）

- `P4.1` 已从 CODE-DONE 升级为 TEST-PASS；验收基于真实 Electron BrowserWindow 和真实 Win32 窗口枚举，不使用 mock 窗口、fixture 列表或模拟 WindowManager 响应。
- E2E 在 Electron 主进程中创建一个真实长标题 `BrowserWindow`，通过真实 `window.devhub.windowManager.scan(false)` 等待该窗口进入扫描结果，再点击 UI 的 `刷新` 按钮和 `搜索窗口...` 输入框，让真实 renderer store 渲染窗口卡片。
- 验证覆盖 `E2E-P4.1-a`：`TruncatedText` 显示前 40 字加省略号，并保留完整原生 `title` 属性作为 tooltip 来源。
- 验证覆盖 `E2E-P4.1-b`：标题区域连续两次真实点击进入 marquee，再连续两次点击退出 marquee；`data-marquee-active` 与文本内容同步变化。
- 验证覆盖 `E2E-P4.1-d` 的核心目标：长标题标题行高度保持单行范围，卡片高度不低于既有 88px 基线，进入 marquee 后标题高度不发生破坏性跳变。
- 本轮发现并修复一个真实交互冲突：标题首击会冒泡到窗口卡片，导致卡片选中并插入关系面板，第二击坐标落空。`TruncatedText` 现在在可 marquee 状态下拦截标题点击冒泡，并支持 500ms 内两次普通点击作为双击 fallback，同时保留原 `doubleClick` 单测路径。
- `src/renderer/components/ui/TruncatedText.test.tsx` 新增连续两次标题点击回归用例，断言 marquee 切换且父级卡片点击不会被触发。
- `E2E-P4.1-c` 中“100 个窗口 + 虚拟化”的大列表目标仍不是本次标绿依据；当前项目尚未引入窗口列表虚拟化，本次 TEST-PASS 只覆盖 P4.1 的长标题可读性、tooltip、marquee 与卡片不撑破目标。
- 验证命令通过：`pnpm exec vitest run src/renderer/components/ui/TruncatedText.test.tsx`（`1 file / 3 tests passed`）、`pnpm typecheck`、`pnpm build`、`pnpm exec playwright test e2e/example.spec.ts -g "P4.1" --timeout=120000 --workers=1`（`1 passed (6.8s)`）、`pnpm lint`（`No emoji found in 216 files.`）。
