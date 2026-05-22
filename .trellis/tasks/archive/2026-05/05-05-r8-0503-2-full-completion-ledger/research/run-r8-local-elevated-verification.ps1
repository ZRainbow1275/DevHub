$ErrorActionPreference = 'Continue'

Set-Location 'D:\Desktop\CREATOR ONE'
$env:DEVHUB_R8_VD_FOREGROUND_WATCH = '1'

$taskResearchDir = 'D:\Desktop\CREATOR ONE\.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research'
$logPath = Join-Path $taskResearchDir 'run-r8-local-elevated-verification.log'
$reportPath = '../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'

function Write-Log {
  param([string]$Message)
  $Message | Out-File -FilePath $logPath -Encoding UTF8 -Append
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )
  Write-Log "step=$Name started=$(Get-Date -Format o)"
  & $Command *>> $logPath
  $exitCode = $LASTEXITCODE
  Write-Log "step=$Name exitCode=$exitCode finished=$(Get-Date -Format o)"
  return $exitCode
}

New-Item -ItemType Directory -Force -Path $taskResearchDir | Out-Null
if (Test-Path $logPath) {
  Remove-Item -LiteralPath $logPath -Force
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Log "started=$(Get-Date -Format o) user=$([Security.Principal.WindowsIdentity]::GetCurrent().Name) admin=$isAdmin DEVHUB_R8_VD_FOREGROUND_WATCH=$env:DEVHUB_R8_VD_FOREGROUND_WATCH"

$browserExit = Invoke-Step 'browserwindow-single-display-placement' { pnpm -C devhub check:browserwindow-second-display }
$displayExit = Invoke-Step 'display-single-display-stability' { pnpm -C devhub check:physical-monitor-hotplug -- --duration-seconds=10 --interval-ms=1000 }
$zeroExit = Invoke-Step 'zero-egress-app-scoped-capture' { pnpm -C devhub check:zero-egress-capture }
$externalExit = Invoke-Step 'refresh-r8-external-blockers' { pnpm -C devhub check:r8-external-blockers -- --write-report $reportPath }

Write-Log "summary browserExit=$browserExit displayExit=$displayExit zeroExit=$zeroExit externalExit=$externalExit finished=$(Get-Date -Format o)"
exit $externalExit
