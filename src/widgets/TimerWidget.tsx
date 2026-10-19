import React from 'react';
import { IslandWidget } from './types';
import { Timer, Play, Pause, RotateCcw, Bell, X } from 'lucide-react';
import { Chip, IconButton, SectionLabel } from '../components/ui';
import { useTimerStore } from '../store/useTimerStore';
import { formatDuration } from '../utils/formatDuration';

const PRESETS = [
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '25m (Pomodoro)', seconds: 1500 },
  { label: '45m', seconds: 2700 },
  { label: '1h', seconds: 3600 },
];

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

  const fraction = totalTime > 0 ? timeLeft / totalTime : isFinished ? 0 : 1;
  const status = isFinished ? "Time's up" : isRunning ? 'Focusing' : timeLeft > 0 ? 'Paused' : 'Ready';

  return (
    <div className="flex w-full h-full px-5 pb-3 pt-1 gap-5 select-none items-center">
      {/* Progress Ring with Time */}
      <ProgressRing fraction={fraction} finished={isFinished}>
        <span className="text-[24px] font-bold tracking-tight text-white tabular-nums leading-none">
          {formatDuration(timeLeft)}
        </span>
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
                else start(1500); // 25 min default
              }}
              className="h-9 px-5 rounded-full bg-[#FF9500] text-black font-semibold text-[12px] flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(255,149,0,0.35)]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{timeLeft > 0 ? 'Resume' : 'Start 25m'}</span>
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

export const TimerWidget: IslandWidget = {
  id: 'timer',
  name: 'Timer',
  priority: 40,
  idleView: TimerIdle,
  peekView: TimerPeek,
  expandedView: TimerExpanded,
};
