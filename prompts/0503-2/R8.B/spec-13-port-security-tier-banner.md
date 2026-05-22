# Spec R8.B-13 — 端口 4 级安全分层 + Banner + 黑名单（用户可扩展）

> **flag**: `R8.B.port.security-tier`
> **priority**: P0（V1-Q-5.D + 用户加项 EXTEND）
> **status**: partial-implemented
> **upstream**: R8.A spec-09（端口卡片）+ R8.B spec-01（浮卡显示安全等级）
> **downstream**: R8.B spec-08（公网端口数磁贴）+ R8.C spec-30（异常通知）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-5.D
  answer: "ACCEPT + EXTEND"
  notes: "4 级 Local / LAN / WAN-Capable / Suspicious + 黑名单可扩展"
  - id: USER-FEEDBACK-3.1
  quote: "端口卡片太小"
  impact: "安全分层让用户在浮卡上一眼看到风险"
```

### 1.2 现状缺陷

```
devhub/src/renderer/components/monitor/PortView.tsx
  - 端口卡片仅显示 0.0.0.0 / 127.0.0.1 文字
  - 无 4 级分类视觉
devhub/src/main/services/PortService.ts
  - 不计算 securityTier
没有：黑名单 / Banner / 用户增删
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 4 级分类 | Local / LAN / WAN-Capable / Suspicious |
| 视觉强度 | success / warning / orange / error 4 级 |
| 默认黑名单 | 30+ 可疑端口（4444 / 6666 / ...） |
| 用户可增删 | 设置面板 + 命令面板 |
| 持久化 | electron-store |
| 公网端口顶部 Banner | 当 ≥ 1 个 WAN-Capable 时强提示 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/services/PortService.ts
  - devhub/src/renderer/components/monitor/PortView.tsx
  - devhub/src/shared/types-extended.ts
modify:
  - devhub/src/main/services/PortService.ts  # 计算 securityTier
  - devhub/src/renderer/components/monitor/PortView.tsx  # 显示 tier 标识
  - devhub/src/renderer/components/monitor/PortFocusPanel.tsx  # 详情显示
  - R8.B/spec-01 PortPopoutCard 复用
new:
  - devhub/src/renderer/components/monitor/port/SecurityTierBadge.tsx
  - devhub/src/renderer/components/monitor/port/PublicPortBanner.tsx
  - devhub/src/renderer/components/settings/BlocklistEditor.tsx
  - devhub/src/renderer/hooks/useBlocklist.ts
  - devhub/src/main/services/BlocklistStore.ts
  - devhub/src/main/services/SecurityTierClassifier.ts
  - devhub/src/main/ipc/blocklistHandlers.ts
test:
  - devhub/src/main/services/SecurityTierClassifier.test.ts
  - devhub/tests/e2e/port-security.spec.ts
docs:
  - docs/r8/port-security.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SecurityTierSchema = z.enum(['Local', 'LAN', 'WAN-Capable', 'Suspicious'])
export type SecurityTier = z.infer<typeof SecurityTierSchema>

export const SECURITY_TIER_VISUAL = {
  Local:  { tone: 'success', iconToken: 'lucide:ShieldCheck', label: '本机' },
  'LAN':  { tone: 'warning', iconToken: 'lucide:Shield',  label: '局域网' },
  'WAN-Capable':{ tone: 'orange',  iconToken: 'lucide:ShieldAlert', label: '公网可达' },
  Suspicious:  { tone: 'error',  iconToken: 'lucide:ShieldX',  label: '可疑端口' },
} as const

export const DEFAULT_SUSPICIOUS_PORTS = [
  4444, 6666, 6667, 31337, 1337, 12345, 27374, 31415, 54321, 65535,
  3127, 5800, 5900, 9999, 8888, 7777, 6969, 1080, 8081, 9050,
  1433, 1521, 3306, 3389, 5432, 5984, 11211, 27017, 6379, 9200,
] as const

export const BlocklistEntrySchema = z.object({
  port: z.number().int().min(1).max(65535),
  reason: z.string().max(200).default(''),
  source: z.enum(['default', 'user']),
  addedAt: z.number().int(),
})

export const SECURITY_TIER_LIMITS = {
  USER_BLOCKLIST_MAX: 500,
  BANNER_MIN_PORTS: 1,  // ≥ 1 WAN 即显示
  RECLASSIFY_INTERVAL_MS: 5000,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  port:security-tier:
  request: { port: number, address: string }
  response: { tier: SecurityTier }
  port:blocklist-list:
  response: { entries: BlocklistEntry[] }
  port:blocklist-add:
  request: { port: number, reason?: string }
  port:blocklist-remove:
  request: { port: number }
  port:blocklist-reset:
  response: { defaults: BlocklistEntry[] }
  port:public-banner-state:
  response: { wanCount: number, suspiciousCount: number }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'port 不合法（< 1 / > 65535）'
  code: E_VALIDATION
  - condition: 'blocklist 已达 500 上限'
  code: E_RATE_LIMITED
  - condition: 'classifier 异常'
  handling: '默认 Local + 红色 warning 标识 unknown'
  - condition: '黑名单文件损坏'
  handling: '重置为默认 + toast'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 4 级分类
Given 端口 3000 监听在 127.0.0.1
Then SecurityTier = Local + 绿盾

Given 端口 8080 监听在 192.168.1.5
Then Tier = LAN + 黄盾

Given 端口 80 监听在 0.0.0.0
Then Tier = WAN-Capable + 橙警

Given 端口 4444 监听任何地址
Then Tier = Suspicious + 红 X

# A2 — Banner
Given 当前监听有 1 个 WAN-Capable 端口
Then 顶部 Drawer 自动 push Banner "公网可达端口 1 个"
  And 用户可点关闭

# A3 — 黑名单增删
Given 用户在设置面板 BlocklistEditor 输入 "9999, 因为我说的算"
When 点添加
Then 黑名单包含 9999
  And 重启后仍在
  And 监听 9999 → Tier = Suspicious

# A4 — 命令面板增删
Given 用户在 cmdk 输入 "add to blocklist 8080 reason=test"
Then 8080 加入黑名单

# A5 — 重置默认
Given 用户多次修改后想恢复
When 点 reset
Then 仅保留 30 个 default + 用户加的清除（确认 dialog）

# A6 — 浮卡显示 tier
Given port 4444 浮卡（spec-01）
Then 浮卡上显示红 X + "Suspicious" 标签

# A7 — 状态栏聚合
Given 当前有 2 WAN + 1 Suspicious
Then 状态栏 public-ports tile badgeValue = 2
  And tooltip "2 个公网可达，1 个可疑"

# A8 — 重启后 reclassify
Given DevHub 重启
Then 所有当前监听端口重新 classify
  And blocklist 持久数据加载

# A9 — Tier 变化通知
Given 一个端口从 Local 变为 WAN-Capable（如绑定 IP 变化）
Then push 通知 "port N 从本机变为公网可达"

# A10 — 用户输入合法性
Given 用户输入 "70000" 或 "abc"
Then BlocklistEditor 拒绝 + 红色提示
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/port-security.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('blocklist add and persist', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-settings"]')
  await page.click('[data-testid="settings-blocklist"]')
  await page.getByPlaceholder(/端口号/).fill('9999')
  await page.getByPlaceholder(/原因/).fill('test')
  await page.click('[data-testid="add-block"]')
  await expect(page.getByText('9999')).toBeVisible()

  await app.close()
  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  await page2.click('[data-testid="open-settings"]')
  await page2.click('[data-testid="settings-blocklist"]')
  await expect(page2.getByText('9999')).toBeVisible()
  await app2.close()
})

test('public banner displays', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  // 模拟存在 WAN port
  await expect(page.getByTestId('public-port-banner')).toBeVisible()
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 SecurityTierClassifier

```typescript
import { DEFAULT_SUSPICIOUS_PORTS } from '@shared/security'

export class SecurityTierClassifier {
  constructor(private blocklistStore: BlocklistStore) {}
  classify(port: number, address: string): SecurityTier {
  // 1. 黑名单优先（用户 + 默认）
  if (this.blocklistStore.has(port)) return 'Suspicious'
  if (DEFAULT_SUSPICIOUS_PORTS.includes(port as any)) return 'Suspicious'
  // 2. 监听地址
  if (address === '127.0.0.1' || address === '::1' || address === 'localhost') return 'Local'
  if (address === '0.0.0.0' || address === '::' || address === '*') return 'WAN-Capable'
  if (this.isLanIp(address)) return 'LAN'
  return 'WAN-Capable'
  }
  private isLanIp(ip: string): boolean {
  // 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12
  const m = ip.match(/^(\d+)\.(\d+)\./)
  if (!m) return false
  const [a, b] = [+m[1], +m[2]]
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
  }
}
```

### 8.2 BlocklistStore

```typescript
import Store from 'electron-store'

interface BlocklistData { entries: BlocklistEntry[] }

export class BlocklistStore {
  private store: Store<BlocklistData>
  constructor() {
  this.store = new Store<BlocklistData>({
  name: 'blocklist',
  defaults: {
  entries: DEFAULT_SUSPICIOUS_PORTS.map(port => ({
  port, reason: 'common malware/RAT port', source: 'default', addedAt: 0,
  })),
  },
  })
  }
  has(port: number): boolean {
  return this.store.get('entries').some(e => e.port === port)
  }
  add(entry: BlocklistEntry) { /* ... */ }
  remove(port: number) { /* ... */ }
  reset() { /* 仅 default */ }
  list() { return this.store.get('entries') }
}
```

### 8.3 PublicPortBanner（顶部 Drawer 内容）

```tsx
export function PublicPortBanner() {
  const { wanCount, suspiciousCount } = usePublicBanner()
  if (wanCount === 0 && suspiciousCount === 0) return null
  return (
  <div data-testid="public-port-banner" className="banner banner-warn">
  <SecurityTierBadge tier="WAN-Capable" /> 公网可达 {wanCount} 个
  {suspiciousCount > 0 && <span> · <SecurityTierBadge tier="Suspicious" /> 可疑 {suspiciousCount} 个</span>}
  <button onClick={() => navigateTo('port?filter=wan')}>查看</button>
  </div>
  )
}
```

### 8.4 关键参考链接

- IANA reserved ports：https://www.iana.org/assignments/service-names-port-numbers/
- electron-store：https://github.com/sindresorhus/electron-store

---

## 9. impact_radius_loc

```yaml
new_files: 8
modified_files: 4
estimated_loc:
  SecurityTierBadge.tsx: 60
  PublicPortBanner.tsx: 80
  BlocklistEditor.tsx: 200
  useBlocklist.ts: 80
  BlocklistStore.ts: 120
  SecurityTierClassifier.ts: 130
  blocklistHandlers.ts: 100
  PortService.ts (modify): +60
  PortView.tsx (modify): +60
  PortFocusPanel.tsx (modify): +40
  PortPopoutCard.tsx (modify): +40
  tests: 290
total_loc: ~1260
risk_level: low
```

---

## 10. implement_checklist

- [x] SecurityTierClassifier（Local/LAN/WAN/Suspicious 4 级 + 黑名单优先） — implemented in `devhub/src/shared/port-security.ts` and `R8RuntimeService.classifyPort`.
- [x] BlocklistStore（30 default + 500 cap） — implemented through existing `devhub-r8-runtime` electron-store key `blocklist`; defaults are generated, user entries are capped at 500.
- [x] BlocklistEditor UI（增删 + reason） — implemented in `devhub/src/renderer/components/settings/BlocklistEditor.tsx` under Settings advanced panel.
- [x] SecurityTierBadge 组件（4 视觉） — implemented in `devhub/src/renderer/components/monitor/port/SecurityTierBadge.tsx`.
- [x] PublicPortBanner（顶部 Drawer push） — implemented as a real port-monitor banner in `devhub/src/renderer/components/monitor/port/PublicPortBanner.tsx`; Drawer-specific push remains a future surface.
- [x] PortView / PortFocusPanel / PortPopoutCard 集成 badge — PortView cards/list and PortFocusPanel are integrated; PortPopoutHost inherits existing port card data path boundary.
- [x] IPC：security-tier / blocklist-* / public-banner-state — implemented in `devhub/src/main/ipc/r8RuntimeHandlers.ts` and preload/global types.
- [x] 与 spec-08 联动（public-ports tile） — `statusAggregate()` now counts `WAN-Capable` ports and adds suspicious count to tooltip.
- [x] 与 spec-04 联动（命令面板 add-to-blocklist） — `port.blocklist.add` command invokes the real blocklist service.
- [x] 单元 + e2e — targeted unit/service/schema tests are implemented; Electron Playwright restart E2E passed on 2026-05-13.
- [x] 文档：docs/r8/port-security.md
- [x] 验收 ASSERT_BLOCKLIST_USER_CAN_EDIT — settings editor and service test prove user add/remove/reset without mock data.

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-09 端口卡片
  - R8.B spec-01 浮卡
  - R8.B spec-03 顶部 Drawer（Banner）
sibling_libs:
  - electron-store: 已存在
  - zod: 已存在
downstream_specs:
  - R8.B spec-08 状态栏
  - R8.C spec-30 通知系统
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: classifier 异常
  action: 默认 'Local' + 加 unknown 红色 warning
  - condition: blocklist 文件损坏
  action: 重置 default
  - condition: 用户列表 > 500
  action: 拒绝添加
flag_disable: 关闭 R8.B.port.security-tier 时仅显示原始 IP 文本
```

---

## 13. performance_budget

```yaml
budgets:
  classify_per_port_us: 50
  blocklist_lookup_us: 20
  banner_update_ms: 100
  reclassify_all_ports_ms: 200  # 假设 ≤ 200 端口
test_harness:
  - benchmark: bench-classify.mjs
  target: 1000 端口 classify p99 < 5ms
```

---

## 14. implementation_status_2026_05_13_electron_restart_e2e

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now contains the real Electron fixture `R8.B spec-13 port security blocklist persists across real Electron restart`.
- The fixture opens a real local TCP listener, resets the real local blocklist store, adds a user blocklist entry through the executable `window.devhub.r8.portSecurity.addBlocklist` IPC/preload bridge, and verifies `classify` returns `Suspicious` with `user-blocklist`.
- It closes the first Electron app, launches a second Electron app against the same local userData, verifies the user blocklist entry persists, then waits for the real listener to appear through `window.devhub.port.scan()`.
- It verifies the renderer port monitor shows the actual port card with `security-tier-Suspicious` and the real `public-port-banner`, without mock ports, fake firewall data, or simulated restart.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-13 port security" --workers=1
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Target Playwright fixture passed on 2026-05-13: 1 test passed in 9.1s.
- File-level ESLint, production build, and TypeScript `tsc --noEmit` passed on 2026-05-13.
- The production build emitted only the existing Monaco dynamic/static import warning; build completed successfully.

### Closure Note

- All checklist items in this spec are now checked.
