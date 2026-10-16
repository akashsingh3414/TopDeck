# TopDeck for Windows

A Dynamic Island-style overlay for Windows 10 & 11. Built with **Electron + React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand**, plus a lightweight background native WinRT helper for real-time SMTC media controls, battery status, and fullscreen auto-hide.

---

## What You Get

* **Universal Music & Video HUD**
  * Control playback (Play/Pause, Next, Previous, Mute/Unmute) without leaving your full-screen browser, editor, game, or document.
  * Live album artwork, track title, artist name, and a monochrome sound equalizer.
  * Works with **Spotify, YouTube (Chrome, Edge, Brave, Firefox), Apple Music, VLC, Windows Media Player**, and any Windows SMTC app.
  * Anti-lag artwork filter, so the thumbnail changes instantly with the track.
* **Stealth Mode (Super Hide)**
  * Tucks the island away into a 4px hairline at the top center of your screen.
  * Glides down only when your cursor touches the top edge.
  * Keeps your desktop clean while you work or game.
* **Clock & Calendar**
  * Real-time digital clock with tabular numbers (no jitter).
  * Full date and weekday at a glance, no need to look at the taskbar.
* **Battery & Power Monitor**
  * Battery percentage with icons for charging, on battery, and low battery.
  * Peeks automatically when you plug/unplug the charger and when power drops below 20%.
* **Focus & Pomodoro Timer**
  * One-click presets: **1 min**, **5 min**, and **25 min (Pomodoro)**.
  * Progress bar and a completion banner.
* **True Click-Through Transparency**
  * Everything outside the black pill passes clicks straight through to the window behind it.
* **Automatic Fullscreen Detection**
  * Hides itself in full-screen games, full-screen YouTube, and PowerPoint presentations.

---

## Installation

No Node.js, no terminal. It's a normal Windows installer.

1. Go to the [**Releases**](../../releases) page of this repo.
2. Download the latest `TopDeck Setup X.X.X.exe`.
3. Double-click it and follow the installer prompts (install directory and shortcut preferences).
4. If Windows shows a SmartScreen warning, click **More info → Run anyway**. (The installer isn't code-signed.)
5. Launch **TopDeck** from the Start Menu or Desktop shortcut.

### Start with Windows

1. Find the **TopDeck** icon in the system tray (near the clock).
2. Right-click it.
3. Tick **Start with Windows**.

That's it. It runs quietly in the background.

### Updating

Download the newer `TopDeck Setup X.X.X.exe` from Releases and run it. It upgrades your existing install in place, and your settings and autostart preference are kept.

---

## Controls & Shortcuts

* **Hover the top edge** (in Super Hide mode): the island slides down into view.
* **Arrow Right (`→`)**: next tab (System → Music → Timer).
* **Arrow Left (`←`)**: previous tab.
* **Top-right buttons**
  * `[ < ]`: previous widget tab.
  * `[ > ]`: next widget tab.
  * `[ 📌 ]`: pin the island (stays expanded even when the mouse leaves).
  * `[ 👁️ ]`: toggle Super Hide mode on/off.

---

## Contributing

Want to contribute? You're welcome to. Open an issue to discuss an idea or bug, or send a pull request.

### Project Structure

```
topdeck/
├── assets/
│   ├── icon.png                 # High-resolution application icon
│   └── tray.png                 # Windows system tray icon
├── electron/
│   ├── main.ts                  # Main process: window management, click-through hit-testing, tray, IPC
│   └── preload.ts               # Secure typed contextBridge API
├── native/
│   └── helper.ps1               # Lightweight WinRT SMTC session, battery, and fullscreen helper
├── src/
│   ├── components/
│   │   └── DynamicIsland.tsx    # Island shell, spring physics, and 280px super-hide notch
│   ├── store/
│   │   └── useIslandStore.ts    # Zustand state machine, localStorage persistence, priority engine
│   ├── types/
│   │   └── island.ts            # Island dimensions, states, and track models
│   ├── widgets/
│   │   ├── ClockWidget.tsx      # System clock, calendar, and battery status
│   │   ├── MediaWidget.tsx      # Media player with anti-lag thumbnail filter and equalizer
│   │   ├── TimerWidget.tsx      # Focus / Pomodoro countdown widget
│   │   └── types.ts             # Widget interface definition
│   ├── App.tsx                  # Root window shell
│   ├── index.css                # System font tokens and audio bounce keyframes
│   └── main.tsx                 # React root mount
├── package.json                 # Dependencies, scripts, and electron-builder config
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript config (frontend)
├── tsconfig.electron.json       # TypeScript config (Electron main & preload)
└── vite.config.ts               # Vite bundling configuration
```

### Local Development

```bash
# Run with live HMR (frontend + Electron)
npm run dev

# Run compiled build locally (with automatic process cleanup)
npm start

# Compile production bundle
npm run build

# Package the Windows .exe installer (output in release/)
npm run dist
```

---

## License

MIT License.