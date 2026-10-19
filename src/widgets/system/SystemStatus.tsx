import React, { useEffect, useState } from 'react';
import { Bluetooth, Wifi, WifiOff, BluetoothOff } from 'lucide-react';
import { useIslandStore } from '../../store/useIslandStore';
import { useMediaAccent } from '../../hooks/useMediaAccent';

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

export const ClockIdle: React.FC = () => {
  const now = useNow();
  const battery = useIslandStore((s) => s.battery);
  const radios = useIslandStore((s) => s.radios);
  const accent = useMediaAccent();
  const isLow = battery.percent <= 20 && !battery.isCharging;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });

  return (
    <div className="flex items-center w-full h-full gap-2.5 px-3 select-none">
      <span className="text-[13px] font-semibold tracking-tight text-white tabular-nums">{time}</span>
      <span
        className="whitespace-nowrap text-[10px] font-medium tracking-tight"
        style={{ color: accent }}
      >
        {date}
      </span>
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {radios.wifiEnabled && radios.wifiConnected && (
          <Wifi className="w-3.5 h-3.5 text-white/75" aria-label="Wi-Fi connected" />
        )}
        {radios.btEnabled && radios.btConnected && (
          <Bluetooth className="w-3.5 h-3.5 text-white/75" aria-label="Bluetooth connected" />
        )}
        <span
          title={battery.isCharging ? `Charging, ${battery.percent}%` : `Battery ${battery.percent}%`}
          className={`text-[11px] font-medium tabular-nums ${
            isLow ? 'text-[#FF453A]' : battery.isCharging ? 'text-[#30D158]' : 'text-white/70'
          }`}
        >
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
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center justify-between w-full h-full px-5 select-none">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px] font-semibold tracking-tight text-white tabular-nums">{time}</span>
        <span className="text-[11px] text-white/50">{date}</span>
      </div>
      <div className="flex items-center gap-3">
        {radios.wifiEnabled
          ? <Wifi className={`w-3.5 h-3.5 ${radios.wifiConnected ? 'text-[#007AFF]' : 'text-white/50'}`} />
          : <WifiOff className="w-3.5 h-3.5 text-white/30" />}
        {radios.btEnabled
          ? <Bluetooth className="w-3.5 h-3.5 text-[#007AFF]" />
          : <BluetoothOff className="w-3.5 h-3.5 text-white/30" />}
        <span
          title={battery.isCharging ? `Charging, ${battery.percent}%` : `Battery ${battery.percent}%`}
          className={`text-[11px] font-medium tabular-nums ${
            battery.percent <= 20 && !battery.isCharging
              ? 'text-[#FF453A]'
              : battery.isCharging ? 'text-[#30D158]' : 'text-white'
          }`}
        >
          {battery.percent}%
        </span>
      </div>
    </div>
  );
};

export const useSystemTime = useNow;
