# R8 Theme Pack Format

Theme packs are local JSON documents exported from the Settings appearance Theme Editor.

## Canonical Implementation

- Schema and serializer: `src/renderer/theme/theme-pack.ts`
- Export UI: `src/renderer/components/settings/SettingsDialog.tsx`
- Tests: `src/renderer/theme/theme-pack.test.ts` and `src/renderer/components/settings/SettingsDialog.theme-editor.test.tsx`

## File Name

Theme Editor exports use the extension:

```text
<palette>-YYYY-MM-DD.devhub-theme.json
```

## File Shape

```json
{
  "schemaVersion": 1,
  "kind": "devhub-theme-pack",
  "exportedAt": "2026-05-19T00:00:00.000Z",
  "name": "constructivism-theme-pack",
  "source": "settings-theme-editor",
  "themeState": {
    "palette": "constructivism",
    "density": "standard",
    "radiusFamily": "sharp",
    "motionLevel": "balanced"
  },
  "tokens": {
    "accentColor": "#112233",
    "cardRadiusPx": 6,
    "spacingBasePx": 8,
    "motionNormalMs": 220
  },
  "decoration": {
    "kind": "soviet-geo",
    "opacity": 0.25,
    "positions": ["card-background", "header"],
    "blendMode": "normal",
    "scale": 1,
    "motionRespect": true
  }
}
```

## Rules

- Theme packs are exported as local JSON only; no remote CSS, script execution, or asset fetching is allowed.
- `schemaVersion`, `kind`, `source`, `themeState`, and `tokens` are required.
- `themeState` must pass the same Zod schema used by runtime theme application.
- `accentColor` must be a six-digit hex color.
- Numeric token ranges are bounded: radius and spacing are `0-64`, motion is `0-1000ms`.
- Decoration data is optional but, when present, must pass the runtime decoration schema.

## Validation

Run:

```bash
pnpm exec vitest run src/renderer/theme/theme-pack.test.ts src/renderer/components/settings/SettingsDialog.theme-editor.test.tsx --maxWorkers=1
```
