import React, { useState, useEffect } from 'react';
import { IslandWidget } from './types';
import {
  Battery,
  BatteryCharging,
  BatteryWarning,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
} from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { SectionLabel } from '../components/ui';

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

const BatteryGlyph: React.FC<{ percent: number; isCharging: boolean; className?: string }> = ({
  percent,
  isCharging,
  className = 'w-4 h-4',
}) => {
  if (isCharging) return <BatteryCharging className={`${className} text-ok`} />;
  if (percent <= 20) return <BatteryWarning className={`${className} text-danger`} />;
  return <Battery className={`${className} text-ink-muted`} />;
};

export const ClockIdle: React.FC = () => {
  const now = useNow();
  const battery = useIslandStore((s) => s.battery);
  const isLow = battery.percent <= 20 && !battery.isCharging;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="flex items-center justify-between w-full h-full px-4 select-none">
      <span className="text-[13px] font-semibold tracking-tight text-ink tabular-nums">{time}</span>
      <div className="flex items-center gap-1">
        <BatteryGlyph percent={battery.percent} isCharging={battery.isCharging} className="w-3.5 h-3.5" />
        <span className={`text-caption font-medium tabular-nums ${isLow ? 'text-danger' : 'text-ink-muted'}`}>
          {battery.percent}%
        </span>
      </div>
    </div>
  );
};

export const ClockPeek: React.FC = () => {
  const now = useNow();
  const battery = useIslandStore((s) => s.battery);
  const radios = useIslandStore((s) => s.radios);

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center justify-between w-full h-full px-5 select-none">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px] font-semibold tracking-tight text-ink tabular-nums">{time}</span>
        <span className="text-caption text-ink-muted">{date}</span>
      </div>

      <div className="flex items-center gap-2.5">
        {radios.wifiEnabled ? (
          <Wifi className={`w-3.5 h-3.5 ${radios.wifiConnected ? 'text-ink' : 'text-ink-faint'}`} />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-ink-faint" />
        )}
        {radios.btEnabled ? (
          <Bluetooth className="w-3.5 h-3.5 text-ink" />
        ) : (
          <BluetoothOff className="w-3.5 h-3.5 text-ink-faint" />
        )}
        <div className="flex items-center gap-1">
          <BatteryGlyph percent={battery.percent} isCharging={battery.isCharging} />
          <span className="text-caption font-medium text-ink tabular-nums">{battery.percent}%</span>
        </div>
      </div>
    </div>
  );
};

// iOS Control Center style toggle row: round icon + label + status
const ToggleTile: React.FC<{
  on: boolean;
  label: string;
  status: string;
  title: string;
  icon: React.ReactNode;
  onToggle: () => void;
}> = ({ on, label, status, title, icon, onToggle }) => (
  <button
    type="button"
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className="flex items-center gap-2.5 w-full h-11 pl-1.5 pr-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors duration-150 active:scale-[0.98] text-left"
  >
    <span
      className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center transition-colors duration-150 ${on ? 'bg-accent text-white' : 'bg-white/[0.1] text-ink-muted'
        }`}
    >
      {icon}
    </span>
    <span className="flex flex-col min-w-0 leading-tight">
      <span className="text-[12px] font-semibold text-ink">{label}</span>
      <span className="text-caption text-ink-muted truncate">{status}</span>
    </span>
  </button>
);

export const ClockExpanded: React.FC = () => {
  const now = useNow();
  const battery = useIslandStore((s) => s.battery);
  const radios = useIslandStore((s) => s.radios);

  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const date = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  const isLow = battery.percent <= 20 && !battery.isCharging;

  const toggleRadio = (type: 'WIFI' | 'BT') => {
    window.islandAPI?.sendMediaCommand(type === 'WIFI' ? 'TOGGLE_WIFI' : 'TOGGLE_BT');
  };

  const wifiStatus = radios.wifiConnected ? radios.wifiSsid : radios.wifiEnabled ? 'Not connected' : 'Off';

  return (
    <div className="flex w-full h-full px-5 pb-4 pt-1 gap-4 select-none">
      {/* Left: time, date, battery */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div className="flex flex-col">
          <SectionLabel>{weekday}</SectionLabel>
          <div className="flex items-baseline mt-1">
            <span className="text-[40px] font-semibold tracking-tight text-ink tabular-nums leading-none">
              {hhmm}
            </span>
            <span className="ml-1.5 text-[15px] font-medium text-ink-faint tabular-nums">{seconds}</span>
          </div>
          <span className="text-[12px] text-ink-muted mt-1.5 truncate">{date}</span>
        </div>

        <div className="flex items-center gap-2">
          <BatteryGlyph percent={battery.percent} isCharging={battery.isCharging} />
          <div className="flex-1 h-1 rounded-full bg-white/[0.1] overflow-hidden">
            <div
              className={`h-full rounded-full ${battery.isCharging ? 'bg-ok' : isLow ? 'bg-danger' : 'bg-ink'}`}
              style={{ width: `${battery.percent}%` }}
            />
          </div>
          <span className="text-caption font-medium text-ink tabular-nums w-9 text-right">{battery.percent}%</span>
        </div>
      </div>

      {/* Right: quick toggles */}
      <div className="flex flex-col justify-center gap-2 w-[176px] flex-shrink-0">
        <ToggleTile
          on={radios.wifiEnabled}
          label="Wi-Fi"
          status={wifiStatus}
          title={radios.wifiConnected ? `Wi-Fi: ${radios.wifiSsid} (${radios.wifiSignal}%)` : `Wi-Fi: ${wifiStatus}`}
          icon={radios.wifiEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          onToggle={() => toggleRadio('WIFI')}
        />
        <ToggleTile
          on={radios.btEnabled}
          label="Bluetooth"
          status={radios.btEnabled ? 'On' : 'Off'}
          title={`Bluetooth: ${radios.btEnabled ? 'On' : 'Off'}`}
          icon={radios.btEnabled ? <Bluetooth className="w-4 h-4" /> : <BluetoothOff className="w-4 h-4" />}
          onToggle={() => toggleRadio('BT')}
        />
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
