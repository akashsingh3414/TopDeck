import { create } from 'zustand';
import { IslandState, WidgetType, PeekKind, HomeSection, MediaTrack, RadiosInfo, AudioInfo, MicInfo, WifiNetwork, BluetoothDevice, WIDGET_ORDER } from '../types/island';

export interface BatteryInfo {
  percent: number;
  isCharging: boolean;
  status: string;
}

interface IslandStore {
  state: IslandState;
  activeWidget: WidgetType;
  slideDirection: number;
  pinned: boolean;
  peekKind: PeekKind;
  homeSection: HomeSection;
  stealthMode: boolean;
  isFullscreenHidden: boolean;
  peekTimeoutId: ReturnType<typeof setTimeout> | null;
  collapseTimeoutId: ReturnType<typeof setTimeout> | null;

  // Widget States
  media: MediaTrack;
  battery: BatteryInfo;
  radios: RadiosInfo;
  audio: AudioInfo;
  mic: MicInfo;
  brightness: number; // 0-100, default 80
  // Fetched on demand when a list is opened; null while loading
  wifiNetworks: WifiNetwork[] | null;
  btDevices: BluetoothDevice[] | null;

  // Actions
  setState: (state: IslandState) => void;
  setActiveWidget: (widget: WidgetType, direction?: number) => void;
  nextWidget: () => void;
  prevWidget: () => void;
  setPinned: (pinned: boolean) => void;
  toggleStealthMode: () => void;
  setStealthMode: (stealth: boolean) => void;
  setFullscreenHidden: (hidden: boolean) => void;
  /** durationMs <= 0 keeps the peek open until the user hovers or it is replaced */
  peekWidget: (kind: PeekKind, durationMs?: number) => void;
  setHomeSection: (section: HomeSection) => void;
  expand: (widget?: WidgetType) => void;
  collapse: (delayMs?: number) => void;
  cancelCollapse: () => void;
  updateMedia: (media: Partial<MediaTrack>) => void;
  updateBattery: (battery: Partial<BatteryInfo>) => void;
  updateRadios: (radios: Partial<RadiosInfo>) => void;
  updateAudio: (audio: Partial<AudioInfo>) => void;
  updateMic: (mic: MicInfo) => void;
  updateBrightness: (brightness: number) => void;
  setWifiNetworks: (networks: WifiNetwork[] | null) => void;
  setBtDevices: (devices: BluetoothDevice[] | null) => void;
}

const getInitialStealth = () => {
  try {
    return localStorage.getItem('island_super_hidden') === 'true';
  } catch {
    return false;
  }
};

export const useIslandStore = create<IslandStore>((set, get) => ({
  state: 'idle',
  activeWidget: 'home',
  slideDirection: 1,
  pinned: false,
  stealthMode: getInitialStealth(),
  peekKind: 'system',
  homeSection: 'controls',
  isFullscreenHidden: false,
  peekTimeoutId: null,
  collapseTimeoutId: null,

  media: {
    title: '',
    artist: '',
    album: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    canSkipNext: false,
    canSkipPrevious: false,
  },

  battery: {
    percent: 100,
    isCharging: false,
    status: 'Online',
  },

  radios: {
    wifiEnabled: true,
    wifiConnected: false,
    wifiSsid: '',
    wifiSignal: 0,
    btEnabled: true,
    btConnected: false,
  },

  audio: {
    muted: false,
    volume: -1,
  },

  mic: {
    active: false,
    apps: [],
  },

  brightness: 80,

  wifiNetworks: null,
  btDevices: null,

  setState: (state) => set({ state }),

  setActiveWidget: (activeWidget, direction = 1) => {
    set({ activeWidget, slideDirection: direction });
  },

  nextWidget: () => {
    const current = get().activeWidget;
    const idx = WIDGET_ORDER.indexOf(current);
    const nextIdx = (idx + 1) % WIDGET_ORDER.length;
    set({ activeWidget: WIDGET_ORDER[nextIdx], slideDirection: 1 });
  },

  prevWidget: () => {
    const current = get().activeWidget;
    const idx = WIDGET_ORDER.indexOf(current);
    const prevIdx = (idx - 1 + WIDGET_ORDER.length) % WIDGET_ORDER.length;
    set({ activeWidget: WIDGET_ORDER[prevIdx], slideDirection: -1 });
  },

  setPinned: (pinned) => set({ pinned }),

  toggleStealthMode: () => {
    const next = !get().stealthMode;
    try {
      localStorage.setItem('island_super_hidden', String(next));
    } catch {}
    set({ stealthMode: next });
  },

  setStealthMode: (stealthMode) => {
    try {
      localStorage.setItem('island_super_hidden', String(stealthMode));
    } catch {}
    set({ stealthMode });
  },

  setFullscreenHidden: (isFullscreenHidden) => set({ isFullscreenHidden }),

  peekWidget: (kind, durationMs = 2800) => {
    const { peekTimeoutId, state, isFullscreenHidden } = get();
    if (isFullscreenHidden) return;
    if (peekTimeoutId) clearTimeout(peekTimeoutId);
    // A finished timer opens on the Timer tab; media and system peeks keep the current tab
    const activeWidget = kind === 'timer' ? 'timer' : get().activeWidget;

    // If already expanded by user interaction, stay expanded
    if (state === 'expanded') {
      set({ activeWidget, peekKind: kind, slideDirection: 1 });
      return;
    }

    const timer = durationMs <= 0 ? null : setTimeout(() => {
      if (get().state === 'peek') set({ state: 'idle', peekTimeoutId: null });
    }, durationMs);

    set({
      state: 'peek',
      activeWidget,
      peekKind: kind,
      peekTimeoutId: timer,
      slideDirection: 1,
    });
  },

  setHomeSection: (homeSection) => set({ homeSection }),

  expand: (widget) => {
    const { peekTimeoutId, collapseTimeoutId, isFullscreenHidden, activeWidget } = get();
    if (isFullscreenHidden) return;
    if (peekTimeoutId) clearTimeout(peekTimeoutId);
    if (collapseTimeoutId) clearTimeout(collapseTimeoutId);

    set({
      state: 'expanded',
      activeWidget: widget ?? activeWidget,
      peekTimeoutId: null,
      collapseTimeoutId: null,
    });
  },

  collapse: (delayMs = 380) => {
    const { collapseTimeoutId, pinned } = get();
    if (pinned) return;
    if (collapseTimeoutId) clearTimeout(collapseTimeoutId);

    const timer = setTimeout(() => {
      set({ state: 'idle', collapseTimeoutId: null });
    }, delayMs);

    set({ collapseTimeoutId: timer });
  },

  cancelCollapse: () => {
    const { collapseTimeoutId } = get();
    if (collapseTimeoutId) {
      clearTimeout(collapseTimeoutId);
      set({ collapseTimeoutId: null });
    }
  },

  updateMedia: (updated) => {
    const current = get().media;
    // An artist appearing for the same title is the app filling in metadata late, not a new song
    const isNewTrack = Boolean(
      (updated.title && updated.title !== current.title) ||
      (updated.artist && current.artist && updated.artist !== current.artist)
    );
    const isPlaying = updated.isPlaying !== undefined ? updated.isPlaying : current.isPlaying;

    // Preserve existing thumbnail if current update didn't include one but song is same.
    // When a new track starts, if updated.albumArt is not provided, strictly clear it so previous song's thumbnail never leaks!
    // An empty title means the media session went away, so the art goes too.
    const albumArt = isNewTrack
      ? (updated.albumArt || '')
      : (updated.albumArt || (updated.title === '' ? '' : current.albumArt));
    const duration = updated.duration === 0 && updated.title !== '' && !isNewTrack && current.duration > 0
      ? current.duration
      : updated.duration ?? current.duration;

    set((s) => ({
      media: { ...s.media, ...updated, duration, albumArt, isPlaying },
    }));

    // Peek on track change ONLY IF music/video is actually playing!
    // Never peek or pop up music on install/startup if paused or stopped!
    if (isNewTrack && isPlaying && updated.title && !get().pinned) {
      get().peekWidget('media', 3000);
    }
  },

  updateBattery: (updated) => {
    const current = get().battery;
    const pluggedChanged = updated.isCharging !== undefined && updated.isCharging !== current.isCharging;
    const wasLow = current.percent <= 20 && !current.isCharging;
    const isNowLow = (updated.percent ?? current.percent) <= 20 && !(updated.isCharging ?? current.isCharging);
    const justBecameLow = !wasLow && isNowLow;

    set((s) => ({
      battery: { ...s.battery, ...updated },
    }));

    if (pluggedChanged || justBecameLow) {
      get().peekWidget('system', 3000);
    }
  },

  updateRadios: (updated) => {
    set((s) => ({
      radios: { ...s.radios, ...updated },
    }));
  },

  updateAudio: (updated) => {
    set((s) => ({
      audio: { ...s.audio, ...updated },
    }));
  },

  updateMic: (mic) => {
    const justStarted = mic.active && !get().mic.active;
    set({ mic });
    // Flash the indicator when an app starts recording
    if (justStarted) get().peekWidget('system', 3000);
  },

  updateBrightness: (brightness) => {
    set({ brightness });
  },

  setWifiNetworks: (wifiNetworks) => set({ wifiNetworks }),

  setBtDevices: (btDevices) => set({ btDevices }),

}));
