# DevHub v2 Comprehensive Fix -- Technical Specification

## Architecture Overview

```
devhub/src/
  main/                          # Electron main process
    index.ts                     # App entry, window creation
    services/                    # Core backend services
      ToolMonitor.ts             # [T1] AI tool detection
      AITaskTracker.ts           # [T1,T5] AI task completion
      AIAliasManager.ts          # [T1,T5] Window alias management
      SystemProcessScanner.ts    # [T3] Process scanning + detail
      ProcessManager.ts          # [T3] Process lifecycle
      PortScanner.ts             # [T4] Port scanning
      WindowManager.ts           # [T5] Window management + layout
      NotificationService.ts     # [T1,T5] Notification delivery
      ProjectScanner.ts          # [T8] Project detection
      ProjectWatcher.ts          # [T8] Filesystem watching
      projectDetectors.ts        # [T8] Project type detection
      BackgroundScannerManager.ts # All scanning coordination
      ScannerCache.ts            # Caching layer
      TaskHistoryStore.ts        # AI task history
      AuditLogger.ts             # Security audit log
    ipc/                         # IPC handlers
      aiTaskHandlers.ts          # [T1,T5]
      processHandlers.ts         # [T3]
      portHandlers.ts            # [T4]
      windowHandlers.ts          # [T5]
      scannerHandlers.ts         # [T8]
      notificationHandlers.ts
      taskHistoryHandlers.ts
    store/AppStore.ts            # Main process state
    utils/                       # Validation, rate limiting, security
  
  renderer/                      # React frontend
    App.tsx                      # Root component
    components/
      layout/
        Sidebar.tsx              # [T2] Collapsible sidebar
        StatusBar.tsx            # [T1,T5] AI status in status bar
        TitleBar.tsx             # App title bar
      monitor/
        MonitorPanel.tsx         # [T6,T7] Tab container
        ProcessView.tsx          # [T3] Process list
        ProcessDetailPanel.tsx   # [T3] Process detail (multi-tab)
        PortView.tsx             # [T4] Port grid
        PortFocusPanel.tsx       # [T4] Port detail panel
        WindowView.tsx           # [T5] Window management
        AITaskView.tsx           # [T1,T5] AI monitoring
        AIWindowAlias.tsx        # [T5] Alias editor
        AIProgressTimeline.tsx   # [T5] Progress timeline
        TopologyView.tsx         # [T6] Neural graph view
        PortRelationshipGraph.tsx# [T7] Flow chart
        LayoutPreview.tsx        # [T5] Layout preview
        Sparkline.tsx            # Shared sparkline chart
        topology/                # [T6] Graph engine
          NeuralGraph.tsx
          NeuralGraphEngine.ts
          ProcessNode.tsx
          PortNode.tsx
          WindowNode.tsx
          TopologyEdge.tsx
          TopologyDetailPanel.tsx
      project/
        ProjectCard.tsx          # [T2,T8] Project card
        ProjectList.tsx          # [T2,T8] Project list
        ProjectDetailPanel.tsx   # [T8] NEW - Project detail
        AddProjectDialog.tsx
        AutoDiscoveryDialog.tsx
        ProjectTypeBadge.tsx
        TagManagerDialog.tsx
      settings/
        SettingsDialog.tsx       # [T9] Theme preview
      ui/                        # Shared UI components
        HeroStats.tsx            # [T2] Stats bar
        ResponsiveMetric.tsx     # [T2] Responsive numbers
        StatCard.tsx             # [T2] Stat card
        PanelSplitter.tsx        # [T2] Panel splitter
        ResizeHandle.tsx         # [T2] Resize handle
        DecorationSet.tsx        # [T9] Theme decorations
        ThemeDecoration.tsx      # [T9] Theme decoration
        ViewModeToggle.tsx       # List/Grid toggle
        ContextMenu.tsx          # Right-click menu
        ConfirmDialog.tsx
        Toast.tsx
        LoadingSpinner.tsx
        TruncatedText.tsx
        ScriptSelector.tsx
      icons/index.tsx            # SVG icon library
    hooks/
      useAITasks.ts              # [T1,T5]
      useToolStatus.ts           # [T1]
      useSystemProcesses.ts      # [T3]
      usePorts.ts                # [T4]
      useWindows.ts              # [T5]
      useProcessTopology.ts      # [T6]
      useProjects.ts             # [T8]
      useTheme.ts                # [T9]
      useDensity.ts              # [T2]
      useBreakpoint.ts           # [T2]
      useWindowSize.ts           # [T2]
      useLogs.ts
      useMetricFormat.ts
      useDebouncedCallback.ts
    stores/
      aiTaskStore.ts             # [T1,T5]
      toolStore.ts               # [T1]
      processStore.ts            # [T3,T6]
      portStore.ts               # [T4,T6]
      windowStore.ts             # [T5,T6]
      projectStore.ts            # [T8]
      scannerStore.ts
      aliasStore.ts              # [T5]
    styles/
      tokens/
        colors.css               # [T9] Color tokens
        typography.css           # [T9] Font tokens
        animations.css           # [T9] Animation tokens
        theme-tokens.css         # [T9] Master token file
      globals.css                # [T9] Global styles
    utils/
      portLabels.ts              # [T4] Port label mapping
      formatDuration.ts
      formatMetric.ts
      formatNumber.ts
      theme-tokens.ts            # [T9] JS token access
  
  shared/
    types.ts                     # Core types
    types-extended.ts            # Extended types (ALL teams)
  
  preload/
    index.ts                     # IPC bridge
    extended.ts                  # Extended IPC bridge
```

## Team Specifications

### Team 1: Backend-Core (T1 + T3)

#### T1 Implementation Details

**ToolMonitor.ts Changes**:

1. Expand `TOOL_DETECTION_CONFIG` with all 9+ tools
2. Add native binary detection (Layer 1)
3. Add window title matching (Layer 3, via WindowManager.scanWindows)
4. Add parent process chain analysis (Layer 4)

```typescript
// New config structure
interface ToolDetectionConfigV2 {
  id: string
  displayName: string
  nativeBinaries: string[]      // claude.exe, codex.exe etc
  nodeCommandPatterns: string[] // @anthropic-ai/claude-code etc
  windowTitlePatterns: RegExp[] // /Claude Code/i etc
  excludePatterns: string[]    // mcp-server etc
  completionPatterns: RegExp[] // Tool-specific completion
  promptPatterns: RegExp[]     // Tool-specific prompts
}
```

5. Rework `checkTools()` to use multi-layer detection
6. Add window title scan integration

**AITaskTracker.ts Changes**:

1. Increase `confirmationWindowMs` from 3000 to 8000
2. Add secondary confirmation mechanism
3. Enhance signal weights (8-signal model)
4. Add tool-specific completion patterns
5. Track false positive history for dynamic threshold

**NotificationService.ts Changes**:

1. Include window alias in notification body
2. Format: `"[Alias] ToolName - Task Complete"`
3. Add notification sound option

#### T3 Implementation Details

**SystemProcessScanner.ts Changes**:

1. Add `getBasicInfo(pid)` method that reads from in-memory cache
2. Add timeout wrapper for all PowerShell calls (3s default)
3. Add LRU cache for relationship queries (capacity 50, TTL 10s)
4. Optimize batch PowerShell queries
5. Add graceful degradation: try full query, fallback to basic

```typescript
async getFullRelationship(pid: number): Promise<ProcessRelationship | null> {
  // Level 1: Always available from cache
  const basic = this.getCachedProcessInfo(pid)
  if (!basic) return null
  
  // Level 2: Try extended info with timeout
  const extended = await this.withTimeout(
    this.getExtendedInfo(pid), 3000, null
  )
  
  // Level 3: Try relationships with timeout
  const relations = await this.withTimeout(
    this.getRelationships(pid), 5000, { children: [], ancestors: [], ... }
  )
  
  // Merge all levels
  return this.mergeRelationship(basic, extended, relations)
}
```

**ProcessDetailPanel.tsx Changes**:

1. Accept both full and partial data
2. Show available info even if some queries fail
3. Multi-tab design: Basic | Resources | Network | Environment | Modules
4. Lazy-load tabs (only query when user clicks)
5. Loading states per tab, not global

### Team 2: Port-Window (T4 + T5)

#### T4 Implementation Details

**PortFocusPanel.tsx i18n Map**:

All hardcoded English strings -> Chinese equivalents as defined in PRD T4.2.1

**portLabels.ts Enhancement**:

Extend to 30+ common port labels with Chinese descriptions.

**PortScanner.ts Optimization**:

1. Add tiered cache TTL (basic: 5s, details: 15s, connections: 10s)
2. Add PowerShell query timeout (3s)
3. Batch queries for multiple ports

#### T5 Implementation Details

**WindowView.tsx Major Enhancement**:

1. Add batch selection toolbar
2. Add group management panel
3. Add layout management panel
4. Add inline alias editing
5. Add transparency slider
6. Add topmost toggle

**WindowManager.ts Enhancement**:

1. Add `arrangeWindows(hwnds, arrangement)` method
2. Add `setOpacity(hwnd, alpha)` method
3. Add `setTopmost(hwnd, topmost)` method (already in C# helper)
4. Add `captureScreenshot(hwnd)` method

**AITaskTracker.ts Enhancement**:

Already covered in Team 1 T1 changes.

### Team 3: Topology-Flow (T6 + T7)

#### T6 Implementation Details

**NeuralGraphEngine.ts Debug Checklist**:

1. Verify `containerRef.current` has non-zero dimensions
2. Add ResizeObserver for container size changes
3. Verify d3-force simulation ticks
4. Add empty state rendering
5. Add error boundary

**TopologyView.tsx Fix**:

1. Add explicit height: `min-h-[400px]` fallback
2. Add loading state while stores sync
3. Add empty state message when no data
4. Filter out noise processes (only show relevant)

#### T7 Implementation Details

**PortRelationshipGraph.tsx Rewrite**:

Replace NeuralGraph usage with @xyflow/react:

```typescript
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import dagre from '@dagrejs/dagre'

// Custom node types
const nodeTypes = {
  portNode: PortFlowNode,
  processNode: ProcessFlowNode,
  windowNode: WindowFlowNode,
}

// dagre layout
function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 })
  // ... layout calculation
}
```

### Team 4: Project-UX (T2 + T8)

#### T2 Implementation Details

**HeroStats.tsx Redesign**:

```tsx
// New layout: inline value+label with responsive grid
<div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-2 p-2">
  <InlineStat value={0} label="运行中" variant="success" />
  <InlineStat value={206} label="进程" variant="accent" />
  ...
</div>
```

**Sidebar.tsx Collapsible**:

1. Add collapsed state (boolean stored in settings)
2. Collapsed: 48px wide, only icons
3. Expanded: user-adjustable width (200-400px)
4. Drag handle on right edge

#### T8 Implementation Details

**ProjectDetailPanel.tsx (NEW)**:

7-tab panel component with lazy-loaded content.

**ProjectScanner.ts Git Integration**:

```typescript
async getGitInfo(projectPath: string): Promise<GitInfo | null> {
  try {
    const branch = await execFileAsync('git', ['-C', projectPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
    const status = await execFileAsync('git', ['-C', projectPath, 'status', '--porcelain'])
    const log = await execFileAsync('git', ['-C', projectPath, 'log', '--oneline', '-10'])
    return { branch, uncommitted: status.stdout.split('\n').filter(Boolean).length, recentCommits: ... }
  } catch { return null }
}
```

### Team 5: Theme-Design (T9)

#### CSS Variable System

Each theme file defines the complete variable set including:
- Colors (existing, verify completeness)
- Border radius (NEW)
- Border styles (NEW)
- Shadows (NEW)
- Spacing/density (NEW)
- Animations (NEW)
- Decorations (NEW)

**File: `src/renderer/styles/tokens/theme-tokens.css`**

Add all new variables under each `[data-theme="..."]` selector.

**Component CSS Updates**:

Replace all hardcoded border-radius, box-shadow, border values with CSS variables.

Search pattern: `borderRadius: '2px'` -> use `var(--radius-sm)` via className
Search pattern: `border-radius` in CSS -> replace with variable

## Conflict Prevention Strategy

### Shared Files Protocol

**types-extended.ts**: 
- Each team adds types in clearly marked sections
- Use `// === T1 Types ===` block comments
- Additions only, no modifications to existing types

**MonitorPanel.tsx**:
- Team 3 adds flow chart tab
- Other teams don't touch this file
- Tab routing additions are append-only

**Global CSS files**:
- Only Team 5 modifies theme CSS
- Other teams use existing CSS classes or add component-local styles

### Merge Order

1. Team 1 (Backend-Core) -- foundation changes
2. Team 4 (Project-UX) -- layout changes
3. Team 2 (Port-Window) -- panel changes
4. Team 3 (Topology-Flow) -- visualization
5. Team 5 (Theme-Design) -- CSS overlay (least conflicts)
