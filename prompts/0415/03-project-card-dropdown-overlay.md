# N3 — 项目卡片"运行脚本"下拉菜单被遮挡，功能残缺

> 日期: 2026-04-15
> 严重性: P1
> 首次暴露: R5
> 证据: Image #1

---

## 一、症状

在"工程控制台 / 全部项目" 视图里，点击项目卡片右上角的 **运行按钮** (▶ + ⌄ 下拉箭头)：

1. 下拉展开菜单只能看到 `dev (默认)` + 半行 `build`
2. 菜单的下边缘被**下一张项目卡片**（agi-pioneer-hub）**盖住**
3. 卡片内 `dev / build / lint` 按钮同时显示，但下拉的脚本列表不能完整看到
4. **功能残缺**：看不到完整的脚本选项就没法选，实际可用性约等于零

---

## 二、根因假设

### 假设 A：下拉 popover 的 `z-index` 低于下一张卡片
- 项目卡片可能是 `position: relative` 的一组 flex/grid item
- 下拉展开的 popover 如果放在 `position: absolute` + 无 portal，会受父卡片 `overflow: hidden` 或 sibling 堆叠上下文的限制

### 假设 B：popover 未使用 `Portal` 挂载到 body
- 正确做法：用 Radix / Headless UI / 自研 Portal 把 dropdown 挂到 `document.body`，脱离卡片布局流
- 当前看起来是直接在卡片内部渲染 → 被下一张卡片覆盖

### 假设 C：卡片容器有 `overflow: hidden` 或 `overflow: clip`
- 卡片边缘被裁切 → 超出卡片的 popover 不显示

### 假设 D：popover 高度未基于视口边界做 flip / shift
- 没有 floating-ui / Popper 的 `flip` middleware，超出空间时不会自动向上展开

---

## 三、修复方向

1. **Portal 化**：改用 Radix `DropdownMenu.Content` 或 Headless UI `<Menu.Items>` + `Portal`
2. **Floating UI**：加 flip + shift middleware，自动避让视口边缘
3. **z-index 层级表**：建立全局 `z-index` tokens（card = 10, dropdown = 50, modal = 100, toast = 200）
4. **审查所有 card 容器** 是否有 `overflow: hidden`；如确实需要裁剪圆角，改用 `border-radius + mask-image`

---

## 四、关联代码

- `src/renderer/components/project/` （项目卡片）
- 需找：`ProjectCard.tsx`、`ScriptDropdown.tsx` 或类似
- 探索指令：
  ```
  serena.find_symbol(name_path_pattern:"ProjectCard", depth:2)
  serena.search_for_pattern(
    substring_pattern:"(dev|build|lint)(\\s|'|\")",
    paths_include_glob:"devhub/src/renderer/components/project/**"
  )
  ```

---

## 五、验收标准

- 下拉菜单完整显示所有 npm script（不论数量）
- 上下空间不足时自动 flip 方向
- 跨主题（Soviet / Cyberpunk / Swiss）都不被遮挡
