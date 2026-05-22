# R8.C Skill Editor

This document records the implemented boundary for `prompts/0503-2/R8.C/spec-11-skill-editor.md`.

## Scope

- The editor is embedded in the existing R8 Ops panel through `src/renderer/views/skills/SkillEditorPanel.tsx`.
- Renderer code edits local SKILL documents only through `window.devhub.r8.skill` preload IPC methods.
- The editor validates metadata and writes files. It does not execute skill scripts; execution remains R8.C spec-15 task-queue work.
- The editor does not upload SKILL names, YAML, body markdown, scripts, validation errors, or template content.

## Editor Behavior

- Monaco is loaded with `lazy(() => import('@monaco-editor/react'))`, so editor code is dynamically imported.
- `skill-monaco-config.ts` registers editor, JSON, TypeScript, and YAML workers from local Vite worker imports.
- YAML schema support is local-only through `monaco-yaml` with `enableSchemaRequest=false` and an embedded SKILL frontmatter schema.
- The UI provides YAML, Body, and Script tabs, plus a script language selector for `node`, `python`, `bash`, and `powershell`.
- Validation calls `skill:validate` after a 200ms debounce and displays YAML/schema errors in the panel.
- Save is disabled unless the buffer is dirty, validation is valid, and no save/delete operation is running.
- Successful save calls `skill:write`, then `skill:reload(true)`, clears dirty state, selects the saved skill name, and updates `lastSavedAt`.

## Templates And Delete

- The template picker is loaded from `skill:template-list`.
- `New from template` calls `skill:create-from-template` with the selected template id and then reloads the skill list.
- Delete is enabled only for user skills, never for built-ins.
- Delete requires `window.confirm()` before calling `skill:delete` with `confirmedBy='skill-editor-panel'`, then calls `skill:reload(true)`.

## Theme

- The panel uses the existing theme CSS variable system for palette, density, radius, and motion.
- `SKILL_EDITOR_MONACO_THEME` defines Monaco colors from local CSS variables such as `--surface-950`, `--text-primary`, `--warning`, `--error`, and `--info`.
- The editor frame uses `--radius-md` and `--duration-theme` so radius and motion axes stay aligned with the rest of the app.

## Verification

- `SkillEditorPanel.test.tsx` covers real preload-shaped load, validation, save, template create, delete confirmation, script language switching, and Monaco theme propagation.
- `R8RuntimeService.test.ts` covers service validation, template creation, write/delete routing through the same skill storage boundary, and user/built-in skill behavior.
- `r8RuntimeHandlers.test.ts` covers executable IPC routing for `skill:validate`, `skill:write`, `skill:delete`, `skill:create-from-template`, and `skill:template-list`.
- `feature-flags.test.ts` asserts `R8.C.skill.editor` remains default-enabled.
- Electron Playwright coverage for real Monaco worker rendering is still open and tracked in the spec checklist.
