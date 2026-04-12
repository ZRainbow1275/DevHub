# DevHub Phase 3 — 功能重建与体验革新

> 日期: 2026-04-02
> 触发: 用户手测 Phase 2 修复后发现 6 类问题
> 策略: 先修基础 → 再重建子系统 → 最后视觉革新

## 用户反馈汇总（附截图）

| # | 类别 | 问题 | 截图证据 | 严重度 |
|---|------|------|----------|--------|
| 1 | 窗口 | 启动出现两个窗口（一大一小） | Screenshot 1 | CRITICAL |
| 2 | 窗口 | 标题显示乱码（����）；聚焦/打开等操作无效 | Screenshot 1 | CRITICAL |
| 3 | 进程 | CPU 仍为 0.0%；StatCard 数值被截断；只显示 postgres；布局拥挤 | Screenshot 2 | HIGH |
| 4 | 项目 | 自动发现未生效，项目列表为空 | Screenshot 3 | HIGH |
| 5 | 主题 | 需全面视觉革新（排版、布局、字体、设计），非仅颜色切换 | 用户明确要求 | MEDIUM |
| 6 | 设置 | 系统设置不够详尽 | 用户明确要求 | MEDIUM |

## 根因分析

### 1. 双窗口问题
- **根因**: 缺少 `app.requestSingleInstanceLock()`，开发模式下 HMR 或 activate 事件可能触发二次 `createWindow()`
- **修复**: 添加单实例锁

### 2. 窗口标题乱码
- **根因**: PowerShell stdout 编码默认为系统 Code Page（中文 Windows 为 CP936/GBK），C# `GetWindowText` 返回的 Unicode 字符在 stdout 管道中被截断
- **修复**: 在 PowerShell 命令前设置 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`；Node 端 `execFileAsync` 添加 `encoding: 'utf8'`

### 3. 窗口操作无效
- **根因**: Phase 2 修复将 Add-Type 内联到每次调用，但需要验证 PowerShell 进程是否正确编译和执行 C# 代码。可能的残留问题：命令字符串中的换行符在 Windows 上可能被不正确处理
- **修复**: 验证实际 PowerShell 执行；改用单行命令或 Base64 编码

### 4. CPU 始终为 0
- **根因**: `@(${pidList})` 语法在 PowerShell 中 IS 有效的数组字面量，但 `Get-Process -Id $_ -ErrorAction SilentlyContinue` 中 `$_` 来自管道的 ForEach-Object，如果某些进程已退出会静默跳过。真正的问题可能是：第一次采样需要 baseline，第二次才有数据，但扫描间隔设置或调用时序有问题
- **修复**: 验证 PowerShell 命令实际输出；添加调试日志

### 5. StatCard 数值截断
- **根因**: Phase 2 添加的 `truncate` class 在 StatCard 上截断了数值（"0.0%" → "0...."）
- **修复**: 移除值元素上的 truncate；改用响应式字体缩放

### 6. 进程列表只显示 postgres
- **根因**: `DEV_PROCESS_PATTERNS` 中包含了 'postgres' 等数据库进程名
- **修复**: 收紧匹配模式，只匹配真正的开发工具进程

### 7. 项目发现未生效
- **根因**: `firstLaunchDone` 已被设为 true（上次启动时设置），自动发现不会再触发
- **修复**: 添加手动扫描按钮；重置 firstLaunchDone 或不依赖此标志

## 实施分期

| 阶段 | 内容 | 文件 | 预估文件数 |
|------|------|------|-----------|
| **3A: 基础修复** | 双窗口、编码、CPU、显示、发现 | [01-prd-phase3a.md](./01-prd-phase3a.md) | 8-12 |
| **3B: 窗口管理重建** | CLI 实例管理核心功能 | [02-prd-phase3b.md](./02-prd-phase3b.md) | 5-8 |
| **3C: 项目发现重建** | 多类型项目扫描与环境管理 | [03-prd-phase3c.md](./03-prd-phase3c.md) | 4-6 |
| **3D: UX 革新** | 主题系统、设置页、视觉设计 | [04-prd-phase3d.md](./04-prd-phase3d.md) | 10-15 |

## 约束

- 不引起驱动或内核级别崩溃（PowerShell 命令必须安全）
- 参照优秀开源实践（Process Explorer, htop 理念）
- 资源占用低于 Windows 任务管理器
- 所有改动非破坏性，增量交付
