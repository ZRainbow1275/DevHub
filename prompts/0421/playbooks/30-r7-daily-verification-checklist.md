# playbooks/30 — R7 每日验证清单

> 目的：每天开发结束前由开发者自查；每周由 ZRainbow 手动验证；每次 stage 切换由 CI gate 卡关
> 使用方式：直接打勾，有问题记录到 `.trellis/workspace/ZRainbow/journal-<n>.md`

---

## 一、每日自查（开发者，5-10 分钟）

### 1.1 Git 变更完整性（防 R5 metadata-only 事故）

- [ ] 本次 commit 的 diff 包含 `devhub/src/` 下的 **实际代码改动**（非 only `.trellis/`）
- [ ] 若只动 `.trellis/` —— commit message 明确写 `chore:` 或 `docs:` 前缀
- [ ] 关键修复对应的 src 文件在 diff 中能看到 **逻辑变化**（不是只改空格/注释）

### 1.2 测试最低门槛

- [ ] `pnpm lint` 无 error
- [ ] `pnpm typecheck` 无 error
- [ ] `pnpm check:no-emoji` 0 命中
- [ ] 相关 spec 的 E2E 至少 smoke 级过
- [ ] `pnpm test:unit` 全绿

### 1.3 手动冒烟（<5 min）

- [ ] 启动 DevHub，主窗口正常显示
- [ ] 切到 监控 → 进程、端口、窗口、AI 任务四个 tab 均可见数据
- [ ] 某进程详情面板可打开并有数据（或降级提示，不是裸错误）
- [ ] 窗口面板出现的 AI 窗口带 logo（非 emoji）
- [ ] 切一次主题（色板 / 密度），界面有可见变化
- [ ] 打开拓扑附属 sub-tab（进程详情 → Relationship），节点不聚左上

---

## 二、每周校验（ZRainbow，30-45 分钟）

### 2.1 回归 R6 问题全清单

| # | 问题（R6 用户原话） | 如何验证 | 通过条件 |
|---|--------------------|---------|---------|
| 1 | 项目卡片下拉遮挡 | 点 Run Script → 看 dropdown | 挂 body，不被遮 |
| 2 | 监控模块长时间占内存 | 开启 30min 不动，看 RSS | < 400 MB |
| 3 | PID 9148 无法获取信息 | 点 svchost/System 详情 | 有部分字段 + 权限提示 |
| 4 | 端口无滚动条 | 50+ 端口 | 有可见 10px 滚动条 |
| 5 | 端口 + FocusPanel 挤占 | 拖 divider | 比例变化 |
| 6 | 查询超时文字 | 触发超时 | 有 TimeoutBanner + 重试 |
| 7 | 窗口长 title 溢出 | 看长 title | 截断 + tooltip |
| 8 | 窗口无虚拟化 | 100+ 窗口 | DOM < 40 个 row |
| 9 | AI alias 真的改标题 | rename + apply | 外部窗口 title 变化 |
| 10 | 通知带窗口名 | 等 AI 任务完成 | "Claude / Fix login bug" 格式 |
| 11 | AI 完成感测准 | 多跑几次 | 无误报、漏报 |
| 12 | 分组功能可用 | 创建组 + 拖窗口 | 真生效 |
| 13 | 布局功能真动窗口 | 选 "Two left-right" | Win32 窗口位置变化 |
| 14 | 监控进度不矛盾 | AI 任务跑时看 | state 与 progress 不冲突 |
| 15 | 窗口可做的功能多 | 右键 | 12 项菜单 |
| 16 | AI 面板无 emoji | 看 AI 任务 | 均为 svg logo |
| 17 | 拓扑正常显示 | 打开 Relationship | 节点分布均匀 |
| 18 | 拓扑是附属 | 检查顶导航 | 无独立 tab |
| 19 | 流程图是附属 | 同上 | 无独立 tab |
| 20 | 小窗口自适应 | 缩到 640x480 | 布局回流 |
| 21 | 主题不仅换颜色 | 切 density | 行高变 |

### 2.2 深度检查（每项 3-5min）

- [ ] 运行 30min 后 PS 子进程数 ≤ 2（DevPanel 观察）
- [ ] RSS 曲线无正斜率（PerfProbe 输出）
- [ ] 重启后 WindowGroup 自动重匹配
- [ ] 重启后 AI alias 仍应用到外部窗口（如未关闭目标窗口）
- [ ] 通知点击跳转到对应 AI 任务/窗口
- [ ] Admin 重启流程可完整走通
- [ ] Ctrl+Shift+D DevObservabilityPanel 可呼出

---

## 三、Stage 切换 Gate（CI 强制）

### Stage 0 → 1 Gate

- [ ] Scenario-B (30min) perf 全绿
- [ ] Scenario-C (2hr) perf 全绿
- [ ] Runtime Stability E2E 12/12 绿
- [ ] IPC Throttle E2E 6/6 绿
- [ ] DevPanel E2E 5/5 绿

### Stage 1 → 2 Gate

- [ ] IA redesign E2E 8/8 绿
- [ ] Topology rendering E2E 4/4 绿
- [ ] 手动验证顶 nav 无 topology/flow 独立项

### Stage 2 → 3 Gate

- [ ] AI alias / detection / groups / layout / progress / ops 53/53 绿
- [ ] 手动验证 Win32 SetWindowText 真生效
- [ ] 手动验证通知含 taskAlias

### Stage 3 → 4 Gate

- [ ] P1 Bug specs E2E 20/20 绿
- [ ] 手动验证 R6 的 20+ 回归问题

### Stage 4 → 5 Gate

- [ ] Visual/UX E2E 32/32 绿
- [ ] NO EMOJI 扫描 0 命中
- [ ] Full Acceptance 136/136 绿

### Stage 5 → GA

- [ ] Stability (4hr) 通过
- [ ] Chaos 通过
- [ ] 打包 + 签名 OK
- [ ] CHANGELOG 更新

---

## 四、紧急响应

若每日冒烟发现以下红线，立即 rollback：

1. 应用无法启动
2. 主窗口白屏或崩溃
3. 扫描 10 分钟内 RSS > 800 MB
4. 用户数据（alias / group / settings）丢失
5. E2E smoke suite 不全绿

---

## 五、记录

每天在 `.trellis/workspace/ZRainbow/journal-<n>.md` 末尾追加：

```markdown
### Daily Check - YYYY-MM-DD

- 冒烟：pass / fail
- Spec 进度：spec/XX completed (/21)
- Issue: <若有>
- 明日计划: <1-3 条>
```

---

## 六、交付最终确认

全部 stage 通过后，此 checklist 的所有 □ 全打勾，归档到
`.trellis/tasks/04-21-devhub-v2-r7-fixpack/completion-checklist.md` 作为验收证据。
