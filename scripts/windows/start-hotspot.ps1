<#
  Turns on Windows Mobile Hotspot (no clicking around in Settings) and prints
  the Wi-Fi name and password to tell students. Called by start-arena.bat.
  Prefers sharing the KM-TEST loopback adapter so the hotspot has no internet.
#>
$ErrorActionPreference = "SilentlyContinue"

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  function Await($op, [Type]$type) {
    $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
  }

  [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime] | Out-Null
  [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime] | Out-Null

  # pick the loopback adapter's profile if it exists, else whatever is connected
  $loop = Get-NetAdapter -IncludeHidden | Where-Object { $_.InterfaceDescription -like "*KM-TEST Loopback*" } | Select-Object -First 1
  $profiles = [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()
  $profile = $null
  if ($loop) {
    $profile = $profiles | Where-Object { $_.NetworkAdapter -and $_.NetworkAdapter.NetworkAdapterId.ToString() -eq $loop.InterfaceGuid.Trim("{}") } | Select-Object -First 1
  }
  if (-not $profile) { $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile() }
  if (-not $profile) { $profile = $profiles | Select-Object -First 1 }
  if (-not $profile) { throw "No network connection to share. Run setup-hotspot.ps1 to add the loopback adapter." }

  $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  if ($tm.TetheringOperationalState -ne "On") {
    $res = Await ($tm.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
    if ($res.Status -ne "Success") { throw "Hotspot didn't start: $($res.Status) $($res.AdditionalErrorMessage)" }
  }
  $cfg = $tm.GetCurrentAccessPointConfiguration()
  Write-Host ""
  Write-Host "  Mobile Hotspot is ON  (sharing: $($profile.ProfileName))" -ForegroundColor Green
  Write-Host "  Wi-Fi name : $($cfg.Ssid)"
  Write-Host "  Password   : $($cfg.Passphrase)"
  Write-Host "  Max phones : $($tm.MaxClientCount)"
  Write-Host ""
} catch {
  Write-Host ""
  Write-Host "  Couldn't switch on Mobile Hotspot automatically: $($_.Exception.Message)" -ForegroundColor DarkYellow
  Write-Host "  Turn it on from Settings > Network & internet > Mobile hotspot, then carry on." -ForegroundColor DarkYellow
  Write-Host ""
}
