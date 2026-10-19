import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useTimerStore } from '../store/useTimerStore';
import { playTimerChime } from '../services/timerAudio';
import { formatDuration } from '../utils/formatDuration';
import type { WidgetType } from '../types/island';

interface IslandEventActions {
  nextWidget: () => void;
  prevWidget: () => void;
  toggleStealthMode: () => void;
  peekWidget: (widget: WidgetType, durationMs?: number) => void;
  pillRef: RefObject<HTMLDivElement | null>;
}

export const useIslandEvents = ({
  nextWidget,
  prevWidget,
  toggleStealthMode,
  peekWidget,
  pillRef,
}: IslandEventActions) => {
  const timerTick = useTimerStore((s) => s.tick);
  const timerRunning = useTimerStore((s) => s.isRunning);
  const timerFinished = useTimerStore((s) => s.isFinished);
  const prevTimerFinishedRef = useRef(useTimerStore.getState().isFinished);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(timerTick, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerTick]);

  useEffect(() => {
    if (timerFinished && !prevTimerFinishedRef.current) {
      peekWidget('timer', 0);
      playTimerChime();
      const total = useTimerStore.getState().totalTime;
      window.islandAPI?.notify?.("Time's up", `Your ${formatDuration(total)} focus timer has finished.`);
    }
    prevTimerFinishedRef.current = timerFinished;
  }, [timerFinished, peekWidget]);

  useEffect(() => {
    let lastKeyTime = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyTime < 240) return;

      if (e.key === 'ArrowRight') {
        lastKeyTime = now;
        nextWidget();
      } else if (e.key === 'ArrowLeft') {
        lastKeyTime = now;
        prevWidget();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextWidget, prevWidget]);

  useEffect(() => {
    if (!window.islandAPI?.onToggleSuperHide) return;
    return window.islandAPI.onToggleSuperHide(toggleStealthMode);
  }, [toggleStealthMode]);

  useEffect(() => {
    window.islandAPI?.setIgnoreMouseEvents(true, { forward: true });
  }, []);

  useEffect(() => {
    let captured = false;
    const handleWindowMouseMove = (e: MouseEvent) => {
      const pill = pillRef.current;
      if (!pill) return;
      const rect = pill.getBoundingClientRect();
      const isInside = e.clientX >= rect.left - 4 &&
        e.clientX <= rect.right + 4 &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom + 4;

      if (isInside && !captured) {
        captured = true;
        window.islandAPI?.setIgnoreMouseEvents(false);
      } else if (!isInside && captured) {
        captured = false;
        window.islandAPI?.setIgnoreMouseEvents(true, { forward: true });
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleWindowMouseMove);
  }, [pillRef]);
};
