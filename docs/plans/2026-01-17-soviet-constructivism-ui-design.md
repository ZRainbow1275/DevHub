# DevHub UI 重构设计方案
## 苏联构成主义 + 社会主义现实主义美学

**日期**: 2026-01-17
**状态**: 待实施
**范围**: 全面重构

---

## 1. 设计理念

### 1.1 风格融合
- **构成主义几何**: 对角线、圆形、三角形的强烈构图
- **社会主义现实主义工业符号**: 齿轮、扳手、闪电等精炼符号
- **去除荣誉符号**: 不使用五角星、麦穗、徽章等

### 1.2 信息密度
- 核心区域高密度（项目列表、日志）
- 边栏和状态栏使用标语/符号装饰
- 关键数据用"英雄数字"突出显示

### 1.3 轻盈化处理
- 提高明度：偏暖深灰背景、鲜亮朱红、米白文字
- 透明层次：半透明叠加（非毛玻璃模糊）
- 整体质感：褪色老海报

---

## 2. 色彩系统

### 2.1 背景层级
```css
--surface-950: #1a1814;  /* 最深背景，偏暖炭灰 */
--surface-900: #252220;  /* 主容器背景 */
--surface-850: #2b2825;  /* 中间层 */
--surface-800: #322e2a;  /* 卡片/面板 */
--surface-750: #3b3632;  /* 悬停背景 */
--surface-700: #443f39;  /* 边框/分割线 */
--surface-600: #5a534b;  /* 次要边框 */
```

### 2.2 文字层级
```css
--text-primary:   #f5f0e8;  /* 米白/象牙色 */
--text-secondary: #c4bdb3;  /* 次要文字 */
--text-muted:     #8a8279;  /* 辅助说明 */
--text-accent:    #e8e0d4;  /* 强调文字 */
```

### 2.3 强调色
```css
/* 革命红 */
--red-300: #f28b8b;
--red-400: #e85d5d;
--red-500: #d64545;  /* 主强调 */
--red-600: #b83a3a;

/* 工业金 */
--gold-400: #dab948;
--gold-500: #c9a227;  /* 二级强调 */
--gold-600: #a68619;

/* 钢铁灰 */
--steel-400: #8499a8;
--steel-500: #6b7d8a;
--steel-600: #4a5966;
```

### 2.4 语义色
```css
--success: #5a9a6b;  /* 偏暖绿 */
--warning: #c9a227;  /* 复用工业金 */
--error:   #d64545;  /* 复用革命红 */
--info:    #6b7d8a;  /* 复用钢铁灰 */
```

---

## 3. 字体排版系统

### 3.1 字体家族
```css
--font-display: "Bebas Neue", "Oswald", sans-serif;  /* 标题 */
--font-sans: "Inter", "Noto Sans SC", sans-serif;    /* UI */
--font-mono: "JetBrains Mono", monospace;            /* 代码 */
```

### 3.2 字号层级
| 用途 | 大小 | 行高 | 字体 |
|------|------|------|------|
| 英雄数字 | 48px | 56px | display |
| 大标题 | 24px | 32px | display |
| 中标题 | 18px | 24px | sans |
| 小标题 | 14px | 20px | sans |
| 正文 | 13px | 20px | sans |
| 辅助 | 12px | 16px | mono |
| 微型 | 11px | 14px | mono |

### 3.3 动态倾斜
```css
.title-dynamic {
  transform: rotate(-12deg);
  transform-origin: left center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slogan {
  transform: rotate(-8deg);
  font-weight: 700;
}
```

---

## 4. 几何系统

### 4.1 对角线
- 主对角线: -12° (左上→右下)
- 次对角线: +12° (右上→左下)
- 强调线: -45° / +45°

### 4.2 圆角规则
- 按钮: 2px
- 卡片: 4px
- 输入框: 2px
- 对话框: 4px
- 状态圆点: 完全圆形

### 4.3 工业符号
- 运行状态: 齿轮 (旋转)、闪电
- 工具操作: 扳手、三角尺、锤子
- 状态指示: 实心圆、空心圆、实心方、三角形

---

## 5. 组件设计

### 5.1 按钮
```css
/* 主按钮 */
.btn-primary {
  background: var(--red-500);
  color: #fff;
  border-radius: 2px;
  border-left: 3px solid var(--gold-500);
}

.btn-primary:hover {
  background: var(--red-400);
  transform: translateX(2px);
}
```

### 5.2 卡片
- 背景: surface-800 (95% 透明)
- 边框: 1px surface-700，左侧 3px transparent
- 选中: 左侧 3px red-500
- 运行中: 左侧 3px success + 齿轮图标

### 5.3 输入框
- 底部重边框风格
- 聚焦: 底部 2px red-500
- 无外发光

---

## 6. 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ TITLE BAR (36px) - 倾斜标语 + 对角线装饰                    │
├────────────┬────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN CONTENT                                   │
│ (220px)    │ ┌─────────────┬──────────────────────────┐    │
│ 可折叠     │ │ PROJECT     │ LOG / MONITOR            │    │
│            │ │ LIST (320px)│ (flex-1)                 │    │
│            │ │             │ ┌──────────────────────┐ │    │
│            │ │             │ │ 英雄数字区 (80px)    │ │    │
│            │ │             │ ├──────────────────────┤ │    │
│            │ │             │ │ 内容区               │ │    │
│            │ │             │ └──────────────────────┘ │    │
│            │ └─────────────┴──────────────────────────┘    │
├────────────┴────────────────────────────────────────────────┤
│ STATUS BAR (28px) - 仪表盘风格指标                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 动画系统

### 7.1 侧边栏动画
```css
/* 页面加载滑入 */
.sidebar-enter {
  animation: slide-in-left 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 折叠/展开 */
.sidebar {
  transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.sidebar.collapsed { width: 56px; }
```

### 7.2 导航项阶梯滑入
```css
.nav-item {
  animation: nav-slide-in 0.3s forwards;
}
.nav-item:nth-child(1) { animation-delay: 0.05s; }
.nav-item:nth-child(2) { animation-delay: 0.10s; }
/* ... */
```

### 7.3 工业元素动画
```css
/* 齿轮旋转 */
.gear-spin { animation: rotate 3s linear infinite; }

/* 闪电闪烁 */
.lightning-pulse { animation: flash 1.5s ease-in-out infinite; }

/* 英雄数字更新 */
.hero-number-update { animation: punch 0.3s; }
```

### 7.4 时序规范
- 快速反馈: 150ms
- 标准过渡: 200-250ms
- 强调动画: 300-400ms
- 缓动函数: cubic-bezier(0.22, 1, 0.36, 1)

---

## 8. 图标系统

### 8.1 风格规范
- 线条: 1.5px - 2px
- 端点: 直角 (square)
- 连接: 斜切 (miter)
- 尺寸: 16px / 20px / 24px

### 8.2 核心图标
- 齿轮、闪电、播放、停止
- 文件夹、标签、分组
- 日志、监控、终端、搜索

---

## 9. 实施计划

### Phase 1: 基础设施
- [ ] 色彩 Token 系统
- [ ] 字体加载配置
- [ ] Tailwind 配置更新
- [ ] 动画关键帧定义

### Phase 2: 布局框架
- [ ] TitleBar 重构
- [ ] Sidebar 重构 (含折叠)
- [ ] StatusBar 重构
- [ ] 主布局网格

### Phase 3: 核心组件
- [ ] 按钮系统
- [ ] ProjectCard
- [ ] 输入框/选择器
- [ ] 徽章/标签

### Phase 4: 功能面板
- [ ] LogPanel
- [ ] MonitorPanel + 英雄数字
- [ ] ProcessView/PortView/WindowView
- [ ] 对话框系统

### Phase 5: 精细化
- [ ] 图标系统
- [ ] 微交互动画
- [ ] 响应式适配
- [ ] 性能优化

---

## 10. 后续实施命令

```bash
# 在项目根目录执行
cd "D:/Desktop/CREATOR ONE/devhub"

# 全自动实施 (Claude Code)
claude "请根据 docs/plans/2026-01-17-soviet-constructivism-ui-design.md 设计文档，全自动全流程实施 UI 重构。不要分阶段汇报，完成后统一报告结果。"
```

---

**设计者**: Claude (Brainstorming Session)
**审核**: 用户确认通过
