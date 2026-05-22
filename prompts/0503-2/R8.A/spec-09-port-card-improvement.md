# R8.A spec-09 — 端口卡片优化（非 popout 版，呼吸感间距 + 字段重排）

> **batch**: R8.A | **rank**: #9 | **user-perception-assert**: ASSERT_PORT_PANEL_BREATHING_ROOM
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-5.A.1/A.2/C.1/D.1 + V2-Q-13.J 用户感知 + 5 大反馈 #3.1
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01, spec-06, spec-07
> **note**: popout 版本在 R8.B-spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: 5 大反馈 #3.1
  raw: "端口卡片都太小，能做成摘出来的悬浮卡片就做"
  impact: 本 spec 仅做"非 popout"端口卡片优化（间距 + 字段排版）；popout 在 R8.B
  - source: V1-Q-5.A.1
  raw: "D（左列表 + 右悬浮卡片混合）"
  impact: 默认仍左列表 + 右焦点面板（PortFocusPanel），但卡片密度需修
  - source: V1-Q-5.C.1
  raw: "全选"
  impact: 字段全部展示，但通过分组减少拥挤
  - source: V1-Q-5.D.1
  raw: "A（接受默认四档）"
  impact: 安全分级徽章 4 档（Local/LAN/WAN/Suspicious）必须明显
  - source: master §9 ASSERT_PORT_PANEL_BREATHING_ROOM
  raw: 单卡片高度 >= 96px 且字段间距 >= 8px
```

### 1.2 工程背景

- refs/source-snapshot-v2.md 维度 3：PortView.tsx 行 363 的 viewMode='cards' 当前卡片高度约 64px，字段拥挤；用户多次反馈"挤"。
- 本 spec 重新排版卡片：行高、间距、字段分组、安全徽章；不引入 popout（popout 在 R8.B-spec-01）。

### 1.3 为什么放在 #9

5 大反馈 #3.1 的"非 popout 部分"修复 + 用户感知断言 #5。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/renderer/components/monitor/PortView.tsx
  lines: "363 viewMode 切换 / 630+ PanelSplitter"
  op: MODIFY
  detail: 卡片视图重排；list/cards 默认间距相同；保留 relationship 入口
  - path: devhub/src/renderer/components/monitor/port/PortCard.tsx
  op: REWRITE
  detail: 完整重写排版；4 区分组（基本 / 进程 / 安全 / 流量）
  - path: devhub/src/renderer/components/monitor/port/PortCardCompact.tsx
  op: CREATE
  detail: 列表行内 mini 版（高度 36px）
  - path: devhub/src/renderer/components/monitor/port/PortSecurityBadge.tsx
  op: CREATE
  detail: 4 档徽章 (Local/LAN/WAN/Suspicious)
  - path: devhub/src/renderer/components/monitor/port/PortLabelBadge.tsx
  op: CREATE
  detail: COMMON_DEV_PORTS 自动标签（3000=React Dev / 5173=Vite / etc.）
  - path: devhub/src/renderer/components/monitor/port/PortConnectionsMini.tsx
  op: CREATE
  detail: 当前连接数 / 累计连接数 mini 显示
  - path: devhub/src/shared/data/COMMON_DEV_PORTS.ts
  op: CREATE
  detail: 30+ 常见端口标签字典
  - path: devhub/src/main/services/port/PortSecurityClassifier.ts
  op: CREATE
  detail: 按 local IP + 远端 IP + 黑名单分类
  - path: devhub/src/main/services/port/PortBlacklist.ts
  op: CREATE
  detail: 内置 30 + 用户补充
  - path: devhub/src/renderer/styles/components/port-card.css
  op: CREATE
  detail: 卡片样式；使用 spec-07 token
  - path: devhub/tests/e2e/r8a/spec-09-port-card.spec.ts
  op: CREATE
```

---

## 3. data_contracts

### 3.1 PortViewModel（已存或扩展）

```typescript
import { z } from 'zod';

export const portStateSchema = z.enum(['LISTENING','ESTABLISHED','TIME_WAIT','CLOSE_WAIT','CLOSED','SYN_SENT','SYN_RECV','UNKNOWN']);
export const securityTierSchema = z.enum(['local','lan','wan','suspicious']);

export const portUnifiedViewModelSchema = z.object({
  schema_version: z.literal('1.0'),
  port: z.number().int().min(1).max(65535),
  proto: z.enum(['TCP','UDP']),
  state: portStateSchema,
  local: z.object({
  ip: z.string(),
  interface_class: z.enum(['loopback','lan','wan','any']),
  }),
  remote: z.object({
  ip: z.string(),
  port: z.number().int(),
  }).nullable(),
  pid: z.number().int().positive().nullable(),
  process_name: z.string().nullable(),
  user: z.string().nullable(),
  bound_at: z.string().datetime().nullable(),
  total_connections: z.number().int().nonnegative(),
  current_connections: z.number().int().nonnegative(),
  bytes_rx: z.number().int().nonnegative(),
  bytes_tx: z.number().int().nonnegative(),
  security: z.object({
  tier: securityTierSchema,
  reasons: z.array(z.string()),
  }),
  label: z.object({
  name: z.string().nullable(),  // "React Dev" 等
  source: z.enum(['common-dev-ports','user','none']),
  }),
});
```

### 3.2 卡片排版规格（V2-Q-20.B 量化）

```yaml
card_layout_spec:
  min_height_px: 96  # ASSERT_PORT_PANEL_BREATHING_ROOM
  field_gap_px: 8  # ASSERT_PORT_PANEL_BREATHING_ROOM
  padding_x_px: var(--card-padding-px)  # 来自 spec-07 density token
  padding_y_px: var(--card-padding-px)
  sections:
  - id: header
  content: [port_proto, security_badge, label_badge]
  height_px: 28
  - id: process
  content: [process_name, pid, user]
  height_px: 24
  - id: connection
  content: [state, current/total connections, bytes_rx/tx]
  height_px: 24
  - id: footer
  content: [bound_at, action_menu, relationship_badge]
  height_px: 20
  total_min: 96
  hover_state:
  elevation: var(--elev-2)
  transform: translateY(-1px)
  transition: var(--motion-hover-ms)
```

### 3.3 安全分级算法

```typescript
export function classifyPortSecurity(vm: { local: { ip: string }, remote: { ip: string } | null, port: number }): {
  tier: 'local'|'lan'|'wan'|'suspicious';
  reasons: string[];
} {
  // local: 127.0.0.1 / ::1
  // lan: 192.168.x / 10.x / 172.16-31.x
  // wan: 0.0.0.0 / :: / 公网 IP
  // suspicious: 端口在黑名单
  // ...
  return /* impl */ { tier: 'local', reasons: [] };
}
```

### 3.4 COMMON_DEV_PORTS 字典示例

```typescript
export const COMMON_DEV_PORTS: Record<number, string> = {
  3000: 'React Dev',
  3001: 'React Dev (alt)',
  3306: 'MySQL',
  4173: 'Vite Preview',
  5173: 'Vite',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8000: 'HTTP Dev',
  8080: 'HTTP Alt',
  8888: 'Jupyter',
  9000: 'PHP-FPM / Webpack',
  9229: 'Node Inspector',
  // ... 30+ 项
};
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: port:vm:get
  direction: renderer -> main
  request_schema: z.object({ port: z.number().int(), proto: z.enum(['TCP','UDP']).optional() })
  response_schema: portUnifiedViewModelSchema
  - name: port:vm:list
  direction: renderer -> main
  request_schema: z.object({ filter: z.object({}).optional() })
  response_schema: z.object({ items: z.array(portUnifiedViewModelSchema) })
  - name: port:blacklist:get
  request_schema: z.object({})
  response_schema: z.object({ items: z.array(z.object({ port: z.number(), reason: z.string() })) })
  - name: port:blacklist:add-user
  request_schema: z.object({ port: z.number().int(), reason: z.string().min(4) })
  requires_audit: true
  response_schema: z.object({ ok: z.boolean() })
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| 端口已释放 | PORT_GONE | toast + close detail | refresh list |
| 列表过大（>2000 端口） | LIST_TOO_LARGE | banner + 自动启用 virtual scroll | virtual list |
| 黑名单 IO 失败 | BLACKLIST_IO_ERROR | banner | 走内置 30 项 |
| 卡片高度 < 96px（dev 检测） | LAYOUT_VIOLATION | dev: console + fail-fast | 检查 token |
| 安全分类异常 | SEC_CLASSIFY_ERROR | tier='lan' fallback + 上报 | continue |

---

## 6. acceptance_gwt

```gherkin
Feature: 端口卡片呼吸感优化

Scenario A1: ASSERT_PORT_PANEL_BREATHING_ROOM 必过
  Given 端口面板默认密度（modern-light theme）
  When 渲染 PortCard
  Then card.offsetHeight >= 96
  And 字段之间 gap >= 8px

Scenario A2: 不同主题下卡片高度仍 >= 96px
  Given cyberpunk 主题（density=compact）
  When 渲染 PortCard
  Then card.offsetHeight >= 96 (compact 也不能压缩到 96 以下)
  Given warm-light 主题（density=comfortable）
  When 渲染 PortCard
  Then card.offsetHeight >= 120 (comfortable 更松)

Scenario A3: 安全徽章 4 档可识别
  Given port=3000 local IP=127.0.0.1
  Then security.tier = 'local'
  And UI 徽章为绿色 "仅本地"
  Given port=8080 local IP=0.0.0.0
  Then security.tier = 'wan'
  And UI 徽章为橙色 "外部可访问"
  Given port=4444（黑名单）
  Then security.tier = 'suspicious'
  And UI 徽章为红色 + 闪烁

Scenario A4: 标签自动识别
  Given port=5173 process_name='node.exe'
  Then label.name = 'Vite'
  And label.source = 'common-dev-ports'

Scenario A5: 关系图入口角标可见
  Given PortCard 渲染
  Then 右上角 RelationshipBadge 可见 (与 spec-05 联动)

Scenario A6: list/cards 视图字段一致
  Given 同 port=3000
  When list 视图与 cards 视图各自渲染
  Then 字段集合一致（仅 layout 不同）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-09-port-card.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('ASSERT_PORT_PANEL_BREATHING_ROOM: card height >= 96 and gap >= 8', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=端口');
  await win.click('button:has-text("卡片")');
  const firstCard = win.locator('[data-port-card]').first();
  const box = await firstCard.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(96);
  const gap = await firstCard.evaluate((el) =>
  parseFloat(getComputedStyle(el).rowGap || getComputedStyle(el).gap)
  );
  expect(gap).toBeGreaterThanOrEqual(8);
  await app.close();
});

test('security badge surfaces 4 tiers correctly', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=端口');
  const wan = await win.locator('[data-security-tier="wan"]').first();
  await expect(wan).toBeVisible();
  const local = await win.locator('[data-security-tier="local"]').first();
  await expect(local).toBeVisible();
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Card density grid | Material 3 density |
| Security tier badges | npm: `lucide-react` Shield* family |
| Common dev ports | https://github.com/sindresorhus/dev-ports |
| Port suspicion list | OWASP common malicious ports |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 500
breakdown:
  PortCard rewrite: 160
  PortCardCompact: 60
  PortSecurityBadge: 50
  PortLabelBadge: 40
  PortConnectionsMini: 30
  COMMON_DEV_PORTS dictionary: 50
  PortSecurityClassifier: 60
  PortBlacklist: 40
  port-card.css: 50
files_touched: ~10
risk_radius:
  - PortFocusPanel 内部布局可能受卡片高度影响（需调 panel 默认宽度）
  - 标签字典字符串国际化（i18n 在 R8.B）
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: PortUnifiedViewModel schema + 后端组装
  - step_02: PortSecurityClassifier + 单测覆盖 4 档
  - step_03: PortBlacklist 内置 30 + 用户增量
  - step_04: COMMON_DEV_PORTS 字典 + PortLabelBadge
  - step_05: PortCard 重写排版（4 区分组）
  - step_06: PortCardCompact mini 版
  - step_07: port-card.css 使用 spec-07 token
  - step_08: dev mode breathing-room 检查器
  - step_09: 接入 spec-05 RelationshipBadge
  - step_10: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter port
  - pnpm e2e --grep "spec-09"
  - 手测 ASSERT_PORT_PANEL_BREATHING_ROOM 通过
```

---

## 11. dependencies

```yaml
blocks:
  - R8.B/spec-01-popout-port.md
  - R8.B/spec-05-port-floating-card.md
blocked_by:
  - spec-01-integration-libs.md
  - spec-06-theme-4d-axis-exposure.md (token)
  - spec-07-theme-default-distance.md (具体数值)
  - spec-05-topology-discoverability.md (RelationshipBadge)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "卡片字段过多导致 96px 不够"
  action: "次要字段折叠到 hover tooltip"
  - cause: "安全分类不确定"
  action: "tier='lan' 默认 + reasons 列出 'classification incomplete'"
  - cause: "标签字典更新冲突（用户改了同 port）"
  action: "用户 override 优先"
```

---

## 13. performance_budget

```yaml
budgets:
  card_render_p95: 12ms
  list_50_cards_initial_render: < 200ms
  list_500_cards_virtual_render: < 500ms
  classifier_per_port: < 1ms
  blacklist_lookup: < 0.5ms
  fps_during_scroll_500_cards: >= 55
verification:
  - react-scan
  - Playwright trace
```
