# Layout Spec — 布局修复技术规格

## LAYOUT-01: 项目面板响应式宽度

**当前**: `<div className="w-[340px]">`
**修改**: `<div className="min-w-[280px] max-w-[400px]" style={{ width: panelWidth }}>`

**ResizeHandle 组件**:
```tsx
// src/renderer/components/ui/ResizeHandle.tsx
function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX
    const onMouseMove = (e: MouseEvent) => {
      onResize(e.clientX - startX)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      className="w-1 cursor-col-resize hover:bg-accent/30 transition-colors"
      onMouseDown={handleMouseDown}
    />
  )
}
```

**宽度持久化**: `localStorage.setItem('devhub:panel-width', width)`

---

## LAYOUT-02: HeroStats 响应式

**globals.css 新增**:
```css
@media (max-width: 1024px) {
  .hero-number-value {
    font-size: 32px;
    line-height: 40px;
  }
  .hero-number {
    padding: 8px;
  }
}
```

---

## LAYOUT-03: StatusBar 防溢出

**当前**:
```tsx
<span className="truncate max-w-[180px]">
  {runningProjects.map(p => p.name).join(', ')}
</span>
```

**修改为**:
```tsx
const MAX_SHOW = 2
const names = runningProjects.map(p => p.name)
const display = names.length <= MAX_SHOW
  ? names.join(', ')
  : `${names.slice(0, MAX_SHOW).join(', ')} +${names.length - MAX_SHOW} more`

<span className="truncate max-w-[180px] lg:max-w-[300px]" title={names.join(', ')}>
  {display}
</span>
```

---

## LAYOUT-04: Sidebar 持久化

**Sidebar.tsx**:
```tsx
const [collapsed, setCollapsed] = useState(() => {
  return localStorage.getItem('devhub:sidebar-collapsed') === 'true'
})

const toggle = () => {
  const next = !collapsed
  setCollapsed(next)
  localStorage.setItem('devhub:sidebar-collapsed', String(next))
}
```

**自动折叠** (useWindowSize hook):
```tsx
const { width } = useWindowSize()

useEffect(() => {
  if (width < 1024 && !collapsed) {
    setCollapsed(true)
  }
}, [width])
```

---

## LAYOUT-05: useWindowSize Hook

```typescript
// src/renderer/hooks/useWindowSize.ts
export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return size
}
```
