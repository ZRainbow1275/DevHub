import { createHash, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, clipboard, screen, shell } from 'electron'
import Store from 'electron-store'
import {
  WindowInfo,
  WindowGroup,
  WindowLayout,
  ServiceResult,
  SYSTEM_WINDOW_CLASSNAMES,
  WindowFingerprint,
  HwndResolutionReport,
  WindowGroupMembership,
  WindowLayoutSnapshot,
  WindowLayoutSnapshotItem,
  TilePreset,
  ApplyLayoutIntent,
  ApplyLayoutResult,
  LayoutErrorCode,
  MonitorInfo,
  WindowFavoriteRecord,
  WindowFavoriteToggleResult,
  WindowOpenDirectoryResult,
  WindowScreenshotResult
} from '@shared/types-extended'
import { PowerShellGateway, getPowerShellGateway } from './runtime/PowerShellGateway'
import {
  Win32WindowEnumerator,
  type NativeWindowSnapshot,
  type Win32WindowEnumeratorLike
} from './integrations/Win32WindowEnumerator'

export interface WindowFocusBatchResult {
  hwnd: number
  result: ServiceResult
}

export type WindowTextInjectionMode = 'clipboard-paste' | 'sendinput' | 'wm-char'

// 安全验证: 确保 hwnd 是有效的整数
function validateHwnd(hwnd: number): boolean {
  return Number.isInteger(hwnd) && hwnd > 0 && hwnd <= Number.MAX_SAFE_INTEGER
}

// 安全验证: 确保 pid 是有效的进程 ID
function validatePid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0 && pid <= 65535 * 1024 // Windows max PID
}

// 安全验证: 确保窗口坐标在合理范围内
function validateWindowRect(x: number, y: number, width: number, height: number): boolean {
  const MAX_COORD = 32767 // Windows screen coordinate limit
  return (
    Number.isInteger(x) && x >= -MAX_COORD && x <= MAX_COORD &&
    Number.isInteger(y) && y >= -MAX_COORD && y <= MAX_COORD &&
    Number.isInteger(width) && width >= 0 && width <= MAX_COORD &&
    Number.isInteger(height) && height >= 0 && height <= MAX_COORD
  )
}

function normalizeExternalWindowTitle(title: string): string | null {
  const withoutControlChars = Array.from(title, char => {
    const code = char.charCodeAt(0)
    return code <= 0x1F || code === 0x7F ? ' ' : char
  }).join('')
  const normalized = withoutControlChars.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length > 200) return null
  return normalized
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''")
}
interface WindowLayoutData {
  layouts: WindowLayout[]
  groups: WindowGroup[]
  layoutSnapshots: WindowLayoutSnapshot[]
  restorePoints: WindowLayoutSnapshot[]
  lastRestorePointId?: string
  favorites: WindowFavoriteRecord[]
}

const layoutSchema = {
  layouts: {
    type: 'array' as const,
    default: []
  },
  groups: {
    type: 'array' as const,
    default: []
  },
  layoutSnapshots: {
    type: 'array' as const,
    default: []
  },
  restorePoints: {
    type: 'array' as const,
    default: []
  },
  lastRestorePointId: {
    type: 'string' as const
  },
  favorites: {
    type: 'array' as const,
    default: []
  }
}

export class WindowManager {
  private windows = new Map<number, WindowInfo>()
  private groups = new Map<string, WindowGroup>()
  private layouts: WindowLayout[] = []
  private layoutSnapshots: WindowLayoutSnapshot[] = []
  private restorePoints: WindowLayoutSnapshot[] = []
  private lastRestorePointId: string | null = null
  private favorites = new Map<string, WindowFavoriteRecord>()
  private store: Store<WindowLayoutData>
  private saveTimeout: NodeJS.Timeout | null = null
  private readonly powerShellGateway: PowerShellGateway
  private readonly win32WindowEnumerator: Win32WindowEnumeratorLike

  // WindowHelper C# 类型定义 — 每次 PowerShell 调用都需要内联（因为每次都是新进程）
  // 使用单行 here-string 避免换行符在 Windows 上的问题
  // Focus 使用 AttachThreadInput + BringWindowToTop + SetForegroundWindow 组合策略
  // 带有 keybd_event Alt 模拟重试机制
  // ***C# 5 兼容***: 所有 `out _` 已替换为显式变量 `out uint dummy`
  private static readonly HELPER_ADD_TYPE = `Add-Type @"
using System; using System.Runtime.InteropServices; public class WindowHelper { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int W, int H, bool repaint); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach); [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId(); [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags); [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags); [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex); [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong); [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool SetWindowText(IntPtr hWnd, string lpString); [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd); private const int SW_RESTORE = 9; private const int SW_MINIMIZE = 6; private const int SW_MAXIMIZE = 3; private const int SW_SHOW = 5; private const byte VK_MENU = 0x12; private const uint KEYEVENTF_EXTENDEDKEY = 0x0001; private const uint KEYEVENTF_KEYUP = 0x0002; private const uint WM_CHAR = 0x0102; private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1); private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2); private const uint SWP_NOMOVE = 0x0002; private const uint SWP_NOSIZE = 0x0001; private const int GWL_EXSTYLE = -20; private const int WS_EX_LAYERED = 0x80000; private const uint LWA_ALPHA = 0x02; public static void Focus(IntPtr h) { if(IsIconic(h)) ShowWindow(h, SW_RESTORE); IntPtr fg = GetForegroundWindow(); if(fg == h) return; uint pid1; uint targetThread = GetWindowThreadProcessId(h, out pid1); uint pid2; uint fgThread = (fg != IntPtr.Zero) ? GetWindowThreadProcessId(fg, out pid2) : 0; bool attached = false; try { if(fgThread != 0 && targetThread != fgThread) { attached = AttachThreadInput(fgThread, targetThread, true); } BringWindowToTop(h); SetForegroundWindow(h); } finally { if(attached) AttachThreadInput(fgThread, targetThread, false); } if(GetForegroundWindow() != h) { keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero); keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero); SetForegroundWindow(h); } } public static void Move(IntPtr h,int x,int y,int w,int ht) { MoveWindow(h,x,y,w,ht,true); } public static void Minimize(IntPtr h) { ShowWindow(h,SW_MINIMIZE); } public static void Maximize(IntPtr h) { ShowWindow(h,SW_MAXIMIZE); } public static void Restore(IntPtr h) { ShowWindow(h,SW_RESTORE); } public static void Close(IntPtr h) { PostMessage(h,0x0010,IntPtr.Zero,IntPtr.Zero); } public static void SetTopmost(IntPtr h, bool topmost) { SetWindowPos(h, topmost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE); } public static void SetOpacity(IntPtr h, byte alpha) { int exStyle = GetWindowLong(h, GWL_EXSTYLE); SetWindowLong(h, GWL_EXSTYLE, exStyle | WS_EX_LAYERED); SetLayeredWindowAttributes(h, 0, alpha, LWA_ALPHA); } public static void SetTitle(IntPtr h, string title) { if(!IsWindow(h)) throw new InvalidOperationException("WINDOW_SET_TITLE_WINDOW_NOT_FOUND"); if(!SetWindowText(h, title)) throw new InvalidOperationException("WINDOW_SET_TITLE_WIN32_ERROR:" + Marshal.GetLastWin32Error()); } public static void SendText(IntPtr h, string text) { if(!IsWindow(h)) throw new InvalidOperationException("WINDOW_SEND_TEXT_WINDOW_NOT_FOUND"); foreach(char c in text) { if(c == '\\r') continue; int code = (c == '\\n') ? 13 : (int)c; if(!PostMessage(h, WM_CHAR, new IntPtr(code), IntPtr.Zero)) throw new InvalidOperationException("WINDOW_SEND_TEXT_WIN32_ERROR:" + Marshal.GetLastWin32Error()); System.Threading.Thread.Sleep(2); } } }
"@`

  private static readonly HELPER_SEND_INPUT = `Add-Type @"
using System; using System.Runtime.InteropServices;
public class TextInputHelper {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public int type; public InputUnion U; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  private const int INPUT_KEYBOARD = 1;
  private const uint KEYEVENTF_KEYUP = 0x0002;
  private const uint KEYEVENTF_UNICODE = 0x0004;
  public static void SendUnicode(string text) {
    foreach(char c in text) {
      INPUT down = new INPUT();
      down.type = INPUT_KEYBOARD;
      down.U.ki.wVk = 0;
      down.U.ki.wScan = c;
      down.U.ki.dwFlags = KEYEVENTF_UNICODE;
      INPUT up = new INPUT();
      up.type = INPUT_KEYBOARD;
      up.U.ki.wVk = 0;
      up.U.ki.wScan = c;
      up.U.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
      INPUT[] inputs = new INPUT[] { down, up };
      uint sent = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
      if(sent != 2) throw new InvalidOperationException("WINDOW_SEND_INPUT_WIN32_ERROR:" + Marshal.GetLastWin32Error());
      System.Threading.Thread.Sleep(2);
    }
  }
}
"@`

  // scanWindows 用的 C# 代码块（缓存避免源码重复；PowerShell 每次仍是新进程）
  private static readonly HELPER_WINDOW_ENUMERATOR = `Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class WindowEnumerator {
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
  [DllImport("user32.dll")] private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  public static string GetWindows() {
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    var result = new List<string>();
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      int length = GetWindowTextLength(hWnd);
      if (length == 0) return true;
      StringBuilder title = new StringBuilder(length + 1);
      GetWindowText(hWnd, title, title.Capacity);
      StringBuilder className = new StringBuilder(256);
      GetClassName(hWnd, className, className.Capacity);
      RECT rect; GetWindowRect(hWnd, out rect);
      uint pid; GetWindowThreadProcessId(hWnd, out pid);
      bool isMinimized = IsIconic(hWnd);
      result.Add(string.Format("{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}",
        hWnd.ToInt64(),
        title.ToString().Replace("|", " "),
        className.ToString(),
        pid, rect.Left, rect.Top,
        rect.Right - rect.Left,
        rect.Bottom - rect.Top,
        isMinimized ? 1 : 0));
      return true;
    }, IntPtr.Zero);
    return string.Join("\\n", result);
  }
}
"@`

  constructor(
    powerShellGateway: PowerShellGateway = getPowerShellGateway(),
    win32WindowEnumerator: Win32WindowEnumeratorLike = new Win32WindowEnumerator()
  ) {
    this.powerShellGateway = powerShellGateway
    this.win32WindowEnumerator = win32WindowEnumerator
    this.store = new Store<WindowLayoutData>({
      name: 'devhub-window-layouts',
      schema: layoutSchema
    })
    this.loadFromDisk()
  }

  private executePowerShell<T = string>(
    script: string,
    options: {
      label: string
      maxBuffer?: number
      parser?: (stdout: string) => T
      timeoutMs?: number
    }
  ): Promise<T> {
    return this.powerShellGateway.execute(script, {
      encoding: 'utf8',
      executionPolicyBypass: true,
      killOnTimeout: true,
      label: `window-manager:${options.label}`,
      maxBuffer: options.maxBuffer,
      nonInteractive: false,
      parser: options.parser,
      timeoutMs: options.timeoutMs ?? 15000,
      windowsHide: true
    })
  }

  private executeWindowHelper<T = string>(
    helperCommand: string,
    options: {
      label: string
      maxBuffer?: number
      parser?: (stdout: string) => T
      timeoutMs?: number
    }
  ): Promise<T> {
    const script = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; ${helperCommand}`
    return this.executePowerShell(script, options)
  }

  private static normalizeFingerprintValue(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase()
  }

  private createWindowFingerprint(windowInfo: WindowInfo, existingHashes = new Set<string>()): WindowFingerprint {
    const normalizedTitle = normalizeExternalWindowTitle(windowInfo.title) ?? windowInfo.title.trim()
    const titleValue = normalizedTitle.slice(0, 96)
    const classNameHint = windowInfo.className?.trim() || undefined
    const processName = windowInfo.processName || `PID:${windowInfo.pid}`
    const titlePattern = {
      kind: 'prefix' as const,
      value: titleValue
    }
    const hashBase = {
      processName: WindowManager.normalizeFingerprintValue(processName),
      titlePattern: {
        kind: titlePattern.kind,
        value: WindowManager.normalizeFingerprintValue(titlePattern.value)
      },
      classNameHint: classNameHint ? WindowManager.normalizeFingerprintValue(classNameHint) : ''
    }
    const baseHash = createHash('sha1').update(JSON.stringify(hashBase)).digest('hex').slice(0, 16)
    const hashKey = existingHashes.has(baseHash) ? `${baseHash}-${windowInfo.hwnd}` : baseHash
    existingHashes.add(hashKey)

    return {
      processName,
      titlePattern,
      classNameHint,
      hashKey,
      createdAt: Date.now()
    }
  }

  private ensureGroupFingerprints(group: WindowGroup): WindowFingerprint[] {
    const persisted = group.memberFingerprints?.filter(fp => fp.hashKey && fp.processName) ?? []
    if (persisted.length > 0) return persisted

    const hashes = new Set<string>()
    const fingerprints = group.windows.map(windowInfo => this.createWindowFingerprint(windowInfo, hashes))
    group.memberFingerprints = fingerprints
    return fingerprints
  }

  private scoreFingerprintMatch(fingerprint: WindowFingerprint, windowInfo: WindowInfo): number | null {
    const expectedProcess = WindowManager.normalizeFingerprintValue(fingerprint.processName)
    const actualProcess = WindowManager.normalizeFingerprintValue(windowInfo.processName)
    if (expectedProcess !== actualProcess) return null

    let score = 0.45
    const expectedClass = fingerprint.classNameHint ? WindowManager.normalizeFingerprintValue(fingerprint.classNameHint) : ''
    const actualClass = WindowManager.normalizeFingerprintValue(windowInfo.className)
    if (expectedClass && expectedClass === actualClass) {
      score += 0.20
    } else if (!expectedClass) {
      score += 0.05
    }

    const normalizedTitle = normalizeExternalWindowTitle(windowInfo.title) ?? windowInfo.title
    const actualTitle = WindowManager.normalizeFingerprintValue(normalizedTitle)
    const expectedTitle = WindowManager.normalizeFingerprintValue(fingerprint.titlePattern.value)
    if (!expectedTitle) return score

    if (fingerprint.titlePattern.kind === 'exact' && actualTitle === expectedTitle) {
      score += 0.30
    } else if (fingerprint.titlePattern.kind === 'prefix' && actualTitle.startsWith(expectedTitle)) {
      score += 0.30
    } else if (fingerprint.titlePattern.kind === 'regex') {
      try {
        if (new RegExp(fingerprint.titlePattern.value, 'i').test(windowInfo.title)) score += 0.30
      } catch {
        return score
      }
    } else if (actualTitle.includes(expectedTitle.slice(0, 32))) {
      score += 0.15
    }

    return Math.min(score, 0.95)
  }

  private resolveGroup(group: WindowGroup): WindowGroup {
    const fingerprints = this.ensureGroupFingerprints(group)
    const matchedHwnds = new Set<number>()
    const resolvedWindows: WindowInfo[] = []
    const resolvedMembership: WindowGroupMembership[] = []
    const report: HwndResolutionReport = {
      groupId: group.id,
      resolvedAt: Date.now(),
      matched: [],
      unmatched: [],
      ambiguous: []
    }

    for (const fingerprint of fingerprints) {
      const candidates = Array.from(this.windows.values())
        .filter(windowInfo => !matchedHwnds.has(windowInfo.hwnd))
        .map(windowInfo => ({ windowInfo, score: this.scoreFingerprintMatch(fingerprint, windowInfo) }))
        .filter((candidate): candidate is { windowInfo: WindowInfo; score: number } =>
          candidate.score !== null && candidate.score >= 0.60
        )
        .sort((a, b) => b.score - a.score)

      if (candidates.length === 0) {
        report.unmatched.push(fingerprint.hashKey)
        continue
      }

      const bestScore = candidates[0].score
      const topCandidates = candidates.filter(candidate => Math.abs(candidate.score - bestScore) < 0.001)
      if (topCandidates.length > 1) {
        report.ambiguous.push({
          fingerprintHash: fingerprint.hashKey,
          candidates: topCandidates.map(candidate => candidate.windowInfo.hwnd)
        })
      }

      const chosen = candidates[0]
      matchedHwnds.add(chosen.windowInfo.hwnd)
      resolvedWindows.push(chosen.windowInfo)
      resolvedMembership.push({
        groupId: group.id,
        hwnd: chosen.windowInfo.hwnd,
        resolvedFromFingerprintHash: fingerprint.hashKey,
        lastResolvedAt: report.resolvedAt,
        confidence: chosen.score
      })
      report.matched.push({
        fingerprintHash: fingerprint.hashKey,
        hwnd: chosen.windowInfo.hwnd,
        confidence: chosen.score
      })
    }

    return {
      ...group,
      windows: resolvedWindows,
      memberFingerprints: fingerprints,
      resolvedMembership,
      resolutionReport: report
    }
  }

  private async getResolvedGroupForAction(groupId: string): Promise<WindowGroup | null> {
    const group = this.groups.get(groupId)
    if (!group) return null
    if (this.windows.size === 0) {
      await this.scanWindows()
    }
    return this.resolveGroup(group)
  }

  private cloneRect(rect: WindowInfo['rect']): WindowInfo['rect'] {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }

  private hydrateSnapshot(snapshot: WindowLayoutSnapshot, restorePoint: boolean): WindowLayoutSnapshot {
    const createdAt = typeof snapshot.createdAt === 'number' ? snapshot.createdAt : new Date(snapshot.createdAt).getTime()
    const updatedAt = typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : new Date(snapshot.updatedAt).getTime()
    return {
      ...snapshot,
      createdAt,
      updatedAt,
      restorePoint,
      items: Array.isArray(snapshot.items)
        ? snapshot.items.map((item, index) => ({
          ...item,
          fingerprintHash: item.fingerprintHash || item.windowFingerprint?.hashKey || `${snapshot.id}_${index}`,
          rect: this.cloneRect(item.rect),
          zOrderIdx: typeof item.zOrderIdx === 'number' ? item.zOrderIdx : index,
          state: item.state ?? 'normal'
        }))
        : []
    }
  }

  private createSnapshotFromWindows(
    name: string,
    description: string | undefined,
    windows: WindowInfo[],
    restorePoint: boolean,
    monitorId?: number
  ): WindowLayoutSnapshot {
    const now = Date.now()
    const hashes = new Set<string>()
    const items: WindowLayoutSnapshotItem[] = windows.map((windowInfo, index) => {
      const fingerprint = this.createWindowFingerprint(windowInfo, hashes)
      return {
        fingerprintHash: fingerprint.hashKey,
        windowFingerprint: fingerprint,
        hwnd: windowInfo.hwnd,
        processName: windowInfo.processName,
        titlePattern: windowInfo.title,
        className: windowInfo.className || undefined,
        rect: this.cloneRect(windowInfo.rect),
        zOrderIdx: index,
        state: windowInfo.isMinimized ? 'minimized' : 'normal'
      }
    })

    return {
      id: `${restorePoint ? 'restore' : 'snapshot'}_${now}_${randomUUID().slice(0, 8)}`,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      monitorId,
      items,
      restorePoint
    }
  }

  private saveRestorePointFromWindows(windows: WindowInfo[], monitorId?: number): string | undefined {
    if (windows.length === 0) return undefined
    const restorePoint = this.createSnapshotFromWindows('恢复点', '自动保存的布局应用前位置', windows, true, monitorId)
    this.restorePoints = [restorePoint, ...this.restorePoints]
      .filter((snapshot, index, snapshots) => snapshots.findIndex(candidate => candidate.id === snapshot.id) === index)
      .slice(0, 20)
    this.lastRestorePointId = restorePoint.id
    this.scheduleSave()
    return restorePoint.id
  }

  private scoreSnapshotItemMatch(item: WindowLayoutSnapshotItem, windowInfo: WindowInfo): number | null {
    if (item.windowFingerprint) {
      return this.scoreFingerprintMatch(item.windowFingerprint, windowInfo)
    }

    if (WindowManager.normalizeFingerprintValue(item.processName) !== WindowManager.normalizeFingerprintValue(windowInfo.processName)) {
      return null
    }

    let score = 0.45
    if (item.className && WindowManager.normalizeFingerprintValue(item.className) === WindowManager.normalizeFingerprintValue(windowInfo.className)) {
      score += 0.20
    }

    const expectedTitle = WindowManager.normalizeFingerprintValue(item.titlePattern)
    const actualTitle = WindowManager.normalizeFingerprintValue(normalizeExternalWindowTitle(windowInfo.title) ?? windowInfo.title)
    if (expectedTitle && (actualTitle.startsWith(expectedTitle.slice(0, 96)) || actualTitle.includes(expectedTitle.slice(0, 32)))) {
      score += 0.30
    }

    return Math.min(score, 0.95)
  }

  private resolveSnapshotTargets(snapshot: WindowLayoutSnapshot, currentWindows: WindowInfo[]): Array<{ hwnd: number; rect: WindowInfo['rect'] }> {
    const matchedHwnds = new Set<number>()
    const targets: Array<{ hwnd: number; rect: WindowInfo['rect'] }> = []

    for (const item of snapshot.items) {
      const candidates = currentWindows
        .filter(windowInfo => !matchedHwnds.has(windowInfo.hwnd))
        .map(windowInfo => ({ windowInfo, score: this.scoreSnapshotItemMatch(item, windowInfo) }))
        .filter((candidate): candidate is { windowInfo: WindowInfo; score: number } =>
          candidate.score !== null && candidate.score >= 0.60
        )
        .sort((a, b) => b.score - a.score)

      const chosen = candidates[0]
      if (!chosen) continue
      matchedHwnds.add(chosen.windowInfo.hwnd)
      targets.push({ hwnd: chosen.windowInfo.hwnd, rect: this.cloneRect(item.rect) })
    }

    return targets
  }

  private getMonitorRect(monitorId?: number): WindowInfo['rect'] | null {
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const display = monitorId === undefined
      ? primaryDisplay
      : displays.find(candidate => candidate.id === monitorId) ?? null
    if (!display) return null
    return {
      x: display.workArea.x,
      y: display.workArea.y,
      width: display.workArea.width,
      height: display.workArea.height
    }
  }

  private calculateLayoutRects(preset: TilePreset, count: number, monitorId?: number): WindowInfo['rect'][] {
    if (count <= 0) return []
    const monitor = this.getMonitorRect(monitorId)
    if (!monitor) return []

    if (preset === 'cascade') {
      const width = Math.floor(monitor.width * 0.6)
      const height = Math.floor(monitor.height * 0.6)
      return Array.from({ length: count }, (_, index) => ({
        x: monitor.x + index * 30,
        y: monitor.y + index * 30,
        width,
        height
      }))
    }

    if (preset === 'stack-center') {
      const width = Math.floor(monitor.width * 0.65)
      const height = Math.floor(monitor.height * 0.65)
      const x = monitor.x + Math.floor((monitor.width - width) / 2)
      const y = monitor.y + Math.floor((monitor.height - height) / 2)
      return Array.from({ length: count }, () => ({ x, y, width, height }))
    }

    const gridByPreset: Record<TilePreset, { cols: number; rows: number } | null> = {
      'tile-2x2': { cols: 2, rows: 2 },
      'tile-3x3': { cols: 3, rows: 3 },
      'tile-3x2': { cols: 3, rows: 2 },
      'tile-horizontal': { cols: count, rows: 1 },
      'tile-vertical': { cols: 1, rows: count },
      'tile-auto': null,
      cascade: null,
      'stack-center': null
    }
    const grid = gridByPreset[preset]
    const cols = grid?.cols ?? Math.ceil(Math.sqrt(count))
    const rows = grid?.rows ?? Math.ceil(count / cols)
    const cellWidth = Math.floor(monitor.width / cols)
    const cellHeight = Math.floor(monitor.height / rows)

    return Array.from({ length: count }, (_, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      return {
        x: monitor.x + col * cellWidth,
        y: monitor.y + row * cellHeight,
        width: cellWidth,
        height: cellHeight
      }
    })
  }

  private toApplyResultError(error: LayoutErrorCode, message?: string): ApplyLayoutResult {
    return { ok: false, applied: [], failed: [{ hwnd: 0, error, message }] }
  }

  private loadFromDisk(): void {
    try {
      const savedLayouts = this.store.get('layouts', [])
      this.layouts = savedLayouts.map(l => ({
        ...l,
        createdAt: typeof l.createdAt === 'number' ? l.createdAt : new Date(l.createdAt).getTime(),
        updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : new Date(l.updatedAt).getTime()
      }))

      const savedSnapshots = this.store.get('layoutSnapshots', [])
      this.layoutSnapshots = savedSnapshots.map(snapshot => this.hydrateSnapshot(snapshot, false))
      const savedRestorePoints = this.store.get('restorePoints', [])
      this.restorePoints = savedRestorePoints.map(snapshot => this.hydrateSnapshot(snapshot, true))
      const savedRestorePointId = this.store.get('lastRestorePointId', '')
      this.lastRestorePointId = savedRestorePointId || null

      const savedGroups = this.store.get('groups', [])
      for (const group of savedGroups) {
        const createdAt = typeof group.createdAt === 'number' ? group.createdAt : new Date(group.createdAt).getTime()
        const updatedAt = typeof group.updatedAt === 'number'
          ? group.updatedAt
          : group.updatedAt
            ? new Date(group.updatedAt).getTime()
            : createdAt
        const hydratedGroup: WindowGroup = {
          ...group,
          windows: Array.isArray(group.windows) ? group.windows : [],
          createdAt,
          updatedAt,
          colorTag: group.colorTag ?? 'blue',
          kind: group.kind ?? 'user'
        }
        this.ensureGroupFingerprints(hydratedGroup)
        this.groups.set(hydratedGroup.id, hydratedGroup)
      }

      const savedFavorites = this.store.get('favorites', [])
      this.favorites.clear()
      for (const favorite of savedFavorites) {
        if (!favorite?.fingerprintHash || !favorite?.id) continue
        this.favorites.set(favorite.fingerprintHash, {
          ...favorite,
          createdAt: typeof favorite.createdAt === 'number' ? favorite.createdAt : new Date(favorite.createdAt).getTime(),
          updatedAt: typeof favorite.updatedAt === 'number' ? favorite.updatedAt : new Date(favorite.updatedAt).getTime()
        })
      }
    } catch (error) {
      console.error('Failed to load window layouts:', error)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk()
    }, 500)
  }

  private saveToDisk(): void {
    try {
      this.store.set('layouts', this.layouts)
      this.store.set('groups', Array.from(this.groups.values()))
      this.store.set('layoutSnapshots', this.layoutSnapshots)
      this.store.set('restorePoints', this.restorePoints)
      if (this.lastRestorePointId) {
        this.store.set('lastRestorePointId', this.lastRestorePointId)
      }
      this.store.set('favorites', Array.from(this.favorites.values()))
    } catch (error) {
      console.error('Failed to save window layouts:', error)
    }
  }

  async scanWindows(includeSystemWindows = false): Promise<ServiceResult<WindowInfo[]>> {
    try {
      let parsedWindows: NativeWindowSnapshot[] | null = null

      if (process.platform === 'win32') {
        const nativeScan = await this.win32WindowEnumerator.enumerateVisibleWindows()
        if (nativeScan.success && nativeScan.data) {
          parsedWindows = nativeScan.data
        } else if (nativeScan.error && nativeScan.error !== 'WIN32_NATIVE_UNSUPPORTED_PLATFORM') {
          console.warn('scanWindows: native Koffi EnumWindows unavailable, falling back to PowerShell:', nativeScan.error)
        }
      }

      if (parsedWindows === null) {
        // 端到端 UTF-8 编码链路：PowerShell $OutputEncoding + [Console]::OutputEncoding + C# Console.OutputEncoding
        // 使用管道分隔文本格式（避免 JSON 转义在多层嵌入中的复杂性）
        const script = `$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${WindowManager.HELPER_WINDOW_ENUMERATOR}
[WindowEnumerator]::GetWindows()`

        const stdout = await this.executePowerShell(script, {
          label: 'scan-windows',
          maxBuffer: 10 * 1024 * 1024
        })

        parsedWindows = this.parsePowerShellWindowRows(stdout)
      }

      const windows: WindowInfo[] = []
      this.windows.clear()

      // 第一遍：收集唯一 PID
      const uniquePids = new Set<number>()
      for (const parsedWindow of parsedWindows) {
        uniquePids.add(parsedWindow.pid)
      }

      // 一次性批量获取所有 PID 的进程名
      const pidNameMap = await this.batchGetProcessNames([...uniquePids])

      // 第二遍：构建 WindowInfo 对象（含系统窗口标记与过滤）
      for (const pw of parsedWindows) {
        const isSystem = SYSTEM_WINDOW_CLASSNAMES.has(pw.className)

        // 后端默认过滤系统窗口（减少数据传输量）
        if (!includeSystemWindows && isSystem) continue

        const windowInfo: WindowInfo = {
          hwnd: pw.hwnd,
          title: pw.title,
          processName: pidNameMap.get(pw.pid) || `PID:${pw.pid}`,
          pid: pw.pid,
          className: pw.className,
          rect: { x: pw.x, y: pw.y, width: pw.width, height: pw.height },
          isVisible: true,
          isMinimized: pw.isMinimized,
          isSystemWindow: isSystem
        }

        this.windows.set(pw.hwnd, windowInfo)
        windows.push(windowInfo)
      }

      return { success: true, data: windows }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to scan windows:', error)
      return { success: false, data: [], error: errorMsg }
    }
  }

  private parsePowerShellWindowRows(stdout: string): NativeWindowSnapshot[] {
    const parsedWindows: NativeWindowSnapshot[] = []
    const lines = stdout.trim().split('\n').filter(line => line.trim())

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 9) continue

      const [hwndStr, title, className, pidStr, xStr, yStr, widthStr, heightStr, minimizedStr] = parts
      const hwnd = parseInt(hwndStr, 10)
      const pid = parseInt(pidStr, 10)

      if (isNaN(hwnd) || isNaN(pid)) continue

      parsedWindows.push({
        hwnd,
        title: title.trim(),
        className: className.trim(),
        pid,
        x: parseInt(xStr, 10) || 0,
        y: parseInt(yStr, 10) || 0,
        width: parseInt(widthStr, 10) || 0,
        height: parseInt(heightStr, 10) || 0,
        isMinimized: minimizedStr.trim() === '1'
      })
    }

    return parsedWindows
  }

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const safeHwnd = Math.floor(Number(hwnd))
    try {
      await this.executeWindowHelper(`[WindowHelper]::Focus([IntPtr]${safeHwnd})`, {
        label: 'focus-window'
      })
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.warn('focusWindow: primary method failed, trying fallback:', errorMsg)
      // Fallback: 使用纯 PowerShell 调用（不依赖 C# Add-Type 编译），覆盖 Add-Type 编译失败的场景
      try {
        const fallbackCmd = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);' -Name FocusFallback -Namespace Win32; if([Win32.FocusFallback]::IsIconic([IntPtr]${safeHwnd})){[Win32.FocusFallback]::ShowWindow([IntPtr]${safeHwnd},9)}; [Win32.FocusFallback]::SetForegroundWindow([IntPtr]${safeHwnd})`
        await this.executePowerShell(fallbackCmd, {
          label: 'focus-window-fallback'
        })
        return { success: true }
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        console.error('focusWindow: fallback also failed:', fallbackMsg)
        return { success: false, error: `Primary: ${errorMsg}; Fallback: ${fallbackMsg}` }
      }
    }
  }

  async focusWindows(hwnds: readonly number[], intervalMs = 150): Promise<WindowFocusBatchResult[]> {
    const validHwnds: number[] = []
    const invalidResults = new Map<number, ServiceResult>()

    for (const hwnd of hwnds) {
      if (!validateHwnd(hwnd)) {
        invalidResults.set(hwnd, { success: false, error: `Invalid hwnd: ${hwnd}` })
        continue
      }
      validHwnds.push(Math.floor(Number(hwnd)))
    }

    if (validHwnds.length === 0) {
      return hwnds.map(hwnd => ({
        hwnd,
        result: invalidResults.get(hwnd) ?? { success: false, error: `Invalid hwnd: ${hwnd}` }
      }))
    }

    const safeIntervalMs = Math.max(0, Math.min(1000, Math.floor(intervalMs)))
    const script = [
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      WindowManager.HELPER_ADD_TYPE,
      `$hwnds = @(${validHwnds.join(',')})`,
      `foreach($hwnd in $hwnds){ try { [WindowHelper]::Focus([IntPtr]$hwnd); Write-Output "$hwnd|ok"; Start-Sleep -Milliseconds ${safeIntervalMs} } catch { $message = ($_.Exception.Message -replace '[\\r\\n|]+',' '); Write-Output "$hwnd|failed|$message" } }`
    ].join('; ')

    const stdout = await this.executePowerShell(script, {
      label: 'focus-windows',
      timeoutMs: Math.max(15000, validHwnds.length * Math.max(1000, safeIntervalMs + 500))
    })

    const resultByHwnd = new Map<number, ServiceResult>()
    for (const line of stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
      const [hwndRaw, status, ...messageParts] = line.split('|')
      const hwnd = Number.parseInt(hwndRaw, 10)
      if (!validateHwnd(hwnd)) continue
      if (status === 'ok') {
        resultByHwnd.set(hwnd, { success: true })
      } else {
        resultByHwnd.set(hwnd, { success: false, error: messageParts.join('|') || 'focus failed' })
      }
    }

    return hwnds.map(hwnd => {
      const invalid = invalidResults.get(hwnd)
      if (invalid) return { hwnd, result: invalid }
      const safeHwnd = Math.floor(Number(hwnd))
      return {
        hwnd,
        result: resultByHwnd.get(safeHwnd) ?? { success: false, error: 'focus batch did not return a result' }
      }
    })
  }

  async focusWindowGroup(groupId: string): Promise<ServiceResult> {
    const group = await this.getResolvedGroupForAction(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }
    if (group.windows.length === 0) {
      return { success: false, error: 'No live windows resolved for group' }
    }

    for (const window of group.windows) {
      await this.focusWindow(window.hwnd)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return { success: true }
  }

  async moveWindow(hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }
    if (!validateWindowRect(x, y, width, height)) {
      return { success: false, error: `Invalid window rect: x=${x}, y=${y}, width=${width}, height=${height}` }
    }

    try {
      const safeHwnd = Math.floor(Number(hwnd))
      const safeX = Math.floor(Number(x))
      const safeY = Math.floor(Number(y))
      const safeWidth = Math.floor(Number(width))
      const safeHeight = Math.floor(Number(height))
      await this.executeWindowHelper(
        `$hwnd = [IntPtr]${safeHwnd}; if([WindowHelper]::IsIconic($hwnd)){[WindowHelper]::ShowWindow($hwnd,9)}; $ok = [WindowHelper]::SetWindowPos($hwnd,[IntPtr]::Zero,${safeX},${safeY},${safeWidth},${safeHeight},0x0040); if(-not $ok){ throw 'WIN32_SETPOS_FAILED' }`,
        { label: 'set-window-pos' }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('moveWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async minimizeWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    try {
      await this.executeWindowHelper(`[WindowHelper]::Minimize([IntPtr]${Math.floor(Number(hwnd))})`, {
        label: 'minimize-window'
      })
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('minimizeWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async maximizeWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    try {
      await this.executeWindowHelper(`[WindowHelper]::Maximize([IntPtr]${Math.floor(Number(hwnd))})`, {
        label: 'maximize-window'
      })
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('maximizeWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async closeWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    try {
      await this.executeWindowHelper(`[WindowHelper]::Close([IntPtr]${Math.floor(Number(hwnd))})`, {
        label: 'close-window'
      })
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('closeWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  createGroup(name: string, windowHwnds: number[], projectId?: string): WindowGroup {
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new Error('GROUP_NAME_EMPTY')
    }
    if (Array.from(this.groups.values()).some(group => group.name === normalizedName)) {
      throw new Error('GROUP_NAME_DUPLICATE')
    }

    const windows = windowHwnds
      .map(hwnd => this.windows.get(hwnd))
      .filter((w): w is WindowInfo => w !== undefined)

    if (windows.length === 0) {
      throw new Error('HWND_NOT_FOUND')
    }
    if (windows.length > 50) {
      throw new Error('GROUP_MEMBER_LIMIT_EXCEEDED')
    }

    const hashes = new Set<string>()
    const now = Date.now()
    const group: WindowGroup = {
      id: `group_${now}_${randomUUID().slice(0, 8)}`,
      name: normalizedName,
      projectId,
      windows,
      createdAt: now,
      updatedAt: now,
      colorTag: 'blue',
      kind: 'user',
      memberFingerprints: windows.map(windowInfo => this.createWindowFingerprint(windowInfo, hashes))
    }

    this.groups.set(group.id, group)
    this.scheduleSave()
    return this.resolveGroup(group)
  }

  getGroups(): WindowGroup[] {
    return Array.from(this.groups.values()).map(group => this.resolveGroup(group))
  }

  renameGroup(groupId: string, newName: string): ServiceResult {
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

    const normalizedName = newName.trim()
    if (!normalizedName) return { success: false, error: 'GROUP_NAME_EMPTY' }
    const duplicate = Array.from(this.groups.values()).some(candidate =>
      candidate.id !== groupId && candidate.name === normalizedName
    )
    if (duplicate) return { success: false, error: 'GROUP_NAME_DUPLICATE' }

    group.name = normalizedName
    group.updatedAt = Date.now()
    this.scheduleSave()
    return { success: true }
  }

  removeGroup(groupId: string): boolean {
    const result = this.groups.delete(groupId)
    if (result) {
      this.scheduleSave()
    }
    return result
  }

  async applyLayout(intent: ApplyLayoutIntent): Promise<ApplyLayoutResult> {
    if (intent.snapshotId) {
      return this.restoreSnapshot(intent.snapshotId, intent.saveRestorePoint !== false)
    }

    const scanResult = await this.scanWindows()
    const currentWindows = scanResult.data ?? Array.from(this.windows.values())
    const currentByHwnd = new Map(currentWindows.map(windowInfo => [windowInfo.hwnd, windowInfo]))
    const failed: ApplyLayoutResult['failed'] = []
    let targets: Array<{ hwnd: number; rect: WindowInfo['rect'] }> = []

    if (intent.customRects && intent.customRects.length > 0) {
      targets = intent.customRects.map(target => ({ hwnd: target.hwnd, rect: this.cloneRect(target.rect) }))
    } else {
      if (!intent.preset || !intent.hwnds || intent.hwnds.length === 0) {
        return this.toApplyResultError('PRESET_REQUIRES_HWNDS', 'Preset layout requires at least one hwnd')
      }
      const validHwnds = intent.hwnds.filter(validateHwnd)
      if (validHwnds.length === 0) {
        return this.toApplyResultError('PRESET_REQUIRES_HWNDS', 'No valid hwnds were provided')
      }
      const rects = this.calculateLayoutRects(intent.preset, validHwnds.length, intent.monitorId)
      if (rects.length === 0) {
        return this.toApplyResultError('MONITOR_OUT_OF_RANGE', `Monitor not found: ${intent.monitorId}`)
      }
      targets = validHwnds.map((hwnd, index) => ({ hwnd, rect: rects[index] }))
    }

    const windowsToMove = targets
      .map(target => currentByHwnd.get(target.hwnd))
      .filter((windowInfo): windowInfo is WindowInfo => Boolean(windowInfo))
    const restorePointId = intent.saveRestorePoint === false
      ? undefined
      : this.saveRestorePointFromWindows(windowsToMove, intent.monitorId)

    const applied: ApplyLayoutResult['applied'] = []
    for (const target of targets) {
      const previous = currentByHwnd.get(target.hwnd)
      if (!previous) {
        failed.push({ hwnd: target.hwnd, error: 'WINDOW_NOT_FOUND', message: `Window not found: ${target.hwnd}` })
        continue
      }

      if (previous.isMinimized) {
        await this.restoreWindow(target.hwnd)
      }

      const moveResult = await this.moveWindow(target.hwnd, target.rect.x, target.rect.y, target.rect.width, target.rect.height)
      if (!moveResult.success) {
        failed.push({ hwnd: target.hwnd, error: 'WIN32_SETPOS_FAILED', message: moveResult.error })
        continue
      }

      applied.push({ hwnd: target.hwnd, prevRect: this.cloneRect(previous.rect), newRect: this.cloneRect(target.rect) })
    }

    return {
      ok: applied.length > 0 && failed.length === 0,
      applied,
      failed,
      restorePointId
    }
  }

  async saveSnapshot(name: string, description: string | undefined, hwnds: number[], monitorId?: number): Promise<ServiceResult<WindowLayoutSnapshot>> {
    const trimmedName = name.trim()
    if (!trimmedName) return { success: false, error: 'SNAPSHOT_NAME_EMPTY' }

    const scanResult = await this.scanWindows()
    const currentWindows = scanResult.data ?? Array.from(this.windows.values())
    const requested = new Set(hwnds.filter(validateHwnd))
    const windowsToSave = currentWindows.filter(windowInfo => requested.has(windowInfo.hwnd))
    if (windowsToSave.length === 0) {
      return { success: false, error: 'PRESET_REQUIRES_HWNDS' }
    }

    const snapshot = this.createSnapshotFromWindows(trimmedName, description, windowsToSave, false, monitorId)
    this.layoutSnapshots = [snapshot, ...this.layoutSnapshots]
    this.scheduleSave()
    return { success: true, data: snapshot }
  }

  updateSnapshot(id: string, patch: { name?: string; description?: string }): ServiceResult {
    const snapshot = this.layoutSnapshots.find(item => item.id === id)
    if (!snapshot) return { success: false, error: 'SNAPSHOT_NOT_FOUND' }
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim()
      if (!trimmed) return { success: false, error: 'SNAPSHOT_NAME_EMPTY' }
      snapshot.name = trimmed
    }
    if (patch.description !== undefined) snapshot.description = patch.description
    snapshot.updatedAt = Date.now()
    this.scheduleSave()
    return { success: true }
  }

  deleteSnapshot(id: string): ServiceResult {
    const before = this.layoutSnapshots.length
    this.layoutSnapshots = this.layoutSnapshots.filter(snapshot => snapshot.id !== id)
    if (this.layoutSnapshots.length === before) return { success: false, error: 'SNAPSHOT_NOT_FOUND' }
    this.scheduleSave()
    return { success: true }
  }

  listSnapshots(): WindowLayoutSnapshot[] {
    return this.layoutSnapshots
  }

  async restoreSnapshot(snapshotId: string, saveRestorePoint = true): Promise<ApplyLayoutResult> {
    const snapshot = this.layoutSnapshots.find(item => item.id === snapshotId)
    if (!snapshot) return this.toApplyResultError('SNAPSHOT_NOT_FOUND', `Snapshot not found: ${snapshotId}`)
    return this.applySnapshot(snapshot, saveRestorePoint)
  }

  async restorePrevious(restorePointId?: string): Promise<ApplyLayoutResult> {
    const targetId = restorePointId ?? this.lastRestorePointId
    if (!targetId) return this.toApplyResultError('SNAPSHOT_NOT_FOUND', 'No restore point is available')
    const restorePoint = this.restorePoints.find(snapshot => snapshot.id === targetId)
    if (!restorePoint) return this.toApplyResultError('SNAPSHOT_NOT_FOUND', `Restore point not found: ${targetId}`)
    return this.applySnapshot(restorePoint, false)
  }

  private async applySnapshot(snapshot: WindowLayoutSnapshot, saveRestorePoint: boolean): Promise<ApplyLayoutResult> {
    const scanResult = await this.scanWindows()
    const currentWindows = scanResult.data ?? Array.from(this.windows.values())
    const targets = this.resolveSnapshotTargets(snapshot, currentWindows)
    if (targets.length === 0) {
      return this.toApplyResultError('SNAPSHOT_MEMBERS_ALL_GONE', `Snapshot has no live members: ${snapshot.id}`)
    }
    const result = await this.applyLayout({ customRects: targets, saveRestorePoint })
    return { ...result, snapshotId: snapshot.id }
  }

  previewLayout(preset: TilePreset, count: number, monitorId?: number): WindowInfo['rect'][] {
    return this.calculateLayoutRects(preset, count, monitorId)
  }

  getMonitorInfo(): MonitorInfo[] {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map(display => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height },
      workArea: { x: display.workArea.x, y: display.workArea.y, width: display.workArea.width, height: display.workArea.height },
      scaleFactor: display.scaleFactor,
      primary: display.id === primary.id
    }))
  }

  async tileGroup(groupId: string, preset: TilePreset = 'tile-auto'): Promise<ApplyLayoutResult> {
    const group = await this.getResolvedGroupForAction(groupId)
    if (!group) return this.toApplyResultError('WINDOW_NOT_FOUND', `Group not found: ${groupId}`)
    if (group.windows.length === 0) return this.toApplyResultError('SNAPSHOT_MEMBERS_ALL_GONE', `Group has no live windows: ${groupId}`)
    return this.applyLayout({ preset, hwnds: group.windows.map(windowInfo => windowInfo.hwnd), saveRestorePoint: true })
  }

  async saveLayout(name: string, description?: string): Promise<WindowLayout> {
    const scanResult = await this.scanWindows()
    if (!scanResult.success) {
      console.error('saveLayout: scanWindows failed:', scanResult.error)
    }
    const currentWindows = scanResult.data ?? []
    const groups = Array.from(this.groups.values())

    // Build layout groups: include explicit groups + an "ungrouped" group for all other windows
    const layoutGroups: WindowLayout['groups'] = []

    // Track which hwnds are already in a group
    const groupedHwnds = new Set<number>()

    for (const g of groups) {
      // Re-fetch positions for group windows from current scan
      const updatedWindows = g.windows.map(gw => {
        const fresh = currentWindows.find(cw => cw.hwnd === gw.hwnd)
        return {
          processName: fresh?.processName ?? gw.processName,
          titlePattern: fresh?.title ?? gw.title,
          className: fresh?.className || gw.className || undefined,
          rect: fresh ? { ...fresh.rect } : { ...gw.rect }
        }
      })
      for (const gw of g.windows) groupedHwnds.add(gw.hwnd)
      layoutGroups.push({ groupId: g.id, windows: updatedWindows })
    }

    // Add ungrouped windows so layout saves ALL windows
    const ungroupedWindows = currentWindows.filter(w => !groupedHwnds.has(w.hwnd) && !w.isSystemWindow)
    if (ungroupedWindows.length > 0) {
      layoutGroups.push({
        groupId: '__ungrouped__',
        windows: ungroupedWindows.map(w => ({
          processName: w.processName,
          titlePattern: w.title,
          className: w.className || undefined,
          rect: { ...w.rect }
        }))
      })
    }

    const layout: WindowLayout = {
      id: `layout_${Date.now()}`,
      name,
      description,
      groups: layoutGroups,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.layouts.push(layout)
    this.scheduleSave()
    return layout
  }

  async restoreLayout(layoutId: string): Promise<ServiceResult> {
    const layout = this.layouts.find(l => l.id === layoutId)
    if (!layout) return { success: false, error: `Layout not found: ${layoutId}` }

    const scanResult = await this.scanWindows()
    const currentWindows = scanResult.data ?? []

    // Track already-matched windows so each real window is used at most once
    const matchedHwnds = new Set<number>()

    for (const group of layout.groups) {
      for (const savedWindow of group.windows) {
        // Weighted matching: find the best matching current window
        let bestMatch: WindowInfo | null = null
        let bestScore = 0

        for (const w of currentWindows) {
          if (matchedHwnds.has(w.hwnd)) continue

          let score = 0
          // processName must match (weight: 40)
          if (w.processName === savedWindow.processName) score += 40
          // title substring match (weight: 30)
          if (savedWindow.titlePattern && w.title.includes(savedWindow.titlePattern.substring(0, 20))) score += 30
          // className match (weight: 20)
          if (savedWindow.className && savedWindow.className === w.className) score += 20

          if (score > bestScore) {
            bestScore = score
            bestMatch = w
          }
        }

        // Threshold: at least processName must match (score >= 40)
        if (bestMatch && bestScore >= 40) {
          matchedHwnds.add(bestMatch.hwnd)
          await this.moveWindow(
            bestMatch.hwnd,
            savedWindow.rect.x,
            savedWindow.rect.y,
            savedWindow.rect.width,
            savedWindow.rect.height
          )
        }
      }
    }

    return { success: true }
  }

  getLayouts(): WindowLayout[] {
    return this.layouts
  }

  removeLayout(layoutId: string): boolean {
    const index = this.layouts.findIndex(l => l.id === layoutId)
    if (index === -1) return false
    this.layouts.splice(index, 1)
    this.scheduleSave()
    return true
  }

  async restoreWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    try {
      await this.executeWindowHelper(`[WindowHelper]::Restore([IntPtr]${Math.floor(Number(hwnd))})`, {
        label: 'restore-window'
      })
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('restoreWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async setWindowTopmost(hwnd: number, topmost: boolean): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    try {
      await this.executeWindowHelper(
        `[WindowHelper]::SetTopmost([IntPtr]${Math.floor(Number(hwnd))}, $${topmost ? 'true' : 'false'})`,
        { label: 'set-window-topmost' }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('setWindowTopmost failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async setWindowOpacity(hwnd: number, opacity: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }
    // opacity: 0-100, map to byte 0-255
    const alpha = Math.max(0, Math.min(255, Math.round((opacity / 100) * 255)))

    try {
      await this.executeWindowHelper(
        `[WindowHelper]::SetOpacity([IntPtr]${Math.floor(Number(hwnd))}, ${alpha})`,
        { label: 'set-window-opacity' }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('setWindowOpacity failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  getFavorites(): WindowFavoriteRecord[] {
    return Array.from(this.favorites.values())
  }

  getCachedWindows(): WindowInfo[] {
    return Array.from(this.windows.values()).map(windowInfo => ({
      ...windowInfo,
      rect: this.cloneRect(windowInfo.rect)
    }))
  }

  toggleFavorite(hwnd: number): ServiceResult<WindowFavoriteToggleResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const windowInfo = this.windows.get(hwnd)
    if (!windowInfo) {
      return { success: false, error: `Window not found: ${hwnd}` }
    }

    const fingerprint = this.createWindowFingerprint(windowInfo)
    const existing = this.favorites.get(fingerprint.hashKey)
    const now = Date.now()
    if (existing) {
      const updated = {
        ...existing,
        hwnd: windowInfo.hwnd,
        title: windowInfo.title,
        processName: windowInfo.processName,
        pid: windowInfo.pid,
        className: windowInfo.className,
        updatedAt: now
      }
      this.favorites.delete(fingerprint.hashKey)
      this.scheduleSave()
      return { success: true, data: { favorite: false, record: updated } }
    }

    const record: WindowFavoriteRecord = {
      id: `window_favorite_${now}_${randomUUID().slice(0, 8)}`,
      fingerprintHash: fingerprint.hashKey,
      hwnd: windowInfo.hwnd,
      title: windowInfo.title,
      processName: windowInfo.processName,
      pid: windowInfo.pid,
      className: windowInfo.className,
      createdAt: now,
      updatedAt: now
    }
    this.favorites.set(record.fingerprintHash, record)
    this.scheduleSave()
    return { success: true, data: { favorite: true, record } }
  }

  async screenshotWindow(hwnd: number): Promise<ServiceResult<WindowScreenshotResult>> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const windowInfo = this.windows.get(hwnd)
    if (!windowInfo) {
      return { success: false, error: `Window not found: ${hwnd}` }
    }
    if (windowInfo.rect.width <= 0 || windowInfo.rect.height <= 0) {
      return { success: false, error: 'Window has no capturable area' }
    }

    const createdAt = Date.now()
    const screenshotDirectory = join(app.getPath('userData'), 'window-screenshots')
    const screenshotPath = join(screenshotDirectory, `window-${Math.floor(hwnd)}-${createdAt}.png`)

    try {
      await mkdir(screenshotDirectory, { recursive: true })
      const script = `Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(${Math.floor(windowInfo.rect.width)}, ${Math.floor(windowInfo.rect.height)})
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen(${Math.floor(windowInfo.rect.x)}, ${Math.floor(windowInfo.rect.y)}, 0, 0, $bitmap.Size)
  $bitmap.Save('${escapePowerShellSingleQuotedString(screenshotPath)}', [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}`
      await this.executePowerShell(script, { label: 'screenshot-window', timeoutMs: 10000 })
      return {
        success: true,
        data: {
          hwnd,
          path: screenshotPath,
          directory: screenshotDirectory,
          width: windowInfo.rect.width,
          height: windowInfo.rect.height,
          createdAt,
          source: 'win32-copy-from-screen'
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('screenshotWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async openWorkingDirectory(hwnd: number): Promise<ServiceResult<WindowOpenDirectoryResult>> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const windowInfo = this.windows.get(hwnd)
    if (!windowInfo) {
      return { success: false, error: `Window not found: ${hwnd}` }
    }
    if (!validatePid(windowInfo.pid)) {
      return { success: false, error: `Invalid pid: ${windowInfo.pid}` }
    }

    try {
      const executablePath = await this.executePowerShell(
        `$process = Get-CimInstance Win32_Process -Filter "ProcessId = ${Math.floor(windowInfo.pid)}"; if(-not $process -or -not $process.ExecutablePath){ throw 'PROCESS_EXECUTABLE_PATH_UNAVAILABLE' }; $process.ExecutablePath`,
        { label: 'resolve-window-process-directory', timeoutMs: 10000 }
      )
      const directory = dirname(executablePath.trim())
      const openError = await shell.openPath(directory)
      if (openError) {
        return { success: false, error: openError }
      }
      return {
        success: true,
        data: {
          hwnd,
          pid: windowInfo.pid,
          directory,
          source: 'process-executable-directory'
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('openWorkingDirectory failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async setWindowTitle(hwnd: number, title: string): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const normalizedTitle = normalizeExternalWindowTitle(title)
    if (!normalizedTitle) {
      return { success: false, error: 'Invalid title: must be 1-200 printable characters' }
    }

    try {
      await this.executeWindowHelper(
        `[WindowHelper]::SetTitle([IntPtr]${Math.floor(Number(hwnd))}, '${escapePowerShellSingleQuotedString(normalizedTitle)}')`,
        { label: 'set-window-title' }
      )
      const existing = this.windows.get(hwnd)
      if (existing) {
        this.windows.set(hwnd, { ...existing, title: normalizedTitle })
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('setWindowTitle failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async sendKeysToWindow(hwnd: number, keys: string): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    // Only allow specific safe key combos
    const allowedKeys = ['Ctrl+C', 'Ctrl+D', 'Ctrl+Z', 'Enter', 'Escape']
    if (!allowedKeys.includes(keys)) {
      return { success: false, error: `Key combination '${keys}' is not allowed. Allowed: ${allowedKeys.join(', ')}` }
    }

    try {
      // Use PowerShell SendKeys via WScript.Shell
      const escapedKeys = keys
        .replace('Ctrl+C', '^c')
        .replace('Ctrl+D', '^d')
        .replace('Ctrl+Z', '^z')
        .replace('Enter', '{ENTER}')
        .replace('Escape', '{ESC}')

      await this.executeWindowHelper(
        `[WindowHelper]::Focus([IntPtr]${Math.floor(Number(hwnd))}); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${escapedKeys}')`,
        { label: 'send-keys-to-window' }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('sendKeysToWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  async sendTextToWindow(hwnd: number, text: string): Promise<ServiceResult<{ characters: number; mode: WindowTextInjectionMode }>> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const normalizedText = text.normalize('NFC')
    if (normalizedText.length === 0 || normalizedText.length > 4000) {
      return { success: false, error: 'Invalid text: must be 1-4000 characters' }
    }

    const safeHwnd = Math.floor(Number(hwnd))
    let clipboardPasteMessage = ''
    try {
      const previousClipboardText = clipboard.readText()
      clipboard.writeText(normalizedText)
      try {
        await this.executeWindowHelper(
          `[WindowHelper]::Focus([IntPtr]${safeHwnd}); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v'); Start-Sleep -Milliseconds 120`,
          { label: 'send-text-to-window-clipboard-paste' }
        )
      } finally {
        clipboard.writeText(previousClipboardText)
      }
      return {
        success: true,
        data: {
          characters: Array.from(normalizedText).length,
          mode: 'clipboard-paste'
        }
      }
    } catch (clipboardPasteError) {
      clipboardPasteMessage = clipboardPasteError instanceof Error ? clipboardPasteError.message : 'Clipboard paste failed'
    }

    try {
      const escapedText = escapePowerShellSingleQuotedString(normalizedText)
      const sendInputScript = [
        '$OutputEncoding = [System.Text.Encoding]::UTF8',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        WindowManager.HELPER_ADD_TYPE,
        WindowManager.HELPER_SEND_INPUT,
        `[WindowHelper]::Focus([IntPtr]${safeHwnd})`,
        'Start-Sleep -Milliseconds 120',
        `[TextInputHelper]::SendUnicode('${escapedText}')`
      ].join('; ')
      await this.executePowerShell(sendInputScript, {
        label: 'send-text-to-window',
        timeoutMs: Math.max(15000, normalizedText.length * 20)
      })
      return {
        success: true,
        data: {
          characters: Array.from(normalizedText).length,
          mode: 'sendinput'
        }
      }
    } catch (sendInputError) {
      const escapedText = escapePowerShellSingleQuotedString(normalizedText)
      try {
        await this.executeWindowHelper(
          `[WindowHelper]::Focus([IntPtr]${safeHwnd}); Start-Sleep -Milliseconds 120; [WindowHelper]::SendText([IntPtr]${safeHwnd}, '${escapedText}')`,
          { label: 'send-text-to-window-fallback' }
        )
        return {
          success: true,
          data: {
            characters: Array.from(normalizedText).length,
            mode: 'wm-char'
          }
        }
      } catch (wmCharError) {
        const sendInputMessage = sendInputError instanceof Error ? sendInputError.message : 'SendInput failed'
        const wmCharMessage = wmCharError instanceof Error ? wmCharError.message : 'WM_CHAR failed'
        console.error('sendTextToWindow failed:', `${clipboardPasteMessage}; ${sendInputMessage}; ${wmCharMessage}`)
        return { success: false, error: `ClipboardPaste: ${clipboardPasteMessage}; SendInput: ${sendInputMessage}; WM_CHAR: ${wmCharMessage}` }
      }
    }
  }

  /** Tile all specified windows equally across the primary screen */
  async tileWindows(hwnds: number[]): Promise<ServiceResult> {
    const result = await this.applyLayout({ preset: 'tile-auto', hwnds, saveRestorePoint: true })
    if (result.ok) return { success: true }
    return { success: false, error: result.failed.map(item => `${item.hwnd}:${item.error}`).join(', ') || 'No windows were tiled' }
  }
  /** Cascade all specified windows with offset */
  async cascadeWindows(hwnds: number[]): Promise<ServiceResult> {
    const result = await this.applyLayout({ preset: 'cascade', hwnds, saveRestorePoint: true })
    if (!result.ok) {
      return { success: false, error: result.failed.map(item => `${item.hwnd}:${item.error}`).join(', ') || 'No windows were cascaded' }
    }
    for (const applied of result.applied) {
      await this.focusWindow(applied.hwnd)
    }
    return { success: true }
  }
  /** Stack all specified windows at the same position (center of screen, same size) */
  async stackWindows(hwnds: number[]): Promise<ServiceResult> {
    const result = await this.applyLayout({ preset: 'stack-center', hwnds, saveRestorePoint: true })
    if (result.ok) return { success: true }
    return { success: false, error: result.failed.map(item => `${item.hwnd}:${item.error}`).join(', ') || 'No windows were stacked' }
  }
  /** Minimize all tracked windows */
  async minimizeAll(): Promise<ServiceResult> {
    try {
      for (const [hwnd] of this.windows) {
        if (!validateHwnd(hwnd)) continue
        await this.minimizeWindow(hwnd)
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('minimizeAll failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /** Restore all tracked windows */
  async restoreAll(): Promise<ServiceResult> {
    try {
      for (const [hwnd] of this.windows) {
        if (!validateHwnd(hwnd)) continue
        await this.restoreWindow(hwnd)
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('restoreAll failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /** Add a window to an existing group */
  addToGroup(groupId: string, hwnd: number): ServiceResult {
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

    const windowInfo = this.windows.get(hwnd)
    if (!windowInfo) return { success: false, error: `Window not found: ${hwnd}` }

    const fingerprints = this.ensureGroupFingerprints(group)
    if (fingerprints.length >= 50) {
      return { success: false, error: 'GROUP_MEMBER_LIMIT_EXCEEDED' }
    }

    const hashes = new Set(fingerprints.map(fp => fp.hashKey))
    const fingerprint = this.createWindowFingerprint(windowInfo, hashes)
    if (fingerprints.some(fp => fp.hashKey === fingerprint.hashKey) || group.windows.some(w => w.hwnd === hwnd)) {
      return { success: true }
    }

    group.memberFingerprints = [...fingerprints, fingerprint]
    group.windows = [...group.windows.filter(w => w.hwnd !== hwnd), windowInfo]
    group.updatedAt = Date.now()
    this.scheduleSave()
    return { success: true }
  }

  /** Restore all windows in a group from minimized state */
  async restoreGroup(groupId: string): Promise<ServiceResult> {
    const group = await this.getResolvedGroupForAction(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }
    if (group.windows.length === 0) return { success: false, error: 'No live windows resolved for group' }

    try {
      for (const window of group.windows) {
        if (!validateHwnd(window.hwnd)) continue
        await this.restoreWindow(window.hwnd)
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('restoreGroup failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  // Filter development-related windows
  filterDevWindows(windows: WindowInfo[]): WindowInfo[] {
    const devProcesses = [
      'node.exe', 'python.exe', 'code.exe', 'idea64.exe',
      'WindowsTerminal.exe', 'cmd.exe', 'powershell.exe',
      'chrome.exe', 'msedge.exe', 'firefox.exe',
      'Cursor.exe', 'pycharm64.exe', 'webstorm64.exe'
    ]
    return windows.filter(w =>
      devProcesses.some(p => w.processName.toLowerCase() === p.toLowerCase())
    )
  }

  // Minimize all windows in a group
  async minimizeGroup(groupId: string): Promise<ServiceResult> {
    const group = await this.getResolvedGroupForAction(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }
    if (group.windows.length === 0) return { success: false, error: 'No live windows resolved for group' }

    try {
      for (const window of group.windows) {
        if (!validateHwnd(window.hwnd)) continue
        await this.minimizeWindow(window.hwnd)
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('minimizeGroup failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  // Close all windows in a group
  async closeGroup(groupId: string): Promise<ServiceResult> {
    const group = await this.getResolvedGroupForAction(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }
    if (group.windows.length === 0) return { success: false, error: 'No live windows resolved for group' }

    try {
      for (const window of group.windows) {
        if (!validateHwnd(window.hwnd)) continue
        await this.closeWindow(window.hwnd)
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('closeGroup failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  // 批量获取多个 PID 的进程名（一次 PowerShell 调用）
  private async batchGetProcessNames(pids: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>()
    if (pids.length === 0) return result

    const validPids = pids.filter(pid => validatePid(pid)).map(pid => Math.floor(Number(pid)))
    if (validPids.length === 0) return result

    try {
      const stdout = await this.executePowerShell(
        `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process -Id ${validPids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | ConvertTo-Csv -NoTypeInformation`,
        { label: 'batch-get-process-names' }
      )

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('"Id"')) continue
        // CSV: "Id","ProcessName"
        const match = trimmed.match(/^"(\d+)","(.+)"$/)
        if (match) {
          result.set(parseInt(match[1], 10), match[2])
        }
      }
    } catch (error) {
      console.warn('batchGetProcessNames failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * 清理资源 - 应在应用退出时调用
   */
  cleanup(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.saveToDisk()
    this.windows.clear()
    this.groups.clear()
  }
}
