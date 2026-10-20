import React from 'react';
import { MotionConfig } from 'framer-motion';
import { DynamicIsland } from './components/DynamicIsland';

// Type declaration for islandAPI on window
declare global {
  interface Window {
    islandAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      onMediaUpdate: (callback: (data: any) => void) => () => void;
      sendMediaCommand: (command: string) => Promise<boolean>;
      onToggleSuperHide?: (callback: () => void) => () => void;
      openSettings?: (setting: string) => Promise<boolean>;
      notify?: (title: string, body: string) => Promise<boolean>;
      onClipboardChange?: (callback: (text: string) => void) => () => void;
      writeClipboard?: (text: string) => Promise<boolean>;
    };
  }
}

export const App: React.FC = () => {
  return (
    // reducedMotion="user": follows Windows "Animation effects"; springs and slides become instant
    <MotionConfig reducedMotion="user">
      <div className="w-screen h-screen overflow-hidden bg-transparent select-none">
        <DynamicIsland />
      </div>
    </MotionConfig>
  );
};

export default App;
