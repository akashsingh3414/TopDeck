export type IslandState = 'idle' | 'peek' | 'expanded';

export type WidgetType = 'clock' | 'media' | 'timer';

export const WIDGET_ORDER: WidgetType[] = ['clock', 'media', 'timer'];

export interface MediaTrack {
  title: string;
  artist: string;
  album: string;
  albumArt?: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  appTitle?: string;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
}

export interface RadiosInfo {
  wifiEnabled: boolean;
  wifiConnected: boolean;
  wifiSsid: string;
  wifiSignal: number;
  btEnabled: boolean;
  btConnected: boolean;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  known: boolean; // saved profile, so it can be joined without a password
  connected: boolean;
}

export interface BluetoothDevice {
  name: string;
  connected: boolean;
}

export interface AudioInfo {
  muted: boolean;
  volume: number; // 0-100, -1 when unknown
}

export interface IslandDimensions {
  width: number;
  height: number;
  bottomRadius: number;
}

export const STATE_DIMENSIONS: Record<IslandState, IslandDimensions> = {
  idle: {
    width: 280,
    height: 34,
    bottomRadius: 12,
  },
  peek: {
    width: 350,
    height: 42,
    bottomRadius: 20,
  },
  expanded: {
    width: 500,
    height: 236,
    bottomRadius: 34,
  },
};
