import React, { useState } from 'react';
import { IslandWidget } from './types';
import { Music, Play, Pause, SkipBack, SkipForward, Disc3, Volume2, VolumeX } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';

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

// Apple-style crisp monochromatic equalizer bar component
const WavyBar: React.FC<{
  isPlaying: boolean;
  minHeight: number;
  maxHeight: number;
  durationMs: number;
  delayMs: number;
  opacity?: number;
}> = ({ isPlaying, minHeight, maxHeight, durationMs, delayMs, opacity = 0.9 }) => {
  return (
    <span
      className="w-[2px] rounded-full bg-white transition-all"
      style={{
        opacity,
        height: isPlaying ? `${maxHeight}px` : `${minHeight}px`,
        animation: isPlaying ? `wavyBounce ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms infinite alternate` : 'none',
      }}
    />
  );
};

export const MediaIdle: React.FC = () => {
  const media = useIslandStore((s) => s.media);

  return (
    <div className="flex items-center justify-between w-full px-3 h-full select-none text-white font-medium">
      <div className="flex items-center space-x-2 overflow-hidden max-w-[125px]">
        {media.albumArt ? (
          <img
            src={media.albumArt}
            alt="Art"
            className={`w-4 h-4 rounded-full object-cover border border-white/20 shadow-sm ${media.isPlaying ? 'animate-spin' : ''}`}
            style={{ animationDuration: '6s' }}
          />
        ) : (
          <Disc3 className={`w-4 h-4 text-neutral-300 ${media.isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        )}
        <span className="text-[11px] truncate tracking-tight text-white/90 font-medium">
          {media.title || 'Music'}
        </span>
      </div>

      {/* Crisp Monochromatic Equalizer */}
      <div className="flex items-center space-x-[2px] h-3.5 ml-1">
        <WavyBar isPlaying={media.isPlaying} minHeight={3} maxHeight={11} durationMs={450} delayMs={0} opacity={0.85} />
        <WavyBar isPlaying={media.isPlaying} minHeight={4} maxHeight={13} durationMs={600} delayMs={120} opacity={1} />
        <WavyBar isPlaying={media.isPlaying} minHeight={3} maxHeight={9} durationMs={380} delayMs={240} opacity={0.7} />
        <WavyBar isPlaying={media.isPlaying} minHeight={5} maxHeight={12} durationMs={520} delayMs={80} opacity={0.9} />
      </div>
    </div>
  );
};

export const MediaPeek: React.FC = () => {
  const media = useIslandStore((s) => s.media);

  return (
    <div className="flex items-center justify-between w-full px-3.5 h-full select-none text-white">
      <div className="flex items-center space-x-2.5 overflow-hidden max-w-[225px]">
        {media.albumArt ? (
          <img
            src={media.albumArt}
            alt="Cover"
            className="w-7 h-7 rounded-lg object-cover shadow-md border border-white/10 flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-300 flex-shrink-0">
            <Music className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="flex flex-col overflow-hidden text-left leading-tight">
          <span className="text-[12px] font-semibold truncate text-white tracking-tight">
            {media.title || 'Track'}
          </span>
          <span className="text-[10px] text-neutral-400 truncate mt-0.5">
            {media.artist || getCleanAppTitle(media.appTitle)}
          </span>
        </div>
      </div>

      {/* Wavy Sound Wave */}
      <div className="flex items-center space-x-[2px] h-4 flex-shrink-0">
        <WavyBar isPlaying={media.isPlaying} minHeight={4} maxHeight={13} durationMs={500} delayMs={0} opacity={0.8} />
        <WavyBar isPlaying={media.isPlaying} minHeight={5} maxHeight={15} durationMs={400} delayMs={150} opacity={1} />
        <WavyBar isPlaying={media.isPlaying} minHeight={3} maxHeight={10} durationMs={550} delayMs={300} opacity={0.7} />
        <WavyBar isPlaying={media.isPlaying} minHeight={6} maxHeight={14} durationMs={450} delayMs={90} opacity={0.9} />
        <WavyBar isPlaying={media.isPlaying} minHeight={4} maxHeight={12} durationMs={600} delayMs={220} opacity={0.85} />
      </div>
    </div>
  );
};

export const MediaExpanded: React.FC = () => {
  const media = useIslandStore((s) => s.media);
  const [isMuted, setIsMuted] = useState(false);

  const handleCommand = (cmd: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cmd === 'MUTE') {
      setIsMuted((prev) => !prev);
    }
    if (window.islandAPI) {
      window.islandAPI.sendMediaCommand(cmd);
    }
  };

  const appDisplayName = getCleanAppTitle(media.appTitle);

  return (
    <div className="flex items-center w-full h-full px-4 py-2 select-none text-white overflow-hidden bg-black">
      {/* LEFT PART: Big Thumbnail */}
      <div className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.7)] border border-white/[0.1] bg-neutral-950 flex items-center justify-center">
        {media.albumArt ? (
          <img
            src={media.albumArt}
            alt="Album Art"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-neutral-950 flex items-center justify-center">
            <div
              className={`w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center shadow-inner ${
                media.isPlaying ? 'animate-spin' : ''
              }`}
              style={{ animationDuration: '7s' }}
            >
              <div className="w-6 h-6 rounded-full bg-neutral-800 border border-white/15 flex items-center justify-center">
                <Music className="w-3 h-3 text-white/80" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PART: Track Info + Playback & Mute Buttons */}
      <div className="flex-1 flex flex-col justify-center pl-4 pr-24 min-w-0">
        {/* Track Title and Artist */}
        <div className="flex flex-col overflow-hidden text-left mb-2.5">
          <span className="text-[10px] font-semibold tracking-wider text-neutral-400 truncate uppercase">
            {appDisplayName}
          </span>
          <span className="text-sm font-semibold truncate text-white tracking-tight leading-snug mt-0.5">
            {media.title || 'No Media Playing'}
          </span>
          <span className="text-xs text-neutral-400 truncate mt-0.5">
            {media.artist || 'Windows Audio'}
          </span>
        </div>

        {/* Playback Controls & Mute Button */}
        <div className="flex items-center space-x-3">
          {/* Previous Track Button */}
          <button
            onClick={(e) => handleCommand('PREVIOUS', e)}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all active:scale-90"
            title="Previous Track"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={(e) => handleCommand('TOGGLE', e)}
            className="w-9 h-9 rounded-full bg-white text-black hover:bg-neutral-200 flex items-center justify-center transition-all active:scale-90 shadow-[0_2px_12px_rgba(255,255,255,0.25)] font-bold"
            title={media.isPlaying ? 'Pause' : 'Play'}
          >
            {media.isPlaying ? (
              <Pause className="w-4 h-4 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 fill-black text-black translate-x-0.5" />
            )}
          </button>

          {/* Next Track Button */}
          <button
            onClick={(e) => handleCommand('NEXT', e)}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all active:scale-90"
            title="Next Track"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Mute Button */}
          <button
            onClick={(e) => handleCommand('MUTE', e)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border-white/[0.08]'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
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
