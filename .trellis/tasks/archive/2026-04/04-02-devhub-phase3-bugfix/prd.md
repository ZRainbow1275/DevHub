# DevHub Phase3 - 五项功能性Bug修复

## Goal
基于 phase2 (commit b101174) 的开发成果，修复 5 个功能性 Bug，使 DevHub 达到可用状态。

## Requirements

### R1: 主题切换修复
- 修复 IPC 验证逻辑，接受实际主题名 ('constructivism', 'modern-light', 'warm-light')
- 在 App.tsx 启动时初始化主题
- 确保主题选择能正确持久化并在重启后恢复

### R2: 项目自动发现与导入修复
- 修复竞态条件：确保 renderer listener 就绪后再发送 auto-discovered 事件
- 改善导入错误处理：显示实际成功数量
- 允许用户手动重新触发自动发现

### R3: CPU 列真实数值显示
- 修复 PowerShell 命令语法：正确拆分 PID 列表为数组
- 确保 getCpuTimes() 返回有效数据
- 保留首次扫描返回 0 的行为（需两次采样）

### R4: 窗口管理功能修复
- 验证并修复 useWindows hook 到 WindowManager 的完整调用链
- 确保窗口扫描、聚焦、最小化、最大化、关闭操作可用

### R5: 显示溢出修复
- PortCard localAddress 添加 truncate
- StatCard 大数值添加宽度约束
- HeroStats 添加移动端字体断点
- 评估并调整 grid 列数

## Acceptance Criteria
- [ ] 主题可在 constructivism/modern-light/warm-light 间切换并持久化
- [ ] 自动发现的项目可正确导入
- [ ] CPU 列显示真实百分比数值
- [ ] 窗口操作（聚焦、最小化等）可正常执行
- [ ] 无数值溢出显示问题
- [ ] `pnpm build` 成功
- [ ] `pnpm typecheck` 通过

## Technical Notes
- Electron + React + TypeScript + Vite
- Windows 平台 (Git Bash 环境)
- 源码在 devhub/src/
- 基于 commit b101174 (phase2) + 4 个未提交文件的修改
