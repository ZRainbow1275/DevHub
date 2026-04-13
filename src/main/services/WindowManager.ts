import { execFile } from 'child_process'
import { promisify } from 'util'
import { screen } from 'electron'
import Store from 'electron-store'
import { WindowInfo, WindowGroup, WindowLayout, ServiceResult, SYSTEM_WINDOW_CLASSNAMES } from '@shared/types-extended'

const execFileAsync = promisify(execFile)

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

interface WindowLayoutData {
  layouts: WindowLayout[]
  groups: WindowGroup[]
}

const layoutSchema = {
  layouts: {
    type: 'array' as const,
    default: []
  },
  groups: {
    type: 'array' as const,
    default: []
  }
}

export class WindowManager {
  private windows = new Map<number, WindowInfo>()
  private groups = new Map<string, WindowGroup>()
  private layouts: WindowLayout[] = []
  private store: Store<WindowLayoutData>
  private saveTimeout: NodeJS.Timeout | null = null

  // WindowHelper C# 类型定义 — 每次 PowerShell 调用都需要内联（因为每次都是新进程）
  // 使用单行 here-string 避免换行符在 Windows 上的问题
  // Focus 使用 AttachThreadInput + BringWindowToTop + SetForegroundWindow 组合策略
  // 带有 keybd_event Alt 模拟重试机制
  // ***C# 5 兼容***: 所有 `out _` 已替换为显式变量 `out uint dummy`
  private static readonly HELPER_ADD_TYPE = `Add-Type @"
using System; using System.Runtime.InteropServices; public class WindowHelper { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int W, int H, bool repaint); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach); [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId(); [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags); [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags); [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex); [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong); private const int SW_RESTORE = 9; private const int SW_MINIMIZE = 6; private const int SW_MAXIMIZE = 3; private const int SW_SHOW = 5; private const byte VK_MENU = 0x12; private const uint KEYEVENTF_EXTENDEDKEY = 0x0001; private const uint KEYEVENTF_KEYUP = 0x0002; private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1); private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2); private const uint SWP_NOMOVE = 0x0002; private const uint SWP_NOSIZE = 0x0001; private const int GWL_EXSTYLE = -20; private const int WS_EX_LAYERED = 0x80000; private const uint LWA_ALPHA = 0x02; public static void Focus(IntPtr h) { if(IsIconic(h)) ShowWindow(h, SW_RESTORE); IntPtr fg = GetForegroundWindow(); if(fg == h) return; uint pid1; uint targetThread = GetWindowThreadProcessId(h, out pid1); uint pid2; uint fgThread = (fg != IntPtr.Zero) ? GetWindowThreadProcessId(fg, out pid2) : 0; bool attached = false; try { if(fgThread != 0 && targetThread != fgThread) { attached = AttachThreadInput(fgThread, targetThread, true); } BringWindowToTop(h); SetForegroundWindow(h); } finally { if(attached) AttachThreadInput(fgThread, targetThread, false); } if(GetForegroundWindow() != h) { keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero); keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero); SetForegroundWindow(h); } } public static void Move(IntPtr h,int x,int y,int w,int ht) { MoveWindow(h,x,y,w,ht,true); } public static void Minimize(IntPtr h) { ShowWindow(h,SW_MINIMIZE); } public static void Maximize(IntPtr h) { ShowWindow(h,SW_MAXIMIZE); } public static void Restore(IntPtr h) { ShowWindow(h,SW_RESTORE); } public static void Close(IntPtr h) { PostMessage(h,0x0010,IntPtr.Zero,IntPtr.Zero); } public static void SetTopmost(IntPtr h, bool topmost) { SetWindowPos(h, topmost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE); } public static void SetOpacity(IntPtr h, byte alpha) { int exStyle = GetWindowLong(h, GWL_EXSTYLE); SetWindowLong(h, GWL_EXSTYLE, exStyle | WS_EX_LAYERED); SetLayeredWindowAttributes(h, 0, alpha, LWA_ALPHA); } }
"@`

  constructor() {
    this.store = new Store<WindowLayoutData>({
      name: 'devhub-window-layouts',
      schema: layoutSchema
    })
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      const savedLayouts = this.store.get('layouts', [])
      this.layouts = savedLayouts.map(l => ({
        ...l,
        createdAt: typeof l.createdAt === 'number' ? l.createdAt : new Date(l.createdAt).getTime(),
        updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : new Date(l.updatedAt).getTime()
      }))

      const savedGroups = this.store.get('groups', [])
      for (const group of savedGroups) {
        this.groups.set(group.id, {
          ...group,
          createdAt: typeof group.createdAt === 'number' ? group.createdAt : new Date(group.createdAt).getTime()
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
    } catch (error) {
      console.error('Failed to save window layouts:', error)
    }
  }

  async scanWindows(includeSystemWindows = false): Promise<ServiceResult<WindowInfo[]>> {
    try {
      // 端到端 UTF-8 编码链路：PowerShell $OutputEncoding + [Console]::OutputEncoding + C# Console.OutputEncoding
      // 使用管道分隔文本格式（避免 JSON 转义在多层嵌入中的复杂性）
      const script = `$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
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
"@
[WindowEnumerator]::GetWindows()`

      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', timeout: 15000 }
      )

      const windows: WindowInfo[] = []
      this.windows.clear()
      const lines = stdout.trim().split('\n').filter(l => l.trim())

      // 第一遍：解析所有窗口数据，收集唯一 PID
      interface ParsedWindow {
        hwnd: number
        title: string
        className: string
        pid: number
        x: number
        y: number
        width: number
        height: number
        isMinimized: boolean
      }
      const parsedWindows: ParsedWindow[] = []
      const uniquePids = new Set<number>()

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
        uniquePids.add(pid)
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

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    if (!validateHwnd(hwnd)) {
      return { success: false, error: `Invalid hwnd: ${hwnd}` }
    }

    const safeHwnd = Math.floor(Number(hwnd))
    try {
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Focus([IntPtr]${safeHwnd})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.warn('focusWindow: primary method failed, trying fallback:', errorMsg)
      // Fallback: 使用纯 PowerShell 调用（不依赖 C# Add-Type 编译），覆盖 Add-Type 编译失败的场景
      try {
        const fallbackCmd = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);' -Name FocusFallback -Namespace Win32; if([Win32.FocusFallback]::IsIconic([IntPtr]${safeHwnd})){[Win32.FocusFallback]::ShowWindow([IntPtr]${safeHwnd},9)}; [Win32.FocusFallback]::SetForegroundWindow([IntPtr]${safeHwnd})`
        await execFileAsync(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', fallbackCmd],
          { windowsHide: true, timeout: 15000 }
        )
        return { success: true }
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        console.error('focusWindow: fallback also failed:', fallbackMsg)
        return { success: false, error: `Primary: ${errorMsg}; Fallback: ${fallbackMsg}` }
      }
    }
  }

  async focusWindowGroup(groupId: string): Promise<ServiceResult> {
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Move([IntPtr]${Math.floor(Number(hwnd))},${Math.floor(Number(x))},${Math.floor(Number(y))},${Math.floor(Number(width))},${Math.floor(Number(height))})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Minimize([IntPtr]${Math.floor(Number(hwnd))})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Maximize([IntPtr]${Math.floor(Number(hwnd))})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Close([IntPtr]${Math.floor(Number(hwnd))})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('closeWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  createGroup(name: string, windowHwnds: number[], projectId?: string): WindowGroup {
    const id = `group_${Date.now()}`
    const windows = windowHwnds
      .map(hwnd => this.windows.get(hwnd))
      .filter((w): w is WindowInfo => w !== undefined)

    const group: WindowGroup = {
      id,
      name,
      projectId,
      windows,
      createdAt: Date.now()
    }

    this.groups.set(id, group)
    this.scheduleSave()
    return group
  }

  getGroups(): WindowGroup[] {
    return Array.from(this.groups.values())
  }

  removeGroup(groupId: string): boolean {
    const result = this.groups.delete(groupId)
    if (result) {
      this.scheduleSave()
    }
    return result
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Restore([IntPtr]${Math.floor(Number(hwnd))})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::SetTopmost([IntPtr]${Math.floor(Number(hwnd))}, $${topmost ? 'true' : 'false'})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
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
      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::SetOpacity([IntPtr]${Math.floor(Number(hwnd))}, ${alpha})`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('setWindowOpacity failed:', errorMsg)
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

      const cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Focus([IntPtr]${Math.floor(Number(hwnd))}); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${escapedKeys}')`
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
        { windowsHide: true, timeout: 15000 }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('sendKeysToWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /** Tile all specified windows equally across the primary screen */
  async tileWindows(hwnds: number[]): Promise<ServiceResult> {
    const validHwnds = hwnds.filter(h => validateHwnd(h))
    if (validHwnds.length === 0) return { success: false, error: 'No valid window handles provided' }

    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
      const { x: offsetX, y: offsetY } = primaryDisplay.workArea

      const cols = Math.ceil(Math.sqrt(validHwnds.length))
      const rows = Math.ceil(validHwnds.length / cols)
      const cellWidth = Math.floor(screenWidth / cols)
      const cellHeight = Math.floor(screenHeight / rows)

      for (let i = 0; i < validHwnds.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = offsetX + col * cellWidth
        const y = offsetY + row * cellHeight
        await this.moveWindow(validHwnds[i], x, y, cellWidth, cellHeight)
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('tileWindows failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /** Cascade all specified windows with offset */
  async cascadeWindows(hwnds: number[]): Promise<ServiceResult> {
    const validHwnds = hwnds.filter(h => validateHwnd(h))
    if (validHwnds.length === 0) return { success: false, error: 'No valid window handles provided' }

    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
      const { x: offsetX, y: offsetY } = primaryDisplay.workArea

      const windowWidth = Math.floor(screenWidth * 0.6)
      const windowHeight = Math.floor(screenHeight * 0.6)
      const cascadeOffset = 30

      for (let i = 0; i < validHwnds.length; i++) {
        const x = offsetX + i * cascadeOffset
        const y = offsetY + i * cascadeOffset
        await this.moveWindow(validHwnds[i], x, y, windowWidth, windowHeight)
        await this.focusWindow(validHwnds[i])
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('cascadeWindows failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /** Stack all specified windows at the same position (center of screen, same size) */
  async stackWindows(hwnds: number[]): Promise<ServiceResult> {
    const validHwnds = hwnds.filter(h => validateHwnd(h))
    if (validHwnds.length === 0) return { success: false, error: 'No valid window handles provided' }

    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
      const { x: offsetX, y: offsetY } = primaryDisplay.workArea

      const windowWidth = Math.floor(screenWidth * 0.65)
      const windowHeight = Math.floor(screenHeight * 0.65)
      const x = offsetX + Math.floor((screenWidth - windowWidth) / 2)
      const y = offsetY + Math.floor((screenHeight - windowHeight) / 2)

      for (const hwnd of validHwnds) {
        await this.moveWindow(hwnd, x, y, windowWidth, windowHeight)
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('stackWindows failed:', errorMsg)
      return { success: false, error: errorMsg }
    }
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

    // Avoid duplicates
    if (group.windows.some(w => w.hwnd === hwnd)) {
      return { success: true } // already in group
    }

    group.windows.push(windowInfo)
    this.scheduleSave()
    return { success: true }
  }

  /** Restore all windows in a group from minimized state */
  async restoreGroup(groupId: string): Promise<ServiceResult> {
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

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
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

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
    const group = this.groups.get(groupId)
    if (!group) return { success: false, error: `Group not found: ${groupId}` }

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
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command',
          `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process -Id ${validPids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | ConvertTo-Csv -NoTypeInformation`
        ],
        { windowsHide: true, encoding: 'utf8', timeout: 15000 }
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
