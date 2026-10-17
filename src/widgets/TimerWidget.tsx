import React from 'react';
import { IslandWidget } from './types';
import { Timer, Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { create } from 'zustand';
import { Chip, IconButton, SectionLabel, formatDuration } from '../components/ui';

interface TimerStore {
  isRunning: boolean;
  timeLeft: number; // in seconds
  totalTime: number;
  isFinished: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  isRunning: false,
  timeLeft: 0,
  totalTime: 0,
  isFinished: false,

  start: (seconds) => {
    set({
      isRunning: true,
      timeLeft: seconds,
      totalTime: seconds,
      isFinished: false,
    });
  },

  pause: () => set({ isRunning: false }),

  resume: () => {
    if (get().timeLeft > 0) {
      set({ isRunning: true });
    }
  },

  reset: () => {
    set({
      isRunning: false,
      timeLeft: 0,
      totalTime: 0,
      isFinished: false,
    });
  },

  tick: () => {
    const { timeLeft, isRunning } = get();
    if (!isRunning) return;

    if (timeLeft <= 1) {
      set({
        timeLeft: 0,
        isRunning: false,
        isFinished: true,
      });
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },
}));

const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '25m', seconds: 1500 },
];

export const TimerIdle: React.FC = () => {
  const { timeLeft, isFinished } = useTimerStore();

  return (
    <div className="flex items-center justify-between w-full h-full px-4 select-none">
      <Timer className={`w-3.5 h-3.5 ${isFinished ? 'text-warn' : 'text-accent'}`} />
      <span className={`text-[13px] font-semibold tabular-nums ${isFinished ? 'text-warn' : 'text-ink'}`}>
        {isFinished ? 'Done' : formatDuration(timeLeft)}
      </span>
    </div>
  );
};

export const TimerPeek: React.FC = () => {
  const { isFinished, timeLeft } = useTimerStore();

  return (
    <div className="flex items-center justify-between w-full h-full px-5 select-none">
      <div className="flex items-center gap-2">
        <Bell className={`w-4 h-4 ${isFinished ? 'text-warn' : 'text-accent'}`} />
        <span className="text-[13px] font-semibold text-ink">{isFinished ? "Time's up" : 'Timer running'}</span>
      </div>
      <span className="text-[13px] font-semibold text-ink tabular-nums">{formatDuration(timeLeft)}</span>
    </div>
  );
};

const RING_SIZE = 124;
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
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} fill="none" strokeWidth={RING_STROKE} className="stroke-white/[0.1]" />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={`${finished ? 'stroke-warn' : 'stroke-accent'} transition-[stroke-dashoffset] duration-1000 ease-linear`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

export const TimerExpanded: React.FC = () => {
  const { isRunning, isFinished, timeLeft, totalTime, start, pause, resume, reset } = useTimerStore();

  // Ring drains as time runs out; full when idle so it reads as "ready"
  const fraction = totalTime > 0 ? timeLeft / totalTime : isFinished ? 0 : 1;
  const status = isFinished ? "Time's up" : isRunning ? 'Focusing' : timeLeft > 0 ? 'Paused' : 'Ready';

  return (
    <div className="flex w-full h-full px-5 pb-4 pt-1 gap-5 select-none">
      <ProgressRing fraction={fraction} finished={isFinished}>
        <span className="text-[26px] font-semibold tracking-tight text-ink tabular-nums leading-none">
          {formatDuration(timeLeft)}
        </span>
        <span className={`text-micro font-semibold uppercase mt-1.5 ${isFinished ? 'text-warn' : 'text-ink-faint'}`}>
          {status}
        </span>
      </ProgressRing>

      <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
        <div className="flex flex-col gap-2">
          <SectionLabel>Focus Timer</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p.seconds} active={totalTime === p.seconds} onClick={() => start(p.seconds)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <IconButton title="Pause" variant="on" size="lg" onClick={pause}>
              <Pause className="fill-current" />
            </IconButton>
          ) : (
            <IconButton
              title={timeLeft > 0 ? 'Resume' : 'Start 25 minutes'}
              variant="on"
              size="lg"
              onClick={() => (timeLeft > 0 ? resume() : start(1500))}
            >
              <Play className="fill-current translate-x-px" />
            </IconButton>
          )}
          {totalTime > 0 && (
            <IconButton title="Reset" onClick={reset}>
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
