# spec/15 — 端口面板滚动 / 布局 / 超时文案规格

> 严重度：P1
> 对应用户诉求：P3.1（端口没滚动条 / 挤压 / 查询超时）
> 对应验收矩阵：P3.1-a / -b / -c
> 对应债务：D14（PortFocusPanel 作 overlay 挤占主列）

---

## 一、动机
用户截图 3 张：195159 / 195211 / 195211（查询超时）。三症状：
1. 主列表滚动条隐藏 / 不可见
2. PortFocusPanel 作为 overlay 挤占主列宽度；两者不能调整比例
3. "查询超时" 文案只有 3 字，没有后续操作

---

## 二、受影响源码

| 文件 | 变更 |
|------|------|
| `devhub/src/renderer/components/monitor/PortView.tsx` | 接入现有 `PanelSplitter`，改为真实双栏布局；端口列表滚动容器显式可滚动 |
| `devhub/src/renderer/components/monitor/PortFocusPanel.tsx`（搜"查询超时"） | 文案改造 + `重试` / `轻量模式` 控件 |
| `devhub/src/renderer/components/ui/PanelSplitter.tsx` | 复用现有通用二栏拆分组件 |
| `devhub/src/renderer/components/monitor/PortFocusPanel.test.tsx` | 超时 banner 与轻量模式单测 |

---

## 三、设计

### 3.1 滚动条样式

```css
/* current implementation */
[data-testid="port-list-scroll"] {
  overflow-y: scroll;
  scrollbar-gutter: stable both-edges;
}
```

当前仓库已在 `src/renderer/styles/globals.css` 提供全局 `::-webkit-scrollbar` 主题样式，因此本轮不新建 `scrollbar.css`，只在端口列表容器上显式开启稳定滚动槽位。

### 3.2 Split Pane

```tsx
// PanelSplitter.tsx
interface Props {
  direction: 'horizontal' | 'vertical'
  defaultSizes: number[]
  minSizes?: number[]
  maxSizes?: number[]
  storageKey?: string
  children: [ReactNode, ReactNode]
}
```

行为：
- 当前端口视图使用 `defaultSizes={[70, 30]}`、`minSizes={[640, 360]}`、`maxSizes={[9999, 560]}`、`storageKey="devhub:port-view-split"`
- divider 宽 4px，hover 高亮，支持拖拽调整比例
- 双击 divider 重置到初始比例

### 3.3 超时文案

```tsx
<TimeoutBanner
  ageSec={cachedAgeSec}
  lightModeEnabled={queryMode === 'light'}
  onRetry={handleRetry}
  onToggleLightMode={handleToggleLightMode}
/>

// 渲染：
"查询超时 - 当前显示 ${ageSec} 秒前的缓存数据"
[按钮] 重试
[Checkbox] 切换到轻量模式（避免再次超时）
```

当前实现说明：
- 超时 banner 实现在 `PortFocusPanel.tsx` 内部，未拆成独立文件，避免无谓拆分。
- 轻量模式不走 mock，而是直接基于当前端口扫描快照构建真实简版 `PortFocusData`。

---

## 四、错误矩阵

| 错误码 | 触发 | 文案 | 日志 |
|-------|-----|------|------|
| `PORT_QUERY_TIMEOUT` | getPortDetailIncremental > 3s | TimeoutBanner 文案 | WARN |
| `PORT_LIGHT_MODE_ON` | 用户切到轻量 | "已切到轻量模式" | INFO |
| `PORT_LIGHT_MODE_FAIL` | 轻量模式也失败 | "无法获取端口信息" | ERROR |
| `SCROLLBAR_GUTTER_MISSING` | 列表容器未开启稳定滚动槽位 | DEV only | DEBUG |

---

## 五、验收条件

### E2E-P3.1-a scrollbar visible
```
Given 端口数 >= 30，视口 1366x768
Then 主列表右侧可见滚动条（宽 >= 8px，颜色对比满足 WCAG AA）
When 用滚轮 / PageDown
Then 列表滚动
```

### E2E-P3.1-b resizable
```
Given PortView 开启 FocusPanel
Then 主列表最小宽度 >= 640px；FocusPanel 最小 360 最大 560
When 拖 divider
Then 比例随之变化
When 双击 divider
Then 回到初始比例
```

### E2E-P3.1-c timeout message
```
Given 某端口详情查询 > 3s
Then 面板顶部出现 TimeoutBanner
And 文字精确匹配: "查询超时 - 当前显示 .+ 秒前的缓存数据"
And "重试" 按钮可点击
And "切换到轻量模式" 复选框可切换
```

---

## 六、E2E 脚本

```typescript
test('P3.1-a scroll bar visible and functional', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-port"]')
  const list = win.locator('[data-testid="port-list-scroll"]')
  // 断言有滚动条
  const sbWidth = await list.evaluate(el => el.offsetWidth - el.clientWidth)
  expect(sbWidth).toBeGreaterThanOrEqual(6)
  // 滚动
  await list.evaluate(el => { el.scrollTop = 1000 })
  expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await app.close()
})
```

---

## 七、参考实现 / 库

- 现有仓内 `PanelSplitter`
- Chromium / Electron 原生滚动槽位与全局 `::-webkit-scrollbar` 样式
- 轻量模式基于当前扫描快照降级，不新增外部依赖

---

## 八、实现同步备注

- 本轮未新增 `port:switch-query-mode` IPC；轻量模式目前是 renderer 内基于当前扫描快照的真实降级逻辑。
- `port:get-detail-incremental` 继续沿用现有返回结构，`cachedAgeSec` 在 renderer 侧由 `lastScanTime` 推导。


---

## 九、2026-04-30 验证快照：P3.1-a/b/c TEST-PASS

- `PanelSplitter` 现在会在容器尺寸可用后校正初始或持久化比例：当两栏空间足够时，`minSizes` / `maxSizes` 不只在拖拽时生效，也会约束首次渲染和旧 `localStorage` 比例，避免 FocusPanel 因旧 70/30 比例被压到 360px 以下。
- `PortView` 的端口详情 splitter 使用 `stackBelow={1004}`。该阈值等于 640px 主列表 + 360px 详情 + 4px divider；当外层项目列表使子容器宽度不足时，端口详情先回流，避免继续以不可读双栏硬挤压。
- E2E 只使用真实 Electron、真实 `window.devhub.port.scan()`、真实 `port:get-detail-incremental`。本机当前端口样本满足 30 条以上前置，超时候选由真实增量详情查询返回 `source="timeout"` 后再进入 UI 验证。
- 验证命令：`pnpm typecheck` 通过；`pnpm build` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "P3.1" --timeout=90000 --workers=1` 为 2 passed (28.9s)。
- 边界说明：P3.1-a 在 1366x768 下验证滚动；P3.1-b 需要端口子容器实际宽度满足 1004px，测试通过真实 BrowserWindow 扩大监控工作区验证，不用 mock 尺寸或伪造端口。

## 十、2026-04-30 复验补丁：真实 timeout 结果短时一致性

- `port:get-detail-incremental` 在真实超时并返回 `cachedData` 时，会把同一端口的 timeout 结果保留 10 秒；后续立即打开 UI 详情时返回同一个真实 timeout/cache 结果，避免后台真实 timeout 被第二次快速 UI 查询覆盖成 fresh 状态，导致用户看不到降级原因。
- `PortFocusPanel` 的关闭按钮补充 `data-testid="port-focus-close-button"` 与 `aria-label="关闭端口详情"`，不改变业务逻辑，只提升真实 E2E 和键盘/辅助技术可达性。
- `E2E-P3.1-c` 仍以前置真实 `port:get-detail-incremental` timeout 为准；若当前端口环境没有真实 timeout，测试继续失败，不伪造通过。
- 复验命令：`pnpm typecheck && pnpm build`、`pnpm exec playwright test e2e/example.spec.ts -g "P3.1-c" --timeout=120000 --workers=1`、`pnpm test:e2e`。结果：`P3.1-c` 定向 1 passed，完整 Electron E2E 13 passed。
