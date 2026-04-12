# Theme Spec — 多主题系统技术规格

## THEME-01: CSS 变量架构

**colors.css 结构变更**:
```css
/* 默认主题 = constructivism */
:root,
[data-theme="constructivism"] {
  --surface-950: #1a1814;
  --surface-900: #252220;
  /* ... 保持当前所有值不变 ... */
}

[data-theme="modern-light"] {
  --surface-950: #f8f9fa;
  --surface-900: #f1f3f5;
  --surface-850: #e9ecef;
  --surface-800: #dee2e6;
  --surface-750: #ced4da;
  --surface-700: #adb5bd;
  --surface-600: #868e96;
  --surface-500: #495057;

  --text-primary: #212529;
  --text-secondary: #495057;
  --text-tertiary: #868e96;
  --text-muted: #adb5bd;
  --text-accent: #343a40;

  --red-500: #3b82f6; /* 蓝色替代红色作为主色 */
  --gold-500: #f59e0b;

  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  --diagonal-stripe: repeating-linear-gradient(
    -12deg, transparent, transparent 8px,
    rgba(59, 130, 246, 0.05) 8px, rgba(59, 130, 246, 0.05) 9px
  );
}

[data-theme="warm-light"] {
  --surface-950: #faf8f5;
  --surface-900: #f5f0e8;
  --surface-850: #ede6da;
  --surface-800: #e5ddd0;
  --surface-750: #dbd2c4;
  --surface-700: #c4b8a8;
  --surface-600: #a69885;
  --surface-500: #8a7c6c;

  --text-primary: #3d2c1e;
  --text-secondary: #5c4a3a;
  --text-tertiary: #8a7c6c;
  --text-muted: #a69885;
  --text-accent: #4a3828;

  --red-500: #b85c38; /* 铜锈红 */
  --gold-500: #c9a227;

  --success: #5a9a6b;
  --warning: #c9a227;
  --error: #b85c38;
  --info: #6b7d8a;

  --diagonal-stripe: repeating-linear-gradient(
    -12deg, transparent, transparent 8px,
    rgba(184, 92, 56, 0.05) 8px, rgba(184, 92, 56, 0.05) 9px
  );
}
```

---

## THEME-02: useTheme Hook

```typescript
// src/renderer/hooks/useTheme.ts
type ThemeName = 'constructivism' | 'modern-light' | 'warm-light'

const THEME_MAP: Record<string, ThemeName> = {
  dark: 'constructivism',
  light: 'modern-light',
  constructivism: 'constructivism',
  'modern-light': 'modern-light',
  'warm-light': 'warm-light',
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>('constructivism')

  useEffect(() => {
    // 启动时读取
    window.devhub?.settings?.get?.().then(s => {
      const resolved = THEME_MAP[s?.theme] || 'constructivism'
      setThemeState(resolved)
      document.documentElement.dataset.theme = resolved
    })
  }, [])

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeState(name)
    document.documentElement.dataset.theme = name
    await window.devhub?.settings?.update?.({ theme: name })
  }, [])

  return { theme, setTheme }
}
```

---

## THEME-03: SettingsDialog 主题选择器

```tsx
const THEMES = [
  { key: 'constructivism', name: '构成主义', desc: '暗色·红金·工业', colors: ['#1a1814','#d64545','#c9a227'] },
  { key: 'modern-light', name: '现代明亮', desc: '亮色·蓝白·专业', colors: ['#f8f9fa','#3b82f6','#f59e0b'] },
  { key: 'warm-light', name: '暖光', desc: '亮色·铜金·温暖', colors: ['#faf8f5','#b85c38','#c9a227'] },
]

// 渲染为 3 个主题卡片，点击切换
```

---

## THEME-04: 全局样式检查

需确认以下文件中**无硬编码 hex 颜色**：
- globals.css — 所有颜色引用 CSS 变量 ✓
- 组件 TSX — 使用 Tailwind class（引用 CSS 变量） ✓
- tailwind.config.js — shadow 值需检查

**需要变量化的 shadow**:
```javascript
// 当前
glow: '0 0 12px rgba(214, 69, 69, 0.4)'
// 修改为
glow: '0 0 12px var(--red-overlay, rgba(214, 69, 69, 0.4))'
```
