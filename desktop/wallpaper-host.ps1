param(
  [Parameter(Mandatory = $true)][string]$WindowHandle,
  [Parameter(Mandatory = $true)][string]$StateFile
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class MusicWallDesktop {
  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr FindWindow(string className, string windowName);

  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string windowName);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern IntPtr SetParent(IntPtr child, IntPtr parent);

  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW", SetLastError=true)]
  public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);

  [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW", SetLastError=true)]
  public static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool ShowWindow(IntPtr hwnd, int command);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern int GetSystemMetrics(int index);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool IsWindow(IntPtr hwnd);
}
'@

$hwnd = [IntPtr]::new([Convert]::ToInt64($WindowHandle, 16))
if (-not [MusicWallDesktop]::IsWindow($hwnd)) { throw 'MusicWall window handle is invalid.' }

$GWL_STYLE = -16
$WS_CHILD = 0x40000000L
$WS_POPUP = 0x80000000L
$WS_CAPTION = 0x00C00000L
$WS_THICKFRAME = 0x00040000L
$WS_MINIMIZEBOX = 0x00020000L
$WS_MAXIMIZEBOX = 0x00010000L
$WS_SYSMENU = 0x00080000L
$removeStyle = $WS_POPUP -bor $WS_CAPTION -bor $WS_THICKFRAME -bor $WS_MINIMIZEBOX -bor $WS_MAXIMIZEBOX -bor $WS_SYSMENU
$SWP_NOZORDER = 0x0004
$SWP_NOACTIVATE = 0x0010
$SWP_FRAMECHANGED = 0x0020
$SW_SHOWNOACTIVATE = 4

function Get-DesktopHost {
  $progman = [MusicWallDesktop]::FindWindow('Progman', $null)
  if ($progman -eq [IntPtr]::Zero) { return [IntPtr]::Zero }
  $result = [IntPtr]::Zero
  [void][MusicWallDesktop]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result)

  $script:foundHost = [IntPtr]::Zero
  $callback = [MusicWallDesktop+EnumWindowsProc]{
    param([IntPtr]$top, [IntPtr]$unused)
    $view = [MusicWallDesktop]::FindWindowEx($top, [IntPtr]::Zero, 'SHELLDLL_DefView', $null)
    if ($view -ne [IntPtr]::Zero) {
      $script:foundHost = [MusicWallDesktop]::FindWindowEx([IntPtr]::Zero, $top, 'WorkerW', $null)
      return $false
    }
    return $true
  }
  [void][MusicWallDesktop]::EnumWindows($callback, [IntPtr]::Zero)
  if ($script:foundHost -ne [IntPtr]::Zero) { return $script:foundHost }
  return $progman
}

$originalStyle = [MusicWallDesktop]::GetWindowLongPtr($hwnd, $GWL_STYLE)
$lastHost = [IntPtr]::Zero
$state = 'wallpaper'
while ([MusicWallDesktop]::IsWindow($hwnd)) {
  if (Test-Path -LiteralPath $StateFile) {
    $requested = (Get-Content -LiteralPath $StateFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($requested -eq 'stop') { break }
  }

  $host = Get-DesktopHost
  if ($host -ne [IntPtr]::Zero -and $host -ne $lastHost) {
    [void][MusicWallDesktop]::SetParent($hwnd, $host)
    $style = [MusicWallDesktop]::GetWindowLongPtr($hwnd, $GWL_STYLE).ToInt64()
    $style = ($style -band (-bnot $removeStyle)) -bor $WS_CHILD
    [void][MusicWallDesktop]::SetWindowLongPtr($hwnd, $GWL_STYLE, [IntPtr]::new($style))
    $width = [MusicWallDesktop]::GetSystemMetrics(78)
    $height = [MusicWallDesktop]::GetSystemMetrics(79)
    if ($width -le 0) { $width = [MusicWallDesktop]::GetSystemMetrics(0) }
    if ($height -le 0) { $height = [MusicWallDesktop]::GetSystemMetrics(1) }
    [void][MusicWallDesktop]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, $width, $height, $SWP_NOZORDER -bor $SWP_NOACTIVATE -bor $SWP_FRAMECHANGED)
    [void][MusicWallDesktop]::ShowWindow($hwnd, $SW_SHOWNOACTIVATE)
    $lastHost = $host
    try { Set-Content -LiteralPath $StateFile -Value 'attached' -NoNewline } catch {}
  }
  Start-Sleep -Milliseconds 1500
}

# The host process is ending with MusicWall; do not leave a stale control file.
try { Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue } catch {}
