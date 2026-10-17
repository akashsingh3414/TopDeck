import React, { useEffect, useRef, useState } from 'react';
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

const FALLBACK_TINT = '#F5F5F7';

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};

// Dominant vivid color of the artwork, lifted so it stays visible on the black island.
// Greyscale or unreadable art falls back to white.
const extractTint = (src: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(FALLBACK_TINT);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Weight each pixel by how vivid it is, so dark backgrounds and grey areas don't dominate
        let r = 0, g = 0, b = 0, total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          const w = s * (1 - Math.abs(2 * l - 1));
          r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; total += w;
        }
        if (total < size * size * 0.05) return resolve(FALLBACK_TINT);

        const [h, s, l] = rgbToHsl(r / total, g / total, b / total);
        const sat = Math.round(Math.max(s, 0.45) * 100);
        const light = Math.round(Math.min(0.75, Math.max(l, 0.6)) * 100);
        resolve(`hsl(${Math.round(h)} ${sat}% ${light}%)`);
      } catch {
        resolve(FALLBACK_TINT);
      }
    };
    img.onerror = () => resolve(FALLBACK_TINT);
    img.src = src;
  });

export const useArtworkTint = (albumArt?: string) => {
  const [tint, setTint] = useState(FALLBACK_TINT);
  useEffect(() => {
    if (!albumArt) {
      setTint(FALLBACK_TINT);
      return;
    }
    let cancelled = false;
    extractTint(albumArt).then((t) => !cancelled && setTint(t));
    return () => {
      cancelled = true;
    };
  }, [albumArt]);
  return tint;
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

// System volume. While dragging, the local value wins so helper echoes don't make the thumb jump.
const VolumeSlider: React.FC = () => {
  const { volume, muted } = useIslandStore((s) => s.audio);
  const updateAudio = useIslandStore((s) => s.updateAudio);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastSentRef = useRef(0);

  if (volume < 0) return null; // helper couldn't read the output device

  const send = (level: number) => {
    lastSentRef.current = Date.now();
    window.islandAPI?.sendMediaCommand(`SET_VOLUME:${level}`);
  };

  const commit = () => {
    if (dragValue === null) return;
    send(dragValue);
    updateAudio({ volume: dragValue, muted: dragValue > 0 ? false : muted });
    setDragValue(null);
  };

  const value = dragValue ?? volume;

  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      title={`Volume ${value}%`}
      aria-label="Volume"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const level = Number(e.target.value);
        setDragValue(level);
        // Throttled so a drag doesn't flood the helper's command queue
        if (Date.now() - lastSentRef.current > 120) send(level);
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
      className={`flex-1 min-w-0 h-1 cursor-pointer ${muted ? 'opacity-40' : ''}`}
      style={{ accentColor: '#F5F5F7' }}
    />
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
          <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-[132px] ml-3">
            <IconButton title={isMuted ? 'Unmute' : 'Mute'} variant={isMuted ? 'on' : 'ghost'} onClick={() => send('MUTE')}>
              {isMuted ? <VolumeX /> : <Volume2 />}
            </IconButton>
            <VolumeSlider />
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
