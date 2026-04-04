# Task: process-card-enhancement

## Overview

增强进程卡片组件（ProcessView.tsx），解决路径显示截断问题、添加丰富的操作菜单、改进 CPU/内存资源可视化效果。当前进程卡片功能单一（仅有终止进程按钮），路径信息严重截断（卡片视图用 CSS truncate，列表视图硬编码截断 50 字符），CPU/内存进度条过于简陋且内存百分比计算不准确（硬编码 `process.memory / 10`）。

## Requirements

### 1. 路径完整显示与 Hover 展开

- **显示 workingDir**：`ProcessInfo.workingDir` 字段已存在于类型定义中但前端完全未展示，需在卡片和列表视图中显示工作目录
- **Hover 展开机制**：鼠标悬停时显示完整路径和命令行，使用自定义 Tooltip 组件或 CSS-only 方案（项目中无现成 Tooltip 组件，仅有 `.tooltip` CSS 类）
- **卡片视图**：保留截断的默认显示，hover 时展开显示完整命令和工作目录
- **列表视图**：移除硬编码 50 字符截断（第 261-263 行），改用 CSS truncate + hover 展开

### 2. 添加更多操作

复用已有的 `ContextMenu` 组件（参考 `ProjectCard.tsx` 的集成模式），添加右键菜单操作：

- **查看详情**：展开/弹出进程详细信息面板（PID、父 PID、工作目录、完整命令行、CPU/内存详情、启动时间等），使用 `EyeIcon`
- **打开目录**：使用 `window.devhub.shell.openPath(process.workingDir)` 打开进程工作目录（参考 `ProjectList.tsx` 第 52 行模式），使用 `FolderIcon`
- **复制命令行**：使用 `navigator.clipboard.writeText()` + `useToast` 反馈（参考 `ProjectList.tsx` 第 59-65 行模式），使用 `CopyIcon`
- **进程树**：查看当前进程的子进程树，需新增后端 IPC API。使用新增的 `TreeIcon` 图标
- **终止进程**（已有）：保留现有终止功能，移入右键菜单作为 `danger` 类型项，使用 `divider` 分隔

### 3. 改进 CPU/内存可视化

- **修复内存百分比计算**：当前硬编码 `process.memory / 10`（假设上限 1000MB），应改为基于系统总内存的百分比或使用更合理的动态上限
- **增强进度条样式**：从单调的 `h-1.5` 细线升级为更具信息量的可视化（更宽的条带、颜色渐变、标注数值）
- **多级阈值颜色**：当前仅 >50% 变 warning，改为多级渐变（正常/注意/警告/危险）
- **列表视图可视化**：当前列表视图仅显示纯数字文本，添加迷你进度条或颜色指示
- **卡片视图增强**：考虑添加数值标注在进度条旁/上方，让数字和图形同时可见

### 4. 进程树后端支持（跨层）

- 在 `SystemProcessScanner` 中新增 `getProcessTree(pid)` 方法
- 在 `processHandlers.ts` 中注册新 IPC handler
- 在 `preload/extended.ts` 中暴露新 API
- 在 `global.d.ts` 中更新类型声明
- 在 `useSystemProcesses` hook 中封装调用

## Acceptance Criteria

- [ ] 卡片视图中显示工作目录信息（截断 + hover 展开完整路径）
- [ ] 列表视图中命令行路径支持 hover 查看完整内容，不再硬编码 50 字符截断
- [ ] 右键点击进程卡片/列表项弹出 ContextMenu，包含：查看详情、打开目录、复制命令行、进程树、终止进程
- [ ] "打开目录"操作正确调用 `shell.openPath` 打开 workingDir
- [ ] "复制命令行"操作正确复制到剪贴板，并显示 Toast 成功通知
- [ ] "查看详情"操作展开/弹出包含完整进程信息的面板
- [ ] "进程树"操作显示子进程列表（需后端 IPC 支持）
- [ ] CPU 进度条使用多级阈值颜色渐变
- [ ] 内存进度条使用合理的百分比计算（非硬编码 /10）
- [ ] 列表视图包含迷你 CPU/内存可视化指示（不只是纯文本数字）
- [ ] 所有新增 UI 严格遵循苏维埃构成主义设计语言（border-l-2/3 左边框、2px 圆角、uppercase tracking-wider 标签、font-mono 数值、deco-diagonal 装饰）
- [ ] TypeScript 类型安全，无 any 类型
- [ ] 新增 IPC channel 的类型声明在 global.d.ts 中正确更新

## Technical Notes

1. **设计语言一致性**：项目使用苏维埃构成主义（Soviet Constructivism）设计语言，特征包括 `border-l-2`/`border-l-3` 左边框强调、`borderRadius: '2px'` 极小圆角、`deco-diagonal` 斜线装饰、`uppercase tracking-wider` 标签文字、`font-mono` 数值显示。所有新增组件必须严格遵循此风格。

2. **技术栈**：React + TypeScript + Zustand + Tailwind CSS + Electron。无第三方 UI 组件库，所有 UI 组件均为自定义实现。

3. **已有可复用模式**：
   - `ContextMenu` 组件：支持位置感知、Escape 关闭、divider、danger 状态
   - `useToast` hook：Toast 通知反馈
   - `window.devhub.shell.openPath(path)`：打开本地目录
   - `navigator.clipboard.writeText(text)`：剪贴板复制
   - `tree-kill` 库：后端已使用，可扩展用于进程树查询

4. **IPC API 缺口**：当前 `systemProcessApi` 仅暴露 scan/kill/cleanupZombies/getGroups。进程树功能需要新增 `getProcessTree` channel。

5. **ProcessInfo 字段**：类型定义中 `workingDir` 字段已存在且后端已填充数据，前端只需展示即可。

6. **可用图标**：icons/index.tsx 中已有 `FolderIcon`、`CopyIcon`、`EyeIcon`、`TerminalIcon`、`CloseIcon` 等，进程树需新增 `TreeIcon`。

## Out of Scope

- 进程排序/过滤功能增强
- 进程实时图表（折线图/历史趋势）
- 进程日志/输出查看
- 进程组管理功能修改
- 系统级别的资源监控总览改动
- PortView 等兄弟组件的修改
