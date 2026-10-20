import { contextBridge, ipcRenderer } from 'electron';

export interface IslandAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
  onMediaUpdate: (callback: (data: any) => void) => () => void;
  sendMediaCommand: (command: string) => Promise<boolean>;
  onSetSuperHide: (callback: (on: boolean) => void) => () => void;
  reportSuperHide: (on: boolean) => void;
  openSettings: (setting: string) => Promise<boolean>;
  notify: (title: string, body: string) => Promise<boolean>;
  onClipboardChange: (callback: (text: string) => void) => () => void;
  writeClipboard: (text: string) => Promise<boolean>;
}

const api: IslandAPI = {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
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
  openSettings: (setting: string) => {
    return ipcRenderer.invoke('open-settings', setting);
  },
  notify: (title: string, body: string) => {
    return ipcRenderer.invoke('notify', title, body);
  },
  onClipboardChange: (callback: (text: string) => void) => {
    const listener = (_event: any, text: string) => callback(text);
    ipcRenderer.on('clipboard-change', listener);
    return () => {
      ipcRenderer.removeListener('clipboard-change', listener);
    };
  },
  writeClipboard: (text: string) => {
    return ipcRenderer.invoke('clipboard-write', text);
  },
  reportSuperHide: (on: boolean) => {
    ipcRenderer.send('super-hide-state', on);
  },
  onSetSuperHide: (callback: (on: boolean) => void) => {
    const listener = (_event: any, on: boolean) => callback(on);
    ipcRenderer.on('set-super-hide', listener);
    return () => {
      ipcRenderer.removeListener('set-super-hide', listener);
    };
  },
};

contextBridge.exposeInMainWorld('islandAPI', api);
