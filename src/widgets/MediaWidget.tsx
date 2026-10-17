import React from 'react';
import { IslandWidget } from './types';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { IconButton, ProgressBar, SectionLabel, formatDuration } from '../components/ui';

// Clean application title to hide raw hex IDs (e.g. 308046B0AF4A39CB)
const getCleanAppTitle = (raw?: string) => {
  if (!raw) return 'Now Playing';
  const clean = raw.toLowerCase();
  if (clean.includes('spotify')) return 'Spotify';
  if (clean.includes('edge') || clean.includes('msedge')) return 'Microsoft Edge';
  if (clean.includes('chrome')) return 'Google Chrome';
  if (clean.includes('brave')) return 'Brave Browser';
  if (clean.includes('firefox')) return 'Firefox';
  if (clean.includes('apple') || clean.includes('itunes')) return 'Apple Music';
  if (clean.includes('vlc')) return 'VLC Media';
  if (/^[0-9a-fA-F!_.-]+$/.test(raw) || (raw.length > 10 && !raw.includes(' '))) {
    return 'Now Playing';
  }
  return raw.split('!')[0];
};

// Monochrome equalizer; bar heights are [min, max, durationMs, delayMs]
const EQ_BARS: [number, number, number, number][] = [
  [3, 10, 450, 0],
  [4, 14, 600, 120],
  [3, 9, 380, 240],
  [4, 12, 520, 80],
];

const Equalizer: React.FC<{ isPlaying: boolean; scale?: number }> = ({ isPlaying, scale = 1 }) => (
  <div className="flex items-center gap-[2px] h-4 flex-shrink-0">
    {EQ_BARS.map(([min, max, duration, delay], i) => (
      <span
        key={i}
        className="w-[3px] rounded-full bg-ink transition-[height] duration-300"
        style={{
          height: `${(isPlaying ? max : min) * scale}px`,
          animation: isPlaying ? `wavyBounce ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms infinite alternate` : 'none',
        }}
      />
    ))}
  </div>
);

// Graphite vinyl shown when the track has no thumbnail
export const DefaultAnimatedCover: React.FC<{
  isPlaying: boolean;
  size: 'idle' | 'peek' | 'expanded';
  className?: string;
}> = ({ isPlaying, size, className = '' }) => {
  const disc = { idle: 'w-full h-full', peek: 'w-[22px] h-[22px]', expanded: 'w-[84px] h-[84px]' }[size];
  const label = { idle: 'w-1.5 h-1.5', peek: 'w-2 h-2', expanded: 'w-7 h-7' }[size];

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-[#1C1C1E] ${className}`}>
      <div
        className={`relative ${disc} rounded-full flex items-center justify-center bg-[#0B0B0C] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]`}
        style={{ animation: isPlaying ? 'vinylSpin 6s linear infinite' : 'none' }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background:
              'repeating-radial-gradient(circle, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 3px)',
          }}
        />
        <div className={`relative ${label} rounded-full bg-accent flex items-center justify-center`}>
          {size === 'expanded' && <div className="w-2 h-2 rounded-full bg-black" />}
        </div>
      </div>
    </div>
  );
};

const Artwork: React.FC<{ size: 'idle' | 'peek' | 'expanded'; className: string }> = ({ size, className }) => {
  const media = useIslandStore((s) => s.media);
  return (
    <div className={`relative flex-shrink-0 overflow-hidden bg-[#1C1C1E] ${className}`}>
      {media.albumArt ? (
        <img src={media.albumArt} alt="" className="w-full h-full object-cover" />
      ) : (
        <DefaultAnimatedCover isPlaying={media.isPlaying} size={size} />
      )}
    </div>
  );
};

export const MediaIdle: React.FC = () => {
  const media = useIslandStore((s) => s.media);

  return (
    <div className="flex items-center justify-between w-full h-full pl-2 pr-4 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <Artwork size="idle" className="w-5 h-5 rounded-md" />
        <span className="text-caption font-medium text-ink truncate max-w-[100px]">{media.title || 'Music'}</span>
      </div>
      <Equalizer isPlaying={media.isPlaying} scale={0.85} />
    </div>
  );
};

export const MediaPeek: React.FC = () => {
  const media = useIslandStore((s) => s.media);

  return (
    <div className="flex items-center justify-between w-full h-full pl-2 pr-5 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <Artwork size="peek" className="w-8 h-8 rounded-lg" />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[12px] font-semibold text-ink truncate">{media.title || 'Track'}</span>
          <span className="text-caption text-ink-muted truncate">
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
  // Real system mute state reported by the native helper
  const isMuted = useIslandStore((s) => s.audio.muted);
  const updateAudio = useIslandStore((s) => s.updateAudio);

  const send = (cmd: string) => {
    // Optimistic flip; the helper echoes the actual state right after applying it
    if (cmd === 'MUTE') updateAudio({ muted: !isMuted });
    window.islandAPI?.sendMediaCommand(cmd);
  };

  const hasTimeline = media.duration > 0;
  const progress = hasTimeline ? (media.position / media.duration) * 100 : 0;

  return (
    <div className="relative flex w-full h-full px-5 pb-4 pt-1 gap-4 select-none overflow-hidden">
      {/* Soft ambient tint taken from the artwork */}
      {media.albumArt && (
        <img
          src={media.albumArt}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-[0.18] pointer-events-none"
        />
      )}

      <Artwork size="expanded" className="relative w-[124px] h-[124px] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.6)]" />

      <div className="relative flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <SectionLabel>{getCleanAppTitle(media.appTitle)}</SectionLabel>
            <span className="text-[15px] font-semibold text-ink truncate leading-snug mt-1">
              {media.title || 'Nothing playing'}
            </span>
            <span className="text-[12px] text-ink-muted truncate">{media.artist || 'Windows Audio'}</span>
          </div>
          <div className="pt-0.5">
            <Equalizer isPlaying={media.isPlaying} scale={0.8} />
          </div>
        </div>

        {hasTimeline && (
          <div className="flex flex-col gap-1">
            <ProgressBar value={progress} />
            <div className="flex justify-between text-micro text-ink-faint tabular-nums tracking-normal">
              <span>{formatDuration(media.position)}</span>
              <span>-{formatDuration(media.duration - media.position)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconButton title="Previous Track" onClick={() => send('PREVIOUS')}>
              <SkipBack className="fill-current" />
            </IconButton>
            <IconButton
              title={media.isPlaying ? 'Pause' : 'Play'}
              variant="primary"
              size="lg"
              onClick={() => send('TOGGLE')}
            >
              {media.isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current translate-x-px" />}
            </IconButton>
            <IconButton title="Next Track" onClick={() => send('NEXT')}>
              <SkipForward className="fill-current" />
            </IconButton>
          </div>
          <IconButton title={isMuted ? 'Unmute' : 'Mute'} variant={isMuted ? 'on' : 'ghost'} onClick={() => send('MUTE')}>
            {isMuted ? <VolumeX /> : <Volume2 />}
          </IconButton>
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
