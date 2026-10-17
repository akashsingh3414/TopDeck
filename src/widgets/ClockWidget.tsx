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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
} from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { SectionLabel } from '../components/ui';
import { WifiNetwork, BluetoothDevice } from '../types/island';

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

// iOS Control Center style tile: the round icon toggles the radio, the rest opens its list
const ToggleTile: React.FC<{
  on: boolean;
  label: string;
  status: string;
  icon: React.ReactNode;
  onToggle: () => void;
  onOpen: () => void;
}> = ({ on, label, status, icon, onToggle, onOpen }) => (
  <div className="flex items-center w-full h-11 pl-1.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors duration-150">
    <button
      type="button"
      title={`Turn ${label} ${on ? 'off' : 'on'}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center transition-colors duration-150 active:scale-90 ${on ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-white/[0.1] text-ink-muted hover:text-ink'
        }`}
    >
      {icon}
    </button>
    <button
      type="button"
      title={`Show ${label} list`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="flex items-center flex-1 min-w-0 h-full pl-2.5 pr-2 text-left"
    >
      <span className="flex flex-col flex-1 min-w-0 leading-tight">
        <span className="text-[12px] font-semibold text-ink">{label}</span>
        <span className="text-caption text-ink-muted truncate">{status}</span>
      </span>
      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-ink-faint" />
    </button>
  </div>
);

const ListRow: React.FC<{
  title: string;
  icon: React.ReactNode;
  primary: string;
  secondary?: React.ReactNode;
  highlighted?: boolean;
  onClick: () => void;
}> = ({ title, icon, primary, secondary, highlighted = false, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="flex items-center gap-2.5 w-full h-8 px-2 rounded-lg hover:bg-white/[0.08] transition-colors duration-150 text-left"
  >
    <span className={highlighted ? 'text-accent' : 'text-ink-muted'}>{icon}</span>
    <span className={`flex-1 min-w-0 truncate text-[12px] text-ink ${highlighted ? 'font-semibold' : ''}`}>{primary}</span>
    {secondary && <span className="flex-shrink-0 text-caption text-ink-faint">{secondary}</span>}
  </button>
);

// Wi-Fi networks or paired Bluetooth devices. Kept deliberately small: saved Wi-Fi networks
// connect in place; everything else (passwords, pairing) is handed to Windows Settings.
const RadioList: React.FC<{ kind: 'wifi' | 'bt'; onBack: () => void }> = ({ kind, onBack }) => {
  const wifiNetworks = useIslandStore((s) => s.wifiNetworks);
  const btDevices = useIslandStore((s) => s.btDevices);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'wifi') useIslandStore.getState().setWifiNetworks(null);
    else useIslandStore.getState().setBtDevices(null);
    window.islandAPI?.sendMediaCommand(kind === 'wifi' ? 'LIST_WIFI' : 'LIST_BT');
  }, [kind]);

  // A fresh list means the connect attempt finished
  useEffect(() => setConnecting(null), [wifiNetworks]);

  const openSettings = () => window.islandAPI?.openSettings?.(kind === 'wifi' ? 'wifi' : 'bluetooth');
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const renderRows = () => {
    if (kind === 'wifi') {
      if (wifiNetworks === null) return <Status loading text="Looking for networks…" />;
      if (wifiNetworks.length === 0) return <Status text="No networks found" />;
      return wifiNetworks.map((n: WifiNetwork) => (
        <ListRow
          key={n.ssid}
          title={n.connected ? 'Connected' : n.known ? `Connect to ${n.ssid}` : `Join ${n.ssid} in Settings`}
          icon={connecting === n.ssid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          primary={n.ssid}
          secondary={
            n.connected ? 'Connected' : connecting === n.ssid ? 'Connecting…' : n.secured ? <Lock className="w-3 h-3" /> : null
          }
          highlighted={n.connected}
          onClick={() => {
            if (n.connected) return;
            if (n.known) {
              setConnecting(n.ssid);
              window.islandAPI?.sendMediaCommand(`CONNECT_WIFI:${n.ssid}`);
            } else {
              openSettings();
            }
          }}
        />
      ));
    }

    if (btDevices === null) return <Status loading text="Loading devices…" />;
    if (btDevices.length === 0) return <Status text="No paired devices" />;
    return btDevices.map((d: BluetoothDevice) => (
      <ListRow
        key={d.name}
        title={`Manage ${d.name} in Settings`}
        icon={<Bluetooth className="w-3.5 h-3.5" />}
        primary={d.name}
        secondary={d.connected ? 'Connected' : 'Not connected'}
        highlighted={d.connected}
        onClick={openSettings}
      />
    ));
  };

  return (
    <div className="flex flex-col w-full h-full px-4 pb-3 select-none">
      <div className="flex items-center justify-between h-7 flex-shrink-0">
        <button
          type="button"
          onClick={stop(onBack)}
          className="flex items-center gap-1 text-[12px] font-semibold text-ink hover:text-ink-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {kind === 'wifi' ? 'Wi-Fi' : 'Bluetooth'}
        </button>
        <button
          type="button"
          onClick={stop(openSettings)}
          className="text-caption text-accent hover:text-accent-hover transition-colors"
        >
          Settings
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto mt-1 -mx-1">{renderRows()}</div>
    </div>
  );
};

const Status: React.FC<{ text: string; loading?: boolean }> = ({ text, loading = false }) => (
  <div className="flex items-center gap-2 h-8 px-3 text-caption text-ink-muted">
    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
    {text}
  </div>
);

export const ClockExpanded: React.FC = () => {
  const now = useNow();
  const battery = useIslandStore((s) => s.battery);
  const radios = useIslandStore((s) => s.radios);
  const [list, setList] = useState<'wifi' | 'bt' | null>(null);

  if (list) {
    return <RadioList kind={list} onBack={() => setList(null)} />;
  }

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
          icon={radios.wifiEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          onToggle={() => toggleRadio('WIFI')}
          onOpen={() => setList('wifi')}
        />
        <ToggleTile
          on={radios.btEnabled}
          label="Bluetooth"
          status={radios.btEnabled ? 'On' : 'Off'}
          icon={radios.btEnabled ? <Bluetooth className="w-4 h-4" /> : <BluetoothOff className="w-4 h-4" />}
          onToggle={() => toggleRadio('BT')}
          onOpen={() => setList('bt')}
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
