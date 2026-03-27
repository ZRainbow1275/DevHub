import { execFile } from 'child_process'
import { promisify } from 'util'
import Store from 'electron-store'
import { WindowInfo, WindowGroup, WindowLayout, ServiceResult } from '@shared/types-extended'

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
  private windowHelperCompiled = false
  private windowHelperCompiling: Promise<void> | null = null

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

  async scanWindows(): Promise<ServiceResult<WindowInfo[]>> {
    try {
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          using System.Collections.Generic;

          public class WindowEnumerator {
            [DllImport("user32.dll")]
            private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

            [DllImport("user32.dll")]
            private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

            [DllImport("user32.dll")]
            private static extern int GetWindowTextLength(IntPtr hWnd);

            [DllImport("user32.dll")]
            private static extern bool IsWindowVisible(IntPtr hWnd);

            [DllImport("user32.dll")]
            private static extern bool IsIconic(IntPtr hWnd);

            [DllImport("user32.dll")]
            private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

            [DllImport("user32.dll")]
            private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

            [DllImport("user32.dll")]
            private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

            [StructLayout(LayoutKind.Sequential)]
            public struct RECT {
              public int Left, Top, Right, Bottom;
            }

            private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

            public static string GetWindows() {
              var result = new List<string>();
              EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;

                int length = GetWindowTextLength(hWnd);
                if (length == 0) return true;

                StringBuilder title = new StringBuilder(length + 1);
                GetWindowText(hWnd, title, title.Capacity);

                StringBuilder className = new StringBuilder(256);
                GetClassName(hWnd, className, className.Capacity);

                RECT rect;
                GetWindowRect(hWnd, out rect);

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);

                bool isMinimized = IsIconic(hWnd);

                result.Add(string.Format("{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}",
                  hWnd.ToInt64(),
                  title.ToString().Replace("|", " "),
                  className.ToString(),
                  pid,
                  rect.Left,
                  rect.Top,
                  rect.Right - rect.Left,
                  rect.Bottom - rect.Top,
                  isMinimized ? 1 : 0
                ));

                return true;
              }, IntPtr.Zero);
              return string.Join("\\n", result);
            }
          }
"@
        [WindowEnumerator]::GetWindows()
      `

      const psCommand = script.replace(/\n/g, ' ')
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
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
          isMinimized: minimizedStr === '1'
        })
        uniquePids.add(pid)
      }

      // 一次性批量获取所有 PID 的进程名
      const pidNameMap = await this.batchGetProcessNames([...uniquePids])

      // 第二遍：构建 WindowInfo 对象
      for (const pw of parsedWindows) {
        const windowInfo: WindowInfo = {
          hwnd: pw.hwnd,
          title: pw.title,
          processName: pidNameMap.get(pw.pid) || `PID:${pw.pid}`,
          pid: pw.pid,
          className: pw.className,
          rect: { x: pw.x, y: pw.y, width: pw.width, height: pw.height },
          isVisible: true,
          isMinimized: pw.isMinimized
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

    try {
      await this.ensureWindowHelper()
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `[WindowHelper]::Focus([IntPtr]${Math.floor(Number(hwnd))})`
        ],
        { windowsHide: true }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('focusWindow failed:', errorMsg)
      return { success: false, error: errorMsg }
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
      await this.ensureWindowHelper()
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `[WindowHelper]::Move([IntPtr]${Math.floor(Number(hwnd))},${Math.floor(Number(x))},${Math.floor(Number(y))},${Math.floor(Number(width))},${Math.floor(Number(height))})`
        ],
        { windowsHide: true }
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
      await this.ensureWindowHelper()
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `[WindowHelper]::Minimize([IntPtr]${Math.floor(Number(hwnd))})`
        ],
        { windowsHide: true }
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
      await this.ensureWindowHelper()
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `[WindowHelper]::Maximize([IntPtr]${Math.floor(Number(hwnd))})`
        ],
        { windowsHide: true }
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
      await this.ensureWindowHelper()
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `[WindowHelper]::Close([IntPtr]${Math.floor(Number(hwnd))})`
        ],
        { windowsHide: true }
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
    const groups = Array.from(this.groups.values())

    const layout: WindowLayout = {
      id: `layout_${Date.now()}`,
      name,
      description,
      groups: groups.map(g => ({
        groupId: g.id,
        windows: g.windows.map(w => ({
          processName: w.processName,
          titlePattern: w.title,
          rect: { ...w.rect }
        }))
      })),
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

    for (const group of layout.groups) {
      for (const savedWindow of group.windows) {
        const matchingWindow = currentWindows.find(w =>
          w.processName === savedWindow.processName &&
          w.title.includes(savedWindow.titlePattern.slice(0, 20))
        )

        if (matchingWindow) {
          await this.moveWindow(
            matchingWindow.hwnd,
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
          `Get-Process -Id ${validPids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | ConvertTo-Csv -NoTypeInformation`
        ],
        { windowsHide: true }
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

  // 编译统一的 WindowHelper C# 类（缓存，只编译一次）
  private async ensureWindowHelper(): Promise<void> {
    if (this.windowHelperCompiled) return
    // Prevent concurrent compilation race condition
    if (this.windowHelperCompiling) {
      await this.windowHelperCompiling
      return
    }

    const compilePromise = (async () => {
      try {
        await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class WindowHelper {
              [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
              [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
              [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int W, int H, bool repaint);
              [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
              [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
              public static void Focus(IntPtr h) { if(IsIconic(h)) ShowWindow(h,9); SetForegroundWindow(h); }
              public static void Move(IntPtr h,int x,int y,int w,int ht) { MoveWindow(h,x,y,w,ht,true); }
              public static void Minimize(IntPtr h) { ShowWindow(h,6); }
              public static void Maximize(IntPtr h) { ShowWindow(h,3); }
              public static void Close(IntPtr h) { PostMessage(h,0x0010,IntPtr.Zero,IntPtr.Zero); }
            }
"@
        `.replace(/\n/g, ' ')], { windowsHide: true })
        this.windowHelperCompiled = true
      } catch (error) {
        console.warn('ensureWindowHelper failed:', error instanceof Error ? error.message : 'Unknown error')
      } finally {
        this.windowHelperCompiling = null
      }
    })()
    this.windowHelperCompiling = compilePromise
    await compilePromise
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
