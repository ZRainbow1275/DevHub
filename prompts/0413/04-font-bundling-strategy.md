# Design: 字体本地打包策略

> 日期: 2026-04-13
> 文件: `src/renderer/styles/tokens/typography.css`

---

## 当前问题

### 双重阻断
1. **CSP 阻断** (`main/index.ts:216-217`): `font-src 'self' data:` 不含 `fonts.gstatic.com`
2. **离线场景**: 桌面应用依赖外部 CDN 违背自包含原则
3. **构建确认**: Vite 不下载外部 URL，原样保留在产物中

### 字体清单（10 条 @font-face）

| 字体 | 大小估算 | 影响主题 |
|------|----------|----------|
| Inter variable (normal+italic) | ~420KB | 所有主题核心 |
| JetBrains Mono variable (normal+italic) | ~260KB | 所有主题 mono |
| Playfair Display variable (normal+italic) | ~180KB | Warm Light |
| Exo 2 variable | ~70KB | Cyberpunk |
| Oswald variable | ~60KB | Constructivism |
| Orbitron variable | ~45KB | Cyberpunk |
| Share Tech Mono | ~20KB | Cyberpunk |
| Bebas Neue | ~15KB | Constructivism |
| **总计** | **~1.07MB** | |

Noto Sans SC 无 @font-face 定义，仅系统 fallback，无需打包。

---

## 方案对比

| 方案 | 构建集成 | 维护成本 | CSP 影响 | Git 体积 |
|------|---------|---------|---------|---------|
| A: @fontsource NPM 包 | 零配置 | 低 | 无需改 | 不进 git |
| B: resources/fonts/ | 需 protocol | 高 | 需改 | +1MB |
| C: Vite public/ | 零配置 | 中 | 无需改 | +1MB |

---

## 推荐方案 A: @fontsource

### 安装
```bash
pnpm add @fontsource-variable/inter @fontsource-variable/jetbrains-mono \
  @fontsource-variable/oswald @fontsource-variable/orbitron \
  @fontsource-variable/exo-2 @fontsource-variable/playfair-display \
  @fontsource/bebas-neue @fontsource/share-tech-mono
```

### 修改 typography.css
删除 `@font-face { src: url('https://fonts.gstatic.com/...') }` 声明（:8-101），替换为：
```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/inter/italic.css';
@import '@fontsource-variable/jetbrains-mono';
@import '@fontsource-variable/jetbrains-mono/italic.css';
@import '@fontsource-variable/oswald';
@import '@fontsource-variable/orbitron';
@import '@fontsource-variable/exo-2';
@import '@fontsource-variable/playfair-display';
@import '@fontsource-variable/playfair-display/italic.css';
@import '@fontsource/bebas-neue';
@import '@fontsource/share-tech-mono';
```

### 验证
```bash
pnpm build
grep -c "fonts.gstatic.com" out/renderer/assets/*.css  # 期望: 0
ls out/renderer/assets/*.woff2 | wc -l                  # 期望: > 0
```

CSP 无需修改。构建后字体为 `./assets/xxx-[hash].woff2`，满足 `font-src 'self'`。
