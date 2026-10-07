<#
  Brain Arena — one-time laptop setup for Windows 10/11 Mobile Hotspot.
  Right-click → "Run with PowerShell" (it asks for admin), or from an admin prompt:
      powershell -ExecutionPolicy Bypass -File .\setup-hotspot.ps1

  What it does:
    1. Raises the Mobile Hotspot client limit (WifiMaxPeers, default 8) to 128.
    2. Stops the hotspot from switching itself off when nobody is connected.
    3. Opens TCP port 4000 in Windows Firewall for the arena.
    4. Checks for a "Microsoft KM-TEST Loopback Adapter" — Windows only lets you
       start Mobile Hotspot when it has a connection to share. Sharing the
       loopback adapter means the hotspot works with NO internet at all
       (which is exactly what we want during an event).
    5. Restarts the hotspot service so the new limit applies.

  The real number of phones that stay stable depends on the laptop's Wi-Fi card.
  Most handle 40–60; do a dry run with friends before the event.
#>
param(
  [int]$MaxPeers = 128,
  [int]$Port = 4000
)

$ErrorActionPreference = "Stop"

# re-launch elevated if needed
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -MaxPeers $MaxPeers -Port $Port"
  exit
}

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Yellow }

Step "Raising Mobile Hotspot client limit to $MaxPeers"
$key = "HKLM:\SYSTEM\CurrentControlSet\Services\icssvc\Settings"
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
New-ItemProperty -Path $key -Name "WifiMaxPeers" -PropertyType DWord -Value $MaxPeers -Force | Out-Null
Write-Host "    WifiMaxPeers = $MaxPeers"

Step "Keeping the hotspot on when no devices are connected"
New-ItemProperty -Path $key -Name "PeerlessTimeoutEnabled" -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $key -Name "PeerlessTimeout" -PropertyType DWord -Value 120 -Force | Out-Null
Write-Host "    (also turn off Settings > Network > Mobile hotspot > Power saving, if you see it)"

Step "Allowing Brain Arena through Windows Firewall (TCP $Port)"
Get-NetFirewallRule -DisplayName "Brain Arena" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName "Brain Arena" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
Write-Host "    rule 'Brain Arena' added"

Step "Checking for a loopback adapter to share"
$loop = Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceDescription -like "*KM-TEST Loopback*" }
if ($loop) {
  Write-Host "    found: $($loop.Name)" -ForegroundColor Green
} else {
  Write-Host "    No loopback adapter yet. Add one (takes a minute, only once):" -ForegroundColor Cyan
  Write-Host "      1. In the window that opens: Next > 'Install the hardware that I manually select' > Next"
  Write-Host "      2. Network adapters > Next"
  Write-Host "      3. Manufacturer: Microsoft  >  Model: Microsoft KM-TEST Loopback Adapter > Next > Next > Finish"
  Write-Host "      4. Run this script again."
  Start-Process "hdwwiz.exe"
}

Step "Restarting the Mobile Hotspot service"
try {
  Restart-Service -Name icssvc -Force -ErrorAction Stop
  Write-Host "    icssvc restarted"
} catch {
  Write-Host "    couldn't restart icssvc now (it starts on demand) — a reboot also works" -ForegroundColor DarkYellow
}

Write-Host "`nAll set. On event day: double-click start-arena.bat." -ForegroundColor Green
Write-Host "In Settings > Mobile hotspot choose 'Share my connection from: <the loopback adapter>' once." -ForegroundColor Green
Read-Host "`nPress Enter to close"
