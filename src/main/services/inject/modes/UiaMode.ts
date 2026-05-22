import type { IInjectMode, InjectModeExecutionContext, InjectModeExecutionResult } from './IInjectMode'
import { getPowerShellGateway, type PowerShellGateway } from '../../runtime/PowerShellGateway'

interface UiaPowerShellResult {
  success: boolean
  characters?: number
  verifiedContentMatches?: boolean
  value?: string
  error?: string
}

export class UiaMode implements IInjectMode {
  readonly mode = 'uia' as const

  constructor(private readonly gateway: Pick<PowerShellGateway, 'execute'> = getPowerShellGateway()) {}

  async execute(context: InjectModeExecutionContext): Promise<InjectModeExecutionResult> {
    if (process.platform !== 'win32') {
      return {
        mode: this.mode,
        success: false,
        error: 'E_RUNTIME:UIA inject mode is only available on Windows'
      }
    }

    const hwnd = this.targetHwnd(context.target)
    if (!hwnd) {
      return {
        mode: this.mode,
        success: false,
        error: 'E_VALIDATION:UIA target HWND is required'
      }
    }

    try {
      const result = await this.gateway.execute<UiaPowerShellResult>(this.script(hwnd, context.action.text), {
        label: 'inject-uia',
        timeoutMs: 5000,
        parser: output => this.parseResult(output)
      })
      if (!result.success) {
        return {
          mode: this.mode,
          success: false,
          error: result.error ?? 'E_RUNTIME:UIA injection failed'
        }
      }
      return {
        mode: this.mode,
        success: true,
        data: {
          characters: result.characters ?? context.action.text.length,
          verifiedContentMatches: result.verifiedContentMatches ?? result.value === context.action.text
        }
      }
    } catch (error) {
      return {
        mode: this.mode,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private targetHwnd(target: unknown): number | null {
    if (!target || typeof target !== 'object') return null
    const record = target as Record<string, unknown>
    const hwnd = Number(record.resolvedHwnd ?? record.hwnd)
    return Number.isInteger(hwnd) && hwnd > 0 ? hwnd : null
  }

  private parseResult(output: string): UiaPowerShellResult {
    const line = output.trim().split(/\r?\n/).filter(Boolean).at(-1)
    if (!line) return { success: false, error: 'E_RUNTIME:UIA returned no output' }
    const parsed = JSON.parse(line) as UiaPowerShellResult
    return parsed
  }

  private script(hwnd: number, text: string): string {
    const textBase64 = Buffer.from(text, 'utf8').toString('base64')
    return `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DevHubUiaWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)]
  public static extern IntPtr SendMessageSetText(IntPtr hWnd, int msg, IntPtr wParam, string lParam);
  [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)]
  public static extern IntPtr SendMessageGetText(IntPtr hWnd, int msg, IntPtr wParam, StringBuilder lParam);
  public static IntPtr FindFirstEditChild(IntPtr root) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(root, (hWnd, lParam) => {
      var className = new StringBuilder(256);
      GetClassName(hWnd, className, className.Capacity);
      if (className.ToString().ToUpperInvariant().Contains("EDIT")) {
        found = hWnd;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
  $targetText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${textBase64}'))
  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]${hwnd})
  if ($null -eq $root) { throw 'E_NOT_FOUND:UIA target HWND not found' }
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  function IsEditableControl($element) {
    $controlType = $element.Current.ControlType
    return ($controlType -eq [System.Windows.Automation.ControlType]::Edit -or $controlType -eq [System.Windows.Automation.ControlType]::Document)
  }
  function SupportsEditablePattern($element) {
    $patternObject = $null
    if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$patternObject)) { return $true }
    if ((IsEditableControl $element) -and $element.Current.NativeWindowHandle -gt 0) { return $true }
    return $false
  }
  function FindEditable($element) {
    if ((IsEditableControl $element) -and (SupportsEditablePattern $element)) { return $element }
    $child = $walker.GetFirstChild($element)
    while ($null -ne $child) {
      $found = FindEditable $child
      if ($null -ne $found) { return $found }
      $child = $walker.GetNextSibling($child)
    }
    if (SupportsEditablePattern $element) { return $element }
    return $null
  }
  $target = FindEditable $root
  $fallbackNativeHandle = 0
  if ($null -eq $target) {
    $fallbackNativeHandle = [DevHubUiaWin32]::FindFirstEditChild([IntPtr]${hwnd}).ToInt64()
    if ($fallbackNativeHandle -le 0) {
      throw 'E_UIA_PATTERN_UNAVAILABLE:target does not expose editable UIA pattern or native EDIT child'
    }
  }
  $patternObject = $null
  if ($null -ne $target) {
    $target.SetFocus()
  }
  if ($null -ne $target -and $target.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$patternObject)) {
    $valuePattern = [System.Windows.Automation.ValuePattern]$patternObject
    if ($valuePattern.Current.IsReadOnly) {
      throw 'E_PERMISSION:UIA target is read-only'
    }
    $valuePattern.SetValue($targetText)
    $value = $valuePattern.Current.Value
  } else {
    $nativeHandle = if ($fallbackNativeHandle -gt 0) { $fallbackNativeHandle } else { $target.Current.NativeWindowHandle }
    if ($nativeHandle -le 0) {
      throw 'E_UIA_PATTERN_UNAVAILABLE:target does not expose editable UIA pattern or native handle'
    }
    [DevHubUiaWin32]::SendMessageSetText([IntPtr]$nativeHandle, 12, [IntPtr]::Zero, $targetText) | Out-Null
    $buffer = New-Object System.Text.StringBuilder 8192
    [DevHubUiaWin32]::SendMessageGetText([IntPtr]$nativeHandle, 13, [IntPtr]$buffer.Capacity, $buffer) | Out-Null
    $value = $buffer.ToString()
  }
  [PSCustomObject]@{
    success = $true
    characters = $targetText.Length
    verifiedContentMatches = ($value -eq $targetText)
    value = $value
  } | ConvertTo-Json -Compress
} catch {
  [PSCustomObject]@{
    success = $false
    error = [string]$_.Exception.Message
  } | ConvertTo-Json -Compress
}
`
  }
}
