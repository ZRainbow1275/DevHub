# N2 — IPC `process:get-history` 被渲染层死循环调用（971 次 Rate Limit）

> 日期: 2026-04-15
> 严重性: **P0-Blocker**
> 首次暴露: R5
> 关联代码: IPC handler `process:get-history`（日志指向 `devhub/out/main/index.js:1356`，需回溯 src 定义）

---

## 一、用户反映的症状

用户未直接反馈此问题（因为错误在主进程终端，不在 UI 可见），但它是性能与稳定性问题的重要放大器。

---

## 二、证据

### 日志摘录

```
Error occurred in handler for 'process:get-history':
  Error: Rate limit exceeded for process:get-history
    at file:///D:/Desktop/CREATOR%20ONE/devhub/out/main/index.js:1356:13
    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:77979)
```

- 连续重复 **971 次** `process:get-history` rate limit
- 末尾**触发** `process:scan` rate limit（1 次）后，应用整体退出

### 频次

971 次在一次会话内（~30 分钟）= 平均**每 2 秒一次**被拒绝。
考虑被拒绝的都是**超过速率**的那些，**实际渲染层发起的调用频次远高于 971**。

---

## 三、根因假设

### 假设 A：React useEffect 依赖数组缺失 / 含 unstable reference

典型场景：
```tsx
useEffect(() => {
  window.api.process.getHistory(pid)
}, [process])  // ← process 对象每次 rerender 都是新引用 → 死循环
```

或：
```tsx
const fetchHistory = () => window.api.process.getHistory(pid)
useEffect(() => {
  fetchHistory()
}, [fetchHistory])  // ← 函数每次 rerender 都是新引用
```

### 假设 B：Zustand selector 订阅返回非稳定对象

`prompts/0413/01-zustand-selector-refactor.md` 已提及 "8 个 hooks 全量解构无 selector，导致不必要重渲染"——
一个重渲染 → 组件内 useEffect 触发 → IPC 调用。

### 假设 C：主进程推送与渲染层轮询冲突

如果有 `onProcessHistoryUpdate` 推送事件，渲染层本不需要主动 pull。但如果代码同时做了 push + poll，且 poll 周期 < 1s，就会密集触发。

### 假设 D：process:get-history handler 自身 rate limiter 阈值过低

主进程 `out/main/index.js:1356` 抛 `Rate limit exceeded` — 主进程有 rate limiter，说明设计者**知道**会被高频调用，但阈值设置得让正常使用也触发限流 → 要么前端调用方式错了，要么阈值错了。

### 假设 E：错误本身被计入新的触发（重试放大）

如果渲染层收到"Rate limit exceeded"后不是 back off，而是重试，会形成正反馈循环。

---

## 四、修复方向

### 短期（止血）
1. 在主进程 handler 中：命中 rate limit 时返回**缓存结果** + 设 `Retry-After` 样式字段，不要 throw
2. 渲染层：收到 rate-limit 响应后 **exponential backoff**（2s → 4s → 8s 封顶）

### 中期（根因）
1. `serena.search_for_pattern('get-history|getHistory', relative_path:'devhub/src/renderer')` 找所有调用点
2. 审查每个 useEffect 的依赖数组
3. 所有 `window.api.process.getHistory` 调用统一走一个 React Query / SWR / Zustand 缓存层
4. 默认改为主进程**事件推送**而非渲染层拉取

### 长期
- 为所有 IPC channel 做审计表：
  - 调用方向（pull vs push）
  - 调用频次上限
  - 缓存策略
  - 错误处理
- 对照 `prompts/0413/05-scanner-subscribe-lifecycle.md`（WeakSet 重连问题）一并改

---

## 五、下一步探索指令

```
1. serena.search_for_pattern(
     substring_pattern:"process:get-history|getHistory",
     paths_include_glob:"**/*.{ts,tsx}"
   )
2. serena.find_referencing_symbols(
     name_path:"getHistory",
     relative_path:"devhub/src/renderer/hooks"
   )
3. gitnexus_context({name:"processHandlers"})  # 主进程 handler 注册位置
4. Read devhub/src/main/ipc/*.ts  # 找 rate limiter 阈值定义
```

验收标准：
- 渲染层每个 PID 的 `get-history` 调用频次 ≤ 1 次 / 5s
- 30 分钟会话内 rate-limit 触发次数 ≤ 3 次（仅突发场景）
