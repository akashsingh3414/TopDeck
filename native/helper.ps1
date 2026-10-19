# Native Windows helper for TopDeck
# Exposes SMTC Media Session, Battery, and Fullscreen detection via stdout JSON
# Listens for stdin commands: TOGGLE, PLAY, PAUSE, NEXT, PREVIOUS, STATUS

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$runtimeAssembly = [AppDomain]::CurrentDomain.GetAssemblies() |
    Where-Object { $_.GetName().Name -eq 'System.Runtime.WindowsRuntime' } |
    Select-Object -First 1

$asTaskGeneric = $runtimeAssembly.GetType('System.WindowsRuntimeSystemExtensions').GetMethods(
    [System.Reflection.BindingFlags]'Public,Static'
) | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Length -eq 1
} | Select-Object -First 1

function Await-WinRt {
    param($Operation, [type]$ResultType, [int]$TimeoutMs = 2000)
    if ($null -eq $Operation -or $null -eq $asTaskGeneric) { return $null }
    try {
        $closed = $asTaskGeneric.MakeGenericMethod(@($ResultType))
        $task = $closed.Invoke($null, @($Operation))
        if ($task.Wait($TimeoutMs)) {
            return $task.GetAwaiter().GetResult()
        }
    } catch {
        return $null
    }
    return $null
}

$asStreamMethod = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [type[]]@([Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType=WindowsRuntime]))
$streamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$propTypes = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]

$mgrReq = $managerType::RequestAsync()
$mgr = Await-WinRt -Operation $mgrReq -ResultType $managerType -TimeoutMs 4000

$radioType = [Windows.Devices.Radios.Radio, Windows.Devices.Radios, ContentType=WindowsRuntime]
$script:radios = $null

function Refresh-Radios {
    try {
        $accessReq = $radioType::RequestAccessAsync()
        [void](Await-WinRt -Operation $accessReq -ResultType ([Windows.Devices.Radios.RadioAccessStatus]) -TimeoutMs 2000)
        $radiosOp = $radioType::GetRadiosAsync()
        $script:radios = Await-WinRt -Operation $radiosOp -ResultType ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]) -TimeoutMs 2000
    } catch {}
}
Refresh-Radios

. (Join-Path $PSScriptRoot 'modules\NativeInterop.ps1')

# Feature modules share the runtime initialized above and write protocol messages to stdout.
. (Join-Path $PSScriptRoot 'modules\Media.ps1')
. (Join-Path $PSScriptRoot 'modules\SystemState.ps1')
. (Join-Path $PSScriptRoot 'modules\Commands.ps1')

$initialMedia = Get-MediaState
[Console]::WriteLine((ConvertTo-Json $initialMedia -Compress))

$initialBattery = Get-BatteryState
if ($initialBattery) {
    [Console]::WriteLine((ConvertTo-Json $initialBattery -Compress))
}

$initialRadios = Get-RadiosState
if ($initialRadios) {
    [Console]::WriteLine((ConvertTo-Json $initialRadios -Compress))
}

$initialAudio = Get-AudioState
if ($initialAudio) {
    [Console]::WriteLine((ConvertTo-Json $initialAudio -Compress))
}

$initialBrightness = Get-BrightnessState
if ($initialBrightness) {
    [Console]::WriteLine((ConvertTo-Json $initialBrightness -Compress))
}

# Main loop
$lastTitle = ""
$lastStatus = $false
$lastAlbumArt = ""
$lastPosition = -1
$lastDuration = -1
$lastBatteryPercent = -1
$lastCharging = $false
$lastFullscreen = $false
$lastWifiEnabled = $null
$lastWifiConnected = $null
$lastWifiSsid = ""
$lastBtEnabled = $null
$lastBtConnected = $null
$lastMuted = if ($initialAudio) { $initialAudio.muted } else { $null }
$lastVolume = if ($initialAudio) { $initialAudio.volume } else { $null }
$lastBrightness = if ($initialBrightness) { $initialBrightness.level } else { -1 }
$loopCount = 0

while ($true) {
    # Check for queued stdin commands from Electron
    while ($true) {
        $cmd = [StdinListener]::ReadNext()
        if ($null -eq $cmd) { break }
        Invoke-MediaCommand -cmd $cmd
        Start-Sleep -Milliseconds 100
    }

    # Real-time media update (title, play/pause, or new thumbnail)
    $media = Get-MediaState
    $changed = ($media.title -ne $lastTitle) -or `
               ($media.isPlaying -ne $lastStatus) -or `
               ($media.albumArt -ne $lastAlbumArt) -or `
               ($media.position -ne $lastPosition) -or `
               ($media.duration -ne $lastDuration)

    if ($changed) {
        $lastTitle = $media.title
        $lastStatus = $media.isPlaying
        $lastAlbumArt = $media.albumArt
        $lastPosition = $media.position
        $lastDuration = $media.duration
        [Console]::WriteLine((ConvertTo-Json $media -Compress))
    }

    # Fullscreen and Battery checks
    $loopCount++
    if ($loopCount % 2 -eq 0) {
        $isFullscreen = Check-Fullscreen
        if ($isFullscreen -ne $lastFullscreen) {
            $lastFullscreen = $isFullscreen
            [Console]::WriteLine((ConvertTo-Json @{ type = "fullscreen"; isFullscreen = $isFullscreen } -Compress))
        }

        # Catch mute/volume changes made outside TopDeck (keyboard keys, taskbar flyout)
        $aState = Get-AudioState
        if ($aState -and (($aState.muted -ne $lastMuted) -or ($aState.volume -ne $lastVolume))) {
            $lastMuted = $aState.muted
            $lastVolume = $aState.volume
            [Console]::WriteLine((ConvertTo-Json $aState -Compress))
        }
    }

    if ($loopCount % 8 -eq 0) {
        $rState = Get-RadiosState
        if ($rState -and (($rState.wifiEnabled -ne $lastWifiEnabled) -or `
                          ($rState.wifiConnected -ne $lastWifiConnected) -or `
                          ($rState.wifiSsid -ne $lastWifiSsid) -or `
                          ($rState.btEnabled -ne $lastBtEnabled) -or `
                          ($rState.btConnected -ne $lastBtConnected))) {
            $lastWifiEnabled = $rState.wifiEnabled
            $lastWifiConnected = $rState.wifiConnected
            $lastWifiSsid = $rState.wifiSsid
            $lastBtEnabled = $rState.btEnabled
            $lastBtConnected = $rState.btConnected
            [Console]::WriteLine((ConvertTo-Json $rState -Compress))
        }
    }

    if ($loopCount % 10 -eq 0) {
        $battery = Get-BatteryState
        if ($battery -and (($battery.percent -ne $lastBatteryPercent) -or ($battery.isCharging -ne $lastCharging))) {
            $lastBatteryPercent = $battery.percent
            $lastCharging = $battery.isCharging
            [Console]::WriteLine((ConvertTo-Json $battery -Compress))
        }

        $bState = Get-BrightnessState
        if ($bState -and ($bState.level -ne $lastBrightness)) {
            $lastBrightness = $bState.level
            [Console]::WriteLine((ConvertTo-Json $bState -Compress))
        }
    }

    Start-Sleep -Milliseconds 350
}
