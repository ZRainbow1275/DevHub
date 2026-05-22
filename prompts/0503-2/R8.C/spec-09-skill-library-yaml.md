# spec-09-skill-library-yaml — SKILL 库 + YAML frontmatter（Anthropic Agent Skills 兼容）

> **batch**: R8.C  |  **flag**: `R8.C.skill.library`
> **depends_on**: R8.A spec-01 (integration-libs)
> **derives_from**: V1-Q-7.D 答 SKILL 系统 / 00-master §7.6 SkillSchema

---

## 1. motivation

```yaml
user_quote_v1_q_7_d: "SKILL 系统：YAML frontmatter + 可执行脚本，兼容 Anthropic Agent Skills"
goals:
  - SkillSchema 与 master §7.6 对齐（zod 校验）
  - 内置 + 用户 SKILL 双源；用户 SKILL 优先级高
  - 文件路径：%APPDATA%/DevHub/skills/<name>/SKILL.md
  - 热加载（chokidar 监听）
  - 离线运行（不调任何在线 API）
constraint:
  - 不执行 SKILL 内代码（仅元数据库）
  - 实际执行由 spec-15 任务调度处理
  - 严格 schema 校验失败 → 拒绝加载
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/skill/SkillLibrary.ts
  - devhub/src/main/services/skill/SkillLoader.ts
  - devhub/src/main/services/skill/SkillRegistry.ts
  - devhub/src/main/services/skill/SkillLoader.test.ts
  - devhub/src/shared/schemas/skill.ts
  - devhub/src/shared/skill-builtins/index.ts  # 10 个 builtin（spec-10）
modified_files:
  - devhub/src/main/index.ts  # 启动时 SkillLibrary.init()
  - devhub/src/main/ipc/skillHandlers.ts  # 新建 IPC handlers
glob_anchors:
  - devhub/src/main/services/storage/StoreManager.ts:1-100
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SkillSchema = z.object({
  schemaVersion: z.literal('1.0'),
  name: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(10).max(500),
  author: z.string().max(80),
  tags: z.array(z.string()).max(10),
  inputs: z.array(z.object({
  name: z.string(),
  type: z.enum(['string','number','boolean','file','json']),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  description: z.string().optional(),
  })).max(20),
  outputs: z.array(z.object({
  name: z.string(),
  type: z.enum(['string','json','file','exit-code']),
  })).max(10),
  scriptPath: z.string(),  // 相对 SKILL 目录
  runtime: z.enum(['node','python','bash','powershell','exe']),
  runtimeVersion: z.string().optional(),
  permissions: z.array(z.enum(['fs-read','fs-write','net','exec'])).max(4),
  builtIn: z.boolean().default(false),
  source: z.enum(['builtin','user']),
  loadedAt: z.number().int(),
  filePath: z.string(),
})
export type Skill = z.infer<typeof SkillSchema>

export const SkillLoadErrorSchema = z.object({
  filePath: z.string(),
  errorCode: z.enum(['E_VALIDATION','E_NOT_FOUND','E_PARSE','E_PERMISSION']),
  message: z.string(),
  details: z.unknown().nullable(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  skill:list:
  req: {}
  resp: { skills: Skill[], errors: SkillLoadError[] }
  skill:get:
  req: { name: string }
  resp: Skill | null
  skill:reload:
  req: { force: boolean }
  resp: { count: number, errors: SkillLoadError[] }
  skill:install-from-path:
  req: { sourcePath: string }
  resp: { skill: Skill | null, error?: SkillLoadError }
  skill:uninstall:
  req: { name: string }
  resp: { success: boolean }
  skill:validate-yaml:
  req: { yaml: string }
  resp: { valid: boolean, errors?: string[] }
  skill:list-stream:  # 文件变化 → 推送
  payload: { added: Skill[], removed: string[], updated: Skill[] }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| YAML 解析失败 | E_PARSE |
| Zod 校验失败 | E_VALIDATION |
| name 已存在（builtin 与 user 同名） | E_VALIDATION（user 覆盖 builtin 时 warn） |
| scriptPath 不存在 | E_NOT_FOUND |
| permissions 含未知值 | E_VALIDATION |
| 用户目录不可读 | E_PERMISSION |
| chokidar 监听失败 | E_INTERNAL（退化到手动 reload） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (启动加载):
  given: %APPDATA%/DevHub/skills/ 含 3 个有效 SKILL
  when: SkillLibrary.init()
  then: skill:list 返回 3 + 10 builtin = 13；errors=[]

GWT-2 (校验失败):
  given: SKILL.md frontmatter 缺 version 字段
  when: SkillLoader 加载
  then: errors 含 E_VALIDATION + 跳过该 SKILL（不污染库）

GWT-3 (热重载):
  given: 用户编辑现有 SKILL.md 改 description
  when: chokidar 触发 change
  then: skill:list-stream 5s 内推送 updated；skill:get 返回新版

GWT-4 (用户覆盖 builtin):
  given: builtin "code-review" + 用户 "code-review"
  when: skill:get name=code-review
  then: 返回 user 版本 + audit log "user override builtin"

GWT-5 (路径校验):
  given: SKILL.md scriptPath="../../etc/passwd"
  when: SkillLoader 校验
  then: E_VALIDATION（路径必须在 SKILL 目录内）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 list skills', async ({ page }) => {
  const { skills } = await page.evaluate(() => window.electronAPI.skill.list())
  expect(skills.length).toBeGreaterThanOrEqual(10)  // 至少 10 个 builtin
  const names = skills.map((s: any) => s.name)
  expect(names).toContain('code-review')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'gray-matter@4.0':  YAML frontmatter 解析
  - 'js-yaml@4.1':  gray-matter 依赖
  - 'chokidar@3.6':  文件监听
  - 'ajv@8.x':  备用 JSON Schema 校验
  - 'zod@3.23':  主校验
inspirations:
  - https://docs.anthropic.com/claude/docs/agent-skills
  - VS Code extension contributes 模型
  - Hugo / Jekyll frontmatter
yaml_example: |
  ---
  schemaVersion: "1.0"
  name: code-review
  displayName: "Code Review Helper"
  version: "1.0.0"
  description: "Run automated code review on a file or PR"
  author: DevHub
  tags: [review, quality]
  inputs:
  - name: file
  type: file
  required: true
  outputs:
  - name: report
  type: json
  scriptPath: ./run.js
  runtime: node
  permissions: [fs-read]
  ---
  # Code Review SKILL
  ...
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~600
modified_loc: ~80
test_loc: ~400
total: ~1080
risk_areas:
  - chokidar 跨平台路径
  - YAML 安全（防 RCE via custom tags）
```

---

## 10. implement_checklist

- [x] gray-matter 解析 + js-yaml safeLoad（禁 custom tags）
- [x] zod 严格 schema（master §7.6 对齐）
- [x] scriptPath 必须在 SKILL 目录内（防路径穿越）
- [x] chokidar 监听 add/change/unlink
- [x] user override builtin 时 audit warn
- [x] skill:list-stream 100ms 节流
- [x] vitest 覆盖 5 GWT + 异常 YAML
- [x] feature flag R8.C.skill.library 默认 ON
- [x] 隐私：不上传 SKILL 名/内容（NO-TELEMETRY）

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-01: gray-matter / chokidar / zod 已安装
downstream:
  - R8.C.spec-10: 10 builtin SKILL 内容
  - R8.C.spec-11: SKILL editor (Monaco)
  - R8.C.spec-15: 任务队列调用 SKILL
```

---

## 12. fallback_strategy

```yaml
on_chokidar_fail:
  - 退化到手动 skill:reload
on_yaml_security_concern:
  - 拒绝 custom tags / !! tags
on_disk_full:
  - skill:install 拒绝；提示用户清理
flag_off_behavior:
  - R8.C.skill.library=OFF 时仅返回 builtin
```

---

## 13. performance_budget

```yaml
init_load_ms: { warn: 800, fatal: 5000 }
single_skill_parse_ms: { warn: 30, fatal: 200 }
chokidar_event_p99_ms: { warn: 50, fatal: 500 }
memory_per_100_skills_mb: { warn: 30, fatal: 100 }
ipc_channel: skill:list → spec-31 low_freq_op 120 RPM
```


---

## 14. implementation_evidence_2026-05-04

### completed_executable_slice

- `SkillFrontmatter`, `Skill`, `SkillLoadError`, input, and output schemas are implemented in `devhub/src/shared/schemas/r8-runtime.ts` and registered in `r8RuntimeSchemaRegistry`.
- The Skill schema is strict: unexpected frontmatter, input, or load-error keys are rejected by Zod instead of being silently accepted.
- `R8RuntimeService.listSkills()` loads built-ins first and then reads real user `SKILL.md` files from Electron `userData/skills` plus compatibility roots; same-name user skills override built-ins.
- Invalid user skills are skipped and returned through `errors` with `E_VALIDATION`, `E_NOT_FOUND`, `E_PARSE`, or `E_PERMISSION`; invalid entries do not pollute `skills`.
- `scriptPath` is validated as a relative path, must remain inside the skill directory, and must point to an existing file.
- `skill:list`, `skill:get`, `skill:validate-yaml`, `skill:validate`, `skill:install-from-path`, `skill:uninstall`, and `skill:reload` now route through executable IPC handlers rather than fake success responses.
- The implementation does not execute skill scripts during load, validation, list, install, fork, or read operations. Script execution remains downstream spec-15 work.

### verified_gwt

- GWT-1 partial: built-ins and valid user skills are listed together from real filesystem state.
- GWT-2 complete: strict schema failures are reported and skipped.
- GWT-4 complete for returned data: user `code-review` overrides builtin `code-review`.
- GWT-5 complete: path traversal, absolute script paths, and missing script files are rejected.

### not_claimed_complete

- GWT-3 chokidar hot reload and `skill:list-stream` push updates are not implemented in this slice.
- Audit-log rows for user override, install, fork, and uninstall are not implemented in this slice.
- The code is integrated into the current `R8RuntimeService` style instead of split into standalone `SkillLibrary.ts`, `SkillLoader.ts`, and `SkillRegistry.ts` files; this avoids a large refactor while keeping executable behavior covered.

### verification

- `pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` passed: 3 files, 43 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed, including no-emoji over 280 files.
- `pnpm test --run --maxWorkers=1` passed: 56 files, 498 tests.
- `pnpm check:license` passed.
- `npx gitnexus analyze --force` indexed 3385 nodes, 9851 edges, 272 clusters, and 270 flows.
- `npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2` returned LOW risk.
- `npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2` returned LOW risk.

---

## 15. implementation_evidence_2026-05-08

### completed_executable_slice

- `gray-matter@4.0.3` is now an installed runtime dependency and `R8RuntimeService.extractSkillFrontmatter()` parses YAML frontmatter through `gray-matter` with the local `js-yaml` engine; unsafe `!!js/function` custom tags are rejected by the real validation path.
- `SkillListStreamPayload` is now a shared Zod source-of-truth schema and exported TypeScript type; the IPC registry maps `skill:list-stream` to `R8.C/spec-09`, `high_freq_scan`, `main-to-renderer-stream`, and `R8.C.skill.library`.
- `R8RuntimeService.startSkillWatcher()` starts a bounded chokidar watcher on Electron `userData/skills`, uses `ignoreInitial`, `depth=2`, `awaitWriteFinish`, `atomic`, no polling, and closes from `dispose()` to reduce resource pressure.
- `add`, `change`, and `unlink` events for real `SKILL.md` files trigger `skill:list-stream` payloads with `added`, `updated`, `removed`, full `skills`, and `errors`; emissions are throttled to 100ms.
- `skill:write`, `skill:install-from-path`, `skill:builtin-fork`, and `skill:uninstall` now write audit rows and queue stream refreshes; user SKILL overrides of built-ins write an audit row with reason `user override builtin`.
- Preload exposes `window.devhub.r8.skill.onListStream()` and `reload(force, watch)`; renderer global types and `prompts/0421/contracts/23-ipc-contracts-master.md` whitelist are synchronized.
- Runtime loading, validation, list, install, fork, write, uninstall, watcher, and stream paths remain local-only and do not execute skill scripts or upload SKILL metadata/content.

### verified_gwt

- GWT-1 complete: built-ins and valid user SKILL files are listed from real filesystem state; same-name user skills override built-ins.
- GWT-2 complete: malformed or schema-invalid SKILL files are returned as errors and skipped.
- GWT-3 complete: chokidar add/change/unlink events for a real user `SKILL.md` push `skill:list-stream` payloads within the test budget.
- GWT-4 complete: user `code-review` overrides builtin `code-review` and records a local audit row.
- GWT-5 complete: path traversal, absolute script paths, missing scripts, and unsafe YAML custom tags are rejected.

### not_claimed_complete

- The implementation remains integrated into the current `R8RuntimeService` style instead of splitting into standalone `SkillLibrary.ts`, `SkillLoader.ts`, and `SkillRegistry.ts`; this is intentional to avoid a large refactor and preserve current architecture.
- Downstream execution of skill scripts remains R8.C spec-15 task-queue work; spec-09 is the local metadata library only.

### verification

- `pnpm -C . test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --testNamePattern "skill|Skill|preload|IPC|schema" --maxWorkers=1` passed: 4 files, 19 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- `pnpm -C . exec gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2` returned LOW risk.
- `pnpm -C . exec gitnexus impact listSkills --repo devhub --direction upstream --depth 2` returned LOW risk.
- `pnpm -C . exec gitnexus impact reloadSkills --repo devhub --direction upstream --depth 2` returned LOW risk.
- `pnpm -C . exec gitnexus status` reported the index up to date for current commit `de634f9`.

---

## 16. implementation_evidence_2026-05-16_metadata_sandbox_mcp

### completed_executable_slice

- `skillFrontmatterSchema` now includes `license`, `sandbox`, and `mcpServers` metadata with defaults for existing local SKILL files.
- `sandbox` is strictly `read-only`, `read-write`, or `system`.
- `mcpServers` is a strict local stdio MCP declaration array and is exposed to executed system SKILL scripts as JSON.
- Monaco SKILL YAML schema and editor fixtures now include the same metadata contract.

### verified_gwt

- Built-in and user SKILL schemas still validate through the shared Zod source of truth.
- Older SKILL files without the new fields remain loadable through defaults.
- MCP metadata is not executed by the library load/list path; execution remains in spec-15.

### verification

- `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1 -t "SKILL|skill|sandbox|MCP|mcp|builtin|metadata"` passed: 3 files, 13 tests.
- `pnpm -C devhub typecheck` passed.
- `pnpm -C devhub check:zod-sot` passed.
