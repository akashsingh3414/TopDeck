import { useEffect } from 'react';
import { useIslandStore } from '../store/useIslandStore';

export const useNativeStateSync = () => {
  const {
    updateMedia,
    updateBattery,
    updateRadios,
    updateAudio,
    updateBrightness,
    setWifiNetworks,
    setBtDevices,
    setFullscreenHidden,
  } = useIslandStore();

  useEffect(() => {
    if (!window.islandAPI) return;

    return window.islandAPI.onMediaUpdate((data) => {
      if (!data) return;
      if (data.type === 'media') {
        if (data.error) return;
        updateMedia({
          title: data.title || '',
          artist: data.artist || '',
          album: data.album || '',
          isPlaying: !!data.isPlaying,
          position: data.position || 0,
          duration: data.duration || 0,
          canSkipNext: !!data.canSkipNext,
          canSkipPrevious: !!data.canSkipPrevious,
          albumArt: data.albumArt || '',
          appTitle: data.appTitle || '',
        });
      } else if (data.type === 'battery') {
        updateBattery({
          percent: data.percent,
          isCharging: data.isCharging,
          status: data.status,
        });
      } else if (data.type === 'radios') {
        updateRadios({
          wifiEnabled: !!data.wifiEnabled,
          wifiConnected: !!data.wifiConnected,
          wifiSsid: data.wifiSsid || '',
          wifiSignal: data.wifiSignal || 0,
          btEnabled: !!data.btEnabled,
          btConnected: !!data.btConnected,
        });
      } else if (data.type === 'audio') {
        updateAudio({
          muted: !!data.muted,
          volume: typeof data.volume === 'number' ? data.volume : -1,
        });
      } else if (data.type === 'brightness') {
        if (typeof data.level === 'number') updateBrightness(data.level);
      } else if (data.type === 'wifiList') {
        setWifiNetworks(Array.isArray(data.networks) ? data.networks : []);
      } else if (data.type === 'btList') {
        setBtDevices(Array.isArray(data.devices) ? data.devices : []);
      } else if (data.type === 'fullscreen') {
        setFullscreenHidden(!!data.isFullscreen);
      }
    });
  }, [
    updateMedia,
    updateBattery,
    updateRadios,
    updateAudio,
    updateBrightness,
    setWifiNetworks,
    setBtDevices,
    setFullscreenHidden,
  ]);
};
