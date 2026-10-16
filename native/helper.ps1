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

# Fullscreen Win32 API, Keyboard Media Key Fallbacks, and C# StdinListener
$pinvoke = @'
using System;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;

public class Win32Helper {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public static void SendMediaKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, 2, UIntPtr.Zero);
    }
}

public static class StdinListener {
    public static readonly ConcurrentQueue<string> Commands = new ConcurrentQueue<string>();
    private static Thread _thread;

    public static void Start() {
        if (_thread != null) return;
        _thread = new Thread(() => {
            while (true) {
                try {
                    string line = Console.ReadLine();
                    if (line == null) break;
                    string trimmed = line.Trim();
                    if (!string.IsNullOrEmpty(trimmed)) {
                        Commands.Enqueue(trimmed);
                    }
                } catch {
                    break;
                }
            }
        });
        _thread.IsBackground = true;
        _thread.Start();
    }

    public static string ReadNext() {
        string cmd;
        if (Commands.TryDequeue(out cmd)) {
            return cmd;
        }
        return null;
    }
}
'@
Add-Type -TypeDefinition $pinvoke -Language CSharp -ErrorAction SilentlyContinue

# Start background stdin thread safely in C#
[StdinListener]::Start()

$script:lastTrackKey = ""
$script:prevTrackArt = ""
$script:currentArt = ""
$script:trackChangedTick = 0
$script:artVerified = $false

function Get-MediaState {
    if ($null -eq $mgr) {
        return @{ ok = $false; error = "NoManager" }
    }
    try {
        $session = $mgr.GetCurrentSession()
        if ($null -eq $session) {
            $script:lastTrackKey = ""
            $script:prevTrackArt = ""
            $script:currentArt = ""
            $script:artVerified = $false
            return @{
                type = "media"
                hasSession = $false
                title = ""
                artist = ""
                album = ""
                isPlaying = $false
                position = 0
                duration = 0
                appTitle = ""
                albumArt = ""
            }
        }

        $propsOp = $session.TryGetMediaPropertiesAsync()
        $props = Await-WinRt -Operation $propsOp -ResultType $propTypes -TimeoutMs 1500
        $playback = $session.GetPlaybackInfo()

        $title = if ($props) { [string]$props.Title } else { "" }
        $artist = if ($props) { [string]$props.Artist } else { "" }
        $album = if ($props) { [string]$props.AlbumTitle } else { "" }
        $isPlaying = if ($playback) { $playback.PlaybackStatus.ToString() -eq "Playing" } else { $false }
        $sourceApp = $session.SourceAppUserModelId

        $currentTrackKey = "$sourceApp::$title::$artist"
        if ($currentTrackKey -ne $script:lastTrackKey) {
            $script:prevTrackArt = if ($script:currentArt) { $script:currentArt } else { $script:prevTrackArt }
            $script:lastTrackKey = $currentTrackKey
            $script:currentArt = ""
            $script:trackChangedTick = [Environment]::TickCount
            $script:artVerified = $false
        }

        # Read timeline with real-time elapsed position calculation
        $pos = 0
        $dur = 0
        try {
            $timeline = $session.GetTimelineProperties()
            if ($timeline) {
                $rawPos = $timeline.Position.TotalSeconds
                $dur = [math]::Round($timeline.EndTime.TotalSeconds)
                if ($isPlaying -and $timeline.LastUpdatedTime -and $timeline.LastUpdatedTime.Year -gt 2000) {
                    $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
                    if ($elapsed -gt 0) {
                        $rawPos += $elapsed
                    }
                }
                if ($dur -gt 0) {
                    $pos = [math]::Min($dur, [math]::Max(0, [math]::Round($rawPos)))
                } else {
                    $pos = [math]::Max(0, [math]::Round($rawPos))
                }
            }
        } catch {}

        # Read album art thumbnail with anti-lag stale image filter
        $art = ""
        if ($script:artVerified -and $script:currentArt) {
            $art = $script:currentArt
        } elseif ($props -and $props.Thumbnail -and $asStreamMethod) {
            try {
                $streamOp = $props.Thumbnail.OpenReadAsync()
                $stream = Await-WinRt -Operation $streamOp -ResultType $streamType -TimeoutMs 1500
                if ($stream) {
                    $netStream = $asStreamMethod.Invoke($null, @($stream))
                    if ($netStream) {
                        $ms = New-Object System.IO.MemoryStream
                        $netStream.CopyTo($ms)
                        $bytes = $ms.ToArray()
                        $ms.Dispose()
                        $netStream.Dispose()
                        if ($bytes.Length -gt 0) {
                            $mime = if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { "image/png" } else { "image/jpeg" }
                            $candidateArt = "data:$mime;base64," + [Convert]::ToBase64String($bytes)
                            
                            $elapsedSinceChange = [Environment]::TickCount - $script:trackChangedTick
                            
                            # If candidate art is identical to previous track's art and track changed recently (< 3.5s),
                            # Windows SMTC has not yet updated the thumbnail for this new track and is still serving the old one.
                            # Hold off so we NEVER display the previous song's thumbnail on the current song!
                            if ($script:prevTrackArt -and ($candidateArt -eq $script:prevTrackArt) -and ($elapsedSinceChange -lt 3500)) {
                                $art = ""
                            } else {
                                $art = $candidateArt
                                $script:currentArt = $candidateArt
                                $script:artVerified = $true
                            }
                        }
                    }
                }
            } catch {}
        }

        return @{
            type = "media"
            hasSession = $true
            title = $title
            artist = $artist
            album = $album
            isPlaying = $isPlaying
            position = $pos
            duration = $dur
            albumArt = $art
            appTitle = $sourceApp
        }
    } catch {
        return @{ type = "media"; hasSession = $false; error = $_.Exception.Message }
    }
}

function Get-BatteryState {
    try {
        $p = [System.Windows.Forms.SystemInformation]::PowerStatus
        $percent = [math]::Round($p.BatteryLifePercent * 100)
        $isCharging = ($p.PowerLineStatus.ToString() -eq "Online")
        return @{
            type = "battery"
            percent = $percent
            isCharging = $isCharging
            status = $p.PowerLineStatus.ToString()
        }
    } catch {
        return $null
    }
}

function Check-Fullscreen {
    try {
        $hWnd = [Win32Helper]::GetForegroundWindow()
        if ($hWnd -eq [IntPtr]::Zero) { return $false }

        $sb = New-Object System.Text.StringBuilder 256
        [void][Win32Helper]::GetClassName($hWnd, $sb, 256)
        $className = $sb.ToString()
        if ($className -in @("Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow")) {
            return $false
        }

        # Check window styles (GWL_STYLE = -16)
        $style = [Win32Helper]::GetWindowLong($hWnd, -16)
        $hasCaption = (($style -band 0x00C00000) -eq 0x00C00000)
        if ($hasCaption) {
            return $false
        }

        $rect = New-Object Win32Helper+RECT
        if ([Win32Helper]::GetWindowRect($hWnd, [ref]$rect)) {
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
            if ($rect.Left -le $screen.Left -and $rect.Top -le $screen.Top -and $rect.Right -ge $screen.Right -and $rect.Bottom -ge $screen.Bottom) {
                return $true
            }
        }
    } catch {}
    return $false
}

function Execute-MediaCmd([string]$cmd) {
    $executed = $false
    if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if ($session) {
            try {
                switch ($cmd.ToUpper().Trim()) {
                    "PLAY" {
                        $res = Await-WinRt -Operation ($session.TryPlayAsync()) -ResultType ([bool]) -TimeoutMs 1500
                        $executed = ($res -eq $true)
                    }
                    "PAUSE" {
                        $res = Await-WinRt -Operation ($session.TryPauseAsync()) -ResultType ([bool]) -TimeoutMs 1500
                        $executed = ($res -eq $true)
                    }
                    "TOGGLE" {
                        $res = Await-WinRt -Operation ($session.TryTogglePlayPauseAsync()) -ResultType ([bool]) -TimeoutMs 1500
                        $executed = ($res -eq $true)
                    }
                    "NEXT" {
                        $res = Await-WinRt -Operation ($session.TrySkipNextAsync()) -ResultType ([bool]) -TimeoutMs 1500
                        $executed = ($res -eq $true)
                    }
                    "PREVIOUS" {
                        $res = Await-WinRt -Operation ($session.TrySkipPreviousAsync()) -ResultType ([bool]) -TimeoutMs 1500
                        $executed = ($res -eq $true)
                    }
                }
            } catch {}
        }
    }

    # Universal Media Key Fallback
    if (-not $executed) {
        try {
            switch ($cmd.ToUpper().Trim()) {
                "PLAY"     { [Win32Helper]::SendMediaKey(0xB3) } # VK_MEDIA_PLAY_PAUSE
                "PAUSE"    { [Win32Helper]::SendMediaKey(0xB3) }
                "TOGGLE"   { [Win32Helper]::SendMediaKey(0xB3) }
                "NEXT"     { [Win32Helper]::SendMediaKey(0xB0) } # VK_MEDIA_NEXT_TRACK
                "PREVIOUS" { [Win32Helper]::SendMediaKey(0xB1) } # VK_MEDIA_PREV_TRACK
                "MUTE"     { [Win32Helper]::SendMediaKey(0xAD) } # VK_VOLUME_MUTE
            }
        } catch {}
    }
}

# Initial states output
$initialMedia = Get-MediaState
[Console]::WriteLine((ConvertTo-Json $initialMedia -Compress))

$initialBattery = Get-BatteryState
if ($initialBattery) {
    [Console]::WriteLine((ConvertTo-Json $initialBattery -Compress))
}

# Main loop
$lastTitle = ""
$lastStatus = $false
$lastPosition = -1
$lastAlbumArt = ""
$lastBatteryPercent = -1
$lastCharging = $false
$lastFullscreen = $false
$loopCount = 0

while ($true) {
    # Check for queued stdin commands from Electron
    while ($true) {
        $cmd = [StdinListener]::ReadNext()
        if ($null -eq $cmd) { break }
        Execute-MediaCmd -cmd $cmd
        Start-Sleep -Milliseconds 100
    }

    # Real-time media update (title, play/pause, position sync, or new thumbnail)
    $media = Get-MediaState
    $changed = ($media.title -ne $lastTitle) -or `
               ($media.isPlaying -ne $lastStatus) -or `
               ($media.albumArt -ne $lastAlbumArt) -or `
               ($media.isPlaying -and [math]::Abs($media.position - $lastPosition) -ge 1)

    if ($changed) {
        $lastTitle = $media.title
        $lastStatus = $media.isPlaying
        $lastPosition = $media.position
        $lastAlbumArt = $media.albumArt
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
    }

    if ($loopCount % 10 -eq 0) {
        $battery = Get-BatteryState
        if ($battery -and (($battery.percent -ne $lastBatteryPercent) -or ($battery.isCharging -ne $lastCharging))) {
            $lastBatteryPercent = $battery.percent
            $lastCharging = $battery.isCharging
            [Console]::WriteLine((ConvertTo-Json $battery -Compress))
        }
    }

    Start-Sleep -Milliseconds 350
}
