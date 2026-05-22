$ErrorActionPreference = 'Continue'
$Repo = 'D:\Desktop\CREATOR ONE'
$Devhub = Join-Path $Repo 'devhub'
$Research = Join-Path $Repo '.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research'
$Stamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
$LogPath = Join-Path $Research "r8-admin-elevation-$Stamp.log"
$SummaryPath = Join-Path $Research "r8-admin-elevation-$Stamp.summary.json"
$ServiceName = 'devhub-watchdog'
$NodeExe = 'C:\Program Files\nodejs\node.exe'
$WatchdogEntry = Join-Path $Devhub 'out\main\watchdog-process\main.js'
$ExternalReport = Join-Path $Research 'r8-external-blockers-current.json'
$results = [System.Collections.Generic.List[object]]::new()

function Write-Log([string]$Message) {
  $line = "[$(Get-Date -Format o)] $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Run-Step([string]$Name, [scriptblock]$Block) {
  Write-Log "STEP_START $Name"
  $started = Get-Date
  $outputPath = Join-Path $Research "r8-admin-elevation-$Stamp-$($Name -replace '[^A-Za-z0-9._-]', '_').out.log"
  $exitCode = 0
  try {
    & $Block *> $outputPath
    $exitCode = if ($null -eq $global:LASTEXITCODE) { 0 } else { [int]$global:LASTEXITCODE }
  } catch {
    $exitCode = 1
    Add-Content -LiteralPath $outputPath -Value $_.Exception.ToString() -Encoding UTF8
  }
  $ended = Get-Date
  $item = [pscustomobject]@{
    name = $Name
    exitCode = $exitCode
    startedAt = $started.ToString('o')
    endedAt = $ended.ToString('o')
    outputPath = $outputPath
  }
  $results.Add($item) | Out-Null
  Write-Log "STEP_END $Name exitCode=$exitCode output=$outputPath"
}

New-Item -ItemType Directory -Force -Path $Research | Out-Null
Write-Log "R8 admin elevation run started"
Write-Log "Repo=$Repo"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Log "Identity=$($identity.Name) Administrator=$isAdmin"

Run-Step 'admin-probe' {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]$identity
  [pscustomobject]@{
    user = $identity.Name
    isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } | ConvertTo-Json -Compress
}

Run-Step 'install-devhub-watchdog-service' {
  if (-not (Test-Path -LiteralPath $NodeExe)) { throw "node.exe missing: $NodeExe" }
  if (-not (Test-Path -LiteralPath $WatchdogEntry)) { throw "watchdog entry missing: $WatchdogEntry" }
  & sc.exe query $ServiceName
  $queryBefore = $LASTEXITCODE
  if ($queryBefore -ne 0) {
    $binPath = "`"$NodeExe`" `"$WatchdogEntry`" --service"
    & sc.exe create $ServiceName binPath= $binPath start= demand DisplayName= 'DevHub Watchdog'
    if ($LASTEXITCODE -ne 0) { throw "sc.exe create failed with exit code $LASTEXITCODE" }
    & sc.exe description $ServiceName 'DevHub R8 watchdog service verification entry installed by explicit elevated operator run.'
  }
  & sc.exe query $ServiceName
  if ($LASTEXITCODE -ne 0) { throw "sc.exe query after install failed with exit code $LASTEXITCODE" }
}

Run-Step 'zero-egress-capture' {
  Push-Location $Devhub
  try {
    & pnpm check:zero-egress-capture
    if ($LASTEXITCODE -ne 0) { throw "zero-egress capture failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

Run-Step 'refresh-r8-external-blockers' {
  Push-Location $Repo
  try {
    & pnpm -C devhub check:r8-external-blockers -- --write-report '..\.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research\r8-external-blockers-current.json'
    if ($LASTEXITCODE -ne 0) { throw "r8 external blocker refresh exited with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

Run-Step 'strict-vd-watch' {
  Push-Location $Repo
  try {
    & pnpm --silent check:0503-strict:vd-watch
    if ($LASTEXITCODE -ne 0) { throw "strict gate exited with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

$summary = [pscustomobject]@{
  schemaVersion = 'devhub-r8-admin-elevation-run-v1'
  generatedAt = (Get-Date).ToString('o')
  repo = $Repo
  identity = $identity.Name
  isAdministrator = $isAdmin
  serviceName = $ServiceName
  nodeExe = $NodeExe
  watchdogEntry = $WatchdogEntry
  externalReport = $ExternalReport
  logPath = $LogPath
  results = $results
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8
Write-Log "SUMMARY $SummaryPath"
Write-Log "R8 admin elevation run finished"
