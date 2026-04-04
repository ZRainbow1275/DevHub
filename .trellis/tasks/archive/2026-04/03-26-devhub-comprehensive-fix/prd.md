# DevHub Comprehensive Code Fix

## Goal
Based on a 149-issue deep review, fix all issues that can be safely resolved without:
- Breaking existing functionality
- Conflicting with the development purpose (dev project manager + AI tool monitor)
- Eliminating features

## Safety Classification

Issues are classified into 3 tiers by fix safety:

### Tier 1: Safe to Fix (No functional risk)
These fixes are purely additive, defensive, or correctional — they cannot break anything.

| # | Issue | Category | Fix Description |
|---|-------|----------|-----------------|
| 1 | `.gitignore` nearly empty | Engineering | Add standard ignores (node_modules, out, release, coverage, tmpclaude-*) |
| 2 | 313 tmpclaude-* temp dirs | Engineering | Delete all temp directories |
| 3 | `.pnpmfile.cjs.tmp` leftover | Engineering | Delete temp file |
| 4 | IPC channel name mismatch (AI_TASK_COMPLETE vs AI_TASK_COMPLETED) | Bug | Fix channel name to match |
| 5 | 4 preload APIs with no matching IPC handlers | Bug | Register missing handlers |
| 6 | `enrichProcessNames` not awaited | Bug | Add await to async call |
| 7 | `startTime` always set to `new Date()` (zombie detection broken) | Bug | Preserve first-seen time for processes |
| 8 | ESLint `--ext` flag incompatible with v9 flat config | Engineering | Remove `--ext` from lint script |
| 9 | `react`/`react-dom`/`zustand` in devDependencies | Engineering | Move to dependencies |
| 10 | Missing CSP headers | Security | Add CSP via session.webRequest |
| 11 | `shell.openExternal` no URL validation | Security | Add protocol whitelist (https only) |
| 12 | Missing `will-navigate` handler | Security | Block navigation to external URLs |
| 13 | `useDebouncedCallback` no cleanup on unmount | Bug | Add useEffect cleanup |
| 14 | `PortScanner.processNameCache` never cleared | Memory | Clear cache on each scanAll |
| 15 | `AITaskTracker.history` unbounded growth | Memory | Add max size limit (1000) |
| 16 | `WindowManager.windows` Map never pruned | Memory | Clear stale entries on scan |
| 17 | `LogPanel` using index as key | Performance | Use timestamp-based key |
| 18 | `PortView`/`ProcessView` stateConfig/statusConfig undefined crash | Bug | Add fallback default |
| 19 | `AITaskView` statusColor undefined | Bug | Add fallback default |
| 20 | `formatDuration` duplicated 3x | DRY | Extract to shared utility |
| 21 | `StatCard` duplicated in 3 monitor views | DRY | Extract to shared component |
| 22 | `PROJECTS_REMOVE` missing await on processManager.stop() | Bug | Add await |
| 23 | `task-history:clear-old` no date validation | Security | Validate beforeDate input |
| 24 | `pnpm-workspace.yaml` vs `package.json` onlyBuiltDependencies conflict | Engineering | Unify configuration |
| 25 | `jsdom` + `happy-dom` both installed | Engineering | Remove jsdom |
| 26 | `PortScanner.releasePort` SIGKILL callback ignores errors | Bug | Check err in callback |
| 27 | `SystemProcessScanner.scan()` silently swallows exceptions | Bug | Add console.error |
| 28 | CI Linux job missing test + build steps | Engineering | Complete ci.yml |
| 29 | CI missing lint step | Engineering | Add lint to CI |

### Tier 2: Safe with Care (Need targeted changes)
Fixes that modify behavior but in ways that strictly improve correctness.

| # | Issue | Category | Risk Assessment |
|---|-------|----------|-----------------|
| 30 | `sandbox: false` → `sandbox: true` | Security | May break preload if it uses Node APIs directly. Need to verify preload only uses contextBridge/ipcRenderer |
| 31 | IPC handlers missing runtime input validation | Security | Additive — only reject bad input, valid input unchanged |
| 32 | `process:kill` no whitelist check | Security | Add check that PID is in known dev processes. May reject valid kills |
| 33 | `port:release` no scope check | Security | Limit to common dev ports. May reject edge cases |
| 34 | ProcessManager start/stop race conditions | Architecture | Add mutex/flag. Only affects concurrent calls |
| 35 | `before-quit` not awaiting stopAll() | Architecture | Need event.preventDefault + async cleanup |
| 36 | WindowManager/TaskHistoryStore missing cleanup on quit | Architecture | Add cleanup calls |
| 37 | Notification config no field validation | Security | Add whitelist filter |
| 38 | `task-history:add/update` no runtime validation | Security | Add schema check |
| 39 | `LogPanel` needs virtualization | Performance | Replace logs.map with react-virtual |
| 40 | Multiple pollers need visibility awareness | Performance | Add document.visibilitychange pause |
| 41 | All dialogs missing role="dialog", aria-modal, Escape key | A11y | Additive attributes |
| 42 | `SettingToggle` needs role="switch" | A11y | Additive attribute |
| 43 | `ProjectCard` needs keyboard support | A11y | Add tabIndex + onKeyDown |

### Tier 3: Deferred (Architectural changes, high risk)
These require significant refactoring and should be separate tasks.

| # | Issue | Reason to Defer |
|---|-------|-----------------|
| — | Unified polling scheduler | Major architecture change |
| — | Replace PowerShell/WMIC with node-ffi | Requires new dependency + testing |
| — | Rewrite all tests to test actual code | Large effort, parallel task |
| — | Remove code generation scripts | Needs team discussion |
| — | Add ErrorBoundary per region | Medium effort, UX design needed |
| — | Migrate WMIC to Get-CimInstance | Breaking change for older Windows |

## Acceptance Criteria
- [ ] All Tier 1 fixes applied and verified
- [ ] All Tier 2 fixes applied with manual verification
- [ ] No existing tests broken
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] No functionality removed

## Technical Notes
- Electron + React + TypeScript + Vite project
- No git repo initialized (cannot use git for verification)
- Windows platform (Git Bash environment)
- Source at `devhub/src/`
