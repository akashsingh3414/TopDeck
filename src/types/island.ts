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
}

export interface IslandDimensions {
  width: number;
  height: number;
  bottomRadius: number;
}

export const STATE_DIMENSIONS: Record<IslandState, IslandDimensions> = {
  idle: {
    width: 175,
    height: 32,
    bottomRadius: 20,
  },
  peek: {
    width: 300,
    height: 42,
    bottomRadius: 24,
  },
  expanded: {
    width: 440,
    height: 168,
    bottomRadius: 28,
  },
};
