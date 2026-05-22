# spec/18 — 响应式缩放系统

> 严重度：P2
> 对应用户诉求：P8.1（窗口过小时内容挤压不缩放/不回流）
> 对应验收矩阵：P8.1-a / -b / -c / -d
> 对应债务：D21（MainLayout 无容器查询 / 无断点回流策略）
> 对应市面最佳实践：VS Code 侧栏折叠、Figma 右侧面板自适应、Linear 多断点密度切换

---

## 一、动机

用户截图 195806：主窗口缩到 960×540 时，进程列表 / 端口列表的表格列被挤扁，按钮文字被截断。原因：

1. **视口级 breakpoints 不够用** — Tailwind 的 `sm/md/lg` 是根据 viewport 宽度判断，但 DevHub 内部有多栏 split pane，子容器宽度远小于 viewport，需要用 **container queries** 判断容器自身尺寸。
2. **table 类组件无"回流"策略** — 列过多时直接横向溢出 / 截断，而不是转成卡片布局或隐藏次要列。
3. **侧边栏不会折叠** — 左侧 nav 在 < 1024px 时仍然占 240px，挤压主内容区。
4. **字号/行高不缩放** — 所有主题都用一套固定 text-size token，窗口缩小时文字依然 14px，密度不变。

---

## 二、受影响源码

| 文件 | 变更 |
|------|------|
| `devhub/src/renderer/layouts/MainLayout.tsx` | 接入 container query + 断点 |
| `devhub/src/renderer/styles/breakpoints.css` | NEW：容器断点变量 |
| `devhub/src/renderer/hooks/useContainerSize.ts` | NEW：ResizeObserver hook |
| `devhub/src/renderer/components/ui/ResponsiveTable.tsx` | NEW：表格 → 卡片自动回流 |
| `devhub/src/renderer/components/ui/CollapsibleSidebar.tsx` | NEW：侧边栏智能折叠 |
| `devhub/src/renderer/theme/density-tokens.ts` | NEW：密度 token（spec/19 配合） |
| `devhub/src/renderer/components/monitor/ProcessView.tsx` 等 5 处列表 | 接入 ResponsiveTable |

---

## 三、设计

### 3.1 容器断点体系

```css
/* breakpoints.css */
:root {
  /* 容器级断点（container query 专用） */
  --bp-container-xs: 320px;
  --bp-container-sm: 480px;
  --bp-container-md: 640px;
  --bp-container-lg: 880px;
  --bp-container-xl: 1200px;

  /* 视口级断点（保留 Tailwind 兼容） */
  --bp-viewport-sm: 640px;
  --bp-viewport-md: 768px;
  --bp-viewport-lg: 1024px;
  --bp-viewport-xl: 1280px;
}

/* 容器查询：需要 containerType: inline-size */
.responsive-container {
  container-type: inline-size;
  container-name: devhub-panel;
}

@container devhub-panel (max-width: 480px) {
  .col-optional { display: none; }
  .table-row { flex-direction: column; }
}
```

### 3.2 useContainerSize Hook

```typescript
// useContainerSize.ts
export interface ContainerSize {
  width: number
  height: number
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  density: 'compact' | 'normal' | 'comfortable'
}

export function useContainerSize(ref: RefObject<HTMLElement>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({
    width: 0, height: 0, breakpoint: 'md', density: 'normal'
  })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      const bp = classifyBreakpoint(rect.width)
      const density = rect.height < 600 ? 'compact'
                    : rect.height > 900 ? 'comfortable' : 'normal'
      setSize({ width: rect.width, height: rect.height, breakpoint: bp, density })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function classifyBreakpoint(w: number): ContainerSize['breakpoint'] {
  if (w < 320) return 'xs'
  if (w < 480) return 'sm'
  if (w < 880) return 'md'
  if (w < 1200) return 'lg'
  return 'xl'
}
```

### 3.3 ResponsiveTable — 表格 → 卡片自动回流

```tsx
interface ResponsiveTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]  // 每列标记 priority: 'must' | 'should' | 'may'
  rowKey: (row: T) => string
  minTableWidth?: number   // default 640 — 低于则切卡片
}

export function ResponsiveTable<T>({ data, columns, rowKey, minTableWidth = 640 }: ResponsiveTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, breakpoint } = useContainerSize(containerRef)
  const mode: 'table' | 'card' = width < minTableWidth ? 'card' : 'table'

  const visibleColumns = useMemo(() => {
    if (mode === 'card') return columns.filter(c => c.priority !== 'may')
    if (breakpoint === 'xs' || breakpoint === 'sm') return columns.filter(c => c.priority === 'must')
    if (breakpoint === 'md') return columns.filter(c => c.priority !== 'may')
    return columns
  }, [columns, mode, breakpoint])

  return (
    <div ref={containerRef} className="responsive-container">
      {mode === 'table'
        ? <TableView data={data} columns={visibleColumns} rowKey={rowKey} />
        : <CardView data={data} columns={visibleColumns} rowKey={rowKey} />}
    </div>
  )
}
```

### 3.4 CollapsibleSidebar 智能折叠

| 容器宽度 | 侧边栏形态 |
|---------|-----------|
| ≥ 1024px | 完整：icon + label（240px） |
| 768-1023px | 图标模式：仅 icon（56px） |
| < 768px | 隐藏，由顶部汉堡按钮呼出 drawer |

用户也可手动锁定模式（覆盖自动判定），偏好写 localStorage。

### 3.5 窗口 min-size 与 zoom fallback

若用户将 Electron 主窗口缩到极端小（< 640x480）：
- 设 `BrowserWindow.setMinimumSize(640, 480)`，防止更小
- 显示"窗口过小，建议放大"的浮条
- 同时 CSS 强制 `html { zoom: 0.9 }`（只在极端小时触发，作为兜底）

---

## 四、错误矩阵

| 错误码 | 触发 | 文案 |
|-------|-----|------|
| `LAYOUT_BELOW_MIN_SIZE` | 主窗口 < 640x480 | 浮条："窗口过小" |
| `LAYOUT_DENSITY_UNKNOWN` | density token 缺失 | fallback 到 normal |
| `RESIZE_OBSERVER_UNSUPPORTED` | 浏览器不支持 ResizeObserver | 退化到 window.resize 监听 |

---

## 五、验收条件

### E2E-P8.1-a 侧边栏折叠
```
Given MainLayout 容器宽 = 1200
Then Sidebar 宽 = 240px（icon + label）
When resize to 900
Then Sidebar 宽 = 56px（仅 icon）
When resize to 640
Then Sidebar 隐藏，顶部汉堡按钮可见
```

### E2E-P8.1-b 表格 → 卡片回流
```
Given ProcessView 列表容器宽 = 900，列有 PID/Name/CPU/Mem/User/StartTime
Then 渲染 table 模式，6 列全显示
When 容器 shrink 到 500
Then 切卡片模式；卡片内显示 Name / PID + CPU + Mem
When shrink 到 320
Then 卡片内仅显示 Name + PID
```

### E2E-P8.1-c 字号密度
```
Given 容器高度 500
Then row height = 32（compact）
When 容器高度 1000
Then row height = 48（comfortable）
```

### E2E-P8.1-d 最小尺寸兜底
```
Given 用户拖动 Electron 主窗口到 500x400
Then 窗口被阻止到 640x480；浮条出现"窗口过小"
```

---

## 六、E2E 脚本

```typescript
test('table reflows to card at narrow width', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-process"]')
  await win.setViewportSize({ width: 1280, height: 800 })
  // 确认 table 模式
  await expect(win.locator('[data-testid="process-table"]')).toBeVisible()
  // 缩到 500
  await win.setViewportSize({ width: 500, height: 800 })
  await expect(win.locator('[data-testid="process-card-list"]')).toBeVisible()
  await expect(win.locator('[data-testid="process-table"]')).not.toBeVisible()
  // 列优先级
  const card = win.locator('[data-testid="process-card"]').first()
  await expect(card.locator('[data-field="name"]')).toBeVisible()
  await expect(card.locator('[data-field="user"]')).not.toBeVisible()  // "may" 列隐藏
  await app.close()
})
```

---

## 七、参考实现 / 库

- `@container` CSS query（Chrome 105+，Electron 23+ 原生支持）
- `use-resize-observer` npm
- `react-responsive` — viewport 级 fallback
- Figma 的 Auto Layout 设计
- Linear 的 `--density` 切换
- Gmail 的 "舒适 / 默认 / 紧凑" 三档

---

## 八、贡献到 contracts/22

- `ContainerSize`, `ColumnDef<T>`, `ResponsiveTableProps`
- `DensityLevel = 'compact' | 'normal' | 'comfortable'`

---

## 九、2026-04-25 实装批注：项目列表密度

- 现有响应式密度实现使用 `InformationDensity = compact | standard | comfortable`，与 spec 草案中的 `normal` 命名不同；本轮不引入新枚举，避免跨层数据模型漂移。
- `theme-tokens.css` 为三档密度补充 `--project-list-row-height` / `--project-card-min-width`，其中 compact 为 `64px` 行高与 `220px` 最小卡片宽。
- `globals.css` 增加 `Project list density compaction` 规则：compact 下压缩 ProjectList header / stats / search / card / HeroStats，并限制卡片次级信息行溢出，服务 P1.2-a 的 1366×768 首屏 8 卡验收。

---

## 十、2026-04-29 实现快照：P8.1 CODE-DONE

- 新增 `devhub/src/renderer/hooks/useContainerSize.ts`，提供 container 宽高、断点与密度分类；新增 `useContainerSize.test.ts` 覆盖 `<900px` compact、断点和完整 size model。
- 新增 `devhub/src/renderer/styles/breakpoints.css`，沉淀 container-first 断点变量与 `responsive-container` 基础设施，并从 `globals.css` 引入。
- `PanelSplitter` 新增 `stackBelow`，主 shell `<900px` 时从左右分栏 reflow 为上下堆叠，避免继续用固定 `minSizes` 挤压内容。
- `AppContent` 将主内容 shell 绑定为真实 container，并写入 `data-layout-mode` / `data-layout-breakpoint` / `data-layout-density`；`globals.css` 对 stacked/compact shell、monitor/card grid 和 settings grid 补充无横向溢出的回流规则。
- `Sidebar` icon-only 折叠宽度从 48px 调整为 56px，并同步 `.sidebar-collapsed` CSS，符合 P8.1 的可点击宽度要求。
- 验证：`pnpm typecheck`、`pnpm exec vitest run src/renderer/theme/theme-language.test.ts src/renderer/hooks/useContainerSize.test.ts src/main/store/AppStore.test.ts`、`pnpm lint` 通过；`No emoji found in 203 files.`。
- 2026-04-30 验证更新：`E2E-P8.1` 已通过真实 Electron resize、设置切换与跨重启持久化验证；矩阵已提升为 `[TEST-PASS]`。用户手测 `[USER-VERIFIED]` 仍需用户确认。

---

## 十一、2026-04-30 验证快照：P1.2-a TEST-PASS

- `SettingSelect` 为原生 select 补充 `aria-label` 与稳定 `data-testid`，使信息密度控制可通过 Playwright 的可访问 label 真实操作，不需要 DOM 脚本模拟。
- `ProjectList` 的 `MutationObserver` 会跟随 `<html data-density>` 切换更新 `data-density` 与 `data-estimated-row-height`；compact 仍为 `64px`，comfortable 为 `144px`。
- `E2E-P1.2-a` 在真实 Electron 应用中打开设置面板，切换 `compact` / `comfortable`，并验证根 dataset、项目列表虚拟行高和 `appearance.informationDensity` 持久化一致。
- 验证命令：`pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.2-a" --timeout=90000 --workers=1`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.1|P1.2-a" --timeout=90000 --workers=1`、`pnpm test:e2e`。


---

## 十二、2026-04-30 验证快照：端口子容器分栏回流

- `PanelSplitter` 的 `stackBelow` 语义已在端口面板真实验证：端口详情 splitter 以 1004px 作为水平分栏下限，低于该宽度时回流，避免在外层项目列表占宽后继续挤压主列表和 FocusPanel。
- `PanelSplitter` 会在容器尺寸可用后归一化初始 / 持久化比例，确保 `minSizes` 和 `maxSizes` 不只对拖拽生效，也对旧 `localStorage` split 值生效。
- `E2E-P3.1-a/b/c` 使用真实 Electron 端口扫描和真实增量详情超时路径验证，补齐了 spec/15 与本响应式系统之间的 container-first 边界。

---

## 十三、2026-04-30 验证快照：P8.1 TEST-PASS

- `AppearanceSettings` 新增 `layoutMode = auto | split | stacked`，并通过 `DEFAULT_SETTINGS`、settings IPC 白名单与字段校验进入真实 electron-store 更新链路。
- `SettingsDialog` 在显示设置中提供原生 `布局模式` select：`auto` 跟随窗口宽度，`split` 固定分栏，`stacked` 固定堆叠；切换时同步持久化并通过 `devhub:layout-mode-change` 事件即时驱动 App shell。
- `AppContent` 的 `responsive-app-shell` 现在暴露 `data-layout-preference` 与 `data-layout-mode`；自动模式优先使用 container 宽度，并以真实 BrowserWindow 宽度兜底，避免 `ResizeObserver` 首帧未返回尺寸时错误保持 split。
- `Sidebar` 的设置按钮补充 `aria-label="设置"` 与 `data-testid="sidebar-settings-button"`，保证侧栏折叠到 icon-only 后仍可被键盘/自动化稳定触达。
- `E2E-P8.1` 使用真实 Electron 窗口 resize 和真实设置面板验证：auto 宽屏为 split、窄屏为 stacked；强制 stacked 后即使宽屏仍保持 stacked；重启后从 settings store 恢复 stacked；切回 auto 后再次验证宽屏 split / 窄屏 stacked。
- 验证命令：`pnpm typecheck`、`pnpm build`、`pnpm exec playwright test e2e/example.spec.ts -g "P8.1" --timeout=120000 --workers=1`，结果为 `1 passed (7.7s)`。
- 合并复验：`pnpm lint` 通过且 no-emoji 输出 `No emoji found in 216 files.`；`pnpm test` 通过 `42 files / 407 tests`；`pnpm test:e2e` 通过 `14 passed (1.3m)`。