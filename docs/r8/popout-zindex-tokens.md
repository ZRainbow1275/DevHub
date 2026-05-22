# R8.B Popout Z-Index Tokens

## Tier Map

`src/renderer/styles/z-index-tokens.css` now defines the R8 tier map:

| Tier | Token | Value |
|---|---|---:|
| Base | `--z-tier-base` | 0 |
| Hover | `--z-tier-hover` | 100 |
| Toolbar | `--z-tier-toolbar` | 1000 |
| Drawer | `--z-tier-drawer` | 2000 |
| Modal | `--z-tier-modal` | 3000 |
| Popout | `--z-tier-popout` | 4000 |
| Toast | `--z-tier-toast` | 5000 |
| Command palette | `--z-tier-command-palette` | 6000 |
| Watchdog alert | `--z-tier-watchdog-alert` | 7000 |
| DevTools | `--z-tier-devtools` | 8000 |
| System overlay | `--z-tier-system-overlay` | 9000 |

## Port Popout Allocation

Port popouts use:

- `--z-popout: var(--z-tier-popout)`
- `--z-popout-max: 4999`
- `PORT_POPOUT_LIMITS.Z_INDEX_BASE = 4000`
- `PORT_POPOUT_LIMITS.Z_INDEX_RANGE = 999`

The renderer model allocates within the popout band, keeping floating cards above drawers and modals while staying below toasts, command palette surfaces, watchdog alerts, DevTools overlays, and system overlays.

## Compatibility

Existing legacy tokens such as `--z-card`, `--z-sticky`, `--z-sidebar`, `--z-header`, `--z-drawer`, `--z-popover`, `--z-tooltip`, `--z-modal`, and `--z-critical` are preserved. No existing z-index token was removed.
