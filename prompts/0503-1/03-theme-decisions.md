# 03 — 主题与设计语言决策（提炼版）

> **派生自**: `prompts/0503/03-theme-design-language-survey.md`
> **核心痛点**: "切主题只换颜色，没有从布局/组件表现给出不同表现"
> **设计哲学**: 4 维主题轴（palette × density × radiusFamily × motionLevel）+ 装饰几何 + 完整音效

---

## A. 主题数量（[Q-3.A.1] [CHANGE→EXTEND]）

**用户回答**: B + C + E
- B. 5 套核心
- C. 6 套核心（更细分）
- E. 主题预设市场（含社区/官方更多预设）

**PRD 解读**: 用户既要"扩展数量"又要"主题市场"机制。

**核心主题**（Round 7 已锁定 6 套，R8 沿用）：
1. **Photographic** — 照相写实，玻璃质感
2. **Constructivism** — 构成主义（**禁用暗色模式**，仅鲜红+米黄+白）
3. **Bauhaus** — 包豪斯
4. **Memphis** — 孟菲斯
5. **Cyberpunk** — 赛博朋克
6. **Minimalist** — 极简

**新增**（R8 候选）:
- Brutalism — 野兽主义
- Glassmorphism — 玻璃拟态
- Neumorphism — 新拟态
- Solarpunk — 太阳朋克

**主题预设市场**（E）:
- 用户/社区可上传 .devhub-theme JSON
- 内置市场浏览（本地，无云端）
- 一键应用 + 预览

---

## B. 暗色模式（[Q-3.B] [CHANGE]）

**用户回答**: 「采纳默认 + 苏维埃风格不能暗黑」

**关键约束**:
- 全部主题支持暗色 — 默认 A
- **例外**: Constructivism 必须保持 **鲜红 + 米黄 + 白**，不允许暗化
- 在主题切换 UI 中：Constructivism 的 dark mode 切换器置灰并标注"该主题不支持暗色"

---

## C. 主题切换的 4 维选择器（[Q-3.C] [ACCEPT]）

**用户回答**: D — 主题切换是 view-transition

4 维主题轴：
- **palette**（调色板）
- **density**（紧凑 / 标准 / 舒适）
- **radiusFamily**（直角 / 微圆 / 大圆 / 不规则）
- **motionLevel**（静态 / 减弱 / 标准 / 强烈）

**切换体验**:
- 使用 CSS view-transition API（浏览器原生支持）
- 用户选择 → 平滑过渡（不闪屏）

---

## D. 主题预览（[Q-3.D] [EXTEND]）

**用户回答**: C + D + 自定义
- C. 多组件预览
- D. 实时预览（无需保存即看）
- 自定义：用户提交自定义界面预览（高保真）

---

## E. 动效（[Q-3.E] [ACCEPT]）

**用户回答**: D — 4 档 motion level
- 0 = Off（无动效）
- 1 = Reduced（仅必要）
- 2 = Standard（默认）
- 3 = Expressive（满档）

**动效类型**:
- 页面切换
- 主题切换 view-transition
- 列表入场/出场
- 数值变化补间
- Hover 反馈

---

## F. 装饰系统（[Q-3.F] [EXTEND]）

**用户回答**: A + B + C + D + E + G + H + J
- A. 几何（圆/方/三角等）
- B. 线条
- C. 网格
- D. 噪点
- E. 渐变
- G. SVG 图案
- H. 字体装饰（粗体大字标题）
- J. **自定义 SVG 上传**（用户加项）

**装饰位置**: A + C + F + G
- A. 卡片背景
- C. 标题旁
- F. 按钮内
- G. 主题预览页

---

## G. 阴影系统（[Q-3.G] [ACCEPT]）

**用户回答**: C — 主题驱动阴影
- 每个主题定义自己的阴影色板与 elevation
- 暗色模式自动反转

---

## H. 边框（[Q-3.H] [ACCEPT]）

**用户回答**: B — 主题级边框（每主题独立）

---

## I. 可访问性强化（[Q-3.I] [EXTEND]）

**用户回答**: 全选（A11y 全套 + J 用户自定义无障碍偏好）

---

## J. 屏幕阅读器（[Q-3.I.X] [ACCEPT]）

**用户回答**: B — 部分支持（关键路径）

---

## K. 键盘 / 图标 / 音效

### K.1 键盘（[Q-3.K.1] [ACCEPT]）
**用户回答**: A — 所有交互必须键盘可达

### K.2 图标库（[Q-3.K.2] [EXTEND]）
**用户回答**: A + D + E + F
- A. lucide-react（默认）
- D. tabler-icons
- E. radix-icons
- F. heroicons

**禁止**: 任何 Emoji 字符（继承 R7 铁律）

### K.3 官方 Logo（[Q-3.K.3] [ACCEPT]）
**用户回答**: A 全选
- AI 工具（Codex / Claude / Gemini / Cursor）使用官方 Logo
- IDE 工具（VS Code / IntelliJ）使用官方 Logo
- 浏览器、终端、Docker 等使用官方 Logo
- 通过 `assets/logos/` + license 注释

### K.4 音效（[Q-3.K.4] [CHANGE]）
**用户回答**: **C — 完整音效**（默认是 B 关键音效）

音效维度:
- 通知声
- 任务完成
- 错误警告
- 主题音色（每主题独立音色 — Cyberpunk 电子音 / Minimalist 静默 / Photographic 真实快门音）
- 按钮反馈（轻量）
- 拖拽吸附

**实现**:
- Howler.js 集成
- 用户可逐项关闭
- 默认音量 30%

---

## L. 主题最具区分度的维度（[Q-3.L] [FREE]）

**用户回答**: 「**装饰 + 颜色 + 动效**」

**PRD 解读**: 三个维度并列优先级。
- 装饰: 形状、图案、纹理
- 颜色: 调色板、渐变、对比度
- 动效: 时长、缓动、变化幅度

→ Spec 编写时这 3 项必须形成可视差异。

---

## M. PRD 信号

1. **4 维主题轴**：palette / density / radiusFamily / motionLevel 必须正交，不能耦合
2. **构成主义特殊处理**：dark 切换器置灰
3. **完整音效系统**：Howler.js + 主题独立音色
4. **市场机制**：本地 .devhub-theme 文件解析 / 校验 / 预览
5. **图标库混用**：4 套并存，按场景选择
6. **官方 Logo 库**：assets/logos 集中维护，license 合规
7. **动效降级**：Reduce Motion 自动降到 motionLevel 1
8. **view-transition**：主题切换不能闪屏
