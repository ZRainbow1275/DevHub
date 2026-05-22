# N4 — 进程详情面板："无法获取进程信息 (PID: 9148)"

> 日期: 2026-04-15
> 严重性: P1（影响用户对进程监控的信任）
> 首次暴露: R5
> 证据: Image #2

---

## 一、症状

1. 进程列表里 **PID 9148 `node.exe`** 可见：
   - 状态: 等待中
   - 端口: `:8201`
   - 运行时间: `29m`
   - 命令行: `"node" "C:\Users\HP\AppData\Roaming\npm\...`（截断）
2. 点击该进程 → 右侧详情面板打开
3. 详情面板显示：
   > ⚠ **无法获取进程信息 (PID: 9148)**
   > 进程可能已终止或需要管理员权限

4. 面板 Tab（基础/资源/网络/环境/模块）**全部为空**

**核心矛盾**：既然进程列表能显示 PID + 端口 + 运行时间 + 命令行，说明扫描器已经**拿到过该进程的数据**。但详情面板**二次查询失败**。

---

## 二、根因假设

### 假设 A：列表数据与详情面板走**不同的 IPC 路径**
- 列表: `BackgroundScannerManager` 批量拿到缓存
- 详情: 点击后触发新的 `process:get-details` 单独查询一遍
- 这次单独查询很可能就是触发 N1 (`PowerShell CIM`) 失败的那一次 → 内存不足 → 查询超时 → 返回 null → 面板显示"无法获取"

### 假设 B：详情查询需要 `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)`
- 某些进程（高权限进程 / 保护进程）需要管理员权限才能 `OpenProcess`
- 但 PID 9148 是 `node.exe`（用户空间），不应需要管理员
- 说明**错误消息误导**——"需要管理员权限"是 fallback copy，真正原因可能是 N1 的资源不足

### 假设 C：PID 查询时已经退出但列表仍缓存
- 进程表现为 "等待中" 状态 29 分钟
- 极端情况 PID 被复用（虽然 29m 很短时间内不太可能）

### 假设 D：PowerShell 查询超时 → 详情面板无 fallback
- 主进程查询超时但没返回 "正在重试" 状态
- 直接发送 `{ error: "unavailable" }` 给前端 → 前端显示兜底 UI

---

## 三、与 N1 的关系

这是 **N1 资源爆炸的直接显性症状**。
修 N1 后 N4 大概率自动消失，但仍需独立对待：
- **即使** PowerShell 偶尔失败，详情面板应**退化为"显示列表级数据 + 正在重试"**，而不是"完全无法获取"

---

## 四、修复方向

### 短期
1. 详情面板失败时，fallback 显示列表里已有的字段（PID, 名称, 端口, 命令行截断前缀）
2. 区分错误类型：
   - 超时 → "数据获取中，稍候重试"
   - 进程已退出 → "进程 (PID: X) 已终止"
   - 权限不足 → "需要管理员权限"
   - 其他 → 通用错误（当前所有情况都走这个兜底）

### 中期
1. 列表扫描结果在主进程内部做**共享缓存**
2. 详情面板优先用缓存 + 后台异步 refresh
3. 和 N1 的 `ScannerCache.ts` 整合

---

## 五、关联代码

- `src/main/services/SystemProcessScanner.ts`（详情查询）
- `src/renderer/components/monitor/ProcessDetailPanel.tsx` 或类似
- IPC channel: 疑似 `process:get-details` / `process:get-info`

探索指令：
```
serena.find_symbol(name_path_pattern:"getProcessDetails|getProcessInfo", depth:1)
serena.search_for_pattern(
  substring_pattern:"无法获取进程信息",
  paths_include_glob:"devhub/src/**"
)  # 直接找错误 copy 定位 UI 与 handler
```

---

## 六、验收标准

- 任意可见于列表的 PID，点击详情不应出现"无法获取"（除非进程确已退出）
- 超时场景显示"查询中"并自动重试 3 次后降级
- 错误 copy 区分四种场景
