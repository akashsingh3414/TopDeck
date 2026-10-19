$script:lastTrackKey = ""
$script:prevTrackArt = ""
$script:currentArt = ""
$script:trackChangedTick = 0
$script:artVerified = $false
$script:lastArtReadTick = 0
$script:activeSession = $null

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
            $script:activeSession = $null
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
                canSkipNext = $false
                canSkipPrevious = $false
                appTitle = ""
                albumArt = ""
            }
        }

        $script:activeSession = $session
        $propsOp = $session.TryGetMediaPropertiesAsync()
        $props = Await-WinRt -Operation $propsOp -ResultType $propTypes -TimeoutMs 1500
        $playback = $session.GetPlaybackInfo()

        $title = if ($props) { [string]$props.Title } else { "" }
        $artist = if ($props) { [string]$props.Artist } else { "" }
        $album = if ($props) { [string]$props.AlbumTitle } else { "" }
        $isPlaying = if ($playback) { $playback.PlaybackStatus.ToString() -eq "Playing" } else { $false }
        $canSkipNext = if ($playback) { [bool]$playback.Controls.IsNextEnabled } else { $false }
        $canSkipPrevious = if ($playback) { [bool]$playback.Controls.IsPreviousEnabled } else { $false }
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
            canSkipNext = $canSkipNext
            canSkipPrevious = $canSkipPrevious
            albumArt = $art
            appTitle = $sourceApp
        }
    } catch {
        return @{ type = "media"; hasSession = $false; error = $_.Exception.Message }
    }
}


function Get-SessionTrackKey($session) {
    if ($null -eq $session) { return $null }
    try {
        $propsOp = $session.TryGetMediaPropertiesAsync()
        $props = Await-WinRt -Operation $propsOp -ResultType $propTypes -TimeoutMs 1000
        if (-not $props) { return $null }
        return "$($session.SourceAppUserModelId)::$($props.Title)::$($props.Artist)"
    } catch {
        return $null
    }
}
