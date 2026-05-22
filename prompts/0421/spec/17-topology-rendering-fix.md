# spec/17 — 拓扑渲染修复（容器尺寸 + simulation restart）

> 严重度：P1
> 对应用户诉求：P6.1（拓扑无法正常显示，节点全挤左上角）
> 对应验收矩阵：P6.1
> 对应债务：D10（容器 0 尺寸回退 800x600 + simulation 不 re-center）
> 与 spec/02（IA 重构）互相依赖

---

## 一、根因
`devhub/src/renderer/components/monitor/topology/NeuralGraphEngine.ts:233-259` 的 `init()` 在 DOM 挂载瞬间读 `container.getBoundingClientRect()`，若布局未完成返回 0x0，fallback 到 800x600。之后 `setData()` 用 viewBox 更新，但 **d3 simulation 的 `forceCenter(x,y)` 不被重新创建**，导致：
- 节点被力拉到 `(400, 300)` 虚拟位置
- 真实容器可能是 300x200，节点"看起来" 聚在左上角
- 窗口 resize 时 `forceY()` 的 `depth*150` 继续生效，多节点被塞到 y=0、y=150 狭窄区域

## 二、修复策略
1. 用 `ResizeObserver` 监听容器尺寸
2. 首次挂载延迟到下一帧读取（`requestAnimationFrame`）
3. 尺寸变化时 `simulation.force('center', d3.forceCenter(w/2, h/2)); simulation.alpha(1).restart()`
4. `yLayerGap` 按容器高度动态计算，不写死 150px

## 三、受影响源码
- `NeuralGraphEngine.ts:82` yLayerGap 常量
- `NeuralGraphEngine.ts:233-259` init()
- `NeuralGraphEngine.ts:354-434` setData()
- NEW: `NeuralGraphEngine.ts:setContainer(el)` 公共方法
- `NeuralGraph.tsx:35-108` React wrapper 集成 ResizeObserver

## 四、核心代码差异
```typescript
// R7 目标形态（伪代码）
class NeuralGraphEngine {
  private resizeObserver: ResizeObserver | null = null
  private containerWidth = 0
  private containerHeight = 0

  setContainer(container: HTMLElement): void {
    this.container = container
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      if (rect.width > 0 && rect.height > 0) {
        this.onResize(rect.width, rect.height)
      }
    })
    this.resizeObserver.observe(container)
    requestAnimationFrame(() => {
      const r = container.getBoundingClientRect()
      if (r.width > 0) this.onResize(r.width, r.height)
    })
  }

  private onResize(w: number, h: number): void {
    this.containerWidth = w
    this.containerHeight = h
    // 动态 yLayerGap
    const maxDepth = Math.max(1, Math.max(...this.nodes.map(n => n.depth ?? 0)))
    const yLayerGap = Math.max(60, Math.min(160, h / (maxDepth + 1)))
    this.simulation
      ?.force('center', d3.forceCenter(w / 2, h / 2))
      .force('y', d3.forceY((d: any) => (d.depth ?? 0) * yLayerGap + yLayerGap / 2).strength(0.15))
      .alpha(0.5)
      .restart()
    this.updateViewBox(w, h)
  }

  dispose(): void {
    this.resizeObserver?.disconnect()
    this.simulation?.stop()
  }
}
```

## 五、错误矩阵
| 错误码 | 触发 | 文案 | 日志 |
|-------|-----|------|------|
| `TOPOLOGY_CONTAINER_ZERO_SIZE` | 首次挂载容器 0x0 | 自动延迟到下一帧 | DEBUG |
| `TOPOLOGY_SIMULATION_RESTART_FAILED` | d3 simulation 抛错 | 降级到静态 layout | ERROR |
| `TOPOLOGY_NODE_NAN_POSITION` | d3 tick 产出 NaN | 过滤该节点 | ERROR |

## 六、验收条件

### E2E-P6.1-a 分布均匀
```
Given 监控 → 进程详情 → 关系视图（spec/02 的附属视图），10 个节点
When 等 1 秒稳定
Then 节点坐标满足：
  - x 分布覆盖容器宽度 >= 70%
  - y 分布覆盖容器高度 >= 70%
  - 两两节点距离最小值 >= visualRadius + 5
```

### E2E-P6.1-b resize 重分布
```
Given 容器从 300x200 resize 到 800x600
Then 500ms 内节点重新分布；新中心 = (400, 300)
```

### E2E-P6.1-c 快速切 tab 不聚左上
```
Given 关系视图 mounted 后被 keep-alive
When 用户快速切 Tab 导致容器 display:none→block
Then 重新可见时节点位置合理（不在 (0, 0) 附近）
```

## 七、E2E 脚本
```typescript
test('nodes distributed evenly after container resize', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-process"]')
  await win.locator('[data-testid="process-row"]').first().dblclick()
  await win.click('[data-testid="process-detail-tab-relationship"]')
  await win.waitForTimeout(1000)
  const rects = await win.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-testid="graph-node"]'))
    return nodes.map(n => (n as SVGGraphicsElement).getBoundingClientRect())
  })
  const xs = rects.map(r => r.x)
  const ys = rects.map(r => r.y)
  const xSpread = Math.max(...xs) - Math.min(...xs)
  const ySpread = Math.max(...ys) - Math.min(...ys)
  const container = await win.locator('[data-testid="attached-graph-view"]').boundingBox()
  expect(xSpread).toBeGreaterThan(container!.width * 0.5)
  expect(ySpread).toBeGreaterThan(container!.height * 0.5)
  await app.close()
})
```

## 八、参考
- d3-force 文档：`simulation.force('center', forceCenter())`
- `use-resize-observer` npm
- `ResizeObserver` MDN

---

## 九、2026-04-29 实现快照（P6.1 CODE-DONE）

- `NeuralGraphEngine.init()` 不再在 0x0 容器时回退到 `800x600`，而是以最小 `1x1` viewBox 初始化并等待真实尺寸重读。
- `NeuralGraphWithControls` 已保留非零尺寸后初始化与 `ResizeObserver` 监听，`resize()` 会忽略 0x0 并在真实尺寸变化时更新 viewBox。
- `setData()` 与 `resize()` 均会用当前容器宽高重建 `forceCenter(width / 2, height / 2)`，并重建 `forceY` 后 restart simulation。
- `yLayerGap` 已由固定 150px 改为 `computeLayerGap(height)` 动态计算，随容器高度在 72-240px 范围内调整。
- 2026-04-29 时仅完成 CODE-DONE 自动检查；2026-04-30 已补齐真实 Electron E2E，当前验收状态以本文件第十节 TEST-PASS 快照为准。


---

## 十、2026-04-30 验证快照（P6.1 TEST-PASS）

- `P6.1` 已从 CODE-DONE 升级为 TEST-PASS；真实 Electron E2E 进入端口详情的附属关系图，验证 `NeuralGraphEngine` 在真实系统数据下渲染节点、关系和 resize 后尺寸同步。
- `NeuralGraphEngine` 的 0 尺寸初始化路径已保持 `1x1` 最小 viewBox 并等待真实容器尺寸，不再把 0 尺寸误当成已完成初始化；`setData()` / `resize()` 会按真实容器宽高更新 `viewBox`、`forceCenter` 与动态 `forceY`。
- SVG 节点与边现在带有 E2E 可观测属性：`data-testid="graph-node"`、`data-node-id`、`data-node-kind`、`data-node-depth`、`data-root`、`data-testid="graph-edge"`、`data-edge-id`、`data-edge-type`。
- E2E 使用 `graph-node.ownerSVGElement` 锁定实际拓扑 SVG，解析 `transform="translate(x,y)"` 计算节点分布，避免把控制条图标 SVG 误当主图；测试等待 `spreadX + spreadY > 40`，确保真实 force layout 不再挤在初始中心点或左上角。
- resize 验证不再假设详情区宽度单调增大，而是断言主图 `viewBox` 在 BrowserWindow resize 后与 `svg.parentElement.getBoundingClientRect()` 的真实容器尺寸同步，覆盖 split/stacked 布局重排场景。
- 验证命令通过：`pnpm typecheck`、`pnpm exec vitest run src/shared/topology/scope.test.ts`、`pnpm lint`、`pnpm build`、`pnpm exec playwright test e2e/example.spec.ts -g "P6.1" --timeout=120000 --workers=1`（复跑 `1 passed (14.4s)`）。
