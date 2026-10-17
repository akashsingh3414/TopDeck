import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, Transition, Variants, useReducedMotion } from 'framer-motion';
import { useIslandStore } from '../store/useIslandStore';
import { STATE_DIMENSIONS, WIDGET_ORDER, WidgetType } from '../types/island';
import { ClockWidget } from '../widgets/ClockWidget';
import { MediaWidget, useArtworkTint } from '../widgets/MediaWidget';
import { TimerWidget, useTimerStore, playChime } from '../widgets/TimerWidget';
import {
  Clock,
  Music,
  Timer as TimerIcon,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { IconButton, formatDuration } from './ui';

const TABS: { id: WidgetType; label: string; title: string; Icon: typeof Clock }[] = [
  { id: 'clock', label: 'System', title: 'System (Clock, Wi-Fi, Bluetooth & Battery)', Icon: Clock },
  { id: 'media', label: 'Music', title: 'Music & Media', Icon: Music },
  { id: 'timer', label: 'Timer', title: 'Focus Timer', Icon: TimerIcon },
];

// iOS TopDeck spring physics
const islandSpring: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 34,
  mass: 0.8,
};

// Dimensions for super-hide notch and trigger zone
const SUPER_HIDE_WIDTH = 280;
const SUPER_HIDE_HEIGHT = 4;
const SUPER_HIDE_TRIGGER_HEIGHT = 9;
const SUPER_HIDE_RADIUS = 4;

// Subtle cross-fade & micro-slide variants for smooth widget switching
const contentSlideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 12 : -12,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -12 : 12,
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: 'easeIn',
    },
  }),
};

// Hairline along the flat part of the idle pill's bottom edge (inset past the rounded corners).
// A running focus timer wins in accent blue; otherwise the playing track, tinted by its artwork.
const IdleProgressLine: React.FC = () => {
  const timerTotal = useTimerStore((s) => s.totalTime);
  const timerLeft = useTimerStore((s) => s.timeLeft);
  const timerFinished = useTimerStore((s) => s.isFinished);
  const media = useIslandStore((s) => s.media);
  const tint = useArtworkTint(media.albumArt);

  let progress: number;
  let color: string;
  if (timerTotal > 0 && !timerFinished) {
    progress = (timerTotal - timerLeft) / timerTotal;
    color = '#0A84FF'; // accent
  } else if (media.isPlaying && media.duration > 0) {
    progress = media.position / media.duration;
    color = tint;
  } else {
    return null;
  }

  const inset = STATE_DIMENSIONS.idle.bottomRadius;
  return (
    <div
      className="absolute bottom-0 h-[2px] rounded-full bg-white/[0.08] overflow-hidden pointer-events-none"
      style={{ left: inset, right: inset }}
    >
      <div
        className="h-full rounded-full transition-[width,background-color] duration-1000 ease-linear"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, backgroundColor: color }}
      />
    </div>
  );
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
    setFullscreenHidden,
    updateMedia,
    updateBattery,
    updateRadios,
    updateAudio,
    setWifiNetworks,
    setBtDevices,
    media,
    hasUserSelectedTab,
  } = useIslandStore();

  const pillRef = useRef<HTMLDivElement>(null);
  // MotionConfig only disables transforms; width/height resizes need this to go instant too
  const reduceMotion = useReducedMotion();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const currentDimensions = STATE_DIMENSIONS[state];
  const timerTick = useTimerStore((s) => s.tick);
  const timerRunning = useTimerStore((s) => s.isRunning);
  const timerFinished = useTimerStore((s) => s.isFinished);
  // Seeded from the restored timer so an already-alerted "Time's up" doesn't chime again on launch
  const prevTimerFinishedRef = useRef(useTimerStore.getState().isFinished);
  const tickMediaPosition = useIslandStore((s) => s.tickMediaPosition);

  // Determine whether the island should be visible or tucked in stealth mode
  const isVisible = !stealthMode || isHovered || pinned || state === 'expanded' || state === 'peek';

  // Real-time media position ticker
  useEffect(() => {
    if (!media.isPlaying) return;
    const interval = setInterval(tickMediaPosition, 1000);
    return () => clearInterval(interval);
  }, [media.isPlaying, tickMediaPosition]);

  // Timer countdown hook
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(timerTick, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerTick]);

  // Timer finished (rising edge only): sticky peek until the user hovers, plus chime and toast
  useEffect(() => {
    if (timerFinished && !prevTimerFinishedRef.current) {
      peekWidget('timer', 0);
      playChime();
      const total = useTimerStore.getState().totalTime;
      window.islandAPI?.notify?.("Time's up", `Your ${formatDuration(total)} focus timer has finished.`);
    }
    prevTimerFinishedRef.current = timerFinished;
  }, [timerFinished, peekWidget]);

  // Keyboard navigation (Left / Right Arrow)
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
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [nextWidget, prevWidget]);

  // Tray toggle super hide listener
  useEffect(() => {
    if (!window.islandAPI?.onToggleSuperHide) return;
    const cleanup = window.islandAPI.onToggleSuperHide(() => {
      toggleStealthMode();
    });
    return cleanup;
  }, [toggleStealthMode]);

  // Native event listeners (Media, Battery, Fullscreen) from Electron IPC
  useEffect(() => {
    if (!window.islandAPI) return;

    const cleanup = window.islandAPI.onMediaUpdate((data) => {
      if (!data) return;
      if (data.type === 'media') {
        // A failed read is transient; don't let it blank out the current track and artwork
        if (data.error) return;
        updateMedia({
          title: data.title || '',
          artist: data.artist || '',
          album: data.album || '',
          isPlaying: !!data.isPlaying,
          position: data.position || 0,
          duration: data.duration || 0,
          albumArt: data.albumArt || '',
          appTitle: data.appTitle || '',
        });
      } else if (data.type === 'battery') {
        updateBattery({
          percent: data.percent,
          isCharging: data.isCharging,
          status: data.status,
        });
      } else if (data.type === 'radios') {
        updateRadios({
          wifiEnabled: !!data.wifiEnabled,
          wifiConnected: !!data.wifiConnected,
          wifiSsid: data.wifiSsid || '',
          wifiSignal: data.wifiSignal || 0,
          btEnabled: !!data.btEnabled,
        });
      } else if (data.type === 'audio') {
        updateAudio({
          muted: !!data.muted,
          volume: typeof data.volume === 'number' ? data.volume : -1,
        });
      } else if (data.type === 'wifiList') {
        setWifiNetworks(Array.isArray(data.networks) ? data.networks : []);
      } else if (data.type === 'btList') {
        setBtDevices(Array.isArray(data.devices) ? data.devices : []);
      } else if (data.type === 'fullscreen') {
        setFullscreenHidden(!!data.isFullscreen);
      }
    });

    return () => {
      cleanup();
    };
  }, [updateMedia, updateBattery, updateRadios, updateAudio, setWifiNetworks, setBtDevices, setFullscreenHidden]);

  // Report pill bounding rect to Electron main process for hit testing.
  // The pill is centered in the window, so x is derived from the window's real width
  // rather than a copy of electron/main.ts WINDOW_WIDTH.
  useEffect(() => {
    const updateBounds = () => {
      if (window.islandAPI) {
        const windowWidth = window.innerWidth;
        if (isFullscreenHidden) {
          window.islandAPI.updatePillBounds({ x: 0, y: 0, width: 0, height: 0 });
          return;
        }

        if (!isVisible) {
          // In super-hide mode: wide top-edge trigger zone at top center
          const centerX = Math.round((windowWidth - SUPER_HIDE_WIDTH) / 2);
          window.islandAPI.updatePillBounds({
            x: centerX,
            y: 0,
            width: SUPER_HIDE_WIDTH,
            height: SUPER_HIDE_TRIGGER_HEIGHT,
          });
          return;
        }

        // Send target bounds for state immediately so Electron's hit-testing loop
        // never drops mouse capture while the spring animation is running!
        const dim = STATE_DIMENSIONS[state];
        const targetX = Math.round((windowWidth - dim.width) / 2);
        window.islandAPI.updatePillBounds({
          x: targetX,
          y: 0,
          width: dim.width,
          height: dim.height,
        });
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [state, isFullscreenHidden, isVisible]);

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
      }, 550);
    } else {
      collapse(380);
    }
  };

  // Clicking only ever opens the island; it closes when the pointer leaves, so a
  // near-miss on a control can't collapse it
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state !== 'expanded') {
      expand();
    }
  };

  // Render Widget view based on state & activeWidget
  const renderContent = () => {
    // When super hidden and not hovered, show minimal indicator line
    if (!isVisible) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-10 h-0.5 rounded-full bg-white/30" />
        </div>
      );
    }

    // 1. Idle View: Prioritize active running states (Timer > Playing Media > Clock)
    if (state === 'idle') {
      if (timerRunning || timerFinished) {
        return <TimerWidget.idleView />;
      }
      if (media.isPlaying) {
        return <MediaWidget.idleView />;
      }
      switch (activeWidget) {
        case 'media':
          return (hasUserSelectedTab || media.isPlaying) ? <MediaWidget.idleView /> : <ClockWidget.idleView />;
        case 'timer':
          return <TimerWidget.idleView />;
        case 'clock':
        default:
          return <ClockWidget.idleView />;
      }
    }

    // 2. Peek View
    if (state === 'peek') {
      switch (activeWidget) {
        case 'media':
          return <MediaWidget.peekView />;
        case 'timer':
          return <TimerWidget.peekView />;
        case 'clock':
        default:
          return <ClockWidget.peekView />;
      }
    }

    // 3. Expanded View
    if (state === 'expanded') {
      return (
        <div className="flex flex-col w-full h-full">
          {/* Header: [<] [System | Music | Timer] [>]  ....  [pin] [hide] */}
          <div
            className="flex items-center justify-between h-11 px-3 pt-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <IconButton title="Previous tab (Left arrow)" size="sm" onClick={prevWidget}>
                <ChevronLeft />
              </IconButton>

              <div className="relative flex items-center p-0.5 rounded-full bg-white/[0.06]">
                {TABS.map(({ id, label, title, Icon }) => {
                  const isActive = activeWidget === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={title}
                      onClick={() =>
                        setActiveWidget(id, WIDGET_ORDER.indexOf(id) >= WIDGET_ORDER.indexOf(activeWidget) ? 1 : -1)
                      }
                      className={`relative h-6 px-2.5 rounded-full text-caption font-medium flex items-center gap-1.5 transition-colors duration-150 ${isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
                        }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="tab-indicator"
                          className="absolute inset-0 rounded-full bg-white/[0.14]"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}
                      <Icon className="relative w-3 h-3" />
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>

              <IconButton title="Next tab (Right arrow)" size="sm" onClick={nextWidget}>
                <ChevronRight />
              </IconButton>
            </div>

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
                    ? 'Super Hide: On (tucks into the top edge until hovered)'
                    : 'Super Hide: Off (click to tuck into the top edge)'
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
            {activeWidget === 'media' && <MediaWidget.expandedView />}
            {activeWidget === 'clock' && <ClockWidget.expandedView />}
            {activeWidget === 'timer' && <TimerWidget.expandedView />}
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
      {/* TopDeck Pill with flat top and curved bottom corners */}
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
        transition={reduceMotion ? { duration: 0 } : islandSpring}
        className={`relative bg-black text-white ${state === 'expanded' ? 'cursor-default' : 'cursor-pointer'} pointer-events-auto overflow-hidden select-none flex flex-col justify-start items-center`}
        style={{
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: targetBottomRadius,
          borderBottomRightRadius: targetBottomRadius,
          // Hairline edge + soft drop shadow; no top edge so the island melts into the screen bezel
          boxShadow: !isVisible
            ? '0 2px 8px rgba(0, 0, 0, 0.8), inset 0 -1px 0 rgba(255, 255, 255, 0.12)'
            : state === 'expanded'
              ? '0 24px 48px -12px rgba(0, 0, 0, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 1px 0 0 rgba(255, 255, 255, 0.06), inset -1px 0 0 rgba(255, 255, 255, 0.06)'
              : '0 8px 20px -6px rgba(0, 0, 0, 0.8), inset 0 -1px 0 rgba(255, 255, 255, 0.08)',
          transform: 'translateZ(0)',
        }}
      >
        <div
          className="w-full h-full flex flex-col overflow-hidden"
          style={{
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: targetBottomRadius,
            borderBottomRightRadius: targetBottomRadius,
          }}
        >
          <AnimatePresence custom={slideDirection} mode="wait">
            <motion.div
              key={`${state}-${activeWidget}-${isVisible}`}
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
            </motion.div>
          </AnimatePresence>
        </div>

        {state === 'idle' && isVisible && <IdleProgressLine />}
      </motion.div>
    </div>
  );
};
