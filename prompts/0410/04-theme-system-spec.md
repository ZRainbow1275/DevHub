# 主题视觉体系重设计 — 技术设计 Spec

> 对应 PRD: 2.8 主题不是换颜色

---

## 1. 设计原则

### 1.1 主题 ≠ 调色板

主题是一套 **完整的视觉传达语言**，包含：

| 维度 | 说明 | 举例 |
|------|------|------|
| 色彩系统 | 主色、辅色、语义色、中性色梯度 | Soviet Red vs Neon Cyan |
| 排版系统 | 字体家族、字号阶梯、行高、字间距 | Mono刚健 vs Sans柔和 |
| 空间系统 | 间距比例、留白策略、信息密度 | 紧凑高密度 vs 宽松留白 |
| 形状语言 | 圆角策略、边框风格、图标风格 | 方正棱角 vs 圆润柔和 |
| 层次表达 | 阴影、模糊、透明度、高程 | 扁平 vs 玻璃态 vs 拟物 |
| 动效风格 | 缓动曲线、持续时间、动画类型 | 刚性弹跳 vs 流畅滑动 |
| 组件形态 | 卡片/列表/网格布局比例 | 大卡片 vs 紧凑行 |
| 装饰元素 | 分隔线、背景纹理、点缀图形 | 几何线条 vs 渐变流体 |

### 1.2 主题 Token 架构

```typescript
interface ThemeDefinition {
  meta: {
    name: string
    description: string
    influence: string  // 设计灵感来源
  }
  
  // 色彩
  colors: {
    primary: ColorScale
    accent: ColorScale
    semantic: { success, warning, error, info }
    neutral: ColorScale
    surface: { background, card, elevated, overlay }
  }
  
  // 排版
  typography: {
    fontFamily: { display, body, mono }
    scale: number[]        // 字号阶梯 [12, 14, 16, 20, 24, 32, 48]
    lineHeight: { tight, normal, relaxed }
    letterSpacing: { tight, normal, wide }
    fontWeight: { light, normal, medium, bold, black }
  }
  
  // 空间
  spacing: {
    base: number           // 基准单位 (4px / 8px)
    scale: number[]        // 间距阶梯
    density: 'compact' | 'normal' | 'relaxed'
    containerPadding: { sm, md, lg }
  }
  
  // 形状
  shape: {
    borderRadius: { none, sm, md, lg, full }
    borderWidth: { thin, normal, thick }
    borderStyle: 'solid' | 'dashed' | 'double'
  }
  
  // 层次
  elevation: {
    type: 'shadow' | 'border' | 'glow' | 'none'
    levels: ElevationLevel[]
  }
  
  // 动效
  motion: {
    easing: { default, enter, exit, bounce }
    duration: { instant, fast, normal, slow }
    style: 'rigid' | 'smooth' | 'bouncy' | 'minimal'
  }
  
  // 组件形态
  components: {
    card: { variant: 'elevated' | 'outlined' | 'filled' }
    list: { density: 'compact' | 'normal' }
    button: { style: 'sharp' | 'rounded' | 'pill' }
    input: { style: 'underline' | 'outlined' | 'filled' }
  }
}
```

---

## 2. 主题方案

### 2.1 Soviet Constructivism（现有主题，增强）

```
灵感: 苏维埃构成主义 + 瑞士理性主义
气质: 力量、秩序、革命、工业

色彩:
  Primary: Soviet Red #C41E3A → #8B0000 梯度
  Accent: Industrial Gold #D4A900
  Neutral: Carbon Black #0D0D0D → Steel Gray #2A2A2A 梯度
  Surface: 深色系，近乎黑色

排版:
  Display: "JetBrains Mono", monospace (刚健、机械感)
  Body: "Inter", sans-serif (清晰可读)
  特征: 大写字母标题、宽字间距、粗体强调

空间:
  密度: compact
  基准: 4px
  特征: 紧凑排列，高信息密度，减少装饰性留白

形状:
  圆角: 0px - 2px (几乎全方角)
  边框: 2px solid，强调结构
  特征: 棱角分明、几何感强烈

层次:
  类型: border (非阴影)
  特征: 通过边框和颜色对比区分层级，不用模糊阴影

动效:
  风格: rigid
  缓动: cubic-bezier(0.4, 0, 0.2, 1)
  特征: 快速、干脆、无弹跳

装饰:
  对角线条纹、45° 几何图形、构成主义风格的分隔线
```

### 2.2 Cyberpunk Neon（赛博朋克）

```
灵感: 赛博朋克 2077 + Blade Runner + TRON
气质: 未来、霓虹、全息、数字废墟

色彩:
  Primary: Neon Cyan #00FFFF → #0088AA 梯度
  Accent: Hot Pink #FF00AA, Electric Purple #AA00FF
  Neutral: Deep Space #0A0A12 → Midnight Blue #141428
  Surface: 深蓝-紫色渐变底色

排版:
  Display: "Orbitron" / "Exo 2" (未来科技感)
  Body: "Roboto Mono" (终端风)
  特征: 荧光色标题、发光文字效果

空间:
  密度: normal
  基准: 8px
  特征: 适度留白，给发光效果留出空间

形状:
  圆角: 4px - 8px
  边框: 1px solid + glow effect
  特征: 柔和圆角，边缘发光

层次:
  类型: glow (发光阴影)
  特征: box-shadow 使用主色调发光，层级越高发光越强

动效:
  风格: smooth
  特征: 流畅渐变、全息闪烁、扫描线效果

装饰:
  网格线背景、数据流粒子、全息投影边框、扫描线动画
```

### 2.3 Swiss Minimal（瑞士极简）

```
灵感: 国际主义平面设计 + Helvetica + Dieter Rams
气质: 克制、精确、优雅、功能至上

色彩:
  Primary: Swiss Black #1A1A1A
  Accent: Signal Red #FF0000 (极少量点缀)
  Neutral: White #FFFFFF → Warm Gray #F5F5F0
  Surface: 纯白/米白，极少颜色干扰

排版:
  Display: "Helvetica Neue" / "Inter" (经典无衬线)
  Body: "Inter" (高可读性)
  特征: 严格的字号阶梯、大量留白、精确对齐

空间:
  密度: relaxed
  基准: 8px
  特征: 大量留白、呼吸感、内容间有明确间距

形状:
  圆角: 0px (纯方角)
  边框: 1px solid #E5E5E5 (极细、低调)
  特征: 通过留白和排版而非边框组织信息

层次:
  类型: none / subtle shadow
  特征: 几乎不使用阴影，通过色彩明度差异区分层级

动效:
  风格: minimal
  duration: 短 (150-200ms)
  特征: 几乎无装饰性动画，仅功能性过渡

装饰:
  无装饰。网格线辅助对齐（调试模式可显示）
```

---

## 3. 实现方案

### 3.1 CSS Variable + Tailwind Plugin

```css
/* 主题变量通过 CSS custom properties 注入 */
:root[data-theme="soviet"] {
  /* 色彩 */
  --color-primary: 196 30 58;
  --color-accent: 212 169 0;
  
  /* 排版 */
  --font-display: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;
  --letter-spacing-display: 0.1em;
  
  /* 形状 */
  --radius-sm: 0px;
  --radius-md: 2px;
  --border-width: 2px;
  
  /* 层次 */
  --elevation-1: 0 0 0 2px rgb(var(--color-primary) / 0.3);
  
  /* 动效 */
  --motion-duration: 150ms;
  --motion-easing: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* 密度 */
  --density-factor: 0.85;  /* compact */
}
```

### 3.2 组件适配

每个组件通过 theme token 适配，而非硬编码样式：

```tsx
// 卡片组件根据主题自动切换形态
function Card({ children }) {
  return (
    <div className={cn(
      "border transition-all",
      "rounded-[var(--radius-md)]",
      "border-[length:var(--border-width)]",
      "shadow-[var(--elevation-1)]",
      "p-[calc(var(--spacing-base)*var(--density-factor))]"
    )}>
      {children}
    </div>
  )
}
```

### 3.3 布局适配

不同主题的组件排布策略：

```typescript
const layoutConfig: Record<ThemeName, LayoutConfig> = {
  soviet: {
    gridCols: { sm: 1, md: 2, lg: 3, xl: 4 },  // 紧凑多列
    cardSize: 'compact',
    showDividers: true,
    sidebarWidth: 240,
  },
  cyberpunk: {
    gridCols: { sm: 1, md: 2, lg: 3, xl: 3 },   // 适中
    cardSize: 'normal',
    showDividers: false,
    sidebarWidth: 280,
  },
  swiss: {
    gridCols: { sm: 1, md: 1, lg: 2, xl: 3 },   // 宽松少列
    cardSize: 'large',
    showDividers: false,
    sidebarWidth: 320,
  },
}
```
