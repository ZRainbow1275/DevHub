# O6 — 端口监控：滚动失效 + 布局挤压 + 查询超时

> 日期: 2026-04-15
> 严重性: P1
> R1-R4 关联: R3 端口性能（`prompts/0411/04-port-performance-spec.md`）
> 证据: Image #3, Image #4

---

## 一、症状

### 1.1 滚动失效（Image #3）
- "端口监控"视图共 128 个活跃端口
- 顶部"常用端口"卡片 + 下方端口列表
- **列表区域没有滚动条**，无法下滑查看 :135 / :445 / :902 之外的其他端口
- 整个面板固定为视口高度，超出内容直接看不到

### 1.2 布局挤压（Image #4）
- 端口卡片大小不均匀（`:135` 被压扁成小方块，`:445` `:902` 同样异常）
- 右侧打开详情面板后，**左侧端口卡片没有响应式重排**，只是被遮住一半
- `本地地址` 标签错位（出现在卡片下方但本来应该在详情面板）
- 调整窗口大小时卡片未收缩 / 放大

### 1.3 查询超时（Image #4 右侧面板）
- 点开 `:135` 详情，顶部显示：
  > ⚠ **查询超时 - 显示缓存数据**
  > ⚠ **外部可访问端口 - 非本地绑定，存在安全风险**

---

## 二、根因假设

### 2.1 滚动失效
- 端口列表容器缺 `overflow-y: auto` 或 `max-height`
- 或父容器是 `display: grid` 没限定行数 → 子项直接撑满
- 或 `ScrollArea` 组件被误用（如使用 Radix ScrollArea 时没设置 `viewport` 的高度约束）

### 2.2 布局挤压
- 端口卡片 grid 使用 `grid-template-columns: repeat(N, 1fr)`，但 N 是写死的（4?）
- 右侧详情面板打开时，容器宽度变化但 grid 列数不变 → 挤压
- 需要：`grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` 或 ResizeObserver 驱动
- 卡片内部没有 `min-width` 保护 → 极端宽度下挤压成小方块

### 2.3 查询超时
- 与 **N1 PowerShell 资源爆炸** 同源：`getPortDetails` 也走 PowerShell/netstat/CIM
- 扫描已有端口列表数据，但点击详情时**重新查询**触发超时
- 回退到缓存数据 → 显示 "查询超时 - 显示缓存数据"

---

## 三、修复方向

### 3.1 滚动
- 端口列表容器包一层：`flex-1 min-h-0 overflow-y-auto`
- 使用 `react-virtuoso` / `@tanstack/react-virtual`（项目已引入）做虚拟滚动，128 个不算多但准备未来 1000+

### 3.2 布局
- `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- 卡片加 `min-width: 180px`
- 详情面板打开时用 `flex` 双栏 + 列表区 `flex: 1`
- `ResizeObserver` 或 `@container` queries 监听容器宽度

### 3.3 查询超时
- 本质上**依赖 N1 修好**
- 短期 fallback：
  - `getPortDetails` 查询失败时显示"重试中"而非直接回退 cache
  - 缓存数据标签从"查询超时"改为"使用 X 秒前的缓存数据"（更温和）
  - 加手动重试按钮

---

## 四、关联代码

- `src/renderer/components/monitor/PortView.tsx` / `PortList.tsx`
- `src/renderer/components/monitor/PortDetailPanel.tsx`
- `src/main/services/PortScanner.ts`（15KB）
- `src/main/services/ScannerCache.ts`

探索指令：
```
serena.find_symbol(name_path_pattern:"PortList|PortView", depth:2)
serena.find_symbol(name_path_pattern:"getPortDetails", depth:1, include_body:true)
serena.search_for_pattern(
  substring_pattern:"查询超时",
  paths_include_glob:"devhub/src/**"
)
```

---

## 五、验收标准

- 端口数 > 视口容量时**必须**可滚动
- 窗口尺寸从最小到最大连续拖动，卡片**每帧**重新排列，不出现挤压
- 详情面板与列表区**不互相遮挡**（响应式双栏）
- 查询超时场景：列表级字段完整显示，且区分"数据陈旧"与"查询失败"两种 UI
