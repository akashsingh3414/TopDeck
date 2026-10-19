function Invoke-MediaCommand([string]$cmd) {
    $executed = $false
    $uCmd = $cmd.ToUpper().Trim()

    if ($uCmd -match '^SET_BRIGHTNESS:(\d{1,3})$') {
        $val = [int]$matches[1]
        try {
            (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1, $val) | Out-Null
        } catch {
            try {
                Invoke-CimMethod -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = $val } -ErrorAction SilentlyContinue | Out-Null
            } catch {}
        }
        [Console]::WriteLine((ConvertTo-Json @{ type = "brightness"; level = $val } -Compress))
        return
    }

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
        $toggled = $false
        if ($script:radios) {
            $wf = $script:radios | Where-Object { $_.Kind.ToString() -eq "WiFi" } | Select-Object -First 1
            if ($wf) {
                $next = if ($wf.State.ToString() -eq "On") { [Windows.Devices.Radios.RadioState]::Off } else { [Windows.Devices.Radios.RadioState]::On }
                $res = Await-WinRt -Operation ($wf.SetStateAsync($next)) -ResultType ([Windows.Devices.Radios.RadioAccessStatus]) -TimeoutMs 2000
                $toggled = ($res -eq [Windows.Devices.Radios.RadioAccessStatus]::Allowed)
            }
        }
        if (-not $toggled) {
            $cur = Get-RadiosState
            if ($cur -and $cur.wifiEnabled) {
                netsh interface set interface name="Wi-Fi" admin=disabled 2>$null | Out-Null
            } else {
                netsh interface set interface name="Wi-Fi" admin=enabled 2>$null | Out-Null
            }
        }
        Start-Sleep -Milliseconds 250
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
        Start-Sleep -Milliseconds 250
        $rState = Get-RadiosState
        if ($rState) { [Console]::WriteLine((ConvertTo-Json $rState -Compress)) }
        return
    }

    if ($uCmd -eq "RESTART_TRACK") {
        $session = $script:activeSession
        if ($null -eq $session -and $mgr) {
            $session = $mgr.GetCurrentSession()
        }
        $restarted = $false
        if ($session) {
            try {
                $result = Await-WinRt -Operation ($session.TryChangePlaybackPositionAsync([long]0)) -ResultType ([bool]) -TimeoutMs 1500
                $restarted = ($result -eq $true)
            } catch {}
        }
        if (-not $restarted) {
            [void][Win32Helper]::SendMediaKey(0xB1) # VK_MEDIA_PREV_TRACK fallback
        }
        Start-Sleep -Milliseconds 150
        $updatedMedia = Get-MediaState
        if ($updatedMedia -and $updatedMedia.type -eq "media") {
            [Console]::WriteLine((ConvertTo-Json $updatedMedia -Compress))
        }
        return
    }

    if ($mgr -and $uCmd -in @("NEXT", "PREVIOUS")) {
        $sessionCandidates = @()
        try {
            $allSessions = $mgr.GetSessions()
            if ($allSessions) {
                foreach ($candidate in $allSessions) {
                    try {
                        $playbackInfo = $candidate.GetPlaybackInfo()
                        if ($playbackInfo -and $playbackInfo.PlaybackStatus.ToString() -eq "Playing") {
                            $sessionCandidates += $candidate
                        }
                    } catch {}
                }
            }
        } catch {}

        if ($script:activeSession -and -not [object]::ReferenceEquals($script:activeSession, $null)) {
            if (-not ($sessionCandidates | Where-Object { [object]::ReferenceEquals($_, $script:activeSession) })) {
                $sessionCandidates += $script:activeSession
            }
        }

        try {
            $currentSession = $mgr.GetCurrentSession()
            if ($currentSession -and -not ($sessionCandidates | Where-Object { [object]::ReferenceEquals($_, $currentSession) })) {
                $sessionCandidates += $currentSession
            }
        } catch {}

        foreach ($session in $sessionCandidates) {
            try {
                $trackBefore = Get-SessionTrackKey $session
                if ($uCmd -eq "NEXT") {
                    $res = Await-WinRt -Operation ($session.TrySkipNextAsync()) -ResultType ([bool]) -TimeoutMs 1500
                } else {
                    $res = Await-WinRt -Operation ($session.TrySkipPreviousAsync()) -ResultType ([bool]) -TimeoutMs 1500
                }
                if ($res -eq $true) {
                    Start-Sleep -Milliseconds 650
                    $trackAfter = Get-SessionTrackKey $session
                    if ($trackBefore -and $trackAfter -and $trackBefore -ne $trackAfter) {
                        $executed = $true
                    } else {
                        $vk = if ($uCmd -eq "NEXT") { 0xB0 } else { 0xB1 }
                        $executed = [Win32Helper]::SendMediaKey($vk)
                    }
                    break
                }
            } catch {}
        }
    }

    if ($mgr -and $uCmd -notin @("NEXT", "PREVIOUS")) {
        $session = $script:activeSession
        if ($null -eq $session) {
            $session = $mgr.GetCurrentSession()
        }
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
