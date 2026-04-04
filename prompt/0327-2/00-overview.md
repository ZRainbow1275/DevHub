# DevHub Phase 2 — 综合修复总览

> 日期: 2026-03-27
> 触发: 用户实测发现 4 大类问题
> 实施顺序: 安全 → 功能 → 主题 → 布局

## 问题清单

| # | 类别 | 问题 | 根因 | 严重度 |
|---|------|------|------|--------|
| 1 | 主题 | 黑红压抑，不够明亮催人奋进 | 单主题硬编码，无切换机制 | MEDIUM |
| 2 | 布局 | 组件显示不全、分布错误 | w-[340px]固定宽度，无响应式 | MEDIUM |
| 3 | 功能 | 项目列表为空 | 无启动自动发现 | HIGH |
| 4 | 功能 | 端口与项目不匹配 | PortInfo.projectId 从未填充 | HIGH |
| 5 | 功能 | 进程 CPU 始终为 0 | 硬编码 cpuPercent: 0 | HIGH |
| 6 | 功能 | 窗口管理无效 | C# 编译失败无恢复 | CRITICAL |
| 7 | 功能 | AI 工具检测失败 | Cursor pattern 为空，regex 太严格 | HIGH |
| 8 | 安全 | 可杀系统进程 | 无保护进程列表 | CRITICAL |
| 9 | 安全 | 僵尸检测太松 | cpu<1% AND >1h，直接 SIGKILL | CRITICAL |
| 10 | 安全 | 端口释放杀任意进程 | 不检查进程身份 | HIGH |

## PRD 索引

| 文件 | 内容 | 优先级 |
|------|------|--------|
| [03-prd-security.md](./03-prd-security.md) | 安全加固 | P0 |
| [02-prd-functionality.md](./02-prd-functionality.md) | 功能修复 | P1 |
| [01-prd-theme.md](./01-prd-theme.md) | 多主题系统 | P2 |
| [04-prd-layout.md](./04-prd-layout.md) | 布局修复 | P2 |

## Spec 索引

| 文件 | 内容 |
|------|------|
| [12-spec-security.md](./12-spec-security.md) | 安全技术规格 |
| [11-spec-functionality.md](./11-spec-functionality.md) | 功能技术规格 |
| [10-spec-theme.md](./10-spec-theme.md) | 主题技术规格 |
| [13-spec-layout.md](./13-spec-layout.md) | 布局技术规格 |
