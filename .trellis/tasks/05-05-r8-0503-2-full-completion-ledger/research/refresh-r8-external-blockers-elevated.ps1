$ErrorActionPreference = 'Continue'
Set-Location 'D:\Desktop\CREATOR ONE'
$env:DEVHUB_R8_VD_FOREGROUND_WATCH = '1'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
"started=$(Get-Date -Format o) user=$([Security.Principal.WindowsIdentity]::GetCurrent().Name) admin=$isAdmin DEVHUB_R8_VD_FOREGROUND_WATCH=$env:DEVHUB_R8_VD_FOREGROUND_WATCH" | Out-File -FilePath 'D:\Desktop\CREATOR ONE\.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research\refresh-r8-external-blockers-elevated.log' -Encoding UTF8
pnpm -C devhub check:r8-external-blockers -- --write-report '../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json' *>> 'D:\Desktop\CREATOR ONE\.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research\refresh-r8-external-blockers-elevated.log'
"exitCode=$LASTEXITCODE finished=$(Get-Date -Format o)" | Out-File -FilePath 'D:\Desktop\CREATOR ONE\.trellis\tasks\05-05-r8-0503-2-full-completion-ledger\research\refresh-r8-external-blockers-elevated.log' -Encoding UTF8 -Append
exit $LASTEXITCODE