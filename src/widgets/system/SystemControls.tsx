import React, { useRef, useState } from 'react';
import { Sun, Volume2, VolumeX } from 'lucide-react';
import { useIslandStore } from '../../store/useIslandStore';

const LevelSlider: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  onChange: (value: number) => void;
  onCommit: () => void;
  action?: React.ReactNode;
}> = ({ label, value, icon, onChange, onCommit, action }) => (
  <div className="flex flex-col justify-center h-[40px] px-2.5 rounded-xl bg-white/[0.055]">
    <div className="flex items-center justify-between mb-0.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {action ?? <span className="text-white/60 flex items-center">{icon}</span>}
        <span className="text-[10px] font-medium tracking-wide text-white/65">{label}</span>
      </div>
      <span className="text-[10px] font-medium text-white/55 tabular-nums">{value}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      title={`${label} ${value}%`}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      className="level-slider w-full"
      style={{ '--range-progress': `${value}%` } as React.CSSProperties}
    />
  </div>
);

const BrightnessSlider: React.FC = () => {
  const brightness = useIslandStore((s) => s.brightness);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastSendRef = useRef(0);
  const value = dragValue ?? brightness;

  const onChange = (level: number) => {
    setDragValue(level);
    const now = Date.now();
    if (now - lastSendRef.current > 50) {
      lastSendRef.current = now;
      window.islandAPI?.sendMediaCommand(`SET_BRIGHTNESS:${level}`);
    }
  };

  const onCommit = () => {
    if (dragValue === null) return;
    window.islandAPI?.sendMediaCommand(`SET_BRIGHTNESS:${dragValue}`);
    useIslandStore.getState().updateBrightness(dragValue);
    setDragValue(null);
  };

  return (
    <LevelSlider
      label="Brightness"
      value={value}
      icon={<Sun className="w-3.5 h-3.5" />}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
};

const SoundVolumeSlider: React.FC = () => {
  const { volume, muted } = useIslandStore((s) => s.audio);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastSendRef = useRef(0);
  const value = dragValue ?? (volume >= 0 ? volume : 50);
  const displayedValue = dragValue !== null ? dragValue : muted ? 0 : value;

  const onChange = (level: number) => {
    setDragValue(level);
    const now = Date.now();
    if (now - lastSendRef.current > 50) {
      lastSendRef.current = now;
      window.islandAPI?.sendMediaCommand(`SET_VOLUME:${level}`);
    }
  };

  const onCommit = () => {
    if (dragValue === null) return;
    window.islandAPI?.sendMediaCommand(`SET_VOLUME:${dragValue}`);
    useIslandStore.getState().updateAudio({ volume: dragValue, muted: dragValue === 0 });
    setDragValue(null);
  };

  return (
    <LevelSlider
      label="Volume"
      value={displayedValue}
      icon={<Volume2 className="w-3.5 h-3.5" />}
      action={
        <button
          type="button"
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={(event) => {
            event.stopPropagation();
            window.islandAPI?.sendMediaCommand('MUTE');
          }}
          className="text-white/60 hover:text-white transition-colors flex items-center"
        >
          {muted || value === 0
            ? <VolumeX className="w-3.5 h-3.5 text-white/60" />
            : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      }
      onChange={onChange}
      onCommit={onCommit}
    />
  );
};

export const SystemControls: React.FC = () => (
  <div className="flex flex-col gap-1.5 mt-0.5">
    <BrightnessSlider />
    <SoundVolumeSlider />
  </div>
);
