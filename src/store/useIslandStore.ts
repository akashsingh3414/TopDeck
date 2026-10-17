import { create } from 'zustand';
import { IslandState, WidgetType, MediaTrack, RadiosInfo, AudioInfo, WifiNetwork, BluetoothDevice, WIDGET_ORDER } from '../types/island';

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
  hasUserSelectedTab: boolean;
  stealthMode: boolean;
  isFullscreenHidden: boolean;
  peekTimeoutId: ReturnType<typeof setTimeout> | null;
  collapseTimeoutId: ReturnType<typeof setTimeout> | null;

  // Widget States
  media: MediaTrack;
  battery: BatteryInfo;
  radios: RadiosInfo;
  audio: AudioInfo;
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
  peekWidget: (widget: WidgetType, durationMs?: number) => void;
  expand: (widget?: WidgetType) => void;
  collapse: (delayMs?: number) => void;
  cancelCollapse: () => void;
  updateMedia: (media: Partial<MediaTrack>) => void;
  updateBattery: (battery: Partial<BatteryInfo>) => void;
  updateRadios: (radios: Partial<RadiosInfo>) => void;
  updateAudio: (audio: Partial<AudioInfo>) => void;
  setWifiNetworks: (networks: WifiNetwork[] | null) => void;
  setBtDevices: (devices: BluetoothDevice[] | null) => void;
  tickMediaPosition: () => void;
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
  activeWidget: 'clock',
  slideDirection: 1,
  pinned: false,
  stealthMode: getInitialStealth(),
  hasUserSelectedTab: false,
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
  },

  audio: {
    muted: false,
    volume: -1,
  },

  wifiNetworks: null,
  btDevices: null,

  setState: (state) => set({ state }),

  setActiveWidget: (activeWidget, direction = 1) => {
    set({ activeWidget, slideDirection: direction, hasUserSelectedTab: true });
  },

  nextWidget: () => {
    const current = get().activeWidget;
    const idx = WIDGET_ORDER.indexOf(current);
    const nextIdx = (idx + 1) % WIDGET_ORDER.length;
    set({ activeWidget: WIDGET_ORDER[nextIdx], slideDirection: 1, hasUserSelectedTab: true });
  },

  prevWidget: () => {
    const current = get().activeWidget;
    const idx = WIDGET_ORDER.indexOf(current);
    const prevIdx = (idx - 1 + WIDGET_ORDER.length) % WIDGET_ORDER.length;
    set({ activeWidget: WIDGET_ORDER[prevIdx], slideDirection: -1, hasUserSelectedTab: true });
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

  peekWidget: (widget, durationMs = 2800) => {
    const { peekTimeoutId, state, isFullscreenHidden } = get();
    if (isFullscreenHidden) return;
    if (peekTimeoutId) clearTimeout(peekTimeoutId);

    // If already expanded by user interaction, stay expanded and switch active widget
    if (state === 'expanded') {
      set({ activeWidget: widget, slideDirection: 1 });
      return;
    }

    const timer = durationMs <= 0 ? null : setTimeout(() => {
      const currentState = get().state;
      if (currentState === 'peek') {
        const { hasUserSelectedTab, activeWidget, media } = get();
        const fallback = hasUserSelectedTab ? activeWidget : (media.isPlaying ? 'media' : 'clock');
        set({
          state: 'idle',
          activeWidget: fallback,
          peekTimeoutId: null,
        });
      }
    }, durationMs);

    set({
      state: 'peek',
      activeWidget: widget,
      peekTimeoutId: timer,
      slideDirection: 1,
    });
  },

  expand: (widget) => {
    const { peekTimeoutId, collapseTimeoutId, isFullscreenHidden, media, activeWidget, hasUserSelectedTab } = get();
    if (isFullscreenHidden) return;
    if (peekTimeoutId) clearTimeout(peekTimeoutId);
    if (collapseTimeoutId) clearTimeout(collapseTimeoutId);

    // Respect user's chosen tab! Only default to media if user hasn't selected another tab.
    const targetWidget = widget ?? (hasUserSelectedTab ? activeWidget : (media.isPlaying ? 'media' : activeWidget));

    set({
      state: 'expanded',
      activeWidget: targetWidget,
      peekTimeoutId: null,
      collapseTimeoutId: null,
    });
  },

  collapse: (delayMs = 380) => {
    const { collapseTimeoutId, pinned, hasUserSelectedTab, activeWidget, media } = get();
    if (pinned) return;
    if (collapseTimeoutId) clearTimeout(collapseTimeoutId);

    const timer = setTimeout(() => {
      // In idle, respect user chosen widget
      const fallback = hasUserSelectedTab ? activeWidget : (media.isPlaying ? 'media' : 'clock');
      set({
        state: 'idle',
        activeWidget: fallback,
        collapseTimeoutId: null,
      });
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
    const isNewTrack = Boolean(
      (updated.title && updated.title !== current.title) ||
      (updated.artist && updated.artist !== current.artist)
    );
    const isPlaying = updated.isPlaying !== undefined ? updated.isPlaying : current.isPlaying;
    const justStartedPlaying = isPlaying && !current.isPlaying;
    const { hasUserSelectedTab, activeWidget } = get();

    // Preserve existing thumbnail if current update didn't include one but song is same.
    // When a new track starts, if updated.albumArt is not provided, strictly clear it so previous song's thumbnail never leaks!
    const albumArt = isNewTrack
      ? (updated.albumArt || '')
      : (updated.albumArt !== undefined ? updated.albumArt : current.albumArt);

    // Only auto-switch to media if user has NOT explicitly picked another tab
    let nextActive = activeWidget;
    if (justStartedPlaying && !hasUserSelectedTab) {
      nextActive = 'media';
    } else if (!isPlaying && activeWidget === 'media' && !hasUserSelectedTab) {
      nextActive = 'clock';
    }

    set((s) => ({
      media: { ...s.media, ...updated, albumArt, isPlaying },
      activeWidget: nextActive,
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
      get().peekWidget('clock', 3000);
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

  setWifiNetworks: (wifiNetworks) => set({ wifiNetworks }),

  setBtDevices: (btDevices) => set({ btDevices }),

  tickMediaPosition: () => {
    const { media } = get();
    if (media.isPlaying && media.duration > 0 && media.position < media.duration) {
      set({ media: { ...media, position: media.position + 1 } });
    }
  },
}));
