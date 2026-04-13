# Team 3: Topology-Flow -- T6 Topology Fix + T7 Flow Chart

## Project Context

DevHub is an Electron desktop app at `devhub/` (electron-vite + React 18 + TypeScript + Zustand + TailwindCSS). Uses `d3-force` for force-directed topology and has `@xyflow/react` + `@dagrejs/dagre` installed for flow charts.

## Scope

- T6: Topology Graph Fix + Enhancement (`TopologyView`, `NeuralGraph`, `NeuralGraphEngine`)
- T7: Port-Process-Window Flow Chart (`PortRelationshipGraph` rewrite)

---

## T6 Requirements

### Current Problem

Topology view displays completely blank. Only "PROCESS TOPOLOGY" title and stats bar are visible. The SVG area is empty even when processes/ports/windows data exists.

### T6.1 Root-Cause Investigation Checklist

Agent must verify each before fixing:

1. `NeuralGraphEngine.ts`: does it receive non-zero `container.clientWidth/clientHeight`?
2. `setData(nodes, edges)`: is it actually called with non-empty arrays?
3. `d3-force simulation.tick`: is the callback firing?
4. `TopologyView.tsx`: do `processes/ports/windows` from stores contain data at render time?
5. Parent container CSS: does `h-full` propagate actual height?

### T6.2 Fix NeuralGraphEngine.ts

- Add ResizeObserver to watch container size changes
- On construction, if container is 0x0, schedule a retry via `requestAnimationFrame` + timeout fallback (100ms)
- Explicit SVG sizing: `svg.attr('width', container.clientWidth).attr('height', container.clientHeight)`
- Log warnings (dev only) if setData called with empty arrays or container still has 0 dimensions after retries
- Ensure d3-force simulation actually starts: `simulation.alpha(0.3).restart()` after setData

### T6.3 Fix TopologyView.tsx

- Add `min-h-[400px]` or explicit inline height to ensure parent gives positive height
- Add loading state: while stores haven't synced (all 3 arrays empty AND initial fetch not done)
- Add empty state: when all arrays empty after sync -> show "暂无拓扑数据 - 等待系统扫描..."
- Translate stats labels to Chinese:
  - "Processes" -> "进程"
  - "Ports" -> "端口"
  - "Windows" -> "窗口"
  - "Projects" -> "项目"
- Keep "PROCESS TOPOLOGY" or change to "系统拓扑" (prefer Chinese for consistency)
- Change `emptyMessage="No topology data"` -> `"暂无拓扑数据"`

### T6.4 Enhance Visualization

Node color/shape mapping (enforce in NeuralGraphEngine or Node components):

| Node Type | Shape | Color |
|-----------|-------|-------|
| project | large circle | theme accent |
| process (CPU < 25%) | circle | green |
| process (CPU 25-50%) | circle | yellow |
| process (CPU 50-80%) | circle | orange |
| process (CPU > 80%) | circle | red |
| port-listening | diamond | gold |
| port-established | diamond | blue |
| port-timewait | diamond | grey |
| window | rectangle | emerald |
| external | circle (dashed) | neutral |

- Hover tooltip: show full label + key metadata (PID, CPU, memory for process; port/state for port; title for window)
- Click highlight: highlight node + all direct edges/neighbors
- Double-click: zoom-to-fit that node's neighborhood
- Search box (already in NeuralGraphWithControls if present) -- ensure it filters
- Legend panel (collapsible): Chinese labels for each node type

---

## T7 Requirements

### Current Problem

Originally designed port->process->window hierarchical flow chart was never implemented. Current `PortRelationshipGraph.tsx` reuses NeuralGraph (force-directed), which is NOT the clear left-to-right layered diagram the design called for.

### T7.1 Rewrite PortRelationshipGraph.tsx with ReactFlow

Use `@xyflow/react` (installed) + `@dagrejs/dagre` (installed) for hierarchical layout.

Import pattern:
```typescript
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
```

### T7.2 Three-Layer Structure

```
Column 0 (Left): Ports (LISTENING, ESTABLISHED)
Column 1 (Center): Processes (with CPU/memory display)
Column 2 (Right): Windows (with title)
```

dagre config:
```typescript
const g = new dagre.graphlib.Graph()
g.setDefaultEdgeLabel(() => ({}))
g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 120, marginx: 20, marginy: 20 })
```

### T7.3 Custom Node Components

Create new files in `devhub/src/renderer/components/monitor/flow/`:

**FlowPortNode.tsx**:
- Shows: `:PORT` (large), protocol badge (TCP/UDP), state badge (颜色区分)
- Click area calls onClick(port)

**FlowProcessNode.tsx**:
- Shows: process name, PID, CPU% mini bar, memory mini bar
- Color-coded by type (dev-server/ai-tool/build/database)

**FlowWindowNode.tsx**:
- Shows: truncated title, process name, HWND
- Icon if it's an AI window

### T7.4 Edge Styling

Use ReactFlow edge types:
- port->process: `type: 'smoothstep'`, style `{stroke: var(--accent)}`, label "绑定"
- process->window: `type: 'smoothstep'`, style `{stroke: var(--success)}`, label "拥有"
- process->childProcess: `type: 'smoothstep', animated: true`, dashed
- port->external: `type: 'step'`, dotted, label `N connections`

### T7.5 Data Pipeline

In `PortRelationshipGraph.tsx`:
- Read `processStore`, `portStore`, `windowStore`
- Transform to `nodes: Node[], edges: Edge[]`
- Apply dagre layout -> assign `position: {x, y}` to each node
- Render `<ReactFlow>` with `nodeTypes={{portNode, processNode, windowNode}}`
- Handle empty data: show friendly "暂无数据" message

### T7.6 Interactions

- Click node -> emit event to parent (opens existing detail panels PortFocusPanel/ProcessDetailPanel)
- Hover -> highlight connected path via CSS
- Controls: zoom in/out, fit-view, lock
- MiniMap: bottom-right overview
- Search input: filter by PID/port/title

### T7.7 Integration with MonitorPanel

Check `MonitorPanel.tsx`:
- If a "flow" or "relationship" tab doesn't exist -> add one labeled "流程图"
- If it exists, ensure PortRelationshipGraph mounts there correctly
- The existing "topology" tab stays (for T6 work)
- Share data from same stores; no duplication

---

## Acceptance Criteria

### T6 Acceptance
- [ ] Topology view renders nodes and edges (not blank)
- [ ] Stats labels in Chinese
- [ ] Node colors reflect state (CPU for processes, state for ports)
- [ ] Empty data shows friendly message, not blank
- [ ] Legend panel shows node type meanings
- [ ] ResizeObserver keeps graph responsive

### T7 Acceptance
- [ ] Flow chart renders 3-column layout (ports | processes | windows)
- [ ] dagre auto-layout places nodes without overlap
- [ ] Edges labeled (绑定, 拥有, etc.)
- [ ] Click node -> opens corresponding detail panel
- [ ] MiniMap and zoom controls functional
- [ ] Chinese UI throughout
- [ ] Empty data handled gracefully

---

## Critical Rules

- **NO deletion** of existing code/components/functions (keep NeuralGraph as the force-directed option)
- **NO mock data**
- **NO emoji icons**
- TypeScript strict mode
- All UI Chinese
- Reuse `@xyflow/react`, `@dagrejs/dagre`, `d3-*` (already installed)
- Run `cd devhub && npx tsc --noEmit` before completing

## Files In Scope

### Frontend (primary)
- `devhub/src/renderer/components/monitor/TopologyView.tsx` -- T6 fix + i18n
- `devhub/src/renderer/components/monitor/topology/NeuralGraph.tsx` -- T6 React wrapper fix
- `devhub/src/renderer/components/monitor/topology/NeuralGraphEngine.ts` -- T6 engine fix
- `devhub/src/renderer/components/monitor/topology/ProcessNode.tsx` -- T6 styling
- `devhub/src/renderer/components/monitor/topology/PortNode.tsx` -- T6 styling
- `devhub/src/renderer/components/monitor/topology/WindowNode.tsx` -- T6 styling
- `devhub/src/renderer/components/monitor/topology/TopologyEdge.tsx` -- T6 styling
- `devhub/src/renderer/components/monitor/topology/TopologyDetailPanel.tsx` -- T6 i18n
- `devhub/src/renderer/components/monitor/PortRelationshipGraph.tsx` -- T7 REWRITE with ReactFlow
- `devhub/src/renderer/components/monitor/MonitorPanel.tsx` -- T7 ensure flow tab exists
- `devhub/src/renderer/hooks/useProcessTopology.ts` -- T7 data transform helper
- `devhub/src/renderer/components/monitor/flow/` -- T7 NEW directory for ReactFlow node components
  - `FlowPortNode.tsx`
  - `FlowProcessNode.tsx`
  - `FlowWindowNode.tsx`

### Shared (READ ONLY)
- `devhub/src/renderer/stores/processStore.ts` -- data source
- `devhub/src/renderer/stores/portStore.ts` -- data source
- `devhub/src/renderer/stores/windowStore.ts` -- data source
- `devhub/src/shared/types-extended.ts` -- reference only, add ADDITIONS if needed

## Out of Scope

- ToolMonitor/AITaskTracker backend (Team 1)
- ProcessDetailPanel backend (Team 1)
- PortFocusPanel i18n (Team 2)
- WindowView batch ops (Team 2)
- HeroStats/Sidebar/ProjectCard (Team 4)
- Theme CSS (Team 5)
