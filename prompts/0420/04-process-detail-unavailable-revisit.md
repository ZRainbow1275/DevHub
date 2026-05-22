# P2.2 — 进程详情面板"无法获取进程信息" [P1]

> Round: R6 · 2026-04-20
> 用户原话：**"依旧对于很多进程显示无法获取进程信息 PID:9148"**
> R5 锚点：`prompts/0415/04-process-detail-unavailable.md`（**未修复，重现**）

---

## 一、症状

截图 `屏幕截图 2026-04-15 195107.png`：
- 列表中可见 `node.exe PID: 9148` 卡片（说明扫描器**能**看到该进程）
- 点击后右侧详情面板的 `基础 / 资源 / 网络 / 环境 / 模块` Tab 全部显示：
  > ⚠️ 无法获取进程信息 (PID: 9148)
  > 进程可能已终止或需要管理员权限

**矛盾点**：列表卡片同时显示 `:8281 29m` + 内存条 + 命令行 `node "C:\Users\HP\AppData\Roaming\npm\..."`，说明**列表层已有信息**，但详情层获取失败。

## 二、根因假设

1. **扫描器与详情查询用不同 API**
   - 扫描器用 `tasklist` / `wmic` 批量获取
   - 详情用 `Get-CimInstance Win32_Process -Filter "ProcessId = $pid"` 或 `OpenProcess` WinAPI 单独查
   - 后者对某些进程（系统级/权限限制）会返回 Access Denied

2. **PowerShell 子进程故障** — 如果 P2.1 的 PowerShell 爆炸未修，详情查询每次都 spawn 新 shell 并失败

3. **详情查询未复用列表已有数据** — 本来列表有的信息应直接传入详情面板，剩下的字段再按需补查

## 三、验收契约

- [ ] 列表已有的字段（PID / 名称 / 命令行 / CPU / 内存 / 端口 / 运行时长）**直接**显示在详情面板基础 Tab，不再请求
- [ ] 仅需补查的字段（模块 / 环境变量 / 句柄 / 线程详情）可能失败，失败时**逐字段降级**：
  - 显示"该字段需要管理员权限"或"该字段暂不可用"
  - 不用一个整 Tab 级的"无法获取进程信息"错误淹没其他信息
- [ ] 权限错误与进程已退出**分别处理**（区分 HRESULT / errno）
- [ ] 如果真是进程已死，列表应同步移除该 PID，而不是列表在、详情不在的不一致

## 四、推荐实现

主进程侧：

```ts
// 将详情查询拆成多个独立 Promise，各自失败不影响其他
async function getProcessDetail(pid: number) {
  const [base, modules, network, env] = await Promise.allSettled([
    getBase(pid),      // 可从扫描缓存取
    getModules(pid),   // 可能 Access Denied
    getNetwork(pid),   // 可能需要 netstat
    getEnv(pid),       // 可能需要管理员
  ]);
  return {
    base: base.status === 'fulfilled' ? base.value : { error: base.reason.code },
    modules: modules.status === 'fulfilled' ? modules.value : { error: ... },
    network: network.status === 'fulfilled' ? network.value : { error: ... },
    env: env.status === 'fulfilled' ? env.value : { error: ... },
  };
}
```

渲染侧每个 Tab 独立显示 error/data，不用一个整屏错误页。

## 五、关联

- R5 原文：`prompts/0415/04-process-detail-unavailable.md`
- 依赖 P2.1 Runtime 修复（如果 PowerShell 本身就爆，详情页注定失败）
