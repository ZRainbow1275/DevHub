# O4/O5 — 响应式缩放 + 主题视觉体系深度

> 日期: 2026-04-15
> 严重性: P2
> R1-R4 关联: R3/R4 响应式布局 spec、R1 PRD §2.8、R4 `prompts/0413/03-theme-runtime-manager.md`
> 证据: Image #8（过小尺寸挤压）+ Image #9 / Image #10（两主题仅换色）

---

## 一、问题 §1：窗口过小时不缩放只挤压（O4）

### 1.1 症状（Image #8）
- 窗口拉到较小尺寸后，各模块组件**没有响应式缩小**
- 流程图画布里的节点、minimap、缩放控件按钮**依旧原始大小**
- 导致整体挤压、溢出，布局错位
- 右下出现深色块（疑似 minimap 超界渲染错误）

### 1.2 根因假设
- 组件使用固定 `px` 单位而非 `rem` / `%` / container queries
- Tailwind 断点没覆盖最小尺寸（R4 指出 `tailwind.config.js` screens 与自定义断点不匹配——已列为 `prompts/0413/` I4）
- 某些组件（如流程图 minimap）基于**视口**而非**容器**，容器缩小时 minimap 仍按视口定位
- 组件没有 `min-width` / `max-width` 保护导致挤到 0 或溢出

### 1.3 修复方向
1. 全局基础字号用 `rem` 联动根 `html { font-size: clamp(12px, 1vw, 16px) }`
2. Tailwind 断点重整（启动 R4 I4）
3. 容器查询：使用 `@container` + `container-type: inline-size`
4. 流程图 minimap：限定在画布容器内部而非 body
5. 关键组件加 `min-width` 保护（如详情面板 ≥ 320px，否则自动折叠为抽屉）

---

## 二、问题 §2：主题只换颜色，不换视觉体系（O5）

### 2.1 症状（Image #9 + Image #10）
两张截图对比：
- Image #9 主题：暖米黄 + 红色 accent（Soviet 色调）
- Image #10 主题：冷灰蓝 + 蓝色 accent
- 布局、组件排布、字体、圆角、阴影、留白、信息密度**完全一致**
- 仅仅是 CSS 颜色变量替换

用户原话：「目前的主题切换依然都只算是换了个颜色，而没有从布局、组件表现等各类情况给出不同的表现」

### 2.2 根因假设
- 主题系统（R4 `prompts/0413/03-theme-runtime-manager.md` 已识别）只管理 `theme name`，没有多维 token（layout / typography / density / shape / elevation / motion）
- Tailwind 配置里只有 `colors` 根据主题变化，其他所有设计 token（间距、圆角、字体、动效）是静态的
- 没有把"主题"上升为"设计语言"的概念

### 2.3 期望（R1 PRD §2.8 已完整列出）
每套主题应是**完整设计语言**，差异覆盖：
- **布局策略**：紧凑型（Soviet 大标题 + 密集信息）vs 宽松型（Swiss 大留白 + 网格）
- **字体**：衬线 vs 无衬线 vs 机械等宽（Soviet = Oswald/Bebas Neue 强几何，Cyberpunk = Orbitron/Share Tech Mono 科技感，Swiss = Inter 极简）
- **圆角**：方正（Soviet 0-2px）vs 中等 vs 圆润（Swiss 8-16px）
- **阴影**：扁平 vs 拟物 vs 发光边缘（Cyberpunk neon glow）
- **动效**：刚健快速（Soviet 150ms linear）vs 流畅丝滑（Swiss 400ms cubic-bezier）vs 闪烁 / 故障风（Cyberpunk）
- **信息密度与留白**

### 2.4 修复方向（启用 R4 `prompts/0413/03-theme-runtime-manager.md`）

架构调整：
```ts
// 现状（推测）
{ theme: 'soviet' | 'cyberpunk' | 'swiss' } → 切换 CSS variables (仅颜色)

// 目标
theme = {
  tokens: {
    colors:     { primary, secondary, ... },
    typography: { fontFamily, fontScale, lineHeight, letterSpacing },
    spacing:    { density, gap, padding },
    shape:      { radius, borderWidth },
    elevation:  { shadow, glow },
    motion:     { duration, easing, scale },
  },
  layout: {
    cardDensity: 'compact' | 'roomy',
    showDecorations: boolean,      // Soviet 几何装饰
    neonGlow: boolean,             // Cyberpunk
    gridOverlay: boolean,          // Swiss
  }
}
```

组件消费方式：
- Tailwind 配置改为 CSS-variable-driven（所有 token 动态读）
- 某些结构性差异（如 Cyberpunk 的 neon border）通过 `data-theme` attribute 条件渲染

### 2.5 已安装字体（可直接用）
从父 `package.json` 看已引入完整字体库：
- `@fontsource-variable/inter` → Swiss
- `@fontsource-variable/oswald` + `@fontsource/bebas-neue` → Soviet
- `@fontsource-variable/orbitron` + `@fontsource-variable/exo-2` + `@fontsource/share-tech-mono` → Cyberpunk
- `@fontsource-variable/jetbrains-mono` → 代码 / 终端
- `@fontsource-variable/playfair-display` → 强调标题 / Editorial

**即主题字体资源已齐全，只缺"用上"**。

---

## 三、关联代码

- `src/renderer/styles/` 下所有主题相关文件
- `tailwind.config.js`（9.4KB）
- `src/renderer/hooks/useTheme.ts`（推测）
- R4 已有方案：`prompts/0413/03-theme-runtime-manager.md`
- R4 已有方案：`prompts/0413/04-font-bundling-strategy.md`

探索指令：
```
serena.find_symbol(name_path_pattern:"useTheme", depth:1, include_body:true)
serena.read_file(relative_path:"devhub/tailwind.config.js")
serena.search_for_pattern(
  substring_pattern:"data-theme|theme:.*(soviet|cyberpunk|swiss)",
  paths_include_glob:"devhub/src/renderer/**"
)
```

---

## 四、验收标准

- §1 窗口从 640×480 到 1920×1080 连续拖动**无挤压 / 溢出**
- §1 最小视口下（< 800px 宽）侧栏自动折叠，详情面板切换为抽屉
- §2 切换主题后**字体、圆角、动效、密度、装饰元素**全部变化，不仅仅颜色
- §2 每套主题都有一个"装饰元素"作为视觉锚点：
  - Soviet：红/黑几何块装饰、粗线条分隔、Oswald 大标题
  - Cyberpunk：发光边缘、扫描线效果、霓虹色、Share Tech Mono
  - Swiss：12 栏网格、大量留白、Inter 无衬线、方正排版
