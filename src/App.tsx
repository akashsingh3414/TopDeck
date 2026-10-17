import React from 'react';
import { DynamicIsland } from './components/DynamicIsland';

// Type declaration for islandAPI on window
declare global {
  interface Window {
    islandAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => void;
      updatePillBounds: (rect: { x: number; y: number; width: number; height: number }) => void;
      minimizeApp: () => void;
      closeApp: () => void;
      onMediaUpdate: (callback: (data: any) => void) => () => void;
      sendMediaCommand: (command: string) => Promise<boolean>;
      getSystemStatus: () => Promise<any>;
      onToggleSuperHide?: (callback: () => void) => () => void;
      openSettings?: (setting: string) => Promise<boolean>;
      notify?: (title: string, body: string) => Promise<boolean>;
    };
  }
}

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent select-none">
      <DynamicIsland />
    </div>
  );
};

export default App;
