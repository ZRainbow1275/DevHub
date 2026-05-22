$ErrorActionPreference = 'Continue'
$repoRoot = 'D:\Desktop\CREATOR ONE'
$devhubRoot = Join-Path $repoRoot 'devhub'
$diagDir = Join-Path $repoRoot '.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research\zero-egress-diagnostics'
New-Item -ItemType Directory -Force -Path $diagDir | Out-Null
$logPath = Join-Path $diagDir 'no-command-10s.log'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
"started=$(Get-Date -Format o) user=$([Security.Principal.WindowsIdentity]::GetCurrent().Name) admin=$isAdmin" | Out-File -FilePath $logPath -Encoding UTF8
Set-Location -LiteralPath $devhubRoot
node .\scripts\verify-zero-egress-capture.mjs --duration-seconds=10 --no-command --output-dir="$diagDir" *>> $logPath
"exitCode=$LASTEXITCODE finished=$(Get-Date -Format o)" | Out-File -FilePath $logPath -Encoding UTF8 -Append
