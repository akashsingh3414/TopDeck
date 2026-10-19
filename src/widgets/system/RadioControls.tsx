import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Wifi,
} from 'lucide-react';
import { useIslandStore } from '../../store/useIslandStore';
import { BluetoothDevice, WifiNetwork } from '../../types/island';

export const CompactRadioCapsule: React.FC<{
  icon: React.ReactNode;
  label: string;
  status: string;
  enabled: boolean;
  onOpenList: () => void;
  onToggle: () => void;
}> = ({ icon, label, status, enabled, onOpenList, onToggle }) => (
  <div className="flex items-center justify-between w-full h-[32px] px-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.1] border border-white/[0.05] transition-all">
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          enabled ? 'bg-[#007AFF] text-white shadow-[0_0_8px_rgba(0,122,255,0.4)]' : 'bg-white/10 text-white/40'
        }`}
      >
        {icon}
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0 truncate">
        <span className="text-[11px] font-semibold text-white tracking-tight">{label}</span>
        <span className="text-[10px] text-white/50 truncate font-normal">{status}</span>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0 ml-1">
      <button
        type="button"
        title={`Check available ${label} devices/networks`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenList();
        }}
        className="w-5 h-5 rounded-md hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        title={`Turn ${label} ${enabled ? 'off' : 'on'}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center flex-shrink-0 ${
          enabled ? 'bg-[#007AFF]' : 'bg-white/20'
        }`}
      >
        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-3' : 'translate-x-0'
        }`} />
      </button>
    </div>
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
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className={`flex items-center gap-2.5 w-full h-8 px-2.5 rounded-xl hover:bg-white/[0.1] transition-all duration-150 text-left cursor-pointer ${
      highlighted ? 'bg-white/[0.07]' : ''
    }`}
  >
    <span className={highlighted ? 'text-[#007AFF]' : 'text-white/60'}>{icon}</span>
    <span className={`flex-1 min-w-0 truncate text-[12px] text-white ${highlighted ? 'font-semibold' : ''}`}>{primary}</span>
    {secondary && <span className="flex-shrink-0 text-[10px] text-white/45">{secondary}</span>}
  </button>
);

const Status: React.FC<{ text: string; loading?: boolean }> = ({ text, loading = false }) => (
  <div className="flex items-center gap-2 h-8 px-3 text-[11px] text-white/50">
    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />}
    {text}
  </div>
);

export const RadioList: React.FC<{ kind: 'wifi' | 'bt'; onBack: () => void }> = ({ kind, onBack }) => {
  const wifiNetworks = useIslandStore((s) => s.wifiNetworks);
  const btDevices = useIslandStore((s) => s.btDevices);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'wifi') useIslandStore.getState().setWifiNetworks(null);
    else useIslandStore.getState().setBtDevices(null);
    window.islandAPI?.sendMediaCommand(kind === 'wifi' ? 'LIST_WIFI' : 'LIST_BT');
  }, [kind]);

  useEffect(() => setConnecting(null), [wifiNetworks]);

  const openSettings = () => window.islandAPI?.openSettings?.(kind === 'wifi' ? 'wifi' : 'bluetooth');
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  const rows = () => {
    if (kind === 'wifi') {
      if (wifiNetworks === null) return <Status loading text="Scanning for networks…" />;
      if (wifiNetworks.length === 0) return <Status text="No networks found" />;
      return wifiNetworks.map((network: WifiNetwork) => (
        <ListRow
          key={network.ssid}
          title={network.connected ? 'Connected' : network.known ? `Connect to ${network.ssid}` : `Join ${network.ssid} in Settings`}
          icon={connecting === network.ssid
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />
            : <Wifi className="w-3.5 h-3.5" />}
          primary={network.ssid}
          secondary={
            network.connected
              ? 'Connected'
              : connecting === network.ssid
                ? 'Connecting…'
                : network.secured ? <Lock className="w-3 h-3" /> : null
          }
          highlighted={network.connected}
          onClick={() => {
            if (network.connected) return;
            if (network.known) {
              setConnecting(network.ssid);
              window.islandAPI?.sendMediaCommand(`CONNECT_WIFI:${network.ssid}`);
            } else {
              openSettings();
            }
          }}
        />
      ));
    }

    if (btDevices === null) return <Status loading text="Loading paired devices…" />;
    if (btDevices.length === 0) return <Status text="No paired devices" />;
    return btDevices.map((device: BluetoothDevice) => (
      <ListRow
        key={device.name}
        title={`Manage ${device.name} in Settings`}
        icon={<Bluetooth className="w-3.5 h-3.5" />}
        primary={device.name}
        secondary={device.connected ? 'Connected' : 'Not connected'}
        highlighted={device.connected}
        onClick={openSettings}
      />
    ));
  };

  return (
    <div className="flex flex-col w-full h-full px-4 pb-3 select-none">
      <div className="flex items-center justify-between h-7 flex-shrink-0 mb-1">
        <button
          type="button"
          onClick={stop(onBack)}
          className="flex items-center gap-1 text-[12px] font-semibold text-white hover:text-white/70 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          {kind === 'wifi' ? 'Wi-Fi Networks' : 'Bluetooth Devices'}
        </button>
        <button
          type="button"
          onClick={stop(openSettings)}
          className="text-[11px] font-medium text-[#007AFF] hover:text-[#409CFF] transition-colors cursor-pointer"
        >
          Settings
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 pr-1">{rows()}</div>
    </div>
  );
};
