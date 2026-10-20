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
        $btConnected = $false
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

        if ($btState) {
            $btList = Get-BluetoothList
            $btConnected = @($btList.devices | Where-Object { $_.connected }).Count -gt 0
        }

        return @{
            type = "radios"
            wifiEnabled = $wifiState
            wifiConnected = $wifiConnected
            wifiSsid = $wifiName
            wifiSignal = $wifiSignal
            btEnabled = $btState
            btConnected = $btConnected
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

# Screen brightness state using WMI
function Get-BrightnessState {
    try {
        $b = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($b) {
            return @{ type = "brightness"; level = [int]$b.CurrentBrightness }
        }
    } catch {}
    return $null
}

# Apps recording from a microphone right now, from Core Audio capture sessions (no admin needed)
function Get-MicState {
    try {
        $apps = @()
        foreach ($procId in [MicHelper]::GetActiveCapturePids()) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $apps -notcontains $proc.ProcessName) { $apps += $proc.ProcessName }
        }
        return @{ type = "mic"; active = ($apps.Count -gt 0); apps = $apps }
    } catch {
        return $null
    }
}
