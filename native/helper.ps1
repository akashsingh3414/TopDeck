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
        $radiosOp = $radioType::GetRadiosAsync()
        $script:radios = Await-WinRt -Operation $radiosOp -ResultType ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]) -TimeoutMs 2000
    } catch {}
}
Refresh-Radios

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

// Core Audio (default render endpoint) for reading and setting the real system mute state
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorCom {}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator {
    int NotImpl_EnumAudioEndpoints();
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume {
    int NotImpl_RegisterControlChangeNotify();
    int NotImpl_UnregisterControlChangeNotify();
    int NotImpl_GetChannelCount();
    int NotImpl_SetMasterVolumeLevel();
    [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int NotImpl_GetMasterVolumeLevel();
    [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
    int NotImpl_SetChannelVolumeLevel();
    int NotImpl_SetChannelVolumeLevelScalar();
    int NotImpl_GetChannelVolumeLevel();
    int NotImpl_GetChannelVolumeLevelScalar();
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
}

public static class AudioHelper {
    // Re-resolved on every call so switching output devices is picked up
    private static IAudioEndpointVolume GetEndpoint() {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom());
            IMMDevice device;
            // eRender = 0, eMultimedia = 1
            if (enumerator.GetDefaultAudioEndpoint(0, 1, out device) != 0 || device == null) return null;
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            object o;
            // CLSCTX_ALL = 23
            if (device.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return null;
            return o as IAudioEndpointVolume;
        } catch {
            return null;
        }
    }

    // Returns 1 = muted, 0 = unmuted, -1 = unavailable
    public static int GetMute() {
        var ep = GetEndpoint();
        if (ep == null) return -1;
        bool muted;
        if (ep.GetMute(out muted) != 0) return -1;
        return muted ? 1 : 0;
    }

    // Returns 0-100, or -1 when unavailable
    public static int GetVolume() {
        var ep = GetEndpoint();
        if (ep == null) return -1;
        float level;
        if (ep.GetMasterVolumeLevelScalar(out level) != 0) return -1;
        return (int)Math.Round(level * 100);
    }

    // level 0-100; also unmutes, like the Windows volume flyout does
    public static bool SetVolume(int level) {
        var ep = GetEndpoint();
        if (ep == null) return false;
        Guid ctx = Guid.Empty;
        float scalar = Math.Max(0, Math.Min(100, level)) / 100f;
        if (ep.SetMasterVolumeLevelScalar(scalar, ref ctx) != 0) return false;
        if (level > 0) ep.SetMute(false, ref ctx);
        return true;
    }

    public static bool SetMute(bool mute) {
        var ep = GetEndpoint();
        if (ep == null) return false;
        Guid ctx = Guid.Empty;
        return ep.SetMute(mute, ref ctx) == 0;
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
$script:lastArtReadTick = 0

function Get-MediaState {
    if ($null -eq $mgr) {
        return @{ ok = $false; error = "NoManager" }
    }
    try {
        # Check all sessions first to find any actively PLAYING session
        $session = $null
        try {
            $allSessions = $mgr.GetSessions()
            if ($allSessions -and $allSessions.Count -gt 0) {
                foreach ($s in $allSessions) {
                    try {
                        $pinfo = $s.GetPlaybackInfo()
                        if ($pinfo -and $pinfo.PlaybackStatus.ToString() -eq "Playing") {
                            $session = $s
                            break
                        }
                    } catch {}
                }
            }
        } catch {}

        # If no session is actively playing, fall back to GetCurrentSession()
        if ($null -eq $session) {
            $session = $mgr.GetCurrentSession()
        }

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

        # Read album art thumbnail with anti-lag stale image filter.
        # Apps (browsers especially, on auto-advance) can publish the real cover several seconds after
        # the track changes, so an accepted thumbnail is not final: re-read on every poll for the first
        # 10s of a track, then every 5s, and switch whenever the image changes.
        $sinceChange = [Environment]::TickCount - $script:trackChangedTick
        $sinceArtRead = [Environment]::TickCount - $script:lastArtReadTick
        $needArtRead = (-not $script:artVerified) -or ($sinceChange -lt 10000) -or ($sinceArtRead -ge 5000) -or ($sinceArtRead -lt 0)
        $art = $script:currentArt
        if ($needArtRead -and $props -and $props.Thumbnail -and $asStreamMethod) {
            $script:lastArtReadTick = [Environment]::TickCount
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
                            
                            # Windows briefly serves the previous song's thumbnail right after a track change,
                            # so reject an identical image only during that short window. After it, an identical
                            # image is genuine (same album, or the app just filled in title/artist late).
                            $inStaleWindow = ($sinceChange -ge 0 -and $sinceChange -lt 2500)
                            if ($inStaleWindow -and $script:prevTrackArt -and ($candidateArt -eq $script:prevTrackArt)) {
                                $art = $script:currentArt
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

function Get-RadiosState {
    try {
        $wifiName = ""
        $wifiSignal = 0
        $wifiConnected = $false
        
        $wlanOut = netsh wlan show interfaces 2>$null
        if ($wlanOut) {
            foreach ($line in $wlanOut) {
                if ($line -match '^\s*State\s*:\s*(.+)$') {
                    $wifiConnected = ($matches[1].Trim() -eq 'connected')
                }
                if ($line -match '^\s*SSID\s*:\s*(.+)$') {
                    $wifiName = $matches[1].Trim()
                }
                if ($line -match '^\s*Signal\s*:\s*(\d+)%') {
                    $wifiSignal = [int]$matches[1]
                }
            }
        }
        
        $btState = $false
        $wifiState = $wifiConnected
        
        if ($script:radios) {
            foreach ($r in $script:radios) {
                if ($r.Kind.ToString() -eq "Bluetooth") {
                    $btState = ($r.State.ToString() -eq "On")
                }
                if ($r.Kind.ToString() -eq "WiFi") {
                    $wifiState = ($r.State.ToString() -eq "On")
                }
            }
        }

        return @{
            type = "radios"
            wifiEnabled = $wifiState
            wifiConnected = $wifiConnected
            wifiSsid = $wifiName
            wifiSignal = $wifiSignal
            btEnabled = $btState
        }
    } catch {
        return $null
    }
}

function Get-AudioState {
    try {
        $muted = [AudioHelper]::GetMute()
        if ($muted -lt 0) { return $null }
        return @{
            type = "audio"
            muted = ($muted -eq 1)
            volume = [AudioHelper]::GetVolume()
        }
    } catch {
        return $null
    }
}

function Get-WifiProfiles {
    $names = @()
    foreach ($line in (netsh wlan show profiles 2>$null)) {
        if ($line -match 'All User Profile\s*:\s*(.+)$') { $names += $matches[1].Trim() }
    }
    return $names
}

# Nearby networks (what Windows last scanned), strongest first, deduped by SSID
function Get-WifiList {
    try {
        $known = Get-WifiProfiles
        $connected = (Get-RadiosState).wifiSsid
        $networks = @{}
        $current = $null
        foreach ($line in (netsh wlan show networks mode=bssid 2>$null)) {
            if ($line -match '^SSID \d+\s*:\s*(.*)$') {
                $ssid = $matches[1].Trim()
                $current = if ($ssid) { $ssid } else { $null }
                if ($current -and -not $networks.ContainsKey($current)) {
                    $networks[$current] = @{ ssid = $current; signal = 0; secured = $true }
                }
            } elseif ($current -and $line -match '^\s*Authentication\s*:\s*(.+)$') {
                $networks[$current].secured = ($matches[1].Trim() -ne 'Open')
            } elseif ($current -and $line -match '^\s*Signal\s*:\s*(\d+)%') {
                $networks[$current].signal = [math]::Max($networks[$current].signal, [int]$matches[1])
            }
        }
        if ($connected -and -not $networks.ContainsKey($connected)) {
            $networks[$connected] = @{ ssid = $connected; signal = (Get-RadiosState).wifiSignal; secured = $true }
        }
        $list = @($networks.Values | ForEach-Object {
            @{ ssid = $_.ssid; signal = $_.signal; secured = $_.secured; known = ($known -contains $_.ssid); connected = ($_.ssid -eq $connected) }
        } | Sort-Object -Property @{ Expression = { $_.connected }; Descending = $true }, @{ Expression = { $_.signal }; Descending = $true })
        return @{ type = "wifiList"; networks = $list }
    } catch {
        return @{ type = "wifiList"; networks = @() }
    }
}

# Paired classic Bluetooth devices with their connection state
function Get-BluetoothList {
    try {
        $devs = @(Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'BTHENUM\DEV_*' })
        $list = @()
        if ($devs.Count -gt 0) {
            # DEVPKEY_Device_IsConnected (one batched call for all devices)
            $props = @(Get-PnpDeviceProperty -InstanceId ($devs | ForEach-Object { $_.InstanceId }) -KeyName '{83DA6326-97A6-4088-9453-A1923F573B29} 15' -ErrorAction SilentlyContinue)
            foreach ($d in $devs) {
                $p = $props | Where-Object { $_.InstanceId -eq $d.InstanceId } | Select-Object -First 1
                $list += @{ name = $d.FriendlyName; connected = ($p -and $p.Data -eq $true) }
            }
        }
        $list = @($list | Sort-Object -Property @{ Expression = { $_.connected }; Descending = $true }, @{ Expression = { $_.name } })
        return @{ type = "btList"; devices = $list }
    } catch {
        return @{ type = "btList"; devices = @() }
    }
}

function Execute-MediaCmd([string]$cmd) {
    $executed = $false
    $uCmd = $cmd.ToUpper().Trim()

    if ($uCmd -eq "LIST_WIFI") {
        [Console]::WriteLine((ConvertTo-Json (Get-WifiList) -Compress -Depth 4))
        return
    }

    if ($uCmd -eq "LIST_BT") {
        [Console]::WriteLine((ConvertTo-Json (Get-BluetoothList) -Compress -Depth 4))
        return
    }

    # CONNECT_WIFI:<ssid> (case-sensitive SSID). Only saved networks; anything else goes to Settings.
    if ($cmd.Trim() -match '^CONNECT_WIFI:(.+)$') {
        $ssid = $matches[1]
        if ((Get-WifiProfiles) -contains $ssid -and $ssid -notmatch '"') {
            netsh wlan connect "name=$ssid" 2>$null | Out-Null
            Start-Sleep -Milliseconds 1500
        }
        $rState = Get-RadiosState
        if ($rState) { [Console]::WriteLine((ConvertTo-Json $rState -Compress)) }
        [Console]::WriteLine((ConvertTo-Json (Get-WifiList) -Compress -Depth 4))
        return
    }

    if ($uCmd -match '^SET_VOLUME:(\d{1,3})$') {
        [void][AudioHelper]::SetVolume([int]$matches[1])
        $aState = Get-AudioState
        if ($aState) { [Console]::WriteLine((ConvertTo-Json $aState -Compress)) }
        return
    }

    if ($uCmd -eq "MUTE") {
        $current = [AudioHelper]::GetMute()
        $ok = $false
        if ($current -ge 0) { $ok = [AudioHelper]::SetMute($current -ne 1) }
        if (-not $ok) { [Win32Helper]::SendMediaKey(0xAD) } # VK_VOLUME_MUTE fallback
        $aState = Get-AudioState
        if ($aState) { [Console]::WriteLine((ConvertTo-Json $aState -Compress)) }
        return
    }

    if ($uCmd -in @("TOGGLE_WIFI", "WIFI_TOGGLE")) {
        Refresh-Radios
        if ($script:radios) {
            $wf = $script:radios | Where-Object { $_.Kind.ToString() -eq "WiFi" } | Select-Object -First 1
            if ($wf) {
                $next = if ($wf.State.ToString() -eq "On") { [Windows.Devices.Radios.RadioState]::Off } else { [Windows.Devices.Radios.RadioState]::On }
                [void](Await-WinRt -Operation ($wf.SetStateAsync($next)) -ResultType ([Windows.Devices.Radios.RadioAccessStatus]) -TimeoutMs 2000)
            }
        }
        $rState = Get-RadiosState
        if ($rState) { [Console]::WriteLine((ConvertTo-Json $rState -Compress)) }
        return
    }

    if ($uCmd -in @("TOGGLE_BT", "BT_TOGGLE")) {
        Refresh-Radios
        if ($script:radios) {
            $bt = $script:radios | Where-Object { $_.Kind.ToString() -eq "Bluetooth" } | Select-Object -First 1
            if ($bt) {
                $next = if ($bt.State.ToString() -eq "On") { [Windows.Devices.Radios.RadioState]::Off } else { [Windows.Devices.Radios.RadioState]::On }
                [void](Await-WinRt -Operation ($bt.SetStateAsync($next)) -ResultType ([Windows.Devices.Radios.RadioAccessStatus]) -TimeoutMs 2000)
            }
        }
        $rState = Get-RadiosState
        if ($rState) { [Console]::WriteLine((ConvertTo-Json $rState -Compress)) }
        return
    }

    if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if ($session) {
            try {
                switch ($uCmd) {
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
            switch ($uCmd) {
                "PLAY"     { [Win32Helper]::SendMediaKey(0xB3) } # VK_MEDIA_PLAY_PAUSE
                "PAUSE"    { [Win32Helper]::SendMediaKey(0xB3) }
                "TOGGLE"   { [Win32Helper]::SendMediaKey(0xB3) }
                "NEXT"     { [Win32Helper]::SendMediaKey(0xB0) } # VK_MEDIA_NEXT_TRACK
                "PREVIOUS" { [Win32Helper]::SendMediaKey(0xB1) } # VK_MEDIA_PREV_TRACK
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

$initialRadios = Get-RadiosState
if ($initialRadios) {
    [Console]::WriteLine((ConvertTo-Json $initialRadios -Compress))
}

$initialAudio = Get-AudioState
if ($initialAudio) {
    [Console]::WriteLine((ConvertTo-Json $initialAudio -Compress))
}

# Main loop
$lastTitle = ""
$lastStatus = $false
$lastAlbumArt = ""
$lastBatteryPercent = -1
$lastCharging = $false
$lastFullscreen = $false
$lastWifiEnabled = $null
$lastWifiConnected = $null
$lastWifiSsid = ""
$lastBtEnabled = $null
$lastMuted = if ($initialAudio) { $initialAudio.muted } else { $null }
$lastVolume = if ($initialAudio) { $initialAudio.volume } else { $null }
$loopCount = 0

while ($true) {
    # Check for queued stdin commands from Electron
    while ($true) {
        $cmd = [StdinListener]::ReadNext()
        if ($null -eq $cmd) { break }
        Execute-MediaCmd -cmd $cmd
        Start-Sleep -Milliseconds 100
    }

    # Real-time media update (title, play/pause, or new thumbnail)
    $media = Get-MediaState
    $changed = ($media.title -ne $lastTitle) -or `
               ($media.isPlaying -ne $lastStatus) -or `
               ($media.albumArt -ne $lastAlbumArt)

    if ($changed) {
        $lastTitle = $media.title
        $lastStatus = $media.isPlaying
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
                          ($rState.btEnabled -ne $lastBtEnabled))) {
            $lastWifiEnabled = $rState.wifiEnabled
            $lastWifiConnected = $rState.wifiConnected
            $lastWifiSsid = $rState.wifiSsid
            $lastBtEnabled = $rState.btEnabled
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
    }

    Start-Sleep -Milliseconds 350
}
