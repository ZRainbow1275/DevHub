# P8.2 — 主题切换仍只换 palette，缺视觉体系差异 [P2]

> Round: R6 · 2026-04-20（**第 6 次反馈**）
> 用户原话：**"目前的主题切换依然都只算是换了个颜色，而没有从布局、组件表现等各类情况给出不同的表现"**
> 截图：`屏幕截图 2026-04-15 195855.png` + `屏幕截图 2026-04-15 195904.png`
> R5 锚点：`prompts/0415/09-responsive-and-theme-depth.md § 2`（**未修复**）

---

## 一、截图对比

两张全屏截图：
- **图 A**：棕红色系 / Soviet Constructivism
- **图 B**：绿色系

**关键观察**：
- 两张图的**布局完全一致**（Sidebar 宽度、主区网格、卡片位置、头部栏、状态栏一字不差）
- 字体、字重、间距、圆角、阴影、图标**全部相同**
- 唯一差别：**颜色变量被替换**（背景色/文字色/强调色）

用户要求的"主题"应该是**完整的设计语言**，不是 palette swap。

## 二、R5 已明确的主题维度

R5 `09-responsive-and-theme-depth.md` + R4 `0413/03-theme-runtime-manager.md` 已给出主题差异维度：

| 维度 | Soviet | Cyberpunk | Swiss |
|------|--------|-----------|-------|
| 色板 | 棕红黑米 | 霓虹洋红/青 + 深黑 | 黑白灰 + 单色强调 |
| 字体 | 无衬线几何（宽字重） | 等宽 mono + 发光 | Helvetica 风格无衬线 |
| 圆角 | 0-2px（方正力量感） | 2-4px（科技感） | 0px（瑞士风） |
| 阴影 | 硬阴影 / 印刷质感 | 霓虹光晕 | 几乎无阴影（靠网格线分区） |
| 密度 | 中密度 | 高密度（信息仪表盘风） | 低密度（大留白） |
| 动效 | 机械、阶跃 | 流畅、发光 pulse | 极简、微过渡 |
| 图标风格 | 粗线条几何 | 线性 + glow | 简约线性 |
| 装饰元素 | 印章/星/齿轮图案 | 电路/扫描线 | 网格/分割线 |
| 布局 | 卡片 2x2 + 强分区 | 卡片 + 数据流纹理 | 网格严格对齐 |

## 三、R5 修复尝试 vs 实际效果

`v2-theme-design` archive（commit `3b58679`）新增了：
- `theme-tokens.ts`
- `useTheme.ts`
- `DecorationSet.tsx`
- `ThemeDecoration.tsx`
- `styles/` 目录重组

但从截图证据看，**布局/密度/圆角/阴影无差异**，仅换了颜色。推测：

1. `theme-tokens` 只定义了 color tokens，未定义 layout / typography / density tokens
2. `ThemeDecoration` / `DecorationSet` 可能只用于添加装饰元素，未驱动全局样式
3. Tailwind config 没有基于主题切换不同的 `spacing / borderRadius / fontFamily` scale

## 四、验收契约

- [ ] 切换主题后，至少以下 8 项**全部**发生可视差异：
  - [ ] 主字体家族（serif / sans / mono）
  - [ ] 字重与行高
  - [ ] 圆角尺度（0 vs 2 vs 8）
  - [ ] 阴影样式（硬/软/霓虹）
  - [ ] 卡片内边距（紧凑/舒适/宽松）
  - [ ] 网格间距 scale
  - [ ] 图标风格（线性/实心/粗线）
  - [ ] 动效 timing function（步进/贝塞尔/弹簧）
- [ ] 主题提供至少 3 套真正差异化的方案（Soviet / Cyberpunk / Swiss）
- [ ] 主题定义文件用 JSON/TS 导出整套 tokens，而非仅 CSS 变量
- [ ] Tailwind config 支持 runtime 主题切换的 token 注入（使用 CSS 变量驱动 `theme()` 函数）

## 五、推荐实现

```ts
// src/renderer/themes/soviet.ts
export const sovietTheme: ThemeTokens = {
  name: 'Soviet Constructivism',
  colors: { ... },
  typography: {
    fontFamily: "'Bebas Neue', 'Inter', system-ui",
    baseSize: 14,
    lineHeight: 1.4,
    weights: { normal: 500, bold: 800 },
  },
  radius: { sm: '0px', md: '2px', lg: '4px' },
  shadow: { sm: '2px 2px 0 rgba(0,0,0,0.3)', md: '4px 4px 0 rgba(0,0,0,0.4)' },
  spacing: { compact: true, scale: 0.9 },
  icon: { style: 'geometric-bold', strokeWidth: 2.5 },
  motion: { easing: 'steps(4, end)', duration: '120ms' },
  decorations: ['hammer-sickle', 'star', 'gear'],
};
```

使用 `useTheme()` hook 将 tokens 注入 CSS 变量，全局 Tailwind `theme()` 读取变量。

## 六、关联

- R5 原文：`prompts/0415/09-responsive-and-theme-depth.md`
- R4 runtime token 方案：`prompts/0413/03-theme-runtime-manager.md`
- 修复 commit：`3b58679 v2-theme-design`（范围狭窄，未达需求）
