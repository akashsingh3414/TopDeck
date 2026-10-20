import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { formatDuration } from '../utils/formatDuration';
import { useMediaAccent } from '../hooks/useMediaAccent';

// Windows reports the player as an app ID (e.g. "Spotify.exe", "MSEdge",
// "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic"); turn it into a readable name
const SOURCE_NAMES: [string, string][] = [
  ['spotify', 'Spotify'],
  ['youtube', 'YouTube Music'],
  ['zunemusic', 'Media Player'],
  ['zunevideo', 'Movies & TV'],
  ['applemusic', 'Apple Music'],
  ['itunes', 'iTunes'],
  ['msedge', 'Microsoft Edge'],
  ['edge', 'Microsoft Edge'],
  ['chrome', 'Google Chrome'],
  ['brave', 'Brave'],
  ['opera', 'Opera'],
  ['vivaldi', 'Vivaldi'],
  ['firefox', 'Mozilla Firefox'],
  ['vlc', 'VLC'],
];

const getSourceName = (raw?: string) => {
  const id = (raw || '').toLowerCase();
  const known = SOURCE_NAMES.find(([key]) => id.includes(key));
  if (known) return known[1];
  // Firefox registers under a 16-hex-digit hash of its install path
  if (/^[0-9a-f]{16}$/.test(id)) return 'Mozilla Firefox';
  return 'Other source';
};

const EQ_BARS: [number, number][] = [
  [4, 16],
  [4, 21],
  [4, 18],
  [4, 22],
  [4, 17],
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
    <div className="flex items-center gap-[2.5px] h-6 flex-shrink-0">
      {EQ_BARS.map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white/75 transition-[height] duration-100"
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
  const disc = { idle: 'w-full h-full', peek: 'w-[24px] h-[24px]', expanded: 'w-[58px] h-[58px]' }[size];
  const label = { idle: 'w-1.5 h-1.5', peek: 'w-2 h-2', expanded: 'w-5 h-5' }[size];

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
          {size === 'expanded' && <div className="w-1.5 h-1.5 rounded-full bg-black/80" />}
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
            {media.artist || getSourceName(media.appTitle)}
          </span>
        </div>
      </div>
      <Equalizer isPlaying={media.isPlaying} />
    </div>
  );
};

// Bare playback icon: no circle, background or motion
const ControlButton: React.FC<{
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, disabled = false, onClick, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="flex items-center justify-center text-white/85 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
  >
    {children}
  </button>
);

// Left half of the Home tab: artwork, track, progress and playback controls
export const MediaPanel: React.FC = () => {
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
  const status = !media.title ? 'NOT PLAYING' : media.isPlaying ? 'PLAYING' : 'PAUSED';

  return (
    <div className="flex flex-col justify-between w-full h-full py-0.5 min-w-0 select-none">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {media.title ? getSourceName(media.appTitle) : 'Media'}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <Artwork
          size="expanded"
          className="w-[76px] h-[76px] rounded-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
        />
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[9px] font-semibold tracking-wide text-white/45">{status}</span>
            <Equalizer isPlaying={media.isPlaying} scale={0.6} />
          </div>
          <span className="truncate text-[14px] font-bold leading-snug tracking-tight text-white">
            {media.title || 'No media playing'}
          </span>
          <span className="truncate text-[11px] font-medium text-white/60">
            {media.title ? media.artist || getSourceName(media.appTitle) : 'Play something to control it here'}
          </span>
        </div>
      </div>

      {/* Progress and controls stay together at the bottom */}
      <div className="flex flex-col gap-1.5">
        {media.duration > 0 && (
          <div className="flex flex-col gap-1">
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

        <div className="flex items-center justify-center gap-5">
          <ControlButton
            title={canRestartCurrent ? 'Restart current track' : 'Previous Track'}
            disabled={!canGoPrevious}
            onClick={() => send(canRestartCurrent ? 'RESTART_TRACK' : 'PREVIOUS')}
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </ControlButton>
          <ControlButton title={media.isPlaying ? 'Pause' : 'Play'} onClick={() => send('TOGGLE')}>
            {media.isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
          </ControlButton>
          <ControlButton title="Next Track" disabled={!media.canSkipNext} onClick={() => send('NEXT')}>
            <SkipForward className="w-4 h-4 fill-current" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
};
