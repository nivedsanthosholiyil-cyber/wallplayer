param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition ([IO.File]::ReadAllText($Source))
$window=New-Object System.Windows.Forms.Form
$inputWindow=New-Object System.Windows.Forms.Form
try {
    $handle=$window.Handle
    $inputHandle=$inputWindow.Handle
    $flags=[Reflection.BindingFlags]'Static,NonPublic'
    $type=[MusicWallWallpaper]
    $get=$type.GetMethod('GetLong',$flags)
    $set=$type.GetMethod('SetLong',$flags)
    $style=$type.GetMethod('Style',$flags)
    $original=$get.Invoke($null,@($handle,-16)).ToInt64()
    $hostWindow=New-Object MusicWallWallpaper($handle.ToInt64().ToString('X'),[uint32]$PID)
    $hostWindow.SetInputWindow($inputHandle.ToInt64().ToString('X'),[uint32]$PID)
    # Seed an error before restoring an already-null owner. Never attach these
    # hidden, fixture-owned windows to Explorer or touch the user's application.
    $null=$set.Invoke($null,@([IntPtr]::Zero,-8,[IntPtr]::Zero))
    $style.Invoke($null,@($handle,-16,($original -bor 0x08000000L)))
    $changed=$get.Invoke($null,@($handle,-16)).ToInt64()
    for ($cycle=0; $cycle -lt 3; $cycle++) { $hostWindow.Restore($false) }
    $restored=$get.Invoke($null,@($handle,-16)).ToInt64()
    $owner=$get.Invoke($null,@($inputHandle,-8)).ToInt64()
    $invalidRejected=$false
    try { $style.Invoke($null,@([IntPtr]::Zero,-8,[long]0)) }
    catch { $invalidRejected=$_.Exception.InnerException -is [ComponentModel.Win32Exception] }
    @{ changed=($changed -ne $original); restored=($restored -eq $original); owner=$owner; cycles=3; invalidRejected=$invalidRejected } | ConvertTo-Json -Compress
} finally {
    $inputWindow.Dispose()
    $window.Dispose()
}
