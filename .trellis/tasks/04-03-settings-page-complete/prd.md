# Task: settings-page-complete

## Overview

将 DevHub 的 SettingsDialog 从当前的单页滚动列表重构为分类选项卡式设置面板，并新增外观、扫描、进程监控、通知、窗口管理、高级等全面设置项。同时完善后端类型定义、IPC 白名单、持久化逻辑以支持新增设置字段。

## Requirements

### 1. UI 重构：选项卡式设置面板

- 将 SettingsDialog 从单页滚动重构为 **左侧分类导航 + 右侧内容面板** 布局
- 分类包括：外观(Appearance)、扫描(Scan)、进程监控(Process)、通知(Notification)、窗口管理(Window)、高级(Advanced)
- 保持苏联构成主义设计风格一致性（方形圆角 2-4px、border-l-3 装饰、deco-diagonal 背景条纹）
- 为每个分类添加对应的 SVG 图标（复用/扩展 `icons/index.tsx`）
- 支持键盘导航（Tab/Arrow 切换分类）

### 2. 外观设置 (Appearance)

- 主题选择：保留现有 5 套主题切换功能（constructivism、modern-light、warm-light、dark、light）
- 字体大小调节（小/中/大 三档）
- 侧边栏位置（左/右）
- 紧凑模式开关
- 动画效果开关

### 3. 扫描设置 (Scan)

- 保留现有 scanDrives（扫描盘符选择）
- 保留现有 allowedPaths（允许路径管理）
- 新增 checkInterval 调节（当前已有字段，提供更好的 UI：Slider + 数值显示）
- 新增排除路径列表（excludePaths）
- 新增最大扫描深度设置（maxScanDepth）
- 新增扫描文件类型过滤

### 4. 进程监控设置 (Process)

- 启用/禁用进程监控开关
- 进程扫描间隔配置
- 僵尸进程自动清理开关及阈值
- CPU/内存占用警告阈值
- 监控进程白名单/黑名单

### 5. 通知设置 (Notification)

- **整合 NotificationConfig 到 AppSettings 持久化**（当前 NotificationConfig 仅在内存中，重启丢失）
- 总开关（保留现有 notificationEnabled）
- 按通知类型精细控制（5 种类型各自的开关）
- 声音通知开关
- 持久通知开关
- 免打扰时间段设置

### 6. 窗口管理设置 (Window)

- 启用/禁用窗口管理功能
- 自动分组策略配置
- 布局保存/恢复功能开关
- 窗口对齐吸附开关

### 7. 高级设置 (Advanced)

- 保留 autoStartOnBoot（开机自启动）- **注意：后端实际未实现，暂保留 UI，加 TODO 注释**
- 保留 minimizeToTray（最小化到托盘）
- 数据存储路径配置
- 日志级别设置（debug/info/warn/error）
- 导出/导入设置功能
- 重置为默认设置按钮
- 开发者模式开关

### 8. 后端同步（关键）

- 扩展 `AppSettings` 接口为嵌套结构（appearance/scan/process/notification/window/advanced）
- 更新 `DEFAULT_SETTINGS` 默认值
- 更新 `ALLOWED_SETTINGS_FIELDS` 白名单以支持新字段（**这是最常见的 bug 来源**）
- 更新 `AppStore.updateSettings()` 支持深层合并（deep merge）
- 将 `NotificationService.NotificationConfig` 持久化合并到 AppSettings
- 更新 preload 桥接层和 global.d.ts 类型声明（如需要）

## Acceptance Criteria

- [ ] SettingsDialog 使用左侧导航 + 右侧面板的选项卡式布局
- [ ] 6 个设置分类均可正常切换显示
- [ ] 每个分类的图标正确显示，风格与现有图标一致
- [ ] AppSettings 接口已扩展为嵌套结构，TypeScript 编译无错误
- [ ] DEFAULT_SETTINGS 包含所有新字段的合理默认值
- [ ] ALLOWED_SETTINGS_FIELDS 白名单包含所有新字段
- [ ] 所有设置项可正确保存到 electron-store 并在重启后恢复
- [ ] NotificationConfig 已从内存存储迁移到 AppSettings 持久化
- [ ] 主题切换功能保持正常
- [ ] 扫描盘符和允许路径功能保持正常（向后兼容）
- [ ] 新增的 Slider/NumberInput 等控件保持苏联构成主义风格一致性
- [ ] 重置为默认设置功能正常工作
- [ ] 导出/导入设置功能正常工作
- [ ] 无 TypeScript 类型错误
- [ ] 现有功能无回归

## Technical Notes

1. **AppSettings 扩展策略**：当前 AppSettings 是扁平结构（8 个字段）。随着设置项大幅增加，建议采用嵌套对象结构（`appearance: {...}`, `scan: {...}`, `process: {...}` 等）。需同时修改后端白名单验证逻辑（当前只做一级字段检查）和 `electron-store` 的 schema。需要实现向后兼容的迁移逻辑（检测旧格式并自动转换）。

2. **Settings 白名单安全边界**：`devhub/src/main/ipc/index.ts` 的 `ALLOWED_SETTINGS_FIELDS` 是安全性关键白名单。**每新增一个设置字段都必须在此处注册**，否则前端写入会被静默丢弃——这是最容易遗漏的 bug。

3. **NotificationConfig 双重存储问题**：通知配置目前有两个源头：(a) `AppSettings.notificationEnabled` 布尔值存在 electron-store 中；(b) `NotificationService` 有完整的 `NotificationConfig`（含按类型开关、声音、持久化），但仅在内存中。需要统一到 AppSettings 中持久化。

4. **autoStartOnBoot 空实现**：该字段 UI toggle 已存在但后端无任何实际逻辑。本次任务暂不实现后端，在 UI 上保留并加 TODO 注释说明。

5. **无 UI 组件库**：项目不使用 shadcn/radix 等组件库，所有 UI 手写 + Tailwind。新增的 Slider、NumberInput、ColorPicker 等需自行实现，保持构成主义风格（方形圆角 2-4px、border-l-3、deco-diagonal 条纹）。

6. **设置变更广播缺失**：当前修改设置后其他组件无法感知。建议在主进程增加 `settings:changed` 事件广播，但这不在本次任务强制范围内（可选优化）。

7. **已有 IPC 通道可复用**：进程监控（`window.devhub.systemProcess`）、窗口管理（`window.devhub.windowManager`）、通知（`window.devhub.notification`）等功能已有完整 IPC 通道和 API，设置页面应复用这些已有接口。

## Out of Scope

- 实际实现 autoStartOnBoot 后端逻辑（需要引入额外依赖）
- 设置变更广播机制（可在后续任务中添加）
- 新增主题（仅使用现有 5 套主题）
- 国际化/多语言支持
- 设置项的云同步
- 对设置页面添加独立的单元测试（可在后续质量任务中补充）
