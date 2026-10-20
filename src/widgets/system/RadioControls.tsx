import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  ChevronLeft,
  Loader2,
  Lock,
  Wifi,
} from 'lucide-react';
import { useIslandStore } from '../../store/useIslandStore';
import { BluetoothDevice, WifiNetwork } from '../../types/island';

// Round icon toggles the radio; the rest of the tile opens the network/device list
export const RadioTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  status: string;
  enabled: boolean;
  onOpenList: () => void;
  onToggle: () => void;
}> = ({ icon, label, status, enabled, onOpenList, onToggle }) => (
  <div
    role="button"
    title={label === 'Wi-Fi' ? 'Show Wi-Fi networks' : 'Show Bluetooth devices'}
    onClick={(event) => {
      event.stopPropagation();
      onOpenList();
    }}
    className="flex items-center gap-1.5 flex-1 min-w-0 h-[34px] px-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.11] transition-colors cursor-pointer"
  >
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      title={`Turn ${label} ${enabled ? 'off' : 'on'}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer active:scale-90 ${
        enabled ? 'bg-[#007AFF] text-white shadow-[0_0_8px_rgba(0,122,255,0.4)]' : 'bg-white/10 text-white/40 hover:bg-white/20'
      }`}
    >
      {icon}
    </button>
    <div className="flex flex-col min-w-0 leading-tight">
      <span className="text-[10px] font-semibold text-white truncate">{label}</span>
      <span className="text-[9px] text-white/50 truncate">{status}</span>
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
