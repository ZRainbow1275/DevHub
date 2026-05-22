# spec/21 — 项目模块 UX 打磨路线图

> 严重度：P2
> 对应用户诉求：P1.2（继续打磨项目应用） — **R1 起连续 6 轮提出**
> 对应验收矩阵：P1.2-a 到 P1.2-t（20 条）
> 对应债务：D24（项目模块交互粗糙）
> 对应市面最佳实践：VS Code Explorer、JetBrains Project View、Raycast 应用启动器、Warp Terminal

---

## 一、R7 扫盘

对 ProjectList / ProjectCard / ScriptSelector / ProjectSettingsPanel 等 12 个文件做系统性打磨。按"打磨项"分表。

---

## 二、20 项打磨清单

| # | 项目 | 现状 | 目标 | 文件 |
|---|------|------|------|------|
| 1 | 卡片 hover 高亮过于突兀 | 整卡 scale(1.02) + 强阴影 | 仅 border 色 + 轻阴影 | `ProjectCard.tsx` |
| 2 | Favorite Favorite 切换无动画 | 瞬变 | 200ms 缩放 + 粒子 | `ProjectCard.tsx` |
| 3 | Run Script 下拉被遮挡 | 见 spec/13 | Portal 化 | `ScriptSelector.tsx` |
| 4 | 卡片无 last-opened 时间 | 无 | 右下角显示"2 小时前" | `ProjectCard.tsx` |
| 5 | 无批量操作 | 无 | shift-点选 + 批量标签/归档 | `ProjectList.tsx` |
| 6 | 无 keyboard nav | 鼠标唯一 | ↑↓→← + Enter 打开 | `ProjectList.tsx` |
| 7 | 搜索框无高级过滤 | 仅名字模糊 | `lang:ts path:src stack:electron` DSL | `ProjectSearchBar.tsx` |
| 8 | 空状态无引导 | 文字"暂无项目" | 大图 + "导入现有项目 / 新建" 按钮 | `ProjectListEmpty.tsx` NEW |
| 9 | 项目扫描无 loading skeleton | 白屏 | 骨架屏 | `ProjectListSkeleton.tsx` NEW |
| 10 | 克隆仓库无进度 | 纯按钮 | 进度条 + stderr 尾行 | `CloneDialog.tsx` |
| 11 | 脚本运行终端无标签页 | 单终端 | 每脚本独立 tab | `TerminalPanel.tsx` |
| 12 | 运行中脚本无状态标记 | 无指示 | 卡片左上角绿点脉冲 | `ProjectCard.tsx` |
| 13 | git 状态仅有 branch 名 | 一行 | branch + ahead/behind + dirty | `GitBadge.tsx` NEW |
| 14 | package.json 解析失败无提示 | silent fail | 黄色警示条"package.json 解析失败" | `ProjectCard.tsx` |
| 15 | 无 recent commands 历史 | 每次选脚本 | 显示最近 3 个快速按钮 | `ScriptSelector.tsx` |
| 16 | 导出设置无确认 | 直接写 | 下载前预览 diff | `SettingsExport.tsx` |
| 17 | 右键菜单缺项 | 仅 2 项 | 12 项（见表 3） | `ProjectContextMenu.tsx` NEW |
| 18 | 无项目备注 | 无 | 卡片可填 300 字 markdown 备注 | `ProjectNote.tsx` NEW |
| 19 | 无项目分组 | 一维列表 | 文件夹式分组 + 拖拽 | `ProjectGroup.tsx` NEW |
| 20 | 无健康度评分 | 无 | 基于 git 活跃/README 完整度打分 | `HealthBadge.tsx` NEW |

### 表 3：右键菜单 12 项

```
+-------------------------------------------+
|  > Run Script                    Ctrl+R   |
|  > Open in Terminal              Ctrl+T   |
|  > Open in VS Code               Ctrl+O   |
|  > Open in File Explorer         Ctrl+E   |
+-------------------------------------------+
|    Copy Path                     Ctrl+C   |
|    Copy Git Remote URL                    |
+-------------------------------------------+
|    Rename                        F2       |
|    Add to Group              >            |
|    Toggle Favorite               Ctrl+D   |
|    Archive                                |
+-------------------------------------------+
|    Refresh Metadata                       |
|    Properties                    Ctrl+I   |
+-------------------------------------------+
```

---

### 2026-04-22 实装批注：P1.2-b

- `ProjectCard.tsx` 已新增显式“打开”按钮，点击后弹出多路径菜单：`在 VS Code 打开 / 在 Cursor 打开 / 在资源管理器打开 / 在终端打开 / 复制路径`。
- `ProjectList.tsx` 不再只走 `shell.openPath()`；项目卡片打开动作统一经由 `window.devhub.projects.openIn(projectPath, target)` 调用主进程。
- `project:open-in-editor` 已在 `main -> preload -> renderer` 真实接通。
- Windows 下 VS Code / Cursor 采用可执行文件探测 + detached 启动；资源管理器继续使用 Electron `shell.openPath()`；终端使用 detached `powershell.exe -NoExit` 并显式切换到项目目录。
- 2026-05-01 已补齐真实 `E2E-P1.2-b` 专项：本机通过 `winget` 安装并确认 `Cursor (User) 3.2.16` 后，Playwright Electron 测试从 renderer 调用真实 preload API `window.devhub.projects.openIn(projectPath, target)`，覆盖 `vscode`、`cursor`、`explorer`、`terminal` 四入口，且通过真实进程探测确认 VS Code、Cursor、PowerShell 可打开或复用。
- 验证命令：`pnpm typecheck` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "P1.2-b" --timeout=120000 --workers=1` 为 `1 passed (11.1s)`。当前自动化状态已提升为 `[TEST-PASS]`；`[USER-VERIFIED]` 仅在用户手测后标记。

---

## 三、设计原则

1. **键盘优先** — 每个鼠标操作有键盘等价
2. **进度可视** — 任何 > 500ms 操作显示 progress
3. **失败可恢复** — 失败操作显示重试按钮 + 错误详情
4. **批量操作** — 列表类场景一定要支持多选
5. **微交互** — 收藏/完成等"情感" 操作有短动画
6. **零 emoji** — 所有装饰用 lucide icon 或 logo SVG

---

## 四、数据契约扩展

```typescript
// ProjectMetadata 扩展
export interface ProjectMetadata {
  // 原有字段 ...

  // R7 NEW
  lastOpenedAt?: number
  note?: string                    // markdown 300 字
  groupId?: string                 // 分组 id
  tags?: string[]
  archived?: boolean

  healthScore?: {
    value: number                  // 0-100
    factors: {
      gitActive: number            // 0-30
      hasReadme: number            // 0-20
      hasLicense: number           // 0-10
      hasTests: number             // 0-20
      hasCI: number                // 0-20
    }
  }

  packageJsonStatus: 'ok' | 'missing' | 'parse-error' | 'no-node-project'
  gitStatus?: {
    branch: string
    ahead: number
    behind: number
    dirty: boolean
    lastCommit: { sha: string; subject: string; author: string; at: number }
  }
}
```

---

## 五、错误矩阵

| 错误码 | 触发 | 文案 |
|-------|-----|------|
| `PROJECT_PKG_JSON_PARSE_ERROR` | JSON.parse 抛异常 | 黄色条"package.json 解析失败" + 查看原因 |
| `PROJECT_NO_NODE_PROJECT` | 无 package.json | 按钮 disabled |
| `PROJECT_GIT_UNAVAILABLE` | 非 git 仓库 | GitBadge 隐藏 |
| `PROJECT_CLONE_FAILED` | git clone 失败 | Toast + 重试 |
| `PROJECT_HEALTH_UNAVAILABLE` | 扫描失败 | HealthBadge 显示"?" |

---

## 六、验收条件（20 条全量）

### E2E-P1.2-a Hover 合理
```
When hover 项目卡片
Then 仅 border 变色 + 阴影淡入；无缩放
```

### E2E-P1.2-b Favorite 动画
```
When 点击 favorite 按钮
Then 200ms 缩放动效 + 短暂粒子效果
```

### E2E-P1.2-c Portal dropdown
详见 spec/13 的 E2E。

### E2E-P1.2-d lastOpenedAt
```
Given 项目曾被双击打开
Then 卡片右下显示 "2h ago"
```

### E2E-P1.2-e 批量选择
```
When 按 shift 点选 2 个卡片
Then 两个都选中
When 按 ctrl+A
Then 全选
When 点 "归档选中"
Then 批量归档
```

### E2E-P1.2-f 键盘 nav
```
When 按 ↓
Then 下一张卡片高亮
When 按 Enter
Then 打开该项目
```

### E2E-P1.2-g 搜索 DSL
```
When 输入 "lang:typescript stack:electron"
Then 过滤为匹配的项目
```

### E2E-P1.2-h 空状态
```
Given 无项目
Then 显示"导入现有项目 / 新建项目"按钮组
```

### E2E-P1.2-i 骨架屏
```
When 首次加载
Then 8 张骨架卡闪烁
When 数据返回
Then 替换为真实卡片
```

### E2E-P1.2-j 克隆进度
```
When clone
Then 进度条 0-100 + stderr 尾行实时显示
```

### E2E-P1.2-k 终端 tab
```
When 同时运行 2 个脚本
Then TerminalPanel 显示 2 个 tab
```

### E2E-P1.2-l 运行中标记
```
When 脚本在跑
Then 卡片左上出现绿色脉冲点
```

### E2E-P1.2-m GitBadge
```
Given branch=main, ahead=2, behind=0, dirty=true
Then 显示 "main ↑2 *"
```

### E2E-P1.2-n package.json 解析失败
```
Given JSON 语法错误
Then 黄色条可见；点击显示原因对话框
```

### E2E-P1.2-o 最近命令
```
Given 曾运行 dev / build / test
Then ScriptSelector 顶部显示 3 个快速按钮
```

### E2E-P1.2-p 导出预览
```
When 导出设置
Then 显示 diff 预览；用户确认后写文件
```

### E2E-P1.2-q 右键 12 项
```
When 右键项目卡片
Then 12 项菜单全部可见；快捷键标注完整
```

### E2E-P1.2-r 项目备注
```
When 在卡片详情 tab 填写 markdown
Then 保存；卡片正面出现笔记图标
```

### E2E-P1.2-s 分组拖拽
```
When 拖卡片到另一组
Then 归属切换
When 创建子分组
Then 支持嵌套
```

### E2E-P1.2-t 健康度
```
Given 项目有 README + .github/workflows + test/
Then 健康分 >= 70；tooltip 显示各项加分
```

---

## 七、参考实现 / 库

- `framer-motion` — 微动画
- `cmdk` — 命令面板 + 搜索 DSL
- `@tanstack/react-virtual` — 列表虚拟化
- `react-dnd` or `dnd-kit` — 拖拽
- VS Code Explorer 的 Filter / Group / Sort
- Raycast 的命令面板

## 八、贡献到 contracts/22

- `ProjectMetadata` 扩展
- `HealthScoreFactors`, `GitStatus`, `PackageJsonStatus`

## 九、贡献到 contracts/23

- `project:rename`, `project:add-note`, `project:set-group`, `project:archive`, `project:restore`, `project:get-health`, `project:batch-update`, `project:compute-git-status`

---

## 十、2026-04-25 实装批注：P1.2-a

- `ProjectList` 不新增平行设置项，直接监听 `<html data-density>`，沿用设置面板写入的 `appearance.informationDensity` 与 `localStorage devhub:density`。
- compact 模式虚拟行高固定为 64px，并通过 `data-estimated-row-height` 暴露给 E2E；在 512px 可滚动区域内可机械容纳 8 张项目卡片。
- `ProjectCard` 新增 `data-testid="project-card"`、`data-project-status` 与 `project-card-*` CSS 钩子；compact 只折叠标签和快捷脚本这类次级正面信息，打开菜单、脚本选择、右键菜单、标签管理、详情入口等交互能力不删除。
- 2026-04-30 已补齐真实 Electron E2E：`P1.2-a 项目列表密度可从设置切换并同步虚拟行高` 通过真实设置面板切换 `compact` / `comfortable`，并断言 `<html data-density>`、项目列表 `data-density`、虚拟化 `data-estimated-row-height=64/144` 和 `electron-store` 持久化一致。验证：`pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.2-a" --timeout=90000 --workers=1`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.1|P1.2-a" --timeout=90000 --workers=1`、`pnpm test:e2e` 通过，状态提升为 `[TEST-PASS]`。
