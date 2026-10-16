import React, { useState, useEffect } from 'react';
import { IslandWidget } from './types';
import { Calendar, Clock, Battery, BatteryCharging, BatteryWarning } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';

export const ClockIdle: React.FC = () => {
  const [time, setTime] = useState<string>('');
  const battery = useIslandStore((s) => s.battery);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLow = battery.percent <= 20 && !battery.isCharging;

  return (
    <div className="flex items-center justify-between w-full px-3 h-full select-none text-white font-medium">
      {/* Time */}
      <div className="flex items-center space-x-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
        <span className="text-[12px] tracking-tight font-semibold text-white/95 tabular-nums">
          {time || '12:00'}
        </span>
      </div>

      {/* Clean inline battery indicator */}
      <div className="flex items-center space-x-1">
        {battery.isCharging ? (
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
        ) : isLow ? (
          <BatteryWarning className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        ) : (
          <Battery className="w-3.5 h-3.5 text-neutral-400" />
        )}
        <span className={`text-[10px] font-medium tabular-nums ${isLow ? 'text-rose-400' : 'text-neutral-300'}`}>
          {battery.percent}%
        </span>
      </div>
    </div>
  );
};

export const ClockPeek: React.FC = () => {
  const [dateTime, setDateTime] = useState({ time: '', date: '' });
  const battery = useIslandStore((s) => s.battery);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDateTime({
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLow = battery.percent <= 20 && !battery.isCharging;

  return (
    <div className="flex items-center justify-between w-full px-4 h-full select-none text-white">
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-neutral-300" />
        <span className="text-[13px] font-semibold tracking-tight text-white tabular-nums">{dateTime.time}</span>
        <span className="text-white/20">•</span>
        <span className="text-[11px] text-neutral-400 font-medium">{dateTime.date}</span>
      </div>

      {/* Clean inline battery */}
      <div className="flex items-center space-x-1 text-xs">
        {battery.isCharging ? (
          <BatteryCharging className="w-4 h-4 text-emerald-400" />
        ) : isLow ? (
          <BatteryWarning className="w-4 h-4 text-rose-400 animate-pulse" />
        ) : (
          <Battery className="w-4 h-4 text-neutral-300" />
        )}
        <span className="font-medium text-neutral-200 tabular-nums">{battery.percent}%</span>
      </div>
    </div>
  );
};

export const ClockExpanded: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const battery = useIslandStore((s) => s.battery);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isLow = battery.percent <= 20 && !battery.isCharging;

  return (
    <div className="flex flex-col justify-between w-full h-full p-4 select-none text-white bg-black">
      {/* Top section: Clock & Full Date */}
      <div className="flex flex-col text-left pr-28">
        <div className="flex items-center space-x-1.5 mb-1">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
            System & Calendar
          </span>
        </div>
        <div className="text-3xl font-bold tracking-tight text-white tabular-nums leading-none my-1">
          {timeStr}
        </div>
        <div className="text-xs text-neutral-400 mt-1 flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Bottom status row: Clean battery display */}
      <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs text-neutral-400">
        <span className="text-[10px] text-neutral-500 font-medium tracking-wide uppercase">
          TopDeck
        </span>

        {/* Clean inline battery indicator */}
        <div className="flex items-center space-x-1.5">
          {battery.isCharging ? (
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          ) : isLow ? (
            <BatteryWarning className="w-4 h-4 text-rose-400 animate-pulse" />
          ) : (
            <Battery className="w-4 h-4 text-neutral-300" />
          )}
          <span className="font-medium text-white/90 tabular-nums">{battery.percent}%</span>
          <span className="text-[10px] text-neutral-400">
            {battery.isCharging ? '• Charging' : '• Battery'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ClockWidget: IslandWidget = {
  id: 'clock',
  name: 'Clock',
  priority: 10,
  idleView: ClockIdle,
  peekView: ClockPeek,
  expandedView: ClockExpanded,
};
