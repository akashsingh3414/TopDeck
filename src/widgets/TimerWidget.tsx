import React from 'react';
import { IslandWidget } from './types';
import { Timer, Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { create } from 'zustand';

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

export const TimerIdle: React.FC = () => {
  const { timeLeft, isFinished } = useTimerStore();

  const format = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center justify-between w-full px-3 h-full select-none text-white font-medium">
      <div className="flex items-center space-x-1.5">
        <Timer className="w-3.5 h-3.5 text-[#FF9F0A]" />
        <span className={`text-[12px] font-semibold tabular-nums ${isFinished ? 'text-[#FF9F0A]' : 'text-white/95'}`}>
          {isFinished ? 'Done' : format(timeLeft)}
        </span>
      </div>
      <span className="text-[9px] font-semibold tracking-wider uppercase text-[#FF9F0A] px-1.5 py-0.5 rounded bg-[#FF9F0A]/15 border border-[#FF9F0A]/30">
        TIMER
      </span>
    </div>
  );
};

export const TimerPeek: React.FC = () => {
  const { isFinished, timeLeft } = useTimerStore();

  const format = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center justify-between w-full px-4 h-full select-none text-white">
      <div className="flex items-center space-x-2">
        <Bell className="w-4 h-4 text-[#FF9F0A]" />
        <span className="text-[13px] font-semibold text-white tracking-tight">
          {isFinished ? 'Timer Completed' : 'Timer Running'}
        </span>
      </div>
      <span className="text-[12px] font-semibold text-[#FF9F0A] tabular-nums">
        {format(timeLeft)}
      </span>
    </div>
  );
};

export const TimerExpanded: React.FC = () => {
  const { isRunning, timeLeft, totalTime, isFinished, start, pause, resume, reset } = useTimerStore();

  const format = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <div className="flex flex-col justify-between w-full h-full p-4 select-none text-white bg-black">
      <div className="flex items-center justify-between pr-28">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 flex items-center justify-center text-[#FF9F0A]">
            <Timer className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
            Focus Timer
          </span>
        </div>

        <span className="text-2xl font-bold text-white tracking-tight tabular-nums">
          {format(timeLeft)}
        </span>
      </div>

      {/* Apple-style Progress bar */}
      {totalTime > 0 && (
        <div className="w-full bg-white/[0.08] h-1 rounded-full overflow-hidden my-2">
          <div
            className="h-full bg-[#FF9F0A] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Presets and controls */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => start(60)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white border border-white/[0.08] transition-all"
          >
            1m
          </button>
          <button
            onClick={() => start(300)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white border border-white/[0.08] transition-all"
          >
            5m
          </button>
          <button
            onClick={() => start(1500)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white border border-white/[0.08] transition-all"
          >
            25m
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {isRunning ? (
            <button
              onClick={pause}
              className="p-1.5 rounded-full bg-[#FF9F0A] text-black hover:bg-[#FFB340] transition-transform active:scale-90 shadow-md font-bold"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5 fill-black text-black" />
            </button>
          ) : timeLeft > 0 ? (
            <button
              onClick={resume}
              className="p-1.5 rounded-full bg-[#FF9F0A] text-black hover:bg-[#FFB340] transition-transform active:scale-90 shadow-md font-bold"
              title="Start"
            >
              <Play className="w-3.5 h-3.5 fill-black text-black translate-x-0.5" />
            </button>
          ) : null}

          {totalTime > 0 && (
            <button
              onClick={reset}
              className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.08] transition-transform active:scale-90"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
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
