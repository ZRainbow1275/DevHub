# Spec: 启动闪屏与加载优化

> 关联 PRD: `00-prd-round3.md` § 3.1 + R2-2.0
> 优先级: P0-Blocker
> 层级: Full Stack (Electron Main + Renderer)

---

## 1. 问题描述

### 1.1 启动黑屏
- 应用启动后窗口一片纯黑，持续数秒
- 用户无法判断应用是在加载还是已崩溃
- 原因：React hydration 之前无任何可视内容；CSS 变量加载时序不确定

### 1.2 扫描器启动异常
- `BackgroundScannerManager` 日志显示所有扫描器被 `stopped`
- `scannerInitStatus` 停留在 `'loading'`，永远不转为 `'ready'`
- `InitializationScreen` 渲染了但背景色 `bg-surface-950`（#1a1814）与黑屏几乎无差异

---

## 2. 方案设计

### 方案 A：原生闪屏窗口（推荐）

```
应用启动
  ├── [立即] 创建 SplashWindow（纯 HTML，独立 BrowserWindow）
  │    └── 显示 Logo + 进度条 + 阶段文字
  ├── [并行] 初始化服务（Scanner、Store、IPC）
  ├── [并行] 创建主窗口（隐藏状态）
  ├── [完成] 主窗口 ready-to-show
  │    ├── SplashWindow fade out（200ms）
  │    └── MainWindow fade in
  └── [清理] destroy SplashWindow
```

**SplashWindow 要求**：
- 独立 HTML 文件，不依赖 React/Vite/Tailwind
- 内联所有 CSS 和 JS（零网络依赖）
- 窗口属性：`frame: false, transparent: true, alwaysOnTop: true, center: true`
- 尺寸：`400x300`
- 通过 IPC 接收进度更新

### 方案 B：HTML 内联加载占位（备选）

在 `src/renderer/index.html` 的 `<body>` 中写入纯 CSS/HTML loading：

```html
<div id="root"></div>
<div id="splash" style="position:fixed;inset:0;z-index:9999;...">
  <!-- Logo + 加载文字 -->
</div>
<script>
  // React 挂载后移除 splash
  const observer = new MutationObserver(() => {
    if (document.getElementById('root').children.length > 0) {
      document.getElementById('splash').remove()
      observer.disconnect()
    }
  })
  observer.observe(document.getElementById('root'), { childList: true })
</script>
```

---

## 3. 加载阶段定义

| 阶段 | 进度 | 显示文字 | 触发条件 |
|------|------|---------|---------|
| 1 | 10% | 正在初始化应用... | app.whenReady() |
| 2 | 25% | 正在加载配置... | AppStore 初始化完成 |
| 3 | 40% | 正在启动扫描引擎... | ScannerManager 初始化 |
| 4 | 60% | 正在扫描系统进程... | 进程扫描完成 |
| 5 | 75% | 正在扫描端口... | 端口扫描完成 |
| 6 | 90% | 正在扫描窗口... | 窗口扫描完成 |
| 7 | 100% | 准备就绪 | 主窗口 ready-to-show |

---

## 4. 扫描器恢复机制

当前问题：扫描器 stopped 后不恢复。

### 4.1 自动重启策略
```typescript
// BackgroundScannerManager 增加重启逻辑
private handleScannerError(type: ScannerType, error: Error) {
  this.retryCount[type]++
  if (this.retryCount[type] <= MAX_RETRIES) {
    const delay = Math.min(1000 * 2 ** this.retryCount[type], 30000)
    setTimeout(() => this.restartScanner(type), delay)
  } else {
    this.emit('scanner-failed', { type, error, retries: this.retryCount[type] })
  }
}
```

### 4.2 降级策略
- 如果某个扫描器持续失败，其余扫描器继续工作
- UI 显示具体哪个扫描器失败（而非全部卡在 loading）
- 提供手动重试按钮

---

## 5. 验收标准

- [ ] 冷启动无黑屏：用户始终能看到闪屏或加载界面
- [ ] 闪屏到主界面过渡平滑（无闪烁）
- [ ] 扫描器异常不导致全局卡死
- [ ] dev 模式和 production 模式均正常
- [ ] 冷启动到可交互时间 < 5 秒（目标）
- [ ] 闪屏页面加载时间 < 100ms（纯 HTML，零依赖）

---

## 6. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/index.ts` | 修改 | 添加 SplashWindow 创建、进度 IPC |
| `splash.html`（新建） | 创建 | 纯 HTML 闪屏页面 |
| `src/main/services/BackgroundScannerManager.ts` | 修改 | 添加错误恢复、进度报告 |
| `src/renderer/index.html` | 可能修改 | 方案 B 时添加内联 loading |
| `src/renderer/stores/scannerStore.ts` | 修改 | 处理 scanner 部分失败的情况 |
| `src/renderer/components/ui/InitializationScreen.tsx` | 修改 | 增强视觉对比度、错误状态 |
