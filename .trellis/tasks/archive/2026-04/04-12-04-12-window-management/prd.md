# 窗口管理核心功能全面修复

## Goal
修复四轮测试持续未解决的窗口管理核心功能。这是项目第一优先级痛点。

## Requirements

### P0-Critical
1. **AI 窗口自命名**：自动命名 + 用户自定义 + 持久化 + 视觉高亮
2. **通知携带窗口名称**：`[自定义名称] 任务完成` + Windows 原生 Toast + 通知历史
3. **AI 任务完成感测重构**：多信号融合（终端输出 + CPU + 输出速率 + 提示符 + 进程状态），置信度 ≥ 80 才通知，确认窗口期 3-5 秒
4. **focusWindow C#5 修复**：`out _` → `out uint dummy`，PowerShell 版本检测
5. **分组/布局修复**：排查 IPC 通道注册 + C# 编译问题 + UI 事件绑定

### P1
6. **监控进度状态机**：7 种状态（idle/thinking/coding/compiling/waiting-input/completed/error）+ 时间线 UI
7. **窗口高级功能**：基础操作扩展 + 批量操作 + 全局快捷键

## Acceptance Criteria
- [ ] AI 窗口自动命名 + 可重命名 + 关闭后恢复名称
- [ ] 任务完成通知标题包含自定义名称
- [ ] Claude Code 任务完成连续 10 次无误报
- [ ] 分组创建→添加窗口→批量操作全链路可用
- [ ] 布局保存→恢复全链路可用
- [ ] focusWindow 在 PowerShell 5.1 和 7+ 下均正常
- [ ] 7 种进度状态正确识别 + 时间线展示

## Technical Notes
- 详细 spec: `prompts/0411/03-window-management-spec.md`
- 批次: 第一批 (P0-Critical) + 第二批 (P1)
- 层级: Full Stack
- **四轮测试持续存在的第一痛点，务必彻底解决**
