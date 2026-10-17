import { contextBridge, ipcRenderer } from 'electron';

export interface IslandAPI {
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => void;
  updatePillBounds: (rect: { x: number; y: number; width: number; height: number }) => void;
  minimizeApp: () => void;
  closeApp: () => void;
  onMediaUpdate: (callback: (data: any) => void) => () => void;
  sendMediaCommand: (command: string) => Promise<boolean>;
  getSystemStatus: () => Promise<any>;
  onToggleSuperHide: (callback: () => void) => () => void;
  openSettings: (setting: string) => Promise<boolean>;
  notify: (title: string, body: string) => Promise<boolean>;
}

const api: IslandAPI = {
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, forward ? { forward: true } : undefined);
  },
  updatePillBounds: (rect) => {
    ipcRenderer.send('update-pill-bounds', rect);
  },
  minimizeApp: () => {
    ipcRenderer.send('minimize-app');
  },
  closeApp: () => {
    ipcRenderer.send('close-app');
  },
  onMediaUpdate: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('media-update', listener);
    return () => {
      ipcRenderer.removeListener('media-update', listener);
    };
  },
  sendMediaCommand: (command: string) => {
    return ipcRenderer.invoke('media-command', command);
  },
  getSystemStatus: () => {
    return ipcRenderer.invoke('get-system-status');
  },
  openSettings: (setting: string) => {
    return ipcRenderer.invoke('open-settings', setting);
  },
  notify: (title: string, body: string) => {
    return ipcRenderer.invoke('notify', title, body);
  },
  onToggleSuperHide: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-super-hide', listener);
    return () => {
      ipcRenderer.removeListener('toggle-super-hide', listener);
    };
  },
};

contextBridge.exposeInMainWorld('islandAPI', api);
