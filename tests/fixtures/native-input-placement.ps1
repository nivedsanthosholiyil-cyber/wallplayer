param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition ([IO.File]::ReadAllText($Source))
# Hidden test-owned windows only: no Explorer attachment or user window changes.
$ownerWindow=New-Object System.Windows.Forms.Form
$renderWindow=New-Object System.Windows.Forms.Form
$inputWindow=New-Object System.Windows.Forms.Form
$icons=New-Object System.Windows.Forms.Panel
$ownerWindow.Controls.Add($icons)
try {
    $ownerHandle=$ownerWindow.Handle
    $hostWindow=New-Object MusicWallWallpaper($renderWindow.Handle.ToInt64().ToString('X'),[uint32]$PID)
    $hostWindow.SetInputWindow($inputWindow.Handle.ToInt64().ToString('X'),[uint32]$PID)
    $attach=[MusicWallWallpaper].GetMethod('AttachInput',[Reflection.BindingFlags]'Instance,NonPublic')
    for ($cycle=0; $cycle -lt 30; $cycle++) {
        $attach.Invoke($hostWindow,@($icons.Handle,120,80,640,480))
    }
    $get=[MusicWallWallpaper].GetMethod('GetLong',[Reflection.BindingFlags]'Static,NonPublic')
    @{ cycles=30; ownerRetained=($get.Invoke($null,@($inputWindow.Handle,-8)).ToInt64() -eq $ownerHandle.ToInt64());
        width=$inputWindow.Bounds.Width; height=$inputWindow.Bounds.Height } | ConvertTo-Json -Compress
    $hostWindow.Restore($false)
} finally {
    $inputWindow.Dispose(); $renderWindow.Dispose(); $ownerWindow.Dispose()
}
