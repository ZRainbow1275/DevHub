# P8.1 — 窗口过小时不缩放只挤压 [P2]

> Round: R6 · 2026-04-20（**第 6 次反馈**）
> 用户原话：**"窗口在过小的情况下，显示并没有进行缩放，而是依然那么大，就会造成挤压"**
> 截图：`屏幕截图 2026-04-15 195806.png`
> R5 锚点：`prompts/0415/09-responsive-and-theme-depth.md § 1`（**未修复**）

---

## 一、症状

截图可见（小窗口下）：
- 顶部 Tab `日志 / 监控` 保持原尺寸
- 监控子 Tab 栏 `系统监控 SYSTEM MONITOR / 进程 / 端口 / 窗口 / AI 任务 / 拓扑` 横向排列且字号不变，挤到几乎重叠
- "流程图"标签下的节点卡片（:51121 / :54545 / :3001）保持原尺寸，垂直堆叠溢出
- 右下角出现一块深灰 minimap（可能是 xyflow 的 minimap 渲染错误）

## 二、对比需求

用户说"应进行缩放"，不是"换行堆叠"。意思是：

- Tab 栏字号随容器缩小，而非换行
- 内容卡片按容器比例缩放（字体/内边距/图标一起缩），保持密度
- 不是 hide-overflow，不是"手机端重新排"

## 三、验收契约

实施方案有三种层级，任选其一与用户确认：

### 方案 A — Container Query 驱动缩放
- [ ] 所有顶级容器用 `container-type: inline-size`
- [ ] 使用 CSS `clamp()` 让字体/内边距随容器宽度缩放：
  ```css
  font-size: clamp(10px, 1cqw + 8px, 14px);
  padding: clamp(4px, 0.5cqw + 2px, 12px);
  ```

### 方案 B — CSS transform scale
- [ ] 整体页面内容在小于阈值时应用 `transform: scale(0.8~1.0)`
- 缺点：会让所有内容包括字体变成缩放比例，可能失真

### 方案 C — 响应式断点重排（非用户所需）
- 用户已明确说"不要换行堆叠式重排"，此方案弃用

**推荐方案 A**，配合每个组件定义自己的 container query 断点。

## 四、关联

- R5 原文：`prompts/0415/09-responsive-and-theme-depth.md`
- `v2-project-ux` 新增了 `useBreakpoint.ts / useDensity.ts / ResponsiveMetric.tsx`，命名看似做了响应式但用户仍反馈不缩放 → 需核实是做了换行断点还是做了缩放
