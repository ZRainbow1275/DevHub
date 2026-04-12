# Design: Zustand Selector 粒度重构

> 版本: 2026-04-13
> Zustand 版本: ^4.4.7
> 影响文件: 7 个 hook + 3 个组件

---

## 问题分析

项目中存在两种 Zustand 使用模式：

**已有正确模式（参考基准）**：
- `App.tsx:46-51` — `useScannerStore(s => s.initialize)` 逐字段
- `TopologyView.tsx:192-194` — `useProcessStore((s) => s.processes)` 逐字段
- `useProcessTopology.ts:50-52` — 逐字段

**问题模式（全量解构，任何字段变化触发重渲染）**：

| 文件 | 行号 | 全量解构字段数 | Store |
|------|------|-------------|-------|
| `useAITasks.ts` | 8-21 | 12 | `useAITaskStore` |
| `useWindows.ts` | 8-27 | 12 | `useWindowStore` |
| `useSystemProcesses.ts` | 8-35 | 14 | `useProcessStore` |
| `useProjects.ts` | 8-16 | 7 | `useProjectStore` |
| `usePorts.ts` | 8-24 | 10 | `usePortStore` |
| `useToolStatus.ts` | 7 | 3 | `useToolStore` |
| `useLogs.ts` | 8 | 3 | `useProjectStore` |
| `StatusBar.tsx` | 7 | 全量 | `useProjectStore` |
| `HeroStats.tsx` | 36 | 全量 | `useProjectStore` |
| `Sidebar.tsx` | 21 | 全量 | `useProjectStore` |

**项目未使用 `useShallow`**（搜索确认）。

---

## 方案对比

### 方案 A: 逐字段 selector
```typescript
const processes = useProcessStore(s => s.processes)
const isScanning = useProcessStore(s => s.isScanning)
```
- 优点：最精确，零依赖，与现有模式一致
- 缺点：字段多时代码冗长
- 适用：字段 ≤ 4 个

### 方案 B: useShallow 批量选择
```typescript
import { useShallow } from 'zustand/react/shallow'
const { processes, isScanning } = useProcessStore(
  useShallow(s => ({ processes: s.processes, isScanning: s.isScanning }))
)
```
- 优点：改动最小，浅比较多字段
- 缺点：引入新导入
- 适用：字段 > 4 个

### 方案 C: createSelectors 工厂
- 优点：自动生成
- 缺点：重构量大
- 不推荐

---

## 推荐方案

**方案 A + B 混用**：
1. 组件直接调用 store（StatusBar/HeroStats/Sidebar）→ 方案 A
2. Hook 字段 ≤ 4 个（useToolStatus/useLogs）→ 方案 A
3. Hook 字段 > 4 个（useSystemProcesses/useWindows/useAITasks/useProjects/usePorts）→ 方案 B

---

## 实施步骤

### Phase 1（高优先级 — 全局组件）

**StatusBar.tsx:7**:
```typescript
// 改前: const { projects } = useProjectStore()
const projects = useProjectStore(s => s.projects)
```

**HeroStats.tsx:36**:
```typescript
const projects = useProjectStore(s => s.projects)
```

**Sidebar.tsx:21**:
```typescript
const filter = useProjectStore(s => s.filter)
const setTagFilter = useProjectStore(s => s.setTagFilter)
const setGroupFilter = useProjectStore(s => s.setGroupFilter)
```

### Phase 2（中优先级 — 字段少的 hooks）

**useToolStatus.ts:7** / **useLogs.ts:8**: 逐字段 selector

### Phase 3（低优先级 — 字段多的 hooks，引入 useShallow）

**useSystemProcesses.ts** / **useWindows.ts** / **useAITasks.ts** / **useProjects.ts** / **usePorts.ts**: 使用 `useShallow` 包裹

---

## 验证方法

1. React DevTools Profiler — 触发进程更新，验证 StatusBar/HeroStats 不再出现在重渲染列表
2. 临时 `useRef` 渲染计数器确认减少
