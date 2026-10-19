import React, { useState } from 'react';
import { Bluetooth, BluetoothOff, Wifi, WifiOff } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { IslandWidget } from './types';
import { CalendarView } from './system/CalendarView';
import { CompactRadioCapsule, RadioList } from './system/RadioControls';
import { ClockIdle, ClockPeek, useSystemTime } from './system/SystemStatus';
import { SystemControls } from './system/SystemControls';

export const ClockExpanded: React.FC = () => {
  const now = useSystemTime();
  const battery = useIslandStore((s) => s.battery);
  const radios = useIslandStore((s) => s.radios);
  const [list, setList] = useState<'wifi' | 'bt' | null>(null);

  if (list) {
    return <RadioList kind={list} onBack={() => setList(null)} />;
  }

  const fullTime = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const toggleRadio = (type: 'WIFI' | 'BT') => {
    if (type === 'WIFI') {
      useIslandStore.getState().updateRadios({ wifiEnabled: !radios.wifiEnabled });
    } else {
      useIslandStore.getState().updateRadios({ btEnabled: !radios.btEnabled });
    }
    window.islandAPI?.sendMediaCommand(type === 'WIFI' ? 'TOGGLE_WIFI' : 'TOGGLE_BT');
  };

  const wifiStatus = radios.wifiConnected
    ? radios.wifiSsid || 'Connected'
    : radios.wifiEnabled
      ? 'Not Connected'
      : 'Off';
  const btStatus = radios.btEnabled ? 'On' : 'Off';

  return (
    <div className="flex w-full h-full px-5 pb-3 pt-0.5 gap-4 select-none">
      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5 gap-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[20px] font-bold tracking-tight text-white tabular-nums leading-none">
            {fullTime}
          </span>
          <span
            title={battery.isCharging ? `Charging, ${battery.percent}%` : `Battery ${battery.percent}%`}
            className={`text-[11px] font-semibold tabular-nums ${
              battery.percent <= 20 && !battery.isCharging
                ? 'text-[#FF453A]'
                : battery.isCharging ? 'text-[#30D158]' : 'text-white/70'
            }`}
          >
            {battery.percent}%
          </span>
        </div>
        <CalendarView />
      </div>

      <div className="flex flex-col justify-between w-[210px] flex-shrink-0 py-0.5 gap-1.5">
        <CompactRadioCapsule
          icon={radios.wifiEnabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          label="Wi-Fi"
          status={wifiStatus}
          enabled={radios.wifiEnabled}
          onOpenList={() => setList('wifi')}
          onToggle={() => toggleRadio('WIFI')}
        />
        <CompactRadioCapsule
          icon={radios.btEnabled ? <Bluetooth className="w-3 h-3" /> : <BluetoothOff className="w-3 h-3" />}
          label="Bluetooth"
          status={btStatus}
          enabled={radios.btEnabled}
          onOpenList={() => setList('bt')}
          onToggle={() => toggleRadio('BT')}
        />
        <SystemControls />
      </div>
    </div>
  );
};

export const ClockWidget: IslandWidget = {
  id: 'clock',
  name: 'System',
  priority: 10,
  idleView: ClockIdle,
  peekView: ClockPeek,
  expandedView: ClockExpanded,
};
