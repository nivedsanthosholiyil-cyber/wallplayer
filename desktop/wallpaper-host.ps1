param(
  [string]$WindowHandle,
  [string]$InputHandle,
  [int]$ParentPid,
  [ValidateSet('wallpaper','window')][string]$InitialMode = 'wallpaper',
  [switch]$Probe
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Send-Status($Message) {
  [Console]::Out.WriteLine(($Message | ConvertTo-Json -Compress -Depth 5))
  [Console]::Out.Flush()
}
$native = $null
$stopping = $false
try {
  Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wallpaper-native.cs')))
  if ($Probe) {
    if ($WindowHandle -and $ParentPid) {
      $probeWindow = [MusicWallWallpaper]::new($WindowHandle, [uint32]$ParentPid)
      Send-Status @{ type='probe'; window=$probeWindow.InspectNormal() }
    } else { Send-Status @{ type='probe'; windows=[MusicWallWallpaper]::DesktopWindows() } }
    exit 0
  }
  $native = [MusicWallWallpaper]::new($WindowHandle, [uint32]$ParentPid)
  if ($InputHandle) { $native.SetInputWindow($InputHandle, [uint32]$ParentPid) }
  $mode = $InitialMode
  if ($mode -eq 'wallpaper') { $details = $native.EnsureAttached() }
  else { $native.Restore($true); $details = $native.InspectNormal() }
  Send-Status @{ type='ready'; mode=$mode; details=$details; pid=$PID }
  [MusicWallWallpaper]::StartInput()
  $lastCheck = [DateTime]::UtcNow
  $lastStatus = [DateTime]::UtcNow
  $recoveringSince = $null
  while ($true) {
    $line = [MusicWallWallpaper]::ReadCommand()
    if ($null -ne $line) {
      $command = $line | ConvertFrom-Json
      if ($command.type -eq 'stop') { $stopping=$true; break }
      if ($command.type -ne 'mode' -or $command.mode -notin @('window','wallpaper')) { throw 'Invalid wallpaper helper command.' }
      $mode = $command.mode
      if ($mode -eq 'window') { $native.Restore($true); $details = $native.InspectNormal() }
      else { $details = $native.EnsureAttached() }
      Send-Status @{ type='mode'; mode=$mode; id=$command.id; details=$details }
    }
    elseif ([MusicWallWallpaper]::InputClosed) { $stopping=$true; break }
    if (([DateTime]::UtcNow-$lastCheck).TotalMilliseconds -ge 500) {
      if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { $stopping=$true; break }
      if (-not [MusicWallWallpaper]::IsWindow([IntPtr]::new([Convert]::ToInt64($WindowHandle,16)))) {
        Send-Status @{ type='window-lost' }; $stopping=$true; break
      }
      if ($mode -eq 'wallpaper') {
        try { $details=$native.EnsureAttached(); $recoveringSince=$null }
        catch {
          if ($_.Exception.Message -notmatch 'Explorer has no verified|Explorer did not respond') { throw }
          if ($null -eq $recoveringSince) { $recoveringSince=[DateTime]::UtcNow }
          if (([DateTime]::UtcNow-$recoveringSince).TotalSeconds -ge 25) { throw }
          Send-Status @{ type='recovering'; message='Waiting for the Explorer desktop host' }
          Start-Sleep -Milliseconds 400
          continue
        }
      }
      $lastCheck=[DateTime]::UtcNow
      if (($lastCheck-$lastStatus).TotalSeconds -ge 5) {
        Send-Status @{ type='heartbeat'; mode=$mode; details=$details }
        $lastStatus=$lastCheck
      }
    }
    Start-Sleep -Milliseconds 100
  }
} catch {
  Send-Status @{ type='error'; message=$_.Exception.Message }
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
} finally {
  if ($native) {
    try { $native.Restore(-not $stopping) }
    catch { [Console]::Error.WriteLine('Window restoration failed: '+$_.Exception.Message) }
  }
}
