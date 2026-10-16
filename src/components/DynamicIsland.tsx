import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIslandStore } from '../store/useIslandStore';
import { STATE_DIMENSIONS, WIDGET_ORDER, WidgetType } from '../types/island';
import { ClockWidget } from '../widgets/ClockWidget';
import { MediaWidget } from '../widgets/MediaWidget';
import { TimerWidget, useTimerStore } from '../widgets/TimerWidget';
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

// iOS TopDeck spring physics
const islandSpring = {
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
const contentSlideVariants = {
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
    media,
  } = useIslandStore();

  const pillRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const currentDimensions = STATE_DIMENSIONS[state];
  const timerTick = useTimerStore((s) => s.tick);
  const timerRunning = useTimerStore((s) => s.isRunning);
  const timerFinished = useTimerStore((s) => s.isFinished);
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

  // Peek on timer finished
  useEffect(() => {
    if (timerFinished) {
      peekWidget('timer', 4000);
    }
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
      } else if (data.type === 'fullscreen') {
        setFullscreenHidden(!!data.isFullscreen);
      }
    });

    return () => {
      cleanup();
    };
  }, [updateMedia, updateBattery, setFullscreenHidden]);

  // Report pill bounding rect to Electron main process for hit testing
  useEffect(() => {
    const updateBounds = () => {
      if (window.islandAPI) {
        if (isFullscreenHidden) {
          window.islandAPI.updatePillBounds({ x: 0, y: 0, width: 0, height: 0 });
          return;
        }

        if (!isVisible) {
          // In super-hide mode: wide top-edge trigger zone at top center
          const centerX = Math.round((560 - SUPER_HIDE_WIDTH) / 2);
          window.islandAPI.updatePillBounds({
            x: centerX,
            y: 0,
            width: SUPER_HIDE_WIDTH,
            height: SUPER_HIDE_TRIGGER_HEIGHT,
          });
          return;
        }

        if (pillRef.current) {
          const rect = pillRef.current.getBoundingClientRect();
          window.islandAPI.updatePillBounds({
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    };

    updateBounds();
    const timer = setTimeout(updateBounds, 80);
    const interval = setInterval(updateBounds, 250);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
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
    if (stealthMode && !pinned) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
        collapse(0);
      }, 550);
    } else {
      collapse(380);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'expanded') {
      collapse(0);
    } else {
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
          return <MediaWidget.idleView />;
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
        <div className="relative flex flex-col w-full h-full pt-1 bg-black">
          {/* Top Control Buttons: [ < ] [ > ] [ 📌 ] [ 👁️ ] */}
          <div
            className="absolute top-2.5 right-3 z-30 flex items-center space-x-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Widget Button */}
            <button
              onClick={prevWidget}
              title="Previous Tab"
              className="w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.08] shadow-sm flex items-center justify-center transition-all active:scale-90"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Next Widget Button */}
            <button
              onClick={nextWidget}
              title="Next Tab"
              className="w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border border-white/[0.08] shadow-sm flex items-center justify-center transition-all active:scale-90"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Pin Island Button */}
            <button
              onClick={() => setPinned(!pinned)}
              title={pinned ? 'Unpin island' : 'Pin island (keep expanded)'}
              className={`w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all active:scale-90 ${pinned
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border-white/[0.08]'
                }`}
            >
              {pinned ? <Pin className="w-3.5 h-3.5 fill-black" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>

            {/* Super Hide Toggle Button */}
            <button
              onClick={toggleStealthMode}
              title={
                stealthMode
                  ? 'Super Hide: Active (auto-tucks to top edge until hovered)'
                  : 'Super Hide: Off (click to auto-hide into top edge)'
              }
              className={`w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all active:scale-90 ${stealthMode
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white border-white/[0.08]'
                }`}
            >
              {stealthMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Main Widget Body */}
          <div className="flex-1 w-full overflow-hidden">
            {activeWidget === 'media' && <MediaWidget.expandedView />}
            {activeWidget === 'clock' && <ClockWidget.expandedView />}
            {activeWidget === 'timer' && <TimerWidget.expandedView />}
          </div>

          {/* Apple Segmented Tab Selector & Pagination Dots */}
          <div
            className="flex items-center justify-between py-1.5 px-4 bg-black border-t border-white/[0.08]"
            style={{
              borderBottomLeftRadius: currentDimensions.bottomRadius,
              borderBottomRightRadius: currentDimensions.bottomRadius,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 3 Quick segmented tabs: System, Music, Timer */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveWidget('clock', -1)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1.5 ${activeWidget === 'clock'
                    ? 'bg-white/[0.14] text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                title="System (Clock, Calendar & Battery)"
              >
                <Clock className="w-3 h-3" />
                <span>System</span>
              </button>

              <button
                onClick={() => setActiveWidget('media', 1)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1.5 ${activeWidget === 'media'
                    ? 'bg-white/[0.14] text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                title="Music & Media"
              >
                <Music className="w-3 h-3" />
                <span>Music</span>
              </button>

              <button
                onClick={() => setActiveWidget('timer', 1)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1.5 ${activeWidget === 'timer'
                    ? 'bg-white/[0.14] text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                title="Focus Timer"
              >
                <TimerIcon className="w-3 h-3" />
                <span>Timer</span>
              </button>
            </div>

            {/* Apple-style Pagination Dots */}
            <div className="flex items-center space-x-1.5">
              {WIDGET_ORDER.map((widgetId: WidgetType) => {
                const isActive = activeWidget === widgetId;
                return (
                  <span
                    key={widgetId}
                    className={`h-1 rounded-full transition-all duration-300 ${isActive ? 'w-3.5 bg-white' : 'w-1 bg-white/20'
                      }`}
                  />
                );
              })}
            </div>
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
        transition={islandSpring}
        className="relative bg-black text-white cursor-pointer pointer-events-auto overflow-hidden select-none flex flex-col justify-start items-center border-x border-b border-white/[0.1]"
        style={{
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: targetBottomRadius,
          borderBottomRightRadius: targetBottomRadius,
          boxShadow: !isVisible
            ? '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 20px 40px -4px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08)',
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
      </motion.div>
    </div>
  );
};
