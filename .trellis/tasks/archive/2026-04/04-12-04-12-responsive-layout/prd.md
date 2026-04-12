# 响应式布局与信息密度优化

## Goal
解决 UI 显示过于局促的问题。引入响应式断点系统和可调信息密度。

## Requirements
- 引入 Container Query 断点系统（xs/sm/md/lg/xl）
- 卡片间距最小 12px，面板内边距最小 16px
- 长文本使用 tooltip 而非 overflow:hidden
- 三级信息密度切换（紧凑/标准/宽松），持久化到设置
- 侧边栏折叠/展开功能
- 窗口宽度不足时自动减少列数而非挤压内容

## Acceptance Criteria
- [ ] 800px 宽窗口不出现挤压/截断
- [ ] 1920px 宽窗口充分利用空间
- [ ] 卡片间距最小 12px
- [ ] 长文本有 tooltip
- [ ] 三级密度切换正常
- [ ] 侧边栏折叠/展开正常

## Technical Notes
- 详细 spec: `prompts/0411/05-responsive-layout-spec.md`
- 批次: 第二批 (P1)
- 层级: Frontend
