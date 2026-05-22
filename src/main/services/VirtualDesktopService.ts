import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  moveWindowToDesktopRequestSchema,
  virtualDesktopListResponseSchema,
  windowVdInfoResponseSchema,
  type MoveWindowToDesktopResponse,
  type VirtualDesktop,
  type VirtualDesktopListResponse,
  type WindowVdInfo,
  type WindowVdInfoResponse
} from '@shared/schemas/r8-runtime'
import { getPowerShellGateway, PowerShellGateway, PowerShellGatewayTimeoutError } from './runtime/PowerShellGateway'

const WINDOWS_VIRTUAL_DESKTOP_TIMEOUT_MS = 5000
const WINDOWS_VIRTUAL_DESKTOP_MAX_BUFFER = 1024 * 512
const WINDOWS_VIRTUAL_DESKTOP_CACHE_TTL_MS = 2000
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const rawDesktopRowSchema = z.object({
  hwnd: z.number().int().positive(),
  desktopId: z.string().nullable(),
  isOnCurrentDesktop: z.boolean(),
  hrCurrent: z.number().int(),
  hrDesktop: z.number().int(),
  error: z.string().nullable().optional()
})

const rawQueryResponseSchema = z.object({
  ok: z.boolean(),
  items: z.union([rawDesktopRowSchema, z.array(rawDesktopRowSchema)]).optional(),
  desktops: z.union([z.string(), z.array(z.string())]).optional(),
  foregroundDesktopId: z.string().nullable().optional(),
  error: z.string().nullable().optional()
})

const rawMoveResponseSchema = z.object({
  hwnd: z.number().int().positive(),
  desktopId: z.string(),
  success: z.boolean(),
  hr: z.number().int(),
  error: z.string().nullable().optional()
})

type RawDesktopRow = z.infer<typeof rawDesktopRowSchema>
type RawQueryResponse = z.infer<typeof rawQueryResponseSchema>

export interface WindowDesktopState {
  hwnd: number
  desktopId: string | null
  isOnCurrentDesktop: boolean
  hrCurrent: number
  hrDesktop: number
  error?: string
}

interface WindowDesktopCacheEntry {
  expiresAt: number
  state: WindowDesktopState
}

interface VirtualDesktopListCacheEntry {
  expiresAt: number
  response: VirtualDesktopListResponse
}

function normalizeGuid(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/^[{(]/, '').replace(/[)}]$/, '').toLowerCase()
  return GUID_PATTERN.test(normalized) ? normalized : null
}

function normalizeRawRows(value: RawQueryResponse['items']): RawDesktopRow[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function dedupeHwnds(hwnds: readonly number[]): number[] {
  return [...new Set(hwnds.map(hwnd => Math.floor(hwnd)).filter(hwnd => Number.isSafeInteger(hwnd) && hwnd > 0))]
}

function powershellStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function buildPayload(input: unknown): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64')
}

function buildBridgeSource(): string {
  return String.raw`
using System;
using System.Runtime.InteropServices;

[ComImport]
[Guid("a5cd92ff-29be-454c-8d04-d82879fb3f1b")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface DevHubIVirtualDesktopManagerR8B11
{
    [PreserveSig]
    int IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow, out int onCurrentDesktop);

    [PreserveSig]
    int GetWindowDesktopId(IntPtr topLevelWindow, out Guid desktopId);

    [PreserveSig]
    int MoveWindowToDesktop(IntPtr topLevelWindow, [MarshalAs(UnmanagedType.LPStruct)] Guid desktopId);
}

public sealed class DevHubVirtualDesktopQueryResultR8B11
{
    public long hwnd { get; set; }
    public string desktopId { get; set; }
    public bool isOnCurrentDesktop { get; set; }
    public int hrCurrent { get; set; }
    public int hrDesktop { get; set; }
    public string error { get; set; }
}

public sealed class DevHubVirtualDesktopMoveResultR8B11
{
    public long hwnd { get; set; }
    public string desktopId { get; set; }
    public bool success { get; set; }
    public int hr { get; set; }
    public string error { get; set; }
}

public static class DevHubVirtualDesktopBridgeR8B11
{
    private static readonly Guid Clsid = new Guid("aa509086-5ca9-4c25-8f95-589d3c07b48a");

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    private static DevHubIVirtualDesktopManagerR8B11 CreateManager()
    {
        Type managerType = Type.GetTypeFromCLSID(Clsid, true);
        object manager = Activator.CreateInstance(managerType);
        return (DevHubIVirtualDesktopManagerR8B11)manager;
    }

    public static DevHubVirtualDesktopQueryResultR8B11 QueryWindow(long hwndValue)
    {
        DevHubVirtualDesktopQueryResultR8B11 result = new DevHubVirtualDesktopQueryResultR8B11();
        result.hwnd = hwndValue;
        result.desktopId = null;
        result.isOnCurrentDesktop = true;
        result.hrCurrent = -1;
        result.hrDesktop = -1;
        result.error = null;

        try
        {
            DevHubIVirtualDesktopManagerR8B11 manager = CreateManager();
            IntPtr hwnd = new IntPtr(hwndValue);
            int onCurrent = 0;
            Guid desktopId = Guid.Empty;
            result.hrCurrent = manager.IsWindowOnCurrentVirtualDesktop(hwnd, out onCurrent);
            result.hrDesktop = manager.GetWindowDesktopId(hwnd, out desktopId);
            result.isOnCurrentDesktop = result.hrCurrent == 0 && onCurrent != 0;
            if (result.hrDesktop == 0 && desktopId != Guid.Empty)
            {
                result.desktopId = desktopId.ToString("D").ToLowerInvariant();
            }
        }
        catch (Exception ex)
        {
            result.error = ex.GetType().Name + ": " + ex.Message;
        }

        return result;
    }

    public static DevHubVirtualDesktopQueryResultR8B11 QueryForegroundWindow()
    {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero)
        {
            DevHubVirtualDesktopQueryResultR8B11 result = new DevHubVirtualDesktopQueryResultR8B11();
            result.hwnd = 0;
            result.desktopId = null;
            result.isOnCurrentDesktop = true;
            result.hrCurrent = -1;
            result.hrDesktop = -1;
            result.error = "E_NO_FOREGROUND_WINDOW";
            return result;
        }
        return QueryWindow(hwnd.ToInt64());
    }

    public static DevHubVirtualDesktopMoveResultR8B11 MoveWindow(long hwndValue, string desktopIdValue)
    {
        DevHubVirtualDesktopMoveResultR8B11 result = new DevHubVirtualDesktopMoveResultR8B11();
        result.hwnd = hwndValue;
        result.desktopId = desktopIdValue;
        result.success = false;
        result.hr = -1;
        result.error = null;

        try
        {
            Guid desktopId = new Guid(desktopIdValue);
            DevHubIVirtualDesktopManagerR8B11 manager = CreateManager();
            result.hr = manager.MoveWindowToDesktop(new IntPtr(hwndValue), desktopId);
            result.success = result.hr == 0;
            if (!result.success)
            {
                result.error = "MoveWindowToDesktop returned HRESULT " + result.hr.ToString();
            }
        }
        catch (Exception ex)
        {
            result.error = ex.GetType().Name + ": " + ex.Message;
        }

        return result;
    }
}
`
}

function buildQueryScript(payloadBase64: string): string {
  return `
$ErrorActionPreference = 'Stop'
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(${powershellStringLiteral(payloadBase64)}))
$payload = $payloadJson | ConvertFrom-Json
Add-Type -Language CSharp -TypeDefinition @'
${buildBridgeSource()}
'@
function Get-DevHubVirtualDesktopIds {
  try {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops')
    if ($null -eq $key) { return @() }
    $bytes = $key.GetValue('VirtualDesktopIDs')
    if ($null -eq $bytes -or $bytes.Length -lt 16) { return @() }
    $ids = @()
    for ($i = 0; $i -le ($bytes.Length - 16); $i += 16) {
      $slice = New-Object byte[] 16
      [Array]::Copy($bytes, $i, $slice, 0, 16)
      $ids += ([Guid]::new($slice).ToString('D').ToLowerInvariant())
    }
    return $ids
  } catch {
    return @()
  }
}
$items = @()
foreach ($candidate in @($payload.hwnds)) {
  $hwnd = [Int64]$candidate
  if ($hwnd -gt 0) {
    $items += [DevHubVirtualDesktopBridgeR8B11]::QueryWindow($hwnd)
  }
}
$foreground = [DevHubVirtualDesktopBridgeR8B11]::QueryForegroundWindow()
$response = [pscustomobject]@{
  ok = $true
  items = $items
  desktops = @(Get-DevHubVirtualDesktopIds)
  foregroundDesktopId = $foreground.desktopId
  error = $null
}
$response | ConvertTo-Json -Depth 6 -Compress
`
}

function buildMoveScript(payloadBase64: string): string {
  return `
$ErrorActionPreference = 'Stop'
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(${powershellStringLiteral(payloadBase64)}))
$payload = $payloadJson | ConvertFrom-Json
Add-Type -Language CSharp -TypeDefinition @'
${buildBridgeSource()}
'@
$result = [DevHubVirtualDesktopBridgeR8B11]::MoveWindow([Int64]$payload.hwnd, [string]$payload.desktopId)
$result | ConvertTo-Json -Depth 4 -Compress
`
}

function normalizeDesktopRows(rows: readonly RawDesktopRow[]): Map<number, WindowDesktopState> {
  const output = new Map<number, WindowDesktopState>()
  for (const row of rows) {
    output.set(row.hwnd, {
      hwnd: row.hwnd,
      desktopId: normalizeGuid(row.desktopId),
      isOnCurrentDesktop: row.hrCurrent === 0 ? row.isOnCurrentDesktop : true,
      hrCurrent: row.hrCurrent,
      hrDesktop: row.hrDesktop,
      ...(row.error ? { error: row.error } : {})
    })
  }
  return output
}

export class VirtualDesktopService {
  private lastUnavailableReason: string | null = null
  private desktopListCache: VirtualDesktopListCacheEntry | null = null
  private readonly desktopStateCache = new Map<number, WindowDesktopCacheEntry>()

  constructor(private readonly gateway: PowerShellGateway = getPowerShellGateway()) {}

  async queryWindows(hwnds: readonly number[]): Promise<Map<number, WindowDesktopState>> {
    this.lastUnavailableReason = null
    const uniqueHwnds = dedupeHwnds(hwnds)
    if (uniqueHwnds.length === 0) return new Map()
    if (process.platform !== 'win32') {
      this.lastUnavailableReason = 'E_PLATFORM_UNSUPPORTED: Windows virtual desktops are only available on win32'
      return new Map()
    }

    const now = Date.now()
    const output = new Map<number, WindowDesktopState>()
    const uncachedHwnds = uniqueHwnds.filter(hwnd => {
      const cached = this.desktopStateCache.get(hwnd)
      if (!cached) return true
      if (cached.expiresAt <= now) {
        this.desktopStateCache.delete(hwnd)
        return true
      }
      output.set(hwnd, cached.state)
      return false
    })
    if (uncachedHwnds.length === 0) return output

    try {
      const response = await this.gateway.execute(buildQueryScript(buildPayload({ hwnds: uncachedHwnds })), {
        label: 'window-vd-info',
        maxBuffer: WINDOWS_VIRTUAL_DESKTOP_MAX_BUFFER,
        timeoutMs: WINDOWS_VIRTUAL_DESKTOP_TIMEOUT_MS,
        parser: output => rawQueryResponseSchema.parse(JSON.parse(output.trim()) as unknown)
      })
      if (!response.ok) {
        this.lastUnavailableReason = response.error ?? 'E_VIRTUAL_DESKTOP_UNAVAILABLE'
        return output
      }
      const freshStates = normalizeDesktopRows(normalizeRawRows(response.items))
      const expiresAt = Date.now() + WINDOWS_VIRTUAL_DESKTOP_CACHE_TTL_MS
      for (const [hwnd, state] of freshStates) {
        this.desktopStateCache.set(hwnd, { expiresAt, state })
        output.set(hwnd, state)
      }
      return output
    } catch (error) {
      this.lastUnavailableReason = this.formatError(error)
      return output
    }
  }

  async getWindowInfo(hwnds: readonly number[], monitorIdByHwnd: ReadonlyMap<number, number> = new Map()): Promise<WindowVdInfoResponse> {
    const uniqueHwnds = dedupeHwnds(hwnds)
    const desktopStates = await this.queryWindows(uniqueHwnds)
    const info = uniqueHwnds.map((hwnd): WindowVdInfo => {
      const state = desktopStates.get(hwnd)
      return {
        hwnd,
        desktopId: state?.desktopId ?? null,
        monitorId: monitorIdByHwnd.get(hwnd) ?? 0,
        isOnCurrentDesktop: state?.isOnCurrentDesktop ?? true
      }
    })
    return windowVdInfoResponseSchema.parse({
      info,
      unavailableReason: this.lastUnavailableReason ?? undefined
    })
  }

  async listDesktops(seedHwnds: readonly number[] = []): Promise<VirtualDesktopListResponse> {
    this.lastUnavailableReason = null
    if (process.platform !== 'win32') {
      return virtualDesktopListResponseSchema.parse({
        desktops: [],
        unavailableReason: 'E_PLATFORM_UNSUPPORTED: Windows virtual desktops are only available on win32'
      })
    }
    const uniqueSeedHwnds = dedupeHwnds(seedHwnds)
    if (uniqueSeedHwnds.length === 0 && this.desktopListCache && this.desktopListCache.expiresAt > Date.now()) {
      return virtualDesktopListResponseSchema.parse(this.desktopListCache.response)
    }

    try {
      const response = await this.gateway.execute(buildQueryScript(buildPayload({ hwnds: uniqueSeedHwnds })), {
        label: 'window-vd-list',
        maxBuffer: WINDOWS_VIRTUAL_DESKTOP_MAX_BUFFER,
        timeoutMs: WINDOWS_VIRTUAL_DESKTOP_TIMEOUT_MS,
        parser: output => rawQueryResponseSchema.parse(JSON.parse(output.trim()) as unknown)
      })
      const ids = this.collectDesktopIds(response)
      const currentId = normalizeGuid(response.foregroundDesktopId)
      const desktops: VirtualDesktop[] = ids.map((id, index) => ({
        id,
        index,
        name: null,
        current: currentId === id
      }))
      const parsed = virtualDesktopListResponseSchema.parse({
        desktops,
        unavailableReason: desktops.length === 0 ? response.error ?? 'E_NO_VIRTUAL_DESKTOPS_VISIBLE' : undefined
      })
      if (uniqueSeedHwnds.length === 0) {
        this.desktopListCache = {
          expiresAt: Date.now() + WINDOWS_VIRTUAL_DESKTOP_CACHE_TTL_MS,
          response: parsed
        }
      }
      return parsed
    } catch (error) {
      return virtualDesktopListResponseSchema.parse({
        desktops: [],
        unavailableReason: this.formatError(error)
      })
    }
  }

  async moveWindowToDesktop(input: unknown): Promise<MoveWindowToDesktopResponse> {
    const request = moveWindowToDesktopRequestSchema.parse(input)
    this.desktopListCache = null
    this.desktopStateCache.delete(request.hwnd)
    if (process.platform !== 'win32') {
      return { success: false, error: 'E_PLATFORM_UNSUPPORTED: Windows virtual desktops are only available on win32' }
    }

    try {
      const response = await this.gateway.execute(buildMoveScript(buildPayload(request)), {
        label: 'window-move-to-desktop',
        maxBuffer: WINDOWS_VIRTUAL_DESKTOP_MAX_BUFFER,
        timeoutMs: WINDOWS_VIRTUAL_DESKTOP_TIMEOUT_MS,
        parser: output => rawMoveResponseSchema.parse(JSON.parse(output.trim()) as unknown)
      })
      if (!response.success) {
        return {
          success: false,
          error: response.error ?? `E_PERMISSION: MoveWindowToDesktop failed with HRESULT ${response.hr}`
        }
      }
      return {
        success: true,
        data: {
          hwnd: response.hwnd,
          desktopId: normalizeGuid(response.desktopId) ?? request.desktopId
        }
      }
    } catch (error) {
      return { success: false, error: this.formatError(error) }
    }
  }

  getLastUnavailableReason(): string | null {
    return this.lastUnavailableReason
  }

  invalidateCaches(): void {
    this.desktopListCache = null
    this.desktopStateCache.clear()
  }

  private collectDesktopIds(response: RawQueryResponse): string[] {
    const candidates = [
      ...(Array.isArray(response.desktops) ? response.desktops : response.desktops ? [response.desktops] : []),
      normalizeGuid(response.foregroundDesktopId),
      ...normalizeRawRows(response.items).map(row => normalizeGuid(row.desktopId))
    ]
    return [...new Set(candidates.filter((value): value is string => Boolean(value)))]
  }

  private formatError(error: unknown): string {
    if (error instanceof PowerShellGatewayTimeoutError) {
      return `E_TIMEOUT: ${error.message}`
    }
    return error instanceof Error ? `E_INTERNAL: ${error.message}` : `E_INTERNAL: ${String(error)}`
  }
}

export const virtualDesktopServiceInternals = {
  normalizeGuid,
  dedupeHwnds
}
