# spec-11-skill-editor — SKILL 编辑器（Monaco + YAML 校验）

> **batch**: R8.C  |  **flag**: `R8.C.skill.editor`
> **depends_on**: R8.C spec-09 (SkillLibrary), R8.C spec-10 (builtins)
> **derives_from**: V1-Q-7.D 答 SKILL 编辑器 = Monaco（VSCode 同源）+ feedback#4 SKILLS 槽位

---

## 1. motivation

```yaml
user_quote_v1_q_7_d: "SKILL 编辑器：Monaco 实时校验 YAML frontmatter + script lint"
goals:
  - Monaco 内嵌（@monaco-editor/react）
  - YAML schema 联动（autocomplete + validation）
  - 实时显示 SkillSchema 校验错误
  - 支持快速创建（template / fork builtin）
  - 保存即热加载（spec-09 chokidar）
constraint:
  - 编辑器仅渲染层；写入磁盘走 main 进程 IPC
  - script 编辑限于 node/python/bash 几种语言（master §7.6）
  - 不上传内容（NO-TELEMETRY）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/renderer/views/skills/SkillEditorView.tsx
  - devhub/src/renderer/views/skills/SkillListPanel.tsx
  - devhub/src/renderer/views/skills/SkillTemplatePicker.tsx
  - devhub/src/renderer/views/skills/skill-monaco-config.ts
  - devhub/src/main/services/skill/SkillWriter.ts
  - devhub/src/main/services/skill/SkillWriter.test.ts
modified_files:
  - devhub/src/renderer/App.tsx  # 路由 /skills
  - devhub/src/main/ipc/skillHandlers.ts  # 新增 write IPC
  - devhub/package.json  # +monaco-editor / +@monaco-editor/react
glob_anchors:
  - devhub/src/renderer/views/SettingsView.tsx:1-100
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SkillEditorBufferSchema = z.object({
  filePath: z.string(),
  yamlFrontmatter: z.string(),
  bodyMarkdown: z.string(),
  scriptContent: z.string(),
  scriptLanguage: z.enum(['node','python','bash','powershell']),
  isDirty: z.boolean(),
  lastSavedAt: z.number().int().nullable(),
})

export const SkillValidationResultSchema = z.object({
  valid: z.boolean(),
  yamlErrors: z.array(z.object({
  line: z.number().int(),
  column: z.number().int(),
  message: z.string(),
  severity: z.enum(['error','warning']),
  })),
  schemaErrors: z.array(z.object({
  path: z.string(),
  message: z.string(),
  })),
})

export const SkillTemplateSchema = z.object({
  templateId: z.enum(['blank','fork-builtin','prompt-only','script-only','full']),
  defaultName: z.string(),
  yaml: z.string(),
  body: z.string(),
  script: z.string(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  skill:write:
  req: { filePath: string, yaml: string, body: string, script: string, scriptLanguage: string }
  resp: { success: boolean, error?: string }
  skill:create-from-template:
  req: { templateId: string, name: string, displayName: string }
  resp: { filePath: string, skill: Skill }
  skill:delete:
  req: { filePath: string }
  resp: { success: boolean }
  skill:validate:
  req: { yaml: string, body: string, script: string }
  resp: SkillValidationResult
  skill:template-list:
  resp: SkillTemplate[]
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| filePath 越界（非用户目录） | E_PERMISSION |
| yaml 解析失败 | E_PARSE（编辑器红线提示） |
| schema 校验失败 | E_VALIDATION（边栏错误） |
| 未保存关闭 | (二次确认弹窗) |
| 磁盘满 | E_INTERNAL |
| 模板 ID 未知 | E_VALIDATION |

---

## 6. acceptance_gwt

```yaml
GWT-1 (打开编辑器):
  given: SKILL 列表面板
  when: 点击某 SKILL 进入编辑
  then: Monaco 加载 yaml + body + script 三 Tab；lastSavedAt 显示

GWT-2 (实时校验):
  given: 用户改 yaml 删除 version 字段
  when: 输入触发 onChange
  then: 边栏 schemaErrors 显示 "version is required"
  and: 保存按钮禁用

GWT-3 (模板创建):
  given: 用户点 "新建 SKILL"
  when: 选择 fork-builtin → code-review
  then: 新文件创建于用户目录；编辑器加载内容；用户可改名

GWT-4 (保存触发热加载):
  given: 编辑器 dirty + 通过校验
  when: 点保存
  then: skill:write 成功；spec-09 SkillLibrary 5s 内 reload；UI toast "已保存"

GWT-5 (脚本语言切换):
  given: scriptLanguage=node
  when: 切到 python
  then: Monaco 重新设置 language="python"；建议 runtime 同步更新
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 realtime validation', async ({ page }) => {
  await page.goto('app://renderer/skills')
  await page.click('[data-skill="code-review"]')
  await page.locator('[data-tab="yaml"]').click()
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('schemaVersion: "1.0"\nname: code-review\n')  // 缺 version
  await page.waitForTimeout(500)
  await expect(page.locator('[data-validation-error]')).toContainText('version is required')
  await expect(page.locator('[data-action="save"]')).toBeDisabled()
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'monaco-editor@0.50':
  license: MIT
  - '@monaco-editor/react@4.6':
  license: MIT
  - 'monaco-yaml@5.x':  YAML schema 集成
  - 'js-yaml@4.1':  解析
  - 'zod-validation-error@3.x':  友好错误消息
inspirations:
  - VSCode JSON schema 集成
  - Anthropic Workbench prompt editor
  - GitHub Actions yaml 校验
  - JetBrains IDE skills editor
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~750
modified_loc: ~120
test_loc: ~350
total: ~1220
risk_areas:
  - Monaco 加载时间（动态 import）
  - YAML schema URL 离线问题（必须本地化）
  - 大文件性能（脚本 > 1000 行）
```

---

## 10. implement_checklist

- [x] Monaco 通过 dynamic import + Vite 配置
- [x] YAML schema 内嵌（不依赖 schemastore.org）
- [x] 三 Tab：YAML / Body / Script
- [x] 实时校验 onChange 200ms debounce
- [x] 保存按钮仅 valid 时启用
- [x] 模板：blank / fork-builtin / prompt-only / script-only / full（5 个）
- [x] 删除前二次确认（不可恢复）
- [x] 主题 4 维同步（feedback#1）
- [x] vitest + Playwright 5 GWT（2026-05-11 Playwright real Monaco worker/rendering GWT 已通过）
- [x] feature flag R8.C.skill.editor 默认 ON
- [x] 隐私：编辑器内容不上传

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-09: SkillLibrary 提供加载/写入路径
  - R8.C.spec-10: builtin 用作 fork 来源
  - R8.A.spec-06: theme 4D axis（同步样式）
downstream:
  - R8.C.spec-15: task queue 调用 SKILL（编辑器无直接关联）
```

---

## 12. fallback_strategy

```yaml
on_monaco_load_fail:
  - 退化为 textarea + 客户端 zod 校验
on_yaml_schema_offline:
  - 已内嵌 schema，无影响
on_disk_quota:
  - 拒绝写入 + 提示用户清理
flag_off_behavior:
  - R8.C.skill.editor=OFF 时仅 SkillListPanel 显示（无编辑能力）
```

---

## 13. performance_budget

```yaml
editor_load_ms: { warn: 1500, fatal: 5000 }
keypress_to_validation_ms: { warn: 200, fatal: 1000 }
save_ms: { warn: 100, fatal: 800 }
memory_mb: { warn: 80, fatal: 256 }
ipc_channel: skill:validate → spec-31 medium_query 60 RPM (debounce 200ms)
```

---

## 14. implementation_evidence_2026-05-04

### completed_executable_slice

- Added local Monaco integration in `devhub/src/renderer/views/skills/skill-monaco-config.ts` with explicit editor, JSON, TypeScript, and YAML workers; `enableSchemaRequest=false` keeps YAML schema validation offline.
- Added `SkillEditorPanel` in `devhub/src/renderer/views/skills/SkillEditorPanel.tsx` and embedded it into `R8OpsPanel` without deleting existing monitor/ops functionality.
- Implemented three editor buffers for YAML, Body, and Script, backed by the real preload `window.devhub.r8.skill` API rather than direct renderer filesystem writes.
- Extended shared strict schemas with `SkillEditorBuffer`, `SkillValidationResult`, and `SkillTemplate`, and registered them in `r8RuntimeSchemaRegistry`.
- Routed `skill:validate`, `skill:write`, and `skill:create-from-template` through executable main-process IPC handlers and `R8RuntimeService` methods.
- Added five real creation templates: `blank`, `fork-builtin`, `prompt-only`, `script-only`, and `full`; template creation writes a real local user skill through the service layer.
- Validation now reports YAML parse errors separately from Zod schema errors and formats schema errors through `zod-validation-error` for user-readable messages.
- Save remains guarded by valid editor state and `confirmedBy`, writes through main IPC, and triggers explicit reload instead of simulating hot reload.

### verified_gwt

- GWT-1 complete for the integrated panel: selecting a skill loads YAML, Body, and Script buffers from real IPC-shaped skill data.
- GWT-2 complete for service and UI path: malformed or incomplete YAML returns `valid=false`, disables save, and surfaces schema errors.
- GWT-3 complete for the implemented template path: creating from a template calls `skill:create-from-template` and reloads the skill list.
- GWT-4 complete for the save route: dirty and valid buffers call `skill:write` through preload/main IPC, then `skill:reload(true)`.
- GWT-5 partial: script buffer language is carried as `scriptLanguage=node`; full runtime/language toggle UI is not separately implemented in this slice.

### not_claimed_complete

- A standalone `/skills` route is not implemented; the editor is currently embedded in the R8 Ops panel.
- Browser/Electron Playwright coverage for real Monaco rendering and worker packaging is not implemented in this slice.
- Unsaved-close confirmation, destructive delete UI, toast copy, and full theme-axis polishing are not claimed complete.
- Chokidar hot reload, `skill:list-stream`, and audit rows remain the spec-09 downstream boundary and are not claimed complete here.
- Script execution, runtime sandboxing, and permission enforcement remain spec-15 work.

### verification

- `pnpm typecheck` passed.
- `pnpm lint` passed, including no-emoji over 283 files.
- `pnpm test --run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1` passed: 4 files, 45 tests.

---

## 15. implementation_evidence_2026-05-08

### completed_executable_slice

- `SkillEditorPanel` now keeps Monaco as a dynamic import and passes a project-local `devhub-skill-editor` Monaco theme from `skill-monaco-config.ts`.
- `skill-monaco-config.ts` embeds the SKILL frontmatter JSON schema and sets `enableSchemaRequest=false`, so validation/autocomplete never depends on schemastore.org or remote schema requests.
- YAML, Body, and Script tabs remain in the integrated R8 Ops editor, and the Script tab now exposes a real runtime language selector for `node`, `python`, `bash`, and `powershell`.
- The renderer calls `skill:validate` through the preload API with a real 200ms debounce before updating `SkillValidationResult`.
- The save button remains disabled unless the buffer is dirty, validation is valid, and no save/delete operation is running.
- Template creation uses the real five-template list from `skill:template-list` and calls `skill:create-from-template` with an explicit selected template id.
- User skill deletion now requires a destructive `window.confirm()` and then calls `skill:delete` with `confirmedBy='skill-editor-panel'`; built-in skills cannot be deleted from the editor.
- Theme synchronization now uses the existing four-axis theme surface through CSS variables (`palette`, `density`, `radius`, `motion`) and the Monaco theme is defined from local CSS tokens.
- `R8.C.skill.editor` is asserted default-ON in `feature-flags.test.ts`.
- The editor still only uses local preload IPC calls and does not upload SKILL YAML, body, script, names, or validation payloads.

### verified_gwt

- GWT-1 remains covered by `SkillEditorPanel.test.tsx`: skill selection loads YAML, Body, and Script buffers from real preload-shaped data and displays `lastSavedAt`.
- GWT-2 remains covered by service/UI validation paths: schema errors disable Save, and the renderer now debounces validation by 200ms.
- GWT-3 remains covered: template creation calls `skill:create-from-template`, reloads the list, and selects the created user skill.
- GWT-4 remains covered: valid dirty buffers call `skill:write`, then `skill:reload(true)`, and update `lastSavedAt`.
- GWT-5 is now covered by renderer tests: switching to `python` changes Monaco `language` and persists `scriptLanguage='python'` on save.

### not_claimed_complete

- Electron Playwright coverage for real packaged Monaco worker rendering is now closed by the 2026-05-11 Playwright worker/rendering GWT.
- A standalone `/skills` route remains out of scope; the editor is embedded in the existing R8 Ops panel to avoid navigation churn.
- Unsaved-close modal and toast system integration remain UX enhancements; save/delete status is currently surfaced through the panel message row.

### verification

- `pnpm -C . test --run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx src/shared/feature-flags.test.ts --testNamePattern "skill|Skill|editor|Editor|template|delete|default disabled states" --maxWorkers=1` passed: 5 files, 16 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `SkillEditorPanel` and `configureSkillMonaco` returned LOW risk.

## 16. playwright_evidence_2026-05-11

- Added `devhub/e2e/example.spec.ts` coverage for `R8.C spec-11`: the test opens the real production Electron app, navigates to the real R8 Ops panel, waits for `SkillEditorPanel`, asserts that `@monaco-editor/react` has replaced the fallback textarea with a `.monaco-editor`, switches the Script tab to `python`, and verifies the editor remains rendered.
- The same GWT calls `globalThis.MonacoEnvironment.getWorker()` for `editor`, `json`, `typescript`, and `yaml`, then terminates each returned Worker. This proves the packaged Monaco worker wiring from `skill-monaco-config.ts` is executable in Electron instead of relying on the Vitest textarea mock.
- Verified with:
  - `pnpm -C devhub typecheck`
  - `pnpm -C devhub test:e2e --grep "R8.C spec-11" --reporter=line`: 1 test passed in 4.1s.
  - `pnpm -C devhub lint`: no emoji found in 598 files.
