# spec-10-skill-builtin-10 — 内置 10 个 SKILL（开箱即用）

> **batch**: R8.C  |  **flag**: `R8.C.skill.builtin`
> **depends_on**: R8.C spec-09 (SkillLibrary)
> **derives_from**: V1-Q-7.D 答 内置 SKILL 数量 ≈ 10 + master §7.6 SkillSchema

---

## 1. motivation

```yaml
user_quote_v1_q_7_d: "10 个 builtin SKILL 覆盖常见场景：code-review / explain-code / write-test / refactor / fix-bug 等"
goals:
  - 提供 10 个开箱可用的 SKILL，覆盖主流开发流程
  - 每个 SKILL 含 SKILL.md + run.js（或 run.py） + README
  - SKILL 不联网（仅 fs-read），调用 AI CLI 由用户配置完成
  - 用户可自由 fork / override
constraint:
  - 10 个 SKILL 都必须通过 SkillSchema 严格校验
  - 不存任何 API key（NO-API-KEY-UI）
  - script 仅 fs-read 权限（输出走 stdout，由 spec-15 task queue 接管）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/shared/skill-builtins/index.ts
  - devhub/src/shared/skill-builtins/code-review/SKILL.md
  - devhub/src/shared/skill-builtins/code-review/run.js
  - devhub/src/shared/skill-builtins/explain-code/SKILL.md
  - devhub/src/shared/skill-builtins/explain-code/run.js
  - devhub/src/shared/skill-builtins/write-test/SKILL.md
  - devhub/src/shared/skill-builtins/write-test/run.js
  - devhub/src/shared/skill-builtins/refactor/SKILL.md
  - devhub/src/shared/skill-builtins/refactor/run.js
  - devhub/src/shared/skill-builtins/fix-bug/SKILL.md
  - devhub/src/shared/skill-builtins/fix-bug/run.js
  - devhub/src/shared/skill-builtins/doc-generate/SKILL.md
  - devhub/src/shared/skill-builtins/doc-generate/run.js
  - devhub/src/shared/skill-builtins/translate-i18n/SKILL.md
  - devhub/src/shared/skill-builtins/translate-i18n/run.js
  - devhub/src/shared/skill-builtins/lint-fix/SKILL.md
  - devhub/src/shared/skill-builtins/lint-fix/run.js
  - devhub/src/shared/skill-builtins/migrate-version/SKILL.md
  - devhub/src/shared/skill-builtins/migrate-version/run.js
  - devhub/src/shared/skill-builtins/security-audit/SKILL.md
  - devhub/src/shared/skill-builtins/security-audit/run.js
  - devhub/src/shared/skill-builtins/builtins.test.ts
modified_files:
  - devhub/src/main/services/skill/SkillLibrary.ts  # 加载 builtins
glob_anchors:
  - devhub/src/shared/skill-builtins/index.ts
```

---

## 3. data_contracts

```typescript
// 复用 spec-09 SkillSchema；本 spec 仅约束 builtin 列表
import type { Skill } from '@/shared/schemas/skill'

export const BUILTIN_SKILL_NAMES = [
  'code-review',
  'explain-code',
  'write-test',
  'refactor',
  'fix-bug',
  'doc-generate',
  'translate-i18n',
  'lint-fix',
  'migrate-version',
  'security-audit',
] as const
export type BuiltinSkillName = typeof BUILTIN_SKILL_NAMES[number]

export interface BuiltinSkillManifest {
  name: BuiltinSkillName
  skill: Skill
  scriptContent: string  // 嵌入 ASAR
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  skill:builtin-list:
  req: {}
  resp: { names: string[] }
  skill:builtin-fork:  # fork builtin 到用户目录
  req: { name: string, targetName: string }
  resp: { success: boolean, newSkillPath: string }
  skill:builtin-readme:
  req: { name: string }
  resp: { markdown: string }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| builtin 数量 != 10 | E_VALIDATION（编译期 assert） |
| builtin schema 校验失败 | E_VALIDATION（编译期 fail） |
| fork 目标名已存在 | E_VALIDATION |
| script 文件丢失 | E_NOT_FOUND |
| ASAR 解压失败 | E_INTERNAL |

---

## 6. acceptance_gwt

```yaml
GWT-1 (10 SKILL 全部加载):
  given: DevHub 启动
  when: skill:list
  then: builtIn=true 的项 = 10；name 集合 = BUILTIN_SKILL_NAMES

GWT-2 (任一 SKILL 通过 schema):
  given: builtin "code-review"
  when: zod 校验
  then: success=true；scriptPath 实际存在

GWT-3 (fork):
  given: 用户 fork code-review → my-review
  when: skill:builtin-fork
  then: %APPDATA%/DevHub/skills/my-review/ 创建；SkillLibrary 5s 内识别

GWT-4 (override):
  given: 用户在 user 目录建同名 code-review
  when: skill:get name=code-review
  then: 返回 user 版（spec-09 GWT-4 验证）

GWT-5 (README 显示):
  given: code-review SKILL
  when: skill:builtin-readme
  then: 返回完整 markdown（含使用方法 + 输入示例）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 ten builtin skills loaded', async ({ page }) => {
  const { skills } = await page.evaluate(() => window.electronAPI.skill.list())
  const builtins = skills.filter((s: any) => s.builtIn)
  expect(builtins.length).toBe(10)
  const expected = ['code-review','explain-code','write-test','refactor','fix-bug','doc-generate','translate-i18n','lint-fix','migrate-version','security-audit']
  expected.forEach(n => expect(builtins.find((s: any) => s.name === n)).toBeTruthy())
})
```

---

## 8. reference_impl

```yaml
script_template: |
  // run.js — code-review.skill
  // stdout 输出由 spec-15 task queue 接管
  const fs = require('fs');
  const file = process.argv[2];
  const content = fs.readFileSync(file, 'utf-8');
  console.log(JSON.stringify({
  skill: 'code-review',
  file,
  lineCount: content.split('\n').length,
  prompt: `Review the following code:\n\n\`\`\`\n${content}\n\`\`\``,
  }));
inspirations:
  - GitHub Actions reusable workflows
  - Cursor "rules" library
  - Anthropic Claude Code commands
ten_skills_summary:
  code-review: 'Static code review prompt with file context'
  explain-code: 'Explain a snippet in plain English / Chinese'
  write-test: 'Generate vitest/pytest test cases'
  refactor: 'Suggest refactor with diff format'
  fix-bug: 'Diagnose error log + propose patch'
  doc-generate: 'Generate JSDoc / docstring'
  translate-i18n: 'Translate i18n locale json'
  lint-fix: 'Auto-fix ESLint / pylint issues'
  migrate-version: 'Migrate code from v1 to v2 (e.g. React 17→18)'
  security-audit: 'Spot common CVE patterns (SQL injection / XSS / path traversal)'
```

---

## 9. impact_radius_loc

```yaml
new_loc:
  10_skill_md_files: ~800  # 80 LoC each
  10_run_js_files: ~600  # 60 LoC each
  builtins_index: ~100
  test: ~250
  total_new: ~1750
modified_loc:
  SkillLibrary.ts: +30
risk_areas:
  - 10 SKILL 任一 schema 错误整批失败
  - script 内容跨平台兼容（Node 版本）
```

---

## 10. implement_checklist

- [x] 10 个 SKILL.md 完整 frontmatter
- [x] 10 个 run.js 仅依赖 fs/path/process（无 npm 包）
- [x] index.ts 导出 BuiltinSkillManifest 数组
- [x] 编译期 assert：BUILTIN_SKILL_NAMES.length === 10
- [x] vitest 验证每个 SKILL 通过 SkillSchema
- [x] README.md 显示用法和输入示例
- [x] feature flag R8.C.skill.builtin 默认 ON
- [x] script 仅 fs-read 权限（spec-15 enforce）
- [x] 不含 API key / 不联网

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-09: SkillLibrary / SkillSchema
downstream:
  - R8.C.spec-11: SKILL editor 加载 builtins
  - R8.C.spec-15: task queue 执行 SKILL
```

---

## 12. fallback_strategy

```yaml
on_one_skill_invalid:
  - 跳过该 SKILL + audit error；其他 9 个继续工作
on_asar_unpack_fail:
  - 提示用户重装
flag_off_behavior:
  - R8.C.skill.builtin=OFF 时仅加载 user SKILL
```

---

## 13. performance_budget

```yaml
total_load_ms: { warn: 600, fatal: 3000 }
per_skill_load_ms: { warn: 60, fatal: 300 }
total_size_kb: { warn: 200, fatal: 1024 }
```


---

## 14. implementation_evidence_2026-05-04

### completed_executable_slice

- `devhub/src/shared/skill-builtins/index.ts` exports `BUILTIN_SKILL_NAMES`, `BuiltinSkillName`, `BuiltinSkillManifest`, and `BUILTIN_SKILLS`.
- The built-in catalog contains exactly 10 names: `code-review`, `explain-code`, `write-test`, `refactor`, `fix-bug`, `doc-generate`, `translate-i18n`, `lint-fix`, `migrate-version`, and `security-audit`.
- Each built-in manifest is parsed by `skillSchema`, has `builtIn=true`, `source=builtin`, `runtime=node`, and `permissions=['fs-read']`.
- Each built-in exposes markdown frontmatter that is parsed back through `skillFrontmatterSchema`, plus README markdown with usage and output shape.
- Each built-in embeds offline `run.js` content that reads one local file and prints JSON to stdout. Tests assert no `http://`, `https://`, or API-key pattern is present.
- `skill:builtin-list`, `skill:builtin-readme`, and `skill:builtin-fork` now route through executable IPC handlers.
- `forkBuiltinSkill()` writes real user files under Electron `userData/skills/<targetName>/`: `SKILL.md`, `run.js`, and `README.md`.

### verified_gwt

- GWT-1 complete for the main-process slice: all 10 built-ins load and remain schema-valid.
- GWT-2 complete: every built-in skill and markdown frontmatter passes strict Zod validation.
- GWT-3 complete for manual fork: `skill:builtin-fork` creates real user skill files and subsequent list/reload paths can read them.
- GWT-4 complete through spec-09 coverage: user `code-review` overrides builtin `code-review`.
- GWT-5 complete: `skill:builtin-readme` returns markdown containing usage and output details.

### not_claimed_complete

- Physical source-tree `SKILL.md` and `run.js` files for each built-in were not added as ten separate directories; the current implementation keeps them in one typed manifest and materializes files on fork.
- `R8.C.skill.builtin=OFF` behavior was represented in the feature flag registry but was not enforced as a runtime branch in the 2026-05-04 slice.
- ASAR unpack failure handling is not separately implemented because built-ins are not unpacked from ASAR in this manifest-based slice.
- Downstream execution and permission enforcement remain spec-15 work.

### verification

- `pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` passed: 3 files, 43 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed, including no-emoji over 280 files.
- `pnpm test --run --maxWorkers=1` passed: 56 files, 498 tests.
- `pnpm check:license` passed.
- `npx gitnexus analyze --force` indexed 3385 nodes, 9851 edges, 272 clusters, and 270 flows.
- GitNexus impact for `R8RuntimeService` and `setupR8RuntimeHandlers` returned LOW risk.

---

## 15. implementation_evidence_2026-05-08

### completed_executable_slice

- `R8.C.skill.builtin=OFF` is now enforced at runtime: `listSkills()` skips built-ins while still loading user skills, `listBuiltinSkills()` returns an empty catalog, and `builtinReadme()` / `forkBuiltinSkill()` return `E_FEATURE_DISABLED`.
- The existing typed manifest remains the source of truth for all 10 built-ins and still materializes real `SKILL.md`, `run.js`, and `README.md` files when forked to a user skill directory.
- The builtin catalog still contains exactly the required 10 names, all schema-valid, all `runtime=node`, all `permissions=['fs-read']`, and all offline.
- Spec-09 now supplies the completed user override, audit, watcher, and stream behavior that spec-10 depends on.

### verified_gwt

- GWT-1 complete: `listSkills()` loads exactly 10 built-ins by default and the expected name set is validated.
- GWT-2 complete: every builtin skill manifest and embedded markdown frontmatter passes strict Zod validation.
- GWT-3 complete: `skill:builtin-fork` creates real user files and the resulting user skill can be listed.
- GWT-4 complete: same-name user `code-review` overrides builtin `code-review` through spec-09 coverage.
- GWT-5 complete: `skill:builtin-readme` returns README markdown with usage and output details.
- Flag-off behavior complete: disabling `R8.C.skill.builtin` leaves user SKILL files available and blocks builtin-only operations.

### not_claimed_complete

- Physical source-tree directories per builtin are still intentionally not duplicated; the embedded typed manifest is the current source of truth and fork materialization writes the real files users interact with.
- ASAR unpack failure handling remains non-applicable for the current manifest-based implementation.
- Downstream skill script execution and permission enforcement remain spec-15 task-queue work.

### verification

- `pnpm -C . test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --testNamePattern "skill|Skill|builtin|Builtin|default disabled states" --maxWorkers=1` passed: 5 files, 10 tests.
- The targeted test rerun also proved that `R8RuntimeService.test.ts` no longer depends on persisted operator feature overrides from previous local runs.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- `pnpm -C . exec gitnexus status` reported the index up to date for current commit `de634f9`.

---

## 16. implementation_evidence_2026-05-16_builtin_metadata_completion

### completed_executable_slice

- Every built-in SKILL manifest and materialized frontmatter now declares `license: "MIT"`, `sandbox: read-only`, and `mcpServers: []`.
- The exact 10-name built-in catalog remains unchanged and still validates through `skillSchema`.
- Built-ins remain offline, local-only, Node-based, and limited to `permissions=['fs-read']`.

### verified_gwt

- Built-in metadata completeness now covers name, description, version, author, license, input/output schema, runtime, permission list, sandbox level, and empty MCP server declarations.
- The shared schema regression confirms all built-in manifests and markdown frontmatter parse successfully with the expanded metadata contract.

### verification

- `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1 -t "SKILL|skill|sandbox|MCP|mcp|builtin|metadata"` passed: 3 files, 13 tests.
- `pnpm -C devhub typecheck` passed.
- `pnpm -C devhub check:zod-sot` passed.
