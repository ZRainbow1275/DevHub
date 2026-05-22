# P1.1 — 项目卡片运行下拉菜单被下方卡片遮挡 [P1]

> Round: R6 · 2026-04-20
> 用户原话：**"点击'屏幕截图 2026-04-15 194903.png'显示不全，受到了遮盖，同时功能残缺"**
> R5 锚点：`prompts/0415/03-project-card-dropdown-overlay.md`（**未修复，重现**）

---

## 一、症状

截图 `屏幕截图 2026-04-15 194903.png`：
- `admin` 项目卡片右上角点击 `▶ ∨` 下拉按钮
- 下拉菜单弹出 `dev (默认)` / `build` / ...（省略号处被下一张 `agi-pioneer-hub` 卡片遮盖）
- 用户无法看到或点击 `build` 之后的脚本，**功能残缺**

## 二、根因假设

1. 下拉菜单用 `position: absolute` 挂在 ProjectCard 组件内部 DOM
2. ProjectCard 容器有 `overflow: hidden`（圆角卡片常见写法）或有 `z-index` 冲突
3. 未使用 Portal 将菜单挂到 body 下

## 三、验收契约

- [ ] 下拉菜单完全显示所有可用脚本（不被遮挡）
- [ ] 菜单出现在卡片按钮下方或自适应上方（视空间决定）
- [ ] 点击菜单外部关闭菜单
- [ ] 键盘导航（↑ ↓ Enter Esc）可用
- [ ] 菜单跟随 Window 滚动定位正确

## 四、推荐实现

用 React Portal + 计算 trigger 坐标挂到 `document.body`，示例结构：

```tsx
<Portal>
  <div
    style={{
      position: 'fixed',
      top: triggerRect.bottom,
      left: triggerRect.left,
      zIndex: 9999,
    }}
    role="menu"
  >
    {scripts.map(...)}
  </div>
</Portal>
```

或使用 `@floating-ui/react`（推荐），提供自动 flip / shift / overflow 处理。

## 五、关联

- R5 原文：`prompts/0415/03-project-card-dropdown-overlay.md`
- R5 修复：`v2-project-ux` commit `7c4f615`（覆盖了 ProjectCard.tsx，但下拉方案未改根因）
