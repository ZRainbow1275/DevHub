# Performance Spec — DevHub 性能优化规格

> 优先级: HIGH
> 影响范围: renderer 监控视图, main process 轮询

---

## PERF-01: 监控视图缺少虚拟化

**影响**: ProcessView, PortView, AITaskView
**问题**: 直接 `.map()` 渲染所有项目，当数量超过 100 时 DOM 节点爆炸

**当前状态**:
- `ProjectList.tsx` 已使用 `@tanstack/react-virtual` ✅
- `ProcessView.tsx` Grid 模式无虚拟化 ❌
- `PortView.tsx` 无虚拟化 ❌
- `AITaskView.tsx` history 列表无虚拟化 ❌

**修复方案**:
参考 `ProjectList.tsx` 的实现模式，为上述三个视图添加虚拟化:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => ITEM_HEIGHT,
  overscan: 5,
});
```

**预期收益**:
- 1000 进程场景: DOM 节点从 1000+ 降至 ~20
- 内存占用减少 80%+
- 滚动流畅度提升

---

## PERF-02: 动画延迟线性增长

**位置**:
- `ProcessView.tsx` — `animationDelay: ${index * 50}ms`
- `PortView.tsx` — 类似模式

**问题**:
1000 个项目 = 第 1000 个项目延迟 50s 才出现动画，用户体验极差。

**修复方案**:
```typescript
// 使用 Math.min 限制最大延迟
const delay = Math.min(index * 50, 500); // 最多 500ms
// 或使用 viewport-aware 方案
const delay = isInViewport ? Math.min(visibleIndex * 30, 300) : 0;
```

---

## PERF-03: 轮询缺少可见性感知

**影响位置**:
| 组件 | 轮询间隔 | 系统命令 |
|------|----------|----------|
| ProcessView | 5s | WMIC process |
| PortView | 10s | netstat -ano |
| AITaskView | 2s | WMIC + PowerShell |
| Sidebar | 5s | 项目状态刷新 |
| ToolMonitor (main) | 5-30s | tasklist |

**问题**:
当应用最小化或标签页不可见时，所有轮询仍在运行，浪费 CPU。

**修复方案**:
```typescript
// hooks/useVisibilityAwarePolling.ts
function useVisibilityAwarePolling(callback: () => void, intervalMs: number) {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    callback();
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }, [isVisible, intervalMs]);
}
```

**预期收益**: 后台 CPU 使用降低 90%+

---

## PERF-04: 未 memo 的计算值

**位置**:
- `StatusBar.tsx` — `runningProjects.filter()` 每次渲染重新计算
- `PortView.tsx` — `filteredPorts.filter()` 每次渲染重新计算

**修复**: 使用 `useMemo` 包裹。

---

## PERF-05: LogPanel key 不稳定

**位置**: `LogPanel.tsx` — `key={${log.timestamp}-${index}}`

**问题**:
使用 index 作为 key 的一部分，当日志数组 shift（环形缓冲区）时会导致所有 key 变化，
触发不必要的 DOM 操作。

**修复**:
为每条 LogEntry 添加唯一 ID（在 ProcessManager 生成时赋予）:
```typescript
interface LogEntry {
  id: string; // uuid or incrementing counter
  projectId: string;
  timestamp: number;
  type: 'stdout' | 'stderr' | 'system';
  message: string;
}
```
