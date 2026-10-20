import React, { useRef, useState } from 'react';
import { motion, AnimatePresence, Transition, Variants, useReducedMotion } from 'framer-motion';
import { useIslandStore } from '../store/useIslandStore';
import { STATE_DIMENSIONS, WIDGET_ORDER, WidgetType } from '../types/island';
import { HomeExpanded } from '../widgets/HomeWidget';
import { MediaAmbientBackground, MediaIdle, MediaPeek, MediaProgressBar } from '../widgets/MediaWidget';
import { TimerExpanded, TimerIdle, TimerPeek } from '../widgets/TimerWidget';
import { ClipboardExpanded } from '../widgets/ClipboardWidget';
import { ClockIdle, ClockPeek } from '../widgets/system/SystemStatus';
import { useTimerStore } from '../store/useTimerStore';
import { useIslandEvents } from '../hooks/useIslandEvents';
import { useNativeStateSync } from '../hooks/useNativeStateSync';
import {
  House,
  Timer as TimerIcon,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { IconButton } from './ui';

const TABS: { id: WidgetType; label: string; title: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', title: 'Media, controls & calendar', Icon: House },
  { id: 'timer', label: 'Timer', title: 'Focus Countdown Timer', Icon: TimerIcon },
  { id: 'clipboard', label: 'Clipboard', title: 'Clipboard history', Icon: ClipboardList },
];

// Apple SwiftUI Spring Physics
const atollSpring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

// Super-hide dimensions: hairline notch at the top center
const SUPER_HIDE_WIDTH = 260;
const SUPER_HIDE_HEIGHT = 4;
const SUPER_HIDE_RADIUS = 3;

// Subtle cross-fade & micro-slide variants for seamless widget transitions
const contentSlideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 8 : -8,
    y: 3,
    opacity: 0,
  }),
  center: {
    x: 0,
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -8 : 8,
    y: -2,
    opacity: 0,
    transition: {
      duration: 0.14,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export const DynamicIsland: React.FC = () => {
  const {
    state,
    activeWidget,
    setActiveWidget,
    nextWidget,
    prevWidget,
    slideDirection,
    expand,
    collapse,
    cancelCollapse,
    peekWidget,
    pinned,
    setPinned,
    stealthMode,
    toggleStealthMode,
    isFullscreenHidden,
    media,
    peekKind,
  } = useIslandStore();

  const pillRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const currentDimensions = STATE_DIMENSIONS[state];
  const timerRunning = useTimerStore((s) => s.isRunning);
  const timerFinished = useTimerStore((s) => s.isFinished);

  const isVisible = !stealthMode || isHovered || pinned || state === 'expanded' || state === 'peek';

  useIslandEvents({ nextWidget, prevWidget, toggleStealthMode, peekWidget, pillRef });
  useNativeStateSync();

  if (isFullscreenHidden) {
    return null;
  }

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    cancelCollapse();
    setIsHovered(true);
    window.islandAPI?.setIgnoreMouseEvents(false);
    expand();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (stealthMode && !pinned) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        collapse(0);
        window.islandAPI?.setIgnoreMouseEvents(true, { forward: true });
      }, 550);
    } else {
      collapse(380);
      window.islandAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state !== 'expanded') {
      window.islandAPI?.setIgnoreMouseEvents(false);
      expand();
    }
  };

  const renderContent = () => {
    // Super hidden and not hovered: show elegant minimal notch indicator line
    if (!isVisible) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-16 h-1 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        </div>
      );
    }

    // 1. Idle View: Timer (running or on its tab) > Playing Media > Clock
    if (state === 'idle') {
      if (timerRunning || timerFinished || activeWidget === 'timer') return <TimerIdle />;
      return media.isPlaying ? <MediaIdle /> : <ClockIdle />;
    }

    // 2. Peek View
    if (state === 'peek') {
      if (peekKind === 'media') return <MediaPeek />;
      if (peekKind === 'timer') return <TimerPeek />;
      return <ClockPeek />;
    }

    // 3. Expanded View
    if (state === 'expanded') {
      return (
        <div className="flex flex-col w-full h-full">
          {/* Header Bar: [<] [Home | Timer | Clipboard] [>]  ....  [Pin] [Super Hide] */}
          <div
            className="flex items-center justify-between h-11 px-3 pt-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Tab Segmented Pill & Chevrons */}
            <div className="flex items-center gap-1">
              <IconButton
                title="Previous tab (Left arrow)"
                size="sm"
                variant="ghost"
                onClick={prevWidget}
              >
                <ChevronLeft />
              </IconButton>

              <div className="relative flex items-center p-0.5 rounded-full bg-white/[0.08] border border-white/[0.05] backdrop-blur-md">
                {TABS.map(({ id, label, title, Icon }) => {
                  const isActive = activeWidget === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={title}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveWidget(id, WIDGET_ORDER.indexOf(id) >= WIDGET_ORDER.indexOf(activeWidget) ? 1 : -1);
                      }}
                      className={`relative h-6 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        isActive ? 'text-white' : 'text-white/60 hover:text-white/90'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="atoll-tab-indicator"
                          className="absolute inset-0 rounded-full bg-white/[0.18] border border-white/20 shadow-sm"
                          transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                        />
                      )}
                      <Icon className="relative w-3.5 h-3.5" />
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>

              <IconButton
                title="Next tab (Right arrow)"
                size="sm"
                variant="ghost"
                onClick={nextWidget}
              >
                <ChevronRight />
              </IconButton>
            </div>

            {/* Right: Pin & Super Hide Actions */}
            <div className="flex items-center gap-1">
              <IconButton
                title={pinned ? 'Unpin island' : 'Pin island (keep expanded)'}
                size="sm"
                variant={pinned ? 'on' : 'ghost'}
                onClick={() => setPinned(!pinned)}
              >
                {pinned ? <Pin className="fill-current" /> : <PinOff />}
              </IconButton>

              <IconButton
                title={
                  stealthMode
                    ? 'Super Hide: On (tucked into notch)'
                    : 'Super Hide: Off (click to tuck into notch)'
                }
                size="sm"
                variant={stealthMode ? 'on' : 'ghost'}
                onClick={toggleStealthMode}
              >
                {stealthMode ? <EyeOff /> : <Eye />}
              </IconButton>
            </div>
          </div>

          {/* Widget Body */}
          <div className="flex-1 w-full min-h-0 overflow-hidden">
            {activeWidget === 'home' && <HomeExpanded />}
            {activeWidget === 'timer' && <TimerExpanded />}
            {activeWidget === 'clipboard' && <ClipboardExpanded />}
          </div>
        </div>
      );
    }

    return null;
  };

  const targetWidth = !isVisible ? SUPER_HIDE_WIDTH : currentDimensions.width;
  const targetHeight = !isVisible ? SUPER_HIDE_HEIGHT : currentDimensions.height;
  const targetBottomRadius = !isVisible ? SUPER_HIDE_RADIUS : currentDimensions.bottomRadius;

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-0 pointer-events-none">
      {/* Atoll Dynamic Island Pill */}
      <motion.div
        ref={pillRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{
          width: targetWidth,
          height: targetHeight,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: targetBottomRadius,
          borderBottomRightRadius: targetBottomRadius,
        }}
        transition={reduceMotion ? { duration: 0 } : atollSpring}
        className={`relative bg-black text-white ${
          state === 'expanded' ? 'cursor-default' : 'cursor-pointer'
        } pointer-events-auto overflow-hidden select-none flex flex-col justify-start items-center`}
        style={{
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: targetBottomRadius,
          borderBottomRightRadius: targetBottomRadius,
          backgroundColor: '#000000',
          boxShadow: !isVisible
            ? '0 2px 8px rgba(0, 0, 0, 0.9)'
            : state === 'expanded'
            ? '0 24px 56px -12px rgba(0, 0, 0, 0.95)'
            : '0 8px 24px -4px rgba(0, 0, 0, 0.85)',
          transform: 'translateZ(0)',
        }}
      >
        <MediaAmbientBackground />
        <div
          className="relative z-10 w-full h-full flex flex-col overflow-hidden"
          style={{
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: targetBottomRadius,
            borderBottomRightRadius: targetBottomRadius,
          }}
        >
          <AnimatePresence custom={slideDirection} mode="wait">
            <motion.div
              key={`${state}-${state === 'peek' ? peekKind : activeWidget}-${isVisible}`}
              custom={slideDirection}
              variants={contentSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full h-full flex items-center justify-center overflow-hidden"
              style={{
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: targetBottomRadius,
                borderBottomRightRadius: targetBottomRadius,
              }}
            >
              {renderContent()}
              {/* A paused track keeps its progress line under the idle clock */}
              {state === 'idle' &&
                !timerRunning &&
                !timerFinished &&
                activeWidget !== 'timer' &&
                !media.isPlaying &&
                media.title &&
                media.duration > 0 && <MediaProgressBar />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
