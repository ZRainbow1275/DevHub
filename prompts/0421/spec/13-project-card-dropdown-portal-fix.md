# spec/13 — 项目卡片下拉菜单 Portal 修复

> 严重度：P1
> 对应用户诉求：P1.1（项目卡片 npm 运行下拉菜单被遮挡）
> 对应验收矩阵：P1.1
> 对应债务：D13（ScriptSelector dropdown 无 Portal）
> 本 spec 仅做一次性精准修复 + 回归护栏。

---

## 一、动机

用户截图：`屏幕截图 2026-04-15 194903.png` 显示点击第一张项目卡片的 "Run Script" 按钮后，下拉菜单的下半部分被第二张项目卡片的内容遮挡。

### 1.1 根因
`devhub/src/renderer/components/project/ScriptSelector.tsx:40-82` 使用：

```tsx
<div className="relative" ref={menuRef}>
  <button>...</button>
  {isOpen && (
    <div className="absolute right-0 top-full mt-1 ... z-50">
      {/* dropdown items */}
    </div>
  )}
</div>
```

下拉 DOM **挂在卡片内部**；外层若存在 overflow:hidden、transform、filter、会建立新的 stacking context，或相邻卡片 z-index 相近，都会遮挡。即使 z-50，在兄弟卡片形成 transform（例如 hover 动画）后也会被叠上。

### 1.2 修正策略
使用 React Portal / Radix UI `<Popper>` / `@floating-ui/react` 把下拉挂到 `document.body`，脱离卡片的 stacking context。

---

## 二、受影响源码

| 文件 | 行号 | 变更 |
|------|------|------|
| `devhub/src/renderer/components/project/ScriptSelector.tsx` | 40-82 | 用 `@radix-ui/react-dropdown-menu` 或 `@floating-ui/react` 的 `FloatingPortal` 替换 `absolute` |
| `devhub/src/renderer/components/project/ProjectCard.tsx` | 245-261 | 无需改 |
| NEW: `devhub/src/renderer/components/ui/Popover.tsx` | — | 抽一个项目级 Popover primitive（若已有则跳过） |

---

## 三、实现方案（两种可选）

### 方案 A — `@radix-ui/react-dropdown-menu`（推荐）

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Play } from 'lucide-react'

export function ScriptSelector({ scripts, onRun }: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button data-testid="project-run-script-btn">
          <Play size={14} />
          Run
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[9999] min-w-[180px] rounded-md bg-surface-800 shadow-xl ..."
        >
          {scripts.map(s => (
            <DropdownMenu.Item
              key={s.name}
              onSelect={() => onRun(s.name)}
              className="px-3 py-2 text-sm hover:bg-surface-700"
            >
              {s.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

### 方案 B — `@floating-ui/react`（更精细）

同理，`useFloating({ middleware: [flip(), shift(), size()] })` + `FloatingPortal`。适合需要自定义 shift/flip 行为。

**决定**：项目已有若干 Radix 组件（待确认 Radix 生态整合情况），**首选方案 A**。若 Radix 未引入，则 B。

---

## 四、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 |
|-------|-----|------|------|------|
| `DROPDOWN_NO_SCRIPTS` | project.scripts 为空 | 按钮 disabled；tooltip "未检测到 package.json scripts" | INFO | 无 |
| `DROPDOWN_RUN_FAILED` | 运行脚本 IPC 失败 | Toast "运行失败: <reason>" | ERROR | 重试 |

---

## 五、验收条件

### E2E-P1.1-a
```
Given 列表视图 5+ 项目卡片水平排列
When 点击第 1 张卡片的 Run Script 按钮
Then 下拉菜单的 DOM 挂在 body 子节点（`.radix-dropdown-menu-content` 的 parent === body）
And 下拉菜单的 z-index === 9999（或由 Radix portal 自动确保最顶）
And 用户可以点击下拉中的任一菜单项（不被遮挡）
```

### E2E-P1.1-b
```
Given 当前主题=cyberpunk，hover 动画会让相邻卡片略微放大
When 打开第 1 张卡片下拉
Then 下拉始终在相邻卡片之上
```

### E2E-P1.1-c
```
Given 下拉菜单打开时，用户滚动主列表
Then 下拉跟随触发按钮移动（Radix 自动处理 scroll 锁定或 reposition）
```

---

## 六、E2E 脚本

```typescript
// tests/e2e/project-card-dropdown-portal.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers'

test('dropdown is rendered outside card via portal', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="nav-projects"]')
  const firstCard = win.locator('[data-testid="project-card"]').first()
  const runBtn = firstCard.locator('[data-testid="project-run-script-btn"]')
  await runBtn.click()
  const menu = win.locator('[role="menu"][data-radix-popper-content-wrapper]').first()
  await expect(menu).toBeVisible()
  const parent = await menu.evaluate(el => el.parentElement?.tagName)
  expect(parent).toBe('BODY')  // Portal 挂 body
  // 点第二个菜单项
  const items = menu.locator('[role="menuitem"]')
  await items.nth(1).click()
  await app.close()
})
```

---

### 6.1 2026-04-30 当前实现与验证

- 当前实现未引入 Radix / Floating UI 新依赖，而是沿用项目轻量实现：`ScriptSelector` 使用 `createPortal(..., document.body)` 将菜单挂到 body，采用 `position: fixed`、视口 clamp 与 `zIndex=1200` 避开项目卡片 stacking context。
- `ScriptSelector` 已补充 `aria-haspopup="menu"`、`aria-expanded`、`role="menu"`、`role="menuitem"` 与稳定 `data-testid`，并支持 Escape 关闭后回焦触发按钮。
- 真实 E2E 已覆盖：`pnpm exec playwright test e2e/example.spec.ts -g "P1.1" --timeout=90000 --workers=1` 通过 1 test；全量 `pnpm test:e2e` 通过 9 tests。断言包括 body portal、fixed 定位、不越出视口、z-index 门槛、多个真实脚本选项和键盘关闭。

---

## 七、参考实现 / 库

- `@radix-ui/react-dropdown-menu`（v2+）
- `@floating-ui/react` 作为备选
- `@radix-ui/react-popover` 用于类似问题（设置面板、AI Alias badge 等）
- 参考 VS Code 的 Quick Pick 实现

---

## 八、影响半径 / LoC

- 新增：0-1 文件（仅当抽 Popover primitive）
- 修改：1 文件（ScriptSelector）
- 预计 LoC：~80 行
