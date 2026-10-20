import React, { useEffect, useState } from 'react';
import { Bluetooth, Wifi, WifiOff, BluetoothOff, Mic } from 'lucide-react';
import { useIslandStore } from '../../store/useIslandStore';

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

// iPhone style orange mic, shown only while an app is recording
export const MicIndicator: React.FC = () => {
  const mic = useIslandStore((s) => s.mic);
  if (!mic.active) return null;
  const label = `Microphone in use${mic.apps.length ? ` by ${mic.apps.join(', ')}` : ''}`;

  return (
    <span
      title={label}
      aria-label={label}
      className="w-[18px] h-[18px] rounded-full bg-[#FF9F0A]/20 flex items-center justify-center flex-shrink-0"
    >
      <Mic className="w-3 h-3 text-[#FF9F0A]" />
    </span>
  );
};

// iPhone/Mac style battery: the level fills the body and the percentage sits inside it
export const BatteryIndicator: React.FC = () => {
  const battery = useIslandStore((s) => s.battery);
  const percent = Math.min(100, Math.max(0, battery.percent));
  const isLow = percent <= 20 && !battery.isCharging;
  const fill = battery.isCharging ? 'bg-[#30D158]' : isLow ? 'bg-[#FF453A]' : 'bg-white/40';

  const label = battery.isCharging ? `Charging, ${percent}%` : `Battery ${percent}%`;

  return (
    <span title={label} aria-label={label} className="flex items-center flex-shrink-0">
      <span className="relative w-[27px] h-[13px] rounded-[4px] border border-white/45 overflow-hidden">
        <span className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${percent}%` }} />
        <span className="relative flex items-center justify-center h-full text-[8.5px] font-bold text-white tabular-nums leading-none">
          {percent}
        </span>
      </span>
      <span className="w-[2px] h-[5px] ml-[1px] rounded-r-sm bg-white/45" />
    </span>
  );
};

export const ClockPeek: React.FC = () => {
  const now = useNow();
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
        <MicIndicator />
        <BatteryIndicator />
      </div>
    </div>
  );
};

export const useSystemTime = useNow;
