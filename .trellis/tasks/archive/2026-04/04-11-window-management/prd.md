# Spec: 窗口管理系统全面修复与增强

> 关联 PRD: `00-prd-round3.md` § 3.3 (全部子项) + R1-2.1/2.2/2.3/2.4 + R2-2.2
> 优先级: P0-Critical
> 层级: Full Stack
> **三轮测试持续存在的第一优先级问题**

---

## 1. 问题总览

| 子问题 | 首次报告 | 当前状态 | 严重性 |
|--------|---------|---------|--------|
| AI 窗口自命名 | R1 | 三轮未修复 | Critical |
| 通知携带窗口名称 | R1 | 三轮未修复 | Critical |
| AI 任务完成感测不准 | R1 | 三轮误报/漏报/错报 | Critical |
| 分组/布局不可用 | R1 | 三轮未修复 | Critical |
| 监控进度太粗 | R1 | 三轮仍仅两态 | High |
| 窗口功能有限 | R3 | 新增 | High |
| focusWindow C#5 bug | R1 | 未修复 | Critical |

---

## 2. AI 窗口自命名系统

### 2.1 自动命名
```typescript
interface AIWindowNaming {
  // 自动命名规则
  autoName: `${toolType}-${index}` // e.g., "Claude Code-1", "Codex CLI-2"
  
  // 匹配键（用于持久化恢复）
  matchKey: {
    titlePrefix: string      // 窗口标题前缀
    executablePath: string   // 可执行文件路径
  }
}
```

### 2.2 用户自定义命名
- **触发方式**：
  - 双击窗口卡片标题 → 内联编辑（输入框，Enter 确认，Esc 取消）
  - 右键菜单 → "重命名"
  - 卡片上的铅笔图标 → 同内联编辑
- **校验**：名称长度 1-50 字符，禁止特殊字符 `< > : " / \ | ? *`
- **反馈**：成功后短暂高亮卡片

### 2.3 持久化
```typescript
// electron-store 结构
{
  "aiWindowAliases": {
    "claude-code|C:\\Users\\X\\.claude\\claude.exe": "Claude-前端重构",
    "codex-cli|C:\\Users\\X\\codex\\codex.exe": "Codex-API开发"
  }
}
```
- 窗口关闭后名称保留
- 相同匹配键的新窗口自动恢复名称

### 2.4 视觉标识
- AI 窗口 **置顶显示**（在窗口列表最前面）
- 专属图标（根据工具类型：Claude/Codex/OpenCode/Gemini 各有图标）
- 彩色左边框（accent 色）
- "AI" 标签徽章

---

## 3. 任务完成通知

### 3.1 通知格式
```
标题: [{自定义名称}] 任务完成
正文: {工具类型} (PID:{pid})
      持续时间: {duration}
      最后输出: {last 3 lines}
```

- 有自定义名称：`[Claude-前端重构] 任务完成`
- 无自定义名称：`[Claude Code (PID:12345)] 任务完成`

### 3.2 通知渠道
1. **Windows 原生 Toast Notification**：`new Notification(title, { body, icon })`
2. **应用内 Toast**：同步在应用内显示
3. **通知历史面板**：最近 50 条记录，可滚动查看

### 3.3 通知交互
- 点击 Windows Toast → 聚焦对应窗口（需 focusWindow 可用）
- 应用内 Toast 提供"跳转"按钮
- 通知历史中点击条目 → 聚焦窗口

---

## 4. AI 任务完成感测重构

### 4.1 当前问题
- 纯关键词匹配 → 误报率高
- 未结合进程状态 → 漏报
- 无确认窗口期 → 错报

### 4.2 多信号融合检测架构

```
信号源                    权重    说明
──────────────────────────────────────────────
终端输出关键词            20%     Done/Complete/✓/finished/Error/Failed
CPU 活动变化              25%     运行时高 → 完成后回落到基线
终端输出速率              20%     编码时密集 → 完成后静默
输入提示符检测            25%     $, >, ❯, >>>, % 等提示符出现
子进程退出事件            10%     AI 启动的子进程（编译/测试）退出

综合置信度 = Σ(信号值 × 权重)
阈值: ≥ 80 → 发送通知
```

### 4.3 确认窗口期
```
检测到"可能完成"
  └── 进入 3 秒确认窗口
       ├── 窗口期内无新输出 + CPU 回落 → 确认完成 → 发通知
       └── 窗口期内有新输出 → 取消，重置检测
```

### 4.4 各工具独立配置
```typescript
interface AIToolDetectionConfig {
  toolType: 'claude-code' | 'codex-cli' | 'opencode' | 'gemini-cli' | 'custom'
  completionKeywords: string[]          // 完成关键词
  errorKeywords: string[]               // 错误关键词
  promptPatterns: RegExp[]              // 提示符正则
  cpuBaselineThreshold: number          // CPU 基线阈值(%)
  confirmationWindowMs: number          // 确认窗口期(ms)
}
```

### 4.5 用户纠错
- 通知中提供"标记为误报"按钮
- 误报数据收集 → 用于动态调整阈值
- 设置面板中可调整各信号权重

---

## 5. 分组与布局功能修复

### 5.1 排查清单
- [ ] IPC 通道注册检查：`window:createGroup`, `window:saveLayout`, `window:restoreLayout`
- [ ] PowerShell/Win32 API 调用链中的 C# 编译问题（`out _` → `out uint dummy`）
- [ ] UI 按钮事件绑定检查（onClick handler 是否正确连接到 IPC）
- [ ] preload 中是否正确暴露相关 API

### 5.2 分组功能要求
```
创建分组 → 命名 → 添加窗口到分组 → 分组内操作：
  ├── 全部最小化
  ├── 全部还原
  ├── 排列（平铺/层叠）
  ├── 移动到指定显示器
  └── 删除分组（不关闭窗口）
```

### 5.3 布局功能要求
```
保存布局：记录所有窗口的 { hwnd, x, y, width, height, state }
恢复布局：将窗口移动到保存的位置和大小
预设布局：
  ├── 平铺（Tile）：等分屏幕
  ├── 主次分区（Master-Slave）：主窗口大面积 + 其余小排列
  └── 层叠（Cascade）：斜向层叠
```

### 5.4 布局持久化
```typescript
// electron-store 结构
{
  "windowLayouts": {
    "开发模式": [
      { "matchKey": "...", "x": 0, "y": 0, "width": 960, "height": 1080, "state": "normal" },
      // ...
    ],
    "演示模式": [ ... ]
  }
}
```

---

## 6. 监控进度状态机

### 6.1 状态定义
```
idle          空闲（终端无活动，CPU 平稳）
thinking      思考中（CPU 高，无终端输出）
coding        编码中（持续终端输出 + 文件写入信号）
compiling     编译/测试中（检测 npm/tsc/vite/cargo 等命令）
waiting-input 等待输入（提示符出现，CPU 平稳）
completed     完成（关键词 + CPU 回落 + 静默）
error         错误（Error/Failed/panic/✗）
```

### 6.2 状态转换
```
idle ──(CPU 上升)──→ thinking
thinking ──(有输出)──→ coding
coding ──(检测到编译命令)──→ compiling
compiling ──(编译完成)──→ coding | completed | error
coding ──(输出停止 + 提示符)──→ waiting-input
waiting-input ──(有新输入)──→ thinking
any ──(完成信号, 置信度≥80)──→ completed
any ──(错误关键词)──→ error
completed ──(新活动)──→ thinking
error ──(新活动)──→ thinking
```

### 6.3 视觉表示
| 状态 | 图标 | 颜色 | 动画 |
|------|------|------|------|
| idle | ⏸ | gray | 无 |
| thinking | 🧠 | blue | 脉冲 |
| coding | ⌨ | green | 打字动画 |
| compiling | ⚙ | orange | 旋转 |
| waiting-input | ⏳ | yellow | 闪烁 |
| completed | ✓ | green | 短暂闪光 |
| error | ✗ | red | 抖动 |

### 6.4 进度时间线
- 水平时序条：每段颜色 = 对应状态
- 鼠标悬停 → tooltip 显示：状态名 + 持续时间 + 起止时间
- 时间线长度：最近 1 小时（可缩放）

---

## 7. 窗口高级功能

### 7.1 基础操作
- [x] 聚焦（需 focusWindow bug 修复）
- [ ] 最小化 / 最大化 / 还原 / 关闭
- [ ] 置顶（Always on Top）
- [ ] 移动到指定坐标/显示器

### 7.2 高级操作
- [ ] 发送按键到窗口（如 Ctrl+C 终止命令）
- [ ] 窗口截图（保存到本地/剪贴板）
- [ ] 窗口透明度调节（slider 0-100%）

### 7.3 批量操作
- [ ] 多选窗口 → 批量最小化/还原/关闭
- [ ] 按分组批量操作
- [ ] "全部最小化" / "全部还原" 快捷按钮

### 7.4 快捷键
- [ ] 全局热键切换到指定 AI 窗口（用户可自定义）
- [ ] Alt+Tab 增强：循环切换 AI 窗口

---

## 8. focusWindow PowerShell C#5 兼容性修复

### 8.1 问题
`focusWindow` 调用 PowerShell `Add-Type` 编译 C# 代码，使用了 C# 7+ 语法 `out _`（discard），Windows PowerShell 5.1 的编译器仅支持 C# 5。

### 8.2 修复方案
```csharp
// Before (C# 7+)
ShowWindow(hWnd, out _);

// After (C# 5 compatible)
uint dummy;
ShowWindow(hWnd, out dummy);
```

### 8.3 额外加固
- [ ] PowerShell 版本检测：`$PSVersionTable.PSVersion`
- [ ] 如果是 PowerShell 7+，可使用更新的 C# 语法
- [ ] 统一输出编码：`[Console]::OutputEncoding = [Text.Encoding]::UTF8`
- [ ] 错误处理：PowerShell 执行失败时回退到 Win32 API 直调

---

## 9. 验收标准

### AI 窗口自命名
- [ ] 检测到 AI 窗口自动命名（如 "Claude Code-1"）
- [ ] 双击标题可重命名
- [ ] 关闭后重新打开自动恢复名称
- [ ] AI 窗口置顶 + 视觉高亮

### 通知
- [ ] 任务完成通知标题包含自定义名称
- [ ] Windows 原生 Toast 正常弹出
- [ ] 点击通知聚焦对应窗口
- [ ] 通知历史面板可查看

### 感测准确性
- [ ] 准确检测 Claude Code 任务完成（连续 10 次无误报）
- [ ] 准确检测 Codex CLI 任务完成
- [ ] 误报后可标记纠错

### 分组/布局
- [ ] 创建分组 → 添加窗口 → 批量操作 全链路可用
- [ ] 保存布局 → 恢复布局 全链路可用
- [ ] 布局持久化到 electron-store

### 进度监控
- [ ] 7 种状态正确识别
- [ ] 进度时间线正确展示
- [ ] 状态切换延迟 < 3 秒

### focusWindow
- [ ] 在 Windows PowerShell 5.1 下正常工作
- [ ] 在 PowerShell 7+ 下正常工作

---

## 10. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/services/WindowManager.ts` | 重构 | focusWindow C#5 修复 + 布局/分组 |
| `src/main/services/AITaskTracker.ts` | 重构 | 多信号融合感测 + 状态机 |
| `src/main/services/AIAliasManager.ts` | 修改 | 自动命名 + 持久化 |
| `src/main/services/NotificationService.ts` | 修改 | 通知携带名称 + Windows Toast |
| `src/main/ipc/windowHandlers.ts` | 修改 | 分组/布局 IPC handler |
| `src/preload/extended.ts` | 修改 | 暴露新 API |
| `src/renderer/components/monitor/WindowPanel.tsx` | 修改 | 自命名 UI + 进度时间线 |
| `src/shared/types-extended.ts` | 修改 | 类型定义更新 |
