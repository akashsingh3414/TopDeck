import { create } from 'zustand';

interface TimerState {
  isRunning: boolean;
  timeLeft: number;
  totalTime: number;
  isFinished: boolean;
  endsAt: number | null;
}

interface TimerStore extends TimerState {
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
}

const TIMER_STORAGE_KEY = 'island_timer';
const IDLE_TIMER: TimerState = {
  isRunning: false,
  timeLeft: 0,
  totalTime: 0,
  isFinished: false,
  endsAt: null,
};

const secondsUntil = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

const loadTimer = (): TimerState => {
  try {
    const saved = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || 'null') as TimerState | null;
    if (!saved || typeof saved.totalTime !== 'number') return IDLE_TIMER;
    if (saved.isRunning && saved.endsAt) {
      return { ...saved, timeLeft: secondsUntil(saved.endsAt) };
    }
    return saved;
  } catch {
    return IDLE_TIMER;
  }
};

export const useTimerStore = create<TimerStore>((set, get) => ({
  ...loadTimer(),

  start: (seconds) => set({
    isRunning: true,
    timeLeft: seconds,
    totalTime: seconds,
    isFinished: false,
    endsAt: Date.now() + seconds * 1000,
  }),

  pause: () => {
    const { endsAt } = get();
    set({ isRunning: false, timeLeft: endsAt ? secondsUntil(endsAt) : get().timeLeft, endsAt: null });
  },

  resume: () => {
    const { timeLeft } = get();
    if (timeLeft > 0) set({ isRunning: true, endsAt: Date.now() + timeLeft * 1000 });
  },

  reset: () => set(IDLE_TIMER),

  tick: () => {
    const { isRunning, endsAt } = get();
    if (!isRunning || !endsAt) return;

    const timeLeft = secondsUntil(endsAt);
    if (timeLeft <= 0) {
      set({ timeLeft: 0, isRunning: false, isFinished: true, endsAt: null });
    } else if (timeLeft !== get().timeLeft) {
      set({ timeLeft });
    }
  },
}));

useTimerStore.subscribe(({ isRunning, timeLeft, totalTime, isFinished, endsAt }) => {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ isRunning, timeLeft, totalTime, isFinished, endsAt }));
  } catch {}
});
