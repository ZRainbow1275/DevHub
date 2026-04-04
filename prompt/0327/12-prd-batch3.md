# PRD — Batch 3: 架构优化（延期执行）

> 优先级: MEDIUM
> 类型: fullstack
> 状态: 规划阶段，等 Batch 1-2 完成后执行

---

## Goal

解决根本性架构问题，提升系统可维护性和可扩展性。

---

## Requirements

### R1: 统一系统命令抽象层 (ARCH-01)
- 创建 `SystemCommandRunner` 服务类
- 封装 PowerShell/WMIC/netstat 调用
- 所有服务通过抽象层调用系统命令
- 为 WMIC → Get-CimInstance 迁移做准备

### R2: 统一轮询调度器 (ARCH-02)
- 创建 `PollingScheduler` 主进程服务
- 替换所有渲染进程的 setInterval 触发模式
- 实现 push 模式: 主进程扫描 → IPC send → 渲染更新
- 支持应用可见性感知（最小化时降频）

### R3: 显式状态机 (ARCH-03)
- 定义项目和进程的状态转换图
- 防止非法状态转换
- 使并发操作更安全

### R4: WMIC 迁移 (SEC-02)
- 将所有 WMIC 调用替换为 PowerShell Get-CimInstance
- 添加 fallback 逻辑（检测 WMIC 可用性）
- 测试 Windows 10 和 Windows 11 兼容性

---

## Acceptance Criteria

- [ ] 所有系统命令通过 SystemCommandRunner 调用
- [ ] 主进程统一调度所有扫描
- [ ] 项目状态转换有显式状态机
- [ ] WMIC 调用已替换为 Get-CimInstance
- [ ] Windows 10/11 兼容性验证
- [ ] 性能不退化（基准测试对比）

---

## Technical Notes

- 此批次为架构重构，风险较高
- 建议在 Batch 1-2 验证通过后再执行
- 每个 R 可作为独立子任务
- WMIC 迁移需要在多个 Windows 版本上测试
