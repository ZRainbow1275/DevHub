# Spec: 端口探查性能优化

> 关联 PRD: `00-prd-round3.md` § 3.4 + R1-2.7
> 优先级: P0 (性能) + P1 (功能完善)
> 层级: Full Stack

---

## 1. 问题描述

- 点击端口卡片后右侧详情面板显示 "Loading port data..." 持续很长时间
- 用户等待体验极差
- 可能原因：每次点击都触发全量 `netstat` 扫描，未利用缓存

---

## 2. 性能优化

### 2.1 缓存优先策略
```
用户点击端口详情
  ├── [立即] 从 ScannerCache 读取该端口的基本信息 → 渲染
  ├── [后台] 仅查询该端口的增量信息（关联进程详情、连接状态）
  └── [完成] 用增量信息更新 UI（merge 到缓存数据上）
```

### 2.2 增量查询
- 不要为单个端口详情执行全量 `netstat -ano`
- 改用过滤查询：`netstat -ano | findstr :{port}` 或等效 PowerShell 命令
- 查询范围：仅该端口的 TCP/UDP 连接信息

### 2.3 加载体验
- **骨架屏（Skeleton）**：查询期间显示灰色占位块，模拟最终布局
- **渐进渲染**：缓存数据先渲染，增量数据到达后补充
- **禁用旋转图标 + 空白**：当前的 "Loading port data..." + 旋转图标体验差

### 2.4 超时与降级
```typescript
const TIMEOUT_MS = 3000

try {
  const detail = await Promise.race([
    fetchPortDetail(port),
    timeout(TIMEOUT_MS)
  ])
  renderDetail(detail)
} catch {
  renderCachedDetail(port) // 降级为缓存数据
  showStaleWarning()       // "部分信息可能不是最新"
}
```

### 2.5 请求取消
- 用户切换到其他端口时，自动取消前一个端口的查询
- 使用 `AbortController` 或等效机制
- 避免请求堆积导致主进程阻塞

### 2.6 并行查询
- 如果用户快速点击多个端口（虽然 UI 一般只展示一个详情），后台查询应并行执行
- 限制最大并行数（如 3）避免资源竞争

---

## 3. 端口拓扑功能完善（P1）

### 3.1 单端口聚焦视图
- 点击端口卡片 → 展开完整关联视图：
  - 占用进程（及其进程树摘要）
  - 连接状态（LISTENING / ESTABLISHED / TIME_WAIT 等）
  - 远程地址列表（如有连接）
  - 网络流量统计（如可获取）

### 3.2 端口-进程交叉关系图
- 同神经流线图风格
- 端口节点 + 进程节点，连线表示占用/连接关系
- 支持缩放和拖拽

### 3.3 端口冲突检测
- 多个进程监听同一端口 → 高亮警告
- 常用端口（80/443/3000/8080 等）自动标注用途

---

## 4. 验收标准

- [ ] 点击端口详情后 < 500ms 显示基本信息（缓存数据）
- [ ] 增量查询完成后 < 3s 显示完整信息
- [ ] 超时后自动降级为缓存数据 + 提示
- [ ] 切换端口时前一个查询被取消
- [ ] 无 "Loading port data..." + 空白长时间显示
- [ ] 骨架屏正确展示

---

## 5. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/services/PortScanner.ts` | 修改 | 增量查询 API、缓存策略 |
| `src/main/ipc/` (port handlers) | 修改 | 端口详情 IPC + 超时 + 取消 |
| `src/renderer/components/monitor/PortPanel.tsx` | 修改 | 骨架屏、渐进渲染 |
| `src/preload/extended.ts` | 修改 | 暴露增量查询 API |
| `src/main/services/ScannerCache.ts` | 修改 | 端口缓存读取优化 |
