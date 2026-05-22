# R8.B spec-16 Component ARIA Audit

This report is produced from the current renderer source tree by `pnpm a11y:component-audit`.

- Renderer TSX files scanned: 167
- Production `tabIndex={0}` entries: 7
- Audited ARIA surfaces: 10
- Blocking findings: 0

| Surface | Source | Result | Evidence |
|---|---|---|---|
| panel-splitter-separator | `src/renderer/components/ui/PanelSplitter.tsx:287` | pass | Resizable panel separator has name, orientation, and value state. |
| project-card-button | `src/renderer/components/project/ProjectCard.tsx:165` | pass | Project card keeps custom button keyboard activation and explicit card label. |
| settings-toggle-switch | `src/renderer/components/settings/SettingsDialog.tsx:586` | pass | Settings toggle uses switch semantics and keyboard activation. |
| monitor-window-card | `src/renderer/components/monitor/MonitorWindowCards.tsx:119` | pass | Monitor cards expose explicit names while retaining Enter and Space activation. |
| port-list-scroll-region | `src/renderer/components/monitor/PortView.tsx:883` | pass | Focusable port scroll containers are named regions in both detail and non-detail branches. |
| process-treemap-tile | `src/renderer/components/monitor/process/ProcessTreemapTile.tsx:48` | pass | SVG treemap tile has explicit button name, selected state, and keyboard activation. |
| process-treemap-inline-svg | `src/renderer/components/monitor/process/ProcessTreemapView.tsx:69` | pass | Bulk-rendered SVG treemap path writes escaped aria labels for real tiles. |
| keyboard-nav-group | `src/renderer/components/a11y/KeyboardNavGroup.tsx:117` | pass | Reusable roving tabindex group keeps role, label, and arrow-key navigation. |
| command-palette-dialog | `src/renderer/components/command/R8CommandPalette.tsx:263` | pass | Command palette dialog has modal semantics and named command groups. |
| a11y-live-regions | `src/renderer/components/a11y/AnnouncementProvider.tsx:71` | pass | Live regions expose polite and assertive channels with atomic updates. |

## Scope Boundary

- This is a component/source audit for renderer ARIA naming, keyboard activation, dialog semantics, live regions, and focusable scroll regions.
- Live WCAG rule execution remains covered by `pnpm a11y:audit -- --url <renderer-url>` and the Electron spec-16 Playwright path.
- No fabricated browser state or mock axe result is used by this report.
