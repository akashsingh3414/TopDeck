import React, { useEffect, useState } from 'react';
import { IslandWidget } from './types';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { IconButton } from '../components/ui';
import { formatDuration } from '../utils/formatDuration';
import { useMediaAccent } from '../hooks/useMediaAccent';

const getCleanAppTitle = (raw?: string) => {
  if (!raw) return 'Media';
  const clean = raw.toLowerCase();
  if (clean.includes('spotify')) return 'Spotify';
  if (clean.includes('apple') || clean.includes('itunes') || clean.includes('music')) return 'Apple Music';
  if (clean.includes('youtube')) return 'YouTube Music';
  if (clean.includes('edge') || clean.includes('msedge')) return 'Microsoft Edge';
  if (clean.includes('chrome')) return 'Google Chrome';
  if (clean.includes('brave')) return 'Brave Browser';
  if (clean.includes('firefox')) return 'Firefox';
  if (clean.includes('vlc')) return 'VLC Media';
  if (/^[0-9a-fA-F!_.-]+$/.test(raw) || (raw.length > 10 && !raw.includes(' '))) {
    return 'Media';
  }
  return raw.split('!')[0];
};

const EQ_BARS: [number, number][] = [
  [3, 16],
  [4, 20],
  [3, 18],
  [4, 22],
  [3, 17],
  [4, 21],
  [3, 16],
];

const usePlaybackPosition = () => {
  const position = useIslandStore((s) => s.media.position);
  const duration = useIslandStore((s) => s.media.duration);
  const isPlaying = useIslandStore((s) => s.media.isPlaying);
  const [now, setNow] = useState(() => Date.now());
  const [anchor, setAnchor] = useState(() => ({ position, timestamp: Date.now() }));

  useEffect(() => {
    setAnchor({ position, timestamp: Date.now() });
  }, [position, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const elapsedPosition = isPlaying
    ? anchor.position + (now - anchor.timestamp) / 1000
    : position;
  return Math.max(0, Math.min(duration > 0 ? duration : elapsedPosition, elapsedPosition));
};

const Equalizer: React.FC<{ isPlaying: boolean; scale?: number }> = ({ isPlaying, scale = 1 }) => {
  const [levels, setLevels] = useState(() => EQ_BARS.map(([min]) => min));

  useEffect(() => {
    if (!isPlaying) {
      setLevels(EQ_BARS.map(([min]) => min));
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const animateBar = (index: number) => {
      timers[index] = setTimeout(() => {
        const [min, max] = EQ_BARS[index];
        setLevels((current) => current.map((level, i) =>
          i === index ? min + Math.random() * (max - min) : level
        ));
        animateBar(index);
      }, 80 + Math.random() * 150);
    };

    EQ_BARS.forEach((_, index) => animateBar(index));
    return () => timers.forEach(clearTimeout);
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-[2px] h-6 flex-shrink-0">
      {EQ_BARS.map((_, i) => (
        <span
          key={i}
          className="w-[1.5px] rounded-full bg-white/75 transition-[height] duration-100"
          style={{ height: `${levels[i] * scale}px` }}
        />
      ))}
    </div>
  );
};

export const DefaultAnimatedCover: React.FC<{
  isPlaying: boolean;
  size: 'idle' | 'peek' | 'expanded';
  className?: string;
}> = ({ isPlaying, size, className = '' }) => {
  const disc = { idle: 'w-full h-full', peek: 'w-[24px] h-[24px]', expanded: 'w-[96px] h-[96px]' }[size];
  const label = { idle: 'w-1.5 h-1.5', peek: 'w-2 h-2', expanded: 'w-8 h-8' }[size];

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-[#151517] ${className}`}>
      <div
        className={`relative ${disc} rounded-full flex items-center justify-center bg-[#0C0C0E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_4px_16px_rgba(0,0,0,0.8)]`}
        style={{ animation: isPlaying ? 'vinylSpin 5s linear infinite' : 'none' }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-50"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.035)',
          }}
        />
        <div className={`relative ${label} rounded-full bg-[#007AFF] flex items-center justify-center shadow-inner`}>
          {size === 'expanded' && <div className="w-2.5 h-2.5 rounded-full bg-black/80" />}
        </div>
      </div>
    </div>
  );
};

const Artwork: React.FC<{ size: 'idle' | 'peek' | 'expanded'; className: string }> = ({ size, className }) => {
  const media = useIslandStore((s) => s.media);
  return (
    <div className={`relative flex-shrink-0 overflow-hidden bg-[#18181A] border border-white/10 ${className}`}>
      {media.albumArt ? (
        <img src={media.albumArt} alt="" className="w-full h-full object-cover" />
      ) : (
        <DefaultAnimatedCover isPlaying={media.isPlaying} size={size} />
      )}
    </div>
  );
};

export const MediaAmbientBackground: React.FC = () => {
  const media = useIslandStore((s) => s.media);
  if (!media.isPlaying || !media.albumArt) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <img
        src={media.albumArt}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(35,35,35,0.2),rgba(0,0,0,0.72)_78%)]" />
    </div>
  );
};

export const MediaIdle: React.FC = () => {
  const media = useIslandStore((s) => s.media);
  const accent = useMediaAccent();
  const position = usePlaybackPosition();
  const progress = media.duration > 0
    ? Math.min(100, Math.max(0, (position / media.duration) * 100))
    : 0;

  return (
    <div className="relative flex items-center justify-between w-full h-full pl-2 pr-3.5 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <Artwork size="idle" className="w-[26px] h-[26px] rounded-md" />
        <span className="text-[11px] font-medium text-white truncate max-w-[110px]">
          {media.title || 'Media'}
        </span>
      </div>
      <Equalizer isPlaying={media.isPlaying} scale={0.8} />
      {media.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden bg-white/[0.08]">
          <div
            className="h-full transition-[width] duration-500 ease-linear"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
      )}
    </div>
  );
};

export const MediaProgressBar: React.FC = () => {
  const accent = useMediaAccent();
  const duration = useIslandStore((s) => s.media.duration);
  const position = usePlaybackPosition();
  const progress = duration > 0
    ? Math.min(100, Math.max(0, (position / duration) * 100))
    : 0;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[2px] overflow-hidden bg-white/[0.08]">
      <div
        className="h-full transition-[width] duration-500 ease-linear"
        style={{ width: `${progress}%`, backgroundColor: accent }}
      />
    </div>
  );
};

export const MediaPeek: React.FC = () => {
  const media = useIslandStore((s) => s.media);

  return (
    <div className="flex items-center justify-between w-full h-full pl-2.5 pr-4 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <Artwork size="peek" className="w-8 h-8 rounded-lg" />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[13px] font-semibold text-white truncate">{media.title || 'Track'}</span>
          <span className="text-[10px] text-white/60 truncate font-medium">
            {media.artist || getCleanAppTitle(media.appTitle)}
          </span>
        </div>
      </div>
      <Equalizer isPlaying={media.isPlaying} />
    </div>
  );
};

export const MediaExpanded: React.FC = () => {
  const media = useIslandStore((s) => s.media);
  const accent = useMediaAccent();
  const position = usePlaybackPosition();

  const send = (cmd: string) => {
    window.islandAPI?.sendMediaCommand(cmd);
  };

  const progressPercent = media.duration > 0
    ? Math.min(100, Math.max(0, (position / media.duration) * 100))
    : 0;
  const canRestartCurrent = !media.canSkipPrevious && media.position > 3;
  const canGoPrevious = media.canSkipPrevious || canRestartCurrent;

  return (
    <div className="relative flex w-full h-full px-5 pb-3 pt-0.5 gap-4 select-none overflow-hidden items-center">
      {/* Album Artwork Squircle */}
      <Artwork
        size="expanded"
        className="relative z-10 w-[160px] h-[160px] rounded-[22px] shadow-[0_12px_28px_rgba(0,0,0,0.7)] flex-shrink-0"
      />

      {/* Media Info & Controls */}
      <div
        className={`relative z-10 grid flex-1 min-w-0 h-[128px] content-start py-0.5 overflow-hidden gap-1 ${
          media.duration > 0
            ? 'grid-rows-[16px_36px_24px_36px]'
            : 'grid-rows-[16px_36px_36px]'
        }`}
      >
        {/* Minimal playback activity indicator */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-[10px] font-medium tracking-wide text-white/45">
            {media.isPlaying ? 'PLAYING' : 'PAUSED'}
          </span>
          <Equalizer isPlaying={media.isPlaying} scale={0.8} />
        </div>

        {/* Track Title & Artist */}
        <div className="flex min-w-0 flex-col justify-center">
          <span className="truncate text-[15px] font-bold leading-snug tracking-tight text-white">
            {media.title || 'No media playing'}
          </span>
          <span className="truncate text-[12px] font-medium text-white/60">
            {media.artist || 'Windows Media Session'}
          </span>
        </div>

        {/* Timeline / Progress Scrubber */}
        {media.duration > 0 && (
          <div className="flex flex-col justify-center gap-1">
            <div className="w-full h-1 rounded-full bg-white/[0.12] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, backgroundColor: accent }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-semibold text-white/45 tabular-nums">
              <span>{formatDuration(position)}</span>
              <span>{formatDuration(media.duration)}</span>
            </div>
          </div>
        )}

        {/* Playback controls; system volume lives in the System tab */}
        <div className="flex items-center justify-start">
          <div className="flex items-center gap-1.5">
            <IconButton
              title={canRestartCurrent ? 'Restart current track' : 'Previous Track'}
              size="sm"
              variant="ghost"
              disabled={!canGoPrevious}
              onClick={() => send(canRestartCurrent ? 'RESTART_TRACK' : 'PREVIOUS')}
            >
              <SkipBack className="fill-current" />
            </IconButton>

            <button
              type="button"
              title={media.isPlaying ? 'Pause' : 'Play'}
              onClick={(e) => {
                e.stopPropagation();
                send('TOGGLE');
              }}
              className="w-9 h-9 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,255,255,0.14)] flex items-center justify-center cursor-pointer flex-shrink-0"
            >
              {media.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
              )}
            </button>

            <IconButton
              title="Next Track"
              size="sm"
              variant="ghost"
              disabled={!media.canSkipNext}
              onClick={() => send('NEXT')}
            >
              <SkipForward className="fill-current" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MediaWidget: IslandWidget = {
  id: 'media',
  name: 'Media',
  priority: 25,
  idleView: MediaIdle,
  peekView: MediaPeek,
  expandedView: MediaExpanded,
};
