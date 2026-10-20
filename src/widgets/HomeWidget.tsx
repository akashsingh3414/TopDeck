import React, { useState } from 'react';
import { Bluetooth, BluetoothOff, CalendarDays, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';
import { useIslandStore } from '../store/useIslandStore';
import { HomeSection } from '../types/island';
import { MediaPanel } from './MediaWidget';
import { CalendarGrid, MonthNav } from './system/CalendarView';
import { RadioList, RadioTile } from './system/RadioControls';
import { BatteryIndicator, MicIndicator, useSystemTime } from './system/SystemStatus';
import { SystemControls } from './system/SystemControls';

const SECTIONS: { id: HomeSection; label: string; Icon: typeof SlidersHorizontal }[] = [
  { id: 'controls', label: 'Controls', Icon: SlidersHorizontal },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
];

// Two side-by-side tabs for the right column; clicking the open one does nothing
const SectionTabs: React.FC<{ section: HomeSection; onSelect: (section: HomeSection) => void }> = ({
  section,
  onSelect,
}) => (
  <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.06]">
    {SECTIONS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        aria-pressed={section === id}
        onClick={(event) => {
          event.stopPropagation();
          if (section !== id) onSelect(id);
        }}
        className={`h-5 px-2 rounded-full flex items-center gap-1 text-[10px] font-semibold ${
          section === id ? 'bg-white/[0.16] text-white cursor-default' : 'text-white/55 hover:text-white cursor-pointer'
        }`}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    ))}
  </div>
);

const ControlsPanel: React.FC<{ onOpenList: (kind: 'wifi' | 'bt') => void }> = ({ onOpenList }) => {
  const now = useSystemTime();
  const radios = useIslandStore((s) => s.radios);

  const hoursMinutes = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const seconds = now.getSeconds().toString().padStart(2, '0');

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
  const btStatus = !radios.btEnabled ? 'Off' : radios.btConnected ? 'Connected' : 'On';

  return (
    <div className="flex flex-col justify-between h-full gap-1.5 px-0.5">
      {/* Lock-screen style clock: big hours:minutes, small seconds; battery level with it */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-[30px] font-bold tracking-tight text-white tabular-nums leading-none">{hoursMinutes}</span>
          <span className="text-[14px] font-semibold text-white/50 tabular-nums leading-none">{seconds}</span>
        </div>
        <span className="flex items-center gap-1.5">
          <MicIndicator />
          <BatteryIndicator />
        </span>
      </div>

      <div className="flex gap-1.5">
        <RadioTile
          icon={radios.wifiEnabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          label="Wi-Fi"
          status={wifiStatus}
          enabled={radios.wifiEnabled}
          onOpenList={() => onOpenList('wifi')}
          onToggle={() => toggleRadio('WIFI')}
        />
        <RadioTile
          icon={radios.btEnabled ? <Bluetooth className="w-3 h-3" /> : <BluetoothOff className="w-3 h-3" />}
          label="Bluetooth"
          status={btStatus}
          enabled={radios.btEnabled}
          onOpenList={() => onOpenList('bt')}
          onToggle={() => toggleRadio('BT')}
        />
      </div>

      <SystemControls />
    </div>
  );
};

export const HomeExpanded: React.FC = () => {
  const section = useIslandStore((s) => s.homeSection);
  const setSection = useIslandStore((s) => s.setHomeSection);
  const [list, setList] = useState<'wifi' | 'bt' | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());

  if (list) {
    return <RadioList kind={list} onBack={() => setList(null)} />;
  }

  const select = (next: HomeSection) => {
    if (next === 'calendar') setViewDate(new Date());
    setSection(next);
  };

  return (
    <div className="flex w-full h-full px-5 pb-3 pt-0.5 gap-4 select-none">
      <div className="flex-1 min-w-0">
        <MediaPanel />
      </div>

      <div className="flex flex-col w-[210px] flex-shrink-0 gap-1.5">
        <div className="flex-shrink-0">
          <SectionTabs section={section} onSelect={select} />
        </div>

        <div className="flex-1 min-h-0">
          {section === 'controls' ? (
            <ControlsPanel onOpenList={setList} />
          ) : (
            <div className="flex flex-col h-full gap-1">
              <div className="flex justify-end flex-shrink-0">
                <MonthNav viewDate={viewDate} onChange={setViewDate} />
              </div>
              <div className="flex-1 min-h-0">
                <CalendarGrid viewDate={viewDate} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
