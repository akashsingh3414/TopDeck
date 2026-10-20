import React, { useState } from 'react';
import { Timer, Play, Pause, RotateCcw, Bell, X } from 'lucide-react';
import { Chip, IconButton, SectionLabel } from '../components/ui';
import { useTimerStore } from '../store/useTimerStore';
import { formatDuration } from '../utils/formatDuration';

const PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '25m', seconds: 1500 },
  { label: '45m', seconds: 2700 },
  { label: '1h', seconds: 3600 },
];

const MAX_MINUTES = 999;
const DEFAULT_SECONDS = 1500; // 25 min

// One editable part of the ring's time: click and type, scroll, or use ↑/↓. Enter starts the timer.
const TimeField: React.FC<{
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  onSubmit: () => void;
}> = ({ value, max, label, onChange, onSubmit }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(0, n));

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      title={`${label}: type, scroll or use ↑/↓`}
      value={draft ?? value.toString().padStart(2, '0')}
      maxLength={max > 99 ? 3 : 2}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        setDraft(value.toString());
        e.target.select();
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        setDraft(digits);
        onChange(clamp(Number(digits || 0)));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
          onSubmit();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = clamp(value + (e.key === 'ArrowUp' ? 1 : -1));
          setDraft(next.toString());
          onChange(next);
        }
      }}
      onWheel={(e) => {
        const next = clamp(value + (e.deltaY < 0 ? 1 : -1));
        if (draft !== null) setDraft(next.toString());
        onChange(next);
      }}
      className="bg-transparent text-center text-[24px] font-bold tracking-tight text-white tabular-nums leading-none outline-none rounded-md cursor-text hover:bg-white/[0.08] focus:bg-white/[0.12] transition-colors"
      style={{ width: max > 99 && value > 99 ? '2.1em' : '1.45em' }}
    />
  );
};

export const TimerIdle: React.FC = () => {
  const { timeLeft, totalTime, isFinished } = useTimerStore();
  const elapsed = totalTime > 0
    ? isFinished
      ? 1
      : Math.min(1, Math.max(0, 1 - timeLeft / totalTime))
    : 0;

  return (
    <div className="relative flex items-center justify-between w-full h-full px-4 select-none">
      <div className="flex items-center gap-2">
        <Timer className={`w-3.5 h-3.5 ${isFinished ? 'text-[#FF9500]' : 'text-white/75'}`} />
        <span className="text-[10px] font-medium text-white/55">Focus</span>
      </div>
      <span className={`text-[13px] font-semibold tracking-tight tabular-nums ${isFinished ? 'text-[#FF9500]' : 'text-white'}`}>
        {isFinished ? "Time's Up!" : formatDuration(timeLeft)}
      </span>
      {totalTime > 0 && (
        <div className="absolute bottom-0 left-4 right-4 h-[2px] overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${
              isFinished ? 'bg-[#FF9500]' : 'bg-white/75'
            }`}
            style={{ width: `${elapsed * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const TimerPeek: React.FC = () => {
  const { isFinished, timeLeft, totalTime } = useTimerStore();

  if (isFinished) {
    return (
      <div className="flex items-center justify-between w-full h-full px-5 select-none">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FF9500] animate-bounce" />
          <span className="text-[13px] font-semibold text-white">Time's Up</span>
        </div>
        <span className="text-[11px] text-white/60 tabular-nums">{formatDuration(totalTime)} finished</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full h-full px-5 select-none">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-[#FF9500]" />
        <span className="text-[13px] font-semibold text-white">Focus Timer</span>
      </div>
      <span className="text-[13px] font-semibold text-[#FF9500] tabular-nums">{formatDuration(timeLeft)}</span>
    </div>
  );
};

const RING_SIZE = 118;
const RING_STROKE = 6;

const ProgressRing: React.FC<{ fraction: number; finished: boolean; children: React.ReactNode }> = ({
  fraction,
  finished,
  children,
}) => {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-white/[0.1]"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={`${
            finished ? 'stroke-[#FF453A]' : 'stroke-[#FF9500]'
          } transition-[stroke-dashoffset] duration-1000 ease-linear shadow-[0_0_12px_rgba(255,149,0,0.5)]`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

export const TimerExpanded: React.FC = () => {
  const { isRunning, isFinished, timeLeft, totalTime, start, pause, resume, reset } = useTimerStore();

  const [draft, setDraft] = useState(DEFAULT_SECONDS);

  const fraction = totalTime > 0 ? timeLeft / totalTime : isFinished ? 0 : 1;
  const status = isFinished ? "Time's up" : isRunning ? 'Focusing' : timeLeft > 0 ? 'Paused' : 'Ready';
  // Before a timer starts, the time in the ring is the duration picker
  const editable = !isRunning && !isFinished && timeLeft === 0;
  const draftMinutes = Math.floor(draft / 60);
  const draftSeconds = draft % 60;
  const startDraft = () => {
    if (draft > 0) start(draft);
  };

  return (
    <div className="flex w-full h-full px-5 pb-3 pt-1 gap-5 select-none items-center">
      {/* Progress Ring with Time */}
      <ProgressRing fraction={fraction} finished={isFinished}>
        {editable ? (
          <div className="flex items-center text-[24px] font-bold text-white leading-none">
            <TimeField
              label="Minutes"
              value={draftMinutes}
              max={MAX_MINUTES}
              onChange={(m) => setDraft(m * 60 + draftSeconds)}
              onSubmit={startDraft}
            />
            <span className="text-white/50 -mt-0.5">:</span>
            <TimeField
              label="Seconds"
              value={draftSeconds}
              max={59}
              onChange={(sec) => setDraft(draftMinutes * 60 + sec)}
              onSubmit={startDraft}
            />
          </div>
        ) : (
          <span className="text-[24px] font-bold tracking-tight text-white tabular-nums leading-none">
            {formatDuration(timeLeft)}
          </span>
        )}
        <span
          className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${
            isFinished ? 'text-[#FF453A]' : isRunning ? 'text-[#FF9500]' : 'text-white/45'
          }`}
        >
          {status}
        </span>
      </ProgressRing>

      {/* Preset Chips & Action Buttons */}
      <div className="flex flex-col justify-between flex-1 min-w-0 py-1 h-[120px]">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Focus Durations</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Chip
                key={p.seconds}
                active={totalTime === p.seconds}
                onClick={() => start(p.seconds)}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 mt-2">
          {isFinished ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  start(totalTime);
                }}
                className="h-9 px-4 rounded-full bg-[#FF9500] text-black font-semibold text-[12px] flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>
              <IconButton title="Dismiss" size="md" variant="ghost" onClick={reset}>
                <X />
              </IconButton>
            </>
          ) : isRunning ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pause();
              }}
              className="h-9 px-5 rounded-full bg-white text-black font-semibold text-[12px] flex items-center gap-1.5 hover:bg-white/90 active:scale-95 transition-all shadow-md"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (timeLeft > 0) resume();
                else startDraft();
              }}
              className="h-9 px-5 rounded-full bg-[#FF9500] text-black font-semibold text-[12px] flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(255,149,0,0.35)]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{timeLeft > 0 ? 'Resume' : 'Start'}</span>
            </button>
          )}

          {totalTime > 0 && !isFinished && (
            <IconButton title="Reset timer" size="md" variant="ghost" onClick={reset}>
              <RotateCcw />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
};
