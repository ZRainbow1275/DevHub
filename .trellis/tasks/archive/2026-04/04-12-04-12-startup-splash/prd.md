# 启动闪屏与加载优化

## Goal
解决应用启动黑屏问题。实现原生闪屏窗口，在加载阶段完成所有进程/端口/窗口/拓扑扫描初始化，确保主窗口显示时数据已就绪。

## Requirements
- 原生闪屏窗口（纯 HTML，不依赖 React/Vite），启动时立即显示
- 闪屏内容：Logo + 进度条 + 当前加载阶段文字
- 加载阶段在闪屏期间完成所有扫描器初始化
- 主窗口 ready-to-show 后闪屏淡出、主窗口淡入
- 扫描器异常时自动重启（指数退避），不阻塞全局

## Acceptance Criteria
- [ ] 冷启动无黑屏：用户始终看到闪屏或加载界面
- [ ] 闪屏到主界面过渡平滑无闪烁
- [ ] 扫描器异常不导致全局卡死
- [ ] dev 模式和 production 模式均正常
- [ ] 冷启动到可交互 < 5 秒
- [ ] 闪屏页加载 < 100ms

## Technical Notes
- 详细 spec: `prompts/0411/01-startup-splash-spec.md`
- 批次: 第一批 (P0-Blocker)
- 层级: Full Stack (Electron Main + Renderer)
