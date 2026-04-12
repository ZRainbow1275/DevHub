# Spec: 进程深层勘探

> 关联 PRD: `00-prd-round3.md` § R2-2.1 + R1-2.5/2.6 + R4-3.7
> 优先级: P0 (勘探 + 渲染报错) + P1 (可视化)
> 层级: Full Stack

---

## 1. 问题描述

- 点击进程后无法查看目录、关系、详情，深层信息完全不可达
- 进程关系图仅为静态拓扑，缺乏动态性
- 进程列表排列显示差于 Windows 任务管理器
- 进程卡片信息密度不足
- **[R4 新增] 进程扫描成功但前端报错无法显示**：后端扫描器已获取进程数据，但前端渲染时报错崩溃，部分或全部进程卡片无法渲染

---

## 2. 进程详情面板

### 2.1 交互设计
- 点击进程卡片 → 右侧弹出**详情抽屉**（Drawer）
- 抽屉宽度：400-600px，可拖拽调整
- 抽屉内使用 Tab 分区：基础 | 资源 | 网络 | 环境 | 模块

### 2.2 基础信息 Tab
| 字段 | 来源 | 备注 |
|------|------|------|
| PID | 已有 | — |
| PPID | `wmic process get ParentProcessId` | 父进程 ID |
| 进程名 | 已有 | — |
| 可执行文件路径 | `wmic process get ExecutablePath` | 完整路径 |
| 命令行参数 | `wmic process get CommandLine` | 完整启动命令 |
| 工作目录 | PowerShell `(Get-Process -Id $pid).Path` | 如可获取 |
| 启动时间 | `wmic process get CreationDate` | 格式化为可读时间 |
| 操作按钮 | — | 结束进程 / 结束进程树 / 打开文件位置 / 设置优先级 |

### 2.3 资源监控 Tab
- **CPU%**：实时折线图（最近 60 秒，2 秒采样）
- **内存**：RSS + VMS，柱状图或数字
- **线程数**：数字 + 变化趋势
- **句柄数**：数字
- **I/O 读写**：ReadBytes / WriteBytes（累计 + 速率）

### 2.4 网络连接 Tab
- 该进程的所有 TCP/UDP 连接列表
- 列：协议 | 本地地址:端口 | 远程地址:端口 | 状态
- 支持排序和过滤

### 2.5 环境变量 Tab
- Key=Value 列表，支持搜索和复制
- **安全注意**：环境变量可能含敏感信息（API Key、Token），展示时默认遮蔽值，点击"显示"后展示

### 2.6 模块/DLL Tab（可选）
- 已加载模块/DLL 列表
- 来源：`wmic process` 或 `Get-Process | Select-Object -ExpandProperty Modules`

---

## 3. 进程关系探查

### 3.1 父子链
- 从 root（System PID=0/4）到当前进程到所有子进程的完整链
- 数据来源：遍历 `ParentProcessId` 构建树
- 展示：可折叠树视图

### 3.2 端口关联
- 查询该进程占用/连接的所有端口
- 交叉链接到端口面板

### 3.3 神经流线图（P1 增强）
- 进程间关系用 D3-force 动态图呈现
- 节点大小 ∝ CPU 占用
- 节点颜色 ∝ 内存占用
- 连线粗细 ∝ 通信频率/依赖强度
- 连线动画：数据流向可视化
- 支持缩放、拖拽、点击聚焦

---

## 4. 进程列表增强

### 4.1 排序
- 支持按 PID、名称、CPU%、内存、启动时间排序
- 升序/降序切换
- 默认按 CPU% 降序

### 4.2 进程卡片增强
**信息密度**：
- 第一行：进程名 + PID
- 第二行：CPU% | 内存 | 线程数
- 第三行：命令行摘要（可展开）
- 操作按钮：结束 | 详情 | 定位文件

---

## 5. [R4 新增] 进程渲染报错修复

### 5.1 问题
后端扫描器成功获取进程数据，但前端渲染时报错，部分或全部进程卡片无法显示。

### 5.2 Error Boundary 方案
```tsx
// ProcessCardErrorBoundary — 包裹每个进程卡片
class ProcessCardErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ProcessCard] Render error:', error, info)
    // 收集失败的进程数据用于调试
  }

  render() {
    if (this.state.hasError) {
      return <DegradedProcessCard pid={this.props.pid} error={this.state.error} />
    }
    return this.props.children
  }
}
```

### 5.3 降级卡片 UI
- 显示：进程名（如可获取）+ PID + "信息不完整" 灰色标记
- 提供"重试"按钮：重新请求该进程数据
- 提供"报告"按钮：将错误信息复制到剪贴板

### 5.4 数据清洗层
```typescript
// 后端返回进程数据前进行标准化
function sanitizeProcessData(raw: unknown): ProcessInfo {
  return {
    pid: raw?.pid ?? 0,
    name: raw?.name ?? 'Unknown',
    cpu: typeof raw?.cpu === 'number' ? raw.cpu : 0,
    memory: typeof raw?.memory === 'number' ? raw.memory : 0,
    status: raw?.status ?? 'unknown',
    ppid: raw?.ppid ?? 0,
    // ... 所有字段都有安全默认值
  }
}
```

### 5.5 覆盖范围
- [ ] 进程卡片 — Error Boundary
- [ ] 端口卡片 — Error Boundary
- [ ] 窗口卡片 — Error Boundary
- [ ] 所有卡片数据字段 — 可选链 + 空值合并

---

## 6. 验收标准

- [ ] 点击任意进程可打开详情面板
- [ ] 详情面板 5 个 Tab 均可正常展示数据
- [ ] 进程树正确展示父子关系
- [ ] 环境变量默认遮蔽敏感值
- [ ] 列表排序功能正常
- [ ] 操作按钮（结束进程等）有二次确认
- [ ] 系统关键进程（PID < 100 等）禁止结束操作
- [ ] **[R4] 单个进程卡片渲染失败不影响其余卡片**
- [ ] **[R4] 渲染失败的卡片显示降级 UI 而非崩溃**
- [ ] **[R4] 后端返回的进程数据经过清洗标准化**

---

## 7. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/services/SystemProcessScanner.ts` | 修改 | 增加深层信息查询 API |
| `src/main/ipc/` | 修改 | 增加进程详情 IPC handler |
| `src/renderer/components/monitor/` | 修改/新建 | 进程详情抽屉、资源图表 |
| `src/preload/extended.ts` | 修改 | 暴露新的进程详情 API |
| `src/shared/types-extended.ts` | 修改 | 增加进程详情类型定义 |
