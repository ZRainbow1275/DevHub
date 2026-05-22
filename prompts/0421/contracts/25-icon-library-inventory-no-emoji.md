# contracts/25 — 图标库清单（NO EMOJI）

> 目的：明确 DevHub 全面禁 Emoji 策略下的所有图标来源
> 规则：任何 UI 元素出现的图标必须出自本清单列出的库或自建 SVG；任何 Unicode Emoji 均禁止
> 关联：spec/20（AI 工具 Logo）、CLAUDE.md 强制规则

---

## 一、授权图标库

### 1.1 主图标集：lucide-react（已安装）

- 许可：ISC
- 覆盖范围：2000+ 图标（UI / 导航 / 操作 / 状态）
- DevHub 使用场景：
  - Toolbar / Nav / Button 的 icon
  - 状态指示（checkmark / warning / error）
  - Action 按钮（play / pause / refresh / trash / edit）

典型使用：
```tsx
import { Play, Pause, RefreshCw, Trash2, Edit2, ChevronDown } from 'lucide-react'
<Button><Play size={14} /> Run</Button>
```

### 1.2 品牌 logo 集：@icons-pack/react-simple-icons

- 许可：CC0 for logo SVG paths + MIT for package
- 覆盖 3000+ 品牌 logo
- DevHub 使用场景：AI 工具 logo 底图（在 spec/20 的自建 SVG 无官方时 fallback）

### 1.3 AI 工具自建 SVG：`brand-logos/`

```
devhub/src/renderer/assets/brand-logos/
├── claude-code.svg
├── codex-cli.svg
├── gemini-cli.svg
├── openai.svg
├── opencode.svg
├── cursor-cli.svg
├── aider.svg
├── cline.svg
├── continue.svg
└── unknown.svg  (fallback，CpuIcon 风格)
```

每个 SVG 遵循：
- `viewBox="0 0 24 24"`
- 支持 `fill="currentColor"` 用于 mono 模式
- Original-color variant 内置 `<defs>`

### 1.4 OS 系统图标：通过 Electron `nativeImage`

- Windows 进程的 Executable Icon 由 Electron `app.getFileIcon(exePath)` 抓取
- 用于进程列表的 native icon 展示，避免自制

---

## 二、Emoji 禁令实现

### 2.1 构建期

```javascript
// scripts/check-no-emoji.mjs
import fg from 'fast-glob'
import fs from 'fs/promises'

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/u
const files = await fg(['src/**/*.{ts,tsx,css,scss,md,json}'], { cwd: 'devhub' })
const offenders: string[] = []
for (const file of files) {
  const content = await fs.readFile(`devhub/${file}`, 'utf8')
  const matches = content.match(EMOJI_RE)
  if (matches) offenders.push(`${file}: ${matches[0]}`)
}
if (offenders.length > 0) {
  console.error('Emoji forbidden:\n' + offenders.join('\n'))
  process.exit(1)
}
```

挂在 `npm run prebuild` + CI pipeline。

### 2.2 ESLint

```json
{
  "rules": {
    "no-irregular-whitespace": "error",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/[\\u{1F300}-\\u{1F9FF}]/u]",
        "message": "Emoji forbidden — use lucide-react or brand-logos/ (contracts/25)"
      },
      {
        "selector": "TemplateElement[value.raw=/[\\u{1F300}-\\u{1F9FF}]/u]",
        "message": "Emoji forbidden in template literal (contracts/25)"
      }
    ]
  }
}
```

### 2.3 Runtime 护栏

`<ToolLogo>` 组件和 `<Icon>` 组件对 children 做检测，DEV 模式抛警。

### 2.4 Git pre-commit hook

```bash
#!/bin/sh
# .husky/pre-commit
set -e
node devhub/scripts/check-no-emoji.mjs
```

---

## 三、图标使用规范

### 3.1 尺寸

| 场景 | 像素 | 说明 |
|------|------|------|
| Inline text | 14px | 与 14px 字体基线对齐 |
| Button icon | 16px | 小按钮 |
| Toolbar icon | 18-20px | 常用工具条 |
| Section header | 20-24px | 卡片/面板标题 |
| Empty state illustration | 48-64px | 空状态图 |

### 3.2 颜色

- 优先 `currentColor`，随上下文 text color 变化
- 状态指示用 `text-status-ok / warning / error`（见 spec/19 语义 token）
- 品牌 logo 默认原色；mono 变体用于密集列表

### 3.3 无障碍

- 装饰性图标：`aria-hidden="true"`
- 功能性图标：加 `aria-label` 或搭配可见 label
- Tooltip：使用 `@radix-ui/react-tooltip`

---

## 四、映射表：原 Emoji → 替换图标

| 原 Emoji | 原语义 | 替换 | 来源 |
|---------|-------|------|------|
| 🤖 | AI 机器人 | `<ToolLogo toolId='unknown'/>` or `<Bot/>` | lucide / brand-logos |
| 🧠 | 思考/AI | `<Brain/>` or tool-specific | lucide |
| ✨ | 完成/新 | `<Sparkles/>` | lucide |
| 📝 | 编辑 | `<Edit2/>` or `<FileText/>` | lucide |
| 💻 | 终端/计算机 | `<Terminal/>` or `<Monitor/>` | lucide |
| 🔥 | 热门/高优 | `<Flame/>` | lucide |
| ⚡ | 快速/闪电 | `<Zap/>` | lucide |
| ✅ | 成功 | `<CheckCircle2 className='text-status-ok'/>` | lucide |
| ❌ | 错误 | `<XCircle className='text-status-error'/>` | lucide |
| ⚠️ | 警告 | `<AlertTriangle className='text-status-warn'/>` | lucide |
| 📊 | 图表 | `<BarChart3/>` | lucide |
| 🔍 | 搜索 | `<Search/>` | lucide |
| ⚙️ | 设置 | `<Settings/>` or `<Cog/>` | lucide |
| 🚀 | 启动 | `<Rocket/>` | lucide |
| 📦 | 包/依赖 | `<Package/>` | lucide |
| 🎨 | 主题/美化 | `<Palette/>` | lucide |
| 🔒 | 锁定 | `<Lock/>` | lucide |
| 👁️ | 查看 | `<Eye/>` | lucide |
| ▶️ | 播放/运行 | `<Play/>` | lucide |
| ⏸️ | 暂停 | `<Pause/>` | lucide |
| ⏹️ | 停止 | `<Square/>` | lucide |
| ♻️ | 刷新 | `<RefreshCw/>` | lucide |
| ℹ️ | 信息 | `<Info/>` | lucide |

扫码所有源码发现的 emoji 必须在本映射表找到替换方案。新 emoji 必须先补映射再使用。

---

## 五、例外说明

**不存在例外**。以下场景都视为违规：

- ❌ 文档注释里的 emoji
- ❌ 通知标题里的 emoji
- ❌ 日志文件里的 emoji
- ❌ README.md 里的 emoji（CLAUDE.md 已明令）
- ❌ 测试文件里的 emoji
- ❌ Toast / Dialog 文案里的 emoji

---

## 六、验收

- [ ] `npm run check:no-emoji` 对 `src/**` 扫 0 命中
- [ ] ESLint 规则启用且 CI 生效
- [ ] Husky pre-commit 钩子就位
- [ ] 所有映射表的 emoji 已被替换
- [ ] 品牌 logo SVG 完整
- [ ] `LICENSE-THIRD-PARTY-BRANDS.md` 已声明

---

## 七、扩展：未来可能引入的图标库（需新增审批）

- `@phosphor-icons/react` — 如果需要 weight 变体
- `@radix-ui/react-icons` — 与 Radix 组件配合
- `@iconify/react` — 海量图标聚合，按需引入

引入新库需在本文件补登记行，说明授权和使用范围。
