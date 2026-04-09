# DevHub V2 Phase 1 — 基础增强实施

## Goal
实施 DevHub V2 第一阶段改进：监控面板响应式 + AI 窗口命名 + 分组/布局修复

## 设计文档
- 总领 PRD: `prompts/0409/prd-master.md`
- Spec-01: `prompts/0409/spec-01-monitor-responsive.md` (监控响应式)
- Spec-04: `prompts/0409/spec-04-window-management.md` (窗口管理, 模块 A + C)

## Requirements

### Spec-01: 监控面板响应式
- [ ] MonitorPanel 内容区添加 container-type: inline-size
- [ ] 替换 viewport media queries 为 Container Queries
- [ ] 新建 ResponsiveMetric 组件 + formatMetric 工具
- [ ] HeroStats / StatCard 集成动态格式化
- [ ] 400px~2560px 宽度范围无溢出/截断

### Spec-04A: AI 窗口自命名
- [ ] 新增 AIWindowAlias 类型和持久化
- [ ] 多因子加权匹配系统 (PID+目录+命令hash)
- [ ] 窗口卡片别名编辑 UI
- [ ] AITaskTracker 集成别名

### Spec-04C: 分组/布局修复
- [ ] 分组创建: hwnd 有效性验证 + toast 反馈
- [ ] 布局恢复: 增强匹配策略 (processName+title+className+workingDir)
- [ ] 所有操作添加 toast 反馈
- [ ] 布局保存预览 (mini-map)

## Acceptance Criteria
- [ ] 监控数值在 400px~2560px 完整显示无截断
- [ ] AI CLI 窗口可设别名，跨重启保留
- [ ] 分组创建/删除/聚焦正常工作，有操作反馈
- [ ] 布局保存/恢复/删除正常工作

## Technical Notes
- Electron 28 = Chromium 120, 完全支持 Container Queries
- 代码改动集中在 devhub/src/ 子模块内
