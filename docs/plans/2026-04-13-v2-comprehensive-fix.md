# DevHub v2 Comprehensive Fix Plan

**Date**: 2026-04-13
**Status**: In Progress
**Scope**: 9 problem domains, 5 agent teams

## Problem Summary

| ID | Problem | Severity | Team |
|----|---------|----------|------|
| T1 | AI tool detection broken | Critical | Backend-Core |
| T2 | UI layout cramped | High | Project-UX |
| T3 | Process detail PID errors | Critical | Backend-Core |
| T4 | Port panel not Chinese + timeout | High | Port-Window |
| T5 | Window management issues (5 sub) | Critical | Port-Window |
| T6 | Topology graph blank | High | Topology-Flow |
| T7 | Port-Process-Window flow chart missing | Medium | Topology-Flow |
| T8 | Project features minimal | High | Project-UX |
| T9 | Theme only changes colors | Medium | Theme-Design |

## Agent Team Assignments

### Team 1: Backend-Core
- **Scope**: T1 (AI Detection) + T3 (Process Detail)
- **Files**: main/services/ToolMonitor.ts, AITaskTracker.ts, SystemProcessScanner.ts, processHandlers.ts
- **Conflict Risk**: Low (backend-only changes)

### Team 2: Port-Window
- **Scope**: T4 (Port i18n) + T5 (Window Management)
- **Files**: PortFocusPanel.tsx, PortView.tsx, WindowView.tsx, WindowManager.ts
- **Conflict Risk**: Medium (shares types-extended.ts)

### Team 3: Topology-Flow
- **Scope**: T6 (Topology Fix) + T7 (Flow Chart)
- **Files**: TopologyView.tsx, NeuralGraph*.tsx, PortRelationshipGraph.tsx
- **Conflict Risk**: Low (isolated components)

### Team 4: Project-UX
- **Scope**: T2 (UI Layout) + T8 (Project Features)
- **Files**: HeroStats.tsx, Sidebar.tsx, ProjectCard.tsx, ProjectDetailPanel.tsx (NEW)
- **Conflict Risk**: Medium (layout changes affect all)

### Team 5: Theme-Design
- **Scope**: T9 (Theme System)
- **Files**: styles/tokens/*.css, useTheme.ts, SettingsDialog.tsx
- **Conflict Risk**: Low (CSS-only, applied last)

## Merge Strategy

1. Backend-Core first (foundation)
2. Project-UX second (layout)
3. Port-Window third (panels)
4. Topology-Flow fourth (visualization)
5. Theme-Design last (CSS overlay)

## Key Constraints

- No deletions of existing code
- No mock data
- No emoji icons
- TypeScript strict mode
- Windows 10/11 compatibility
- PowerShell queries max 3s timeout
