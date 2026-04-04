# Task: port-monitor-relationship

## Overview

修复端口监控视图中的端口号截断显示问题，并设计端口与进程之间的深层关系可视化，揭示本地网络拓扑。

本任务涉及 Electron 应用的前后端全栈改动：后端扩展端口扫描数据模型，前端修复 UI bug 并新增关系图视图。

## Requirements

### Bug 修复：端口号截断

- **问题**：当端口号为 5 位数（如 49152、65535）时，PortView.tsx 的卡片模式（w-14 h-14 容器 + text-2xl 字体）和列表模式（w-12 h-12 容器 + text-lg 字体）无法容纳完整端口号，导致显示为 `:471...` 形式
- **根因**：PortView.tsx 第 69 行（PortCard）和第 184 行（PortItem）使用固定宽度容器
- **修复**：使用动态宽度（min-w-fit）或增大容器尺寸，确保 1-65535 范围内所有端口号完整显示

### 数据模型扩展：foreignAddress 补全

- **问题**：PortScanner.parseNetstatOutput（第 101 行）在解构 netstat 输出时跳过了 Foreign Address 字段
- **修复**：在 `PortInfo` 类型中添加 `foreignAddress: string` 字段，解析并保留该数据
- **影响范围**：types-extended.ts → PortScanner.ts → portHandlers.ts → portStore.ts → usePorts.ts

### 进程-端口关系聚合

- **问题**：当前 SystemProcessScanner 将 PID 映射为单个端口（Map<pid, port>），不支持一个进程占用多端口的场景
- **扩展**：构建完整的进程-端口多对多关系图数据结构
- **数据结构**：
  - 节点类型：Process（PID + name）、Port（端口号 + 协议）、External（foreign address）
  - 边类型：Process→Port（进程监听/使用端口）、Port→External（已建立的外部连接）

### 关系图可视化（新视图模式）

- 在 PortView 中新增"关系图"视图模式（与现有的卡片/列表模式并列）
- 使用 @xyflow/react（React Flow）实现交互式节点-边关系图
- 自定义节点样式需符合项目苏联构成主义设计风格（方角、粗线条、几何形状）
- 支持：缩放、拖拽、节点悬停详情、边高亮
- 节点分组：按进程名聚合同类节点

### IPC 通道扩展

- 新增获取拓扑关系数据的 IPC handler（需包裹 withRateLimit）
- 在 preload/extended.ts 暴露新 API
- 在 global.d.ts 声明类型
- 在 portHandlers.ts 注册并在 cleanupPortHandlers 中清理

## Acceptance Criteria

- [ ] 所有端口号（1-65535）在卡片模式和列表模式下完整显示，无截断
- [ ] PortInfo 类型包含 foreignAddress 字段，PortScanner 正确解析并返回
- [ ] 关系图视图正确显示进程→端口→外部连接的拓扑关系
- [ ] 关系图节点支持拖拽、缩放、悬停查看详情
- [ ] 关系图视图与苏联构成主义设计风格一致（方角、几何线条）
- [ ] 新 IPC 接口包含 withRateLimit 限制和输入验证
- [ ] 现有 PortScanner 单元测试通过，并新增 foreignAddress 相关测试
- [ ] 一个进程占用多个端口时在关系图中正确聚合显示
- [ ] ViewModeToggle 支持三种模式切换（卡片/列表/关系图）

## Technical Notes

1. **图形库选型**：@xyflow/react（React Flow）-- 与 React + Tailwind 技术栈兼容，支持自定义节点，社区活跃。需安装 `@xyflow/react` 依赖。

2. **foreignAddress 恢复**：PortScanner.ts 第 101 行 `const [protocol, localAddr, , state, pidStr] = parts` 需要改为 `const [protocol, localAddr, foreignAddr, state, pidStr] = parts`，并将 foreignAddr 赋值到新字段。

3. **性能考量**：ESTABLISHED 连接可能有数百条，关系图需考虑：
   - 限制初始渲染的节点数量
   - 支持按进程名/状态过滤
   - 防抖更新避免频繁重绘

4. **设计风格参考**：现有组件使用 `borderRadius: '2px'`、trapezoid clip-path badge、左侧 3px accent 边框、对角线装饰。关系图节点和边需遵循此风格。

5. **数据流**：PortScanner → portHandlers (IPC) → preload → usePorts hook → portStore → PortView（关系图模式）

## Out of Scope

- 跨机器的远程网络拓扑发现
- 端口安全审计/漏洞扫描功能
- 历史拓扑变化的时间线回放
- 关系图数据的持久化存储
- 外部连接的地理位置信息
- 端口流量统计/带宽监控
