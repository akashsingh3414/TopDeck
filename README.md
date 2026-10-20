# TopDeck for Windows

A Dynamic Island-style overlay for Windows 10 & 11. Built with **Electron + React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand**, plus a lightweight native PowerShell/WinRT helper for media controls, system volume, display brightness, Wi-Fi, Bluetooth, battery, and fullscreen auto-hide.

---

## What You Get

* **A Calm, Compact Interface**
  * A softly layered charcoal-black island that blends into the top of your screen, with restrained highlights and color reserved for meaningful states.
  * Expanded view has one header row: `‹ Home | Timer | Clipboard ›` with a sliding highlight, plus Pin and Super Hide on the right. Nothing overlaps the widget content.
  * The collapsed focus timer shows its progress at a glance; expanding the island keeps controls grouped by purpose.
* **Universal Music & Video HUD**
  * The **Home** tab keeps playback on the left: artwork, title, artist, progress, and Play/Pause, Next and Previous.
  * The right side has two tabs side by side, **Controls** (clock, Wi-Fi, Bluetooth, brightness, volume) and **Calendar**. Click one to switch to it.
  * Works with **Spotify, YouTube (Chrome, Edge, Brave, Firefox), Apple Music, VLC, Windows Media Player**, and any app that shows up in Windows' media controls.
  * Artwork stays correct across track changes, including songs from the same album and apps that fill in the title/artist late.
* **Wi-Fi & Bluetooth Quick Controls**
  * Tap the round icon to turn Wi-Fi or Bluetooth on/off.
  * Tap the rest of the tile to open a list:
    * **Wi-Fi:** nearby networks. Tap a saved network to connect; anything else opens Windows Wi-Fi settings.
    * **Bluetooth:** paired devices and whether they're connected. Tap one to manage it in Windows Settings.
* **Clock, Calendar & Battery**
  * Lock-screen style clock (big hours and minutes, smaller seconds) in Controls, and a month calendar with ‹ › to change month.
  * iPhone-style battery icon with the percentage inside, with charging and low-battery states. Peeks automatically when you plug/unplug the charger and when power drops below 20%.
* **Microphone Indicator**
  * An orange mic appears next to the battery while any app is recording, like on iPhone. Hover it to see which app.
  * The island peeks briefly when the mic switches on.
* **Focus Timer**
  * Presets: **5, 15, 25, 45 min and 1 h**, or set your own by clicking the minutes or seconds in the ring and typing (or scrolling / ↑↓), then Enter or **Start**. Shown as a progress ring.
  * When it finishes: a chime, a Windows notification, and a "Time's up" banner that stays until you see it, with **Restart** and **Dismiss**.
  * Survives restarts. A running or paused timer picks up where it left off after you close TopDeck, reboot, or the PC sleeps.
* **Clipboard History**
  * Keeps the text you copy. Click an item to copy it again.
  * **Max items** (10, 25, 50 or 100) and **Delete after** (1 hour, 1 day, 7 days or 30 days) menus set how many items are kept and when they're removed automatically.
  * Delete single items or clear the whole list. Text only; items marked private by password managers are skipped.
* **Stealth Mode (Super Hide)**
  * Tucks the island into a 4px hairline at the top center of your screen, and it slides down when your cursor touches the top edge.
* **Plays Nicely with Windows**
  * Everything outside the island is click-through.
  * Hides itself in full-screen games, full-screen video and presentations.
  * Follows **Settings → Accessibility → Visual effects → Animation effects**: with animations off, motion is instant and decorative loops stop.

---

## Installation

No Node.js, no terminal. It's a normal Windows installer (about 70 MB).

1. Go to the [**Releases**](../../releases) page of this repo.
2. Download the latest `TopDeck-X.X.X.exe`.
3. Double-click it and follow the installer prompts (install directory and shortcut preferences).
4. If Windows shows a SmartScreen warning, click **More info → Run anyway**. (The installer isn't code-signed.)
5. Launch **TopDeck** from the Start Menu or Desktop shortcut.

### Start with Windows

1. Install TopDeck with the installer (see above) and launch it from the Start Menu.
2. Right-click the **TopDeck** icon in the system tray (near the clock) and tick **Start with Windows**.

TopDeck now launches each time you sign in. You can check or turn it off in **Settings → Apps → Startup** (or Task Manager → Startup apps).

> Running from source (`npm start` / `npm run dev`)? Don't tick **Start with Windows** there. It registers the development copy of Electron, which opens a blank Electron window at sign-in instead of TopDeck. If that happened, untick it, or switch off the "Electron" entry in **Settings → Apps → Startup**.

The tray menu also has **Toggle Super Hide**, **Reposition to Center**, **Restart Native Helper** (if media or Wi-Fi info stops updating), and **Quit TopDeck**.

### Updating

Download the newer `TopDeck-X.X.X.exe` from Releases and run it. It upgrades your existing install in place, and your settings and autostart preference are kept.

---

## Controls & Shortcuts

* **Hover** the island to expand it; move the pointer away to collapse it.
* **Hover the top edge** (in Super Hide mode): the island slides down into view.
* **Arrow Right (`→`) / Arrow Left (`←`)**: next / previous tab (Home → Timer → Clipboard).
* **Header row** (expanded island)
  * `‹` `Home | Timer | Clipboard` `›`: switch tabs.
  * Pin: keep the island expanded even when the mouse leaves.
  * Super Hide: toggle stealth mode on/off.
* **Home tab:** control playback on the left; on the right switch between Controls (brightness, volume and mute, Wi-Fi and Bluetooth) and Calendar.
* **Clipboard tab:** click an item to copy it again, hover it and press × to delete it, or **Clear** to empty the list.

---

## Known Limitations

* **Wi-Fi details need English Windows.** Network name, status and the network list are read from `netsh`, whose output is localized.
* **Wi-Fi list:** shows what Windows last scanned, and joining a *new* network (password entry) is done in Windows Settings.
* **Bluetooth list:** loading it takes 2–3 seconds. Connecting and pairing devices are left to Windows Settings.
* **Notifications:** Windows may hide TopDeck's notification if notifications or Focus Assist / Do Not Disturb are blocking it. The chime and on-screen banner still work.

---

## Contributing

Want to contribute? You're welcome to. Open an issue to discuss an idea or bug, or send a pull request. TopDeck aims to stay small and simple, so prefer handing off to Windows Settings over rebuilding OS features.

### Project Structure

```
topdeck/
├── assets/
│   ├── icon.svg / icon.png      # App + installer logo (SVG source, rendered PNG)
│   └── tray.svg / tray.png      # System tray icon (SVG source, rendered PNG)
├── electron/
│   ├── main.ts                  # Main process: window, click-through hit-testing, tray, notifications, IPC
│   └── preload.ts               # Secure typed contextBridge API
├── native/
│   ├── helper.ps1               # Native helper startup and polling loop
│   └── modules/
│       ├── Commands.ps1         # IPC command routing
│       ├── Media.ps1            # Windows media-session state and track metadata
│       ├── SystemState.ps1      # Battery, radios, audio, brightness, and fullscreen state
│       └── NativeInterop.ps1    # Win32 input/window and Core Audio interop
├── scripts/
│   └── make-icon.js             # Renders the SVG logos to PNG (npx electron scripts/make-icon.js)
├── src/
│   ├── components/
│   │   ├── DynamicIsland.tsx    # Island shell, header controls, spring physics
│   │   └── ui.tsx               # Shared buttons and chips
│   ├── hooks/
│   │   ├── useIslandEvents.ts   # Island lifecycle, keyboard, and timer events
│   │   └── useNativeStateSync.ts # Native helper event subscription
│   ├── store/
│   │   ├── useIslandStore.ts    # Island, media, audio, radio, and list state
│   │   ├── useTimerStore.ts     # Persistent focus timer state
│   │   └── useClipboardStore.ts # Clipboard history, limit and retention
│   ├── types/
│   │   └── island.ts            # Island dimensions, states, and data models
│   ├── services/
│   │   └── timerAudio.ts        # Timer completion sound
│   ├── utils/
│   │   └── formatDuration.ts    # Shared time formatting
│   ├── widgets/
│   │   ├── HomeWidget.tsx       # Home tab: media panel plus Controls / Calendar sections
│   │   ├── MediaWidget.tsx      # Media idle/peek views and the Home media panel
│   │   ├── TimerWidget.tsx      # Focus timer views and controls
│   │   ├── ClipboardWidget.tsx  # Clipboard history list and settings
│   │   └── system/              # Calendar, radio, status, and system-control modules
│   ├── App.tsx                  # Root window shell (reduced-motion support)
│   ├── index.css                # Base styles, keyframes, reduced-motion rules
│   └── main.tsx                 # React root mount
├── package.json                 # Scripts and electron-builder config
├── tailwind.config.js           # Theme tokens (colors, type sizes)
├── tsconfig.json                # TypeScript config (frontend)
├── tsconfig.electron.json       # TypeScript config (Electron main & preload)
└── vite.config.ts               # Vite bundling configuration
```

### Theme

The island uses a layered charcoal-black surface, with a restrained blue accent for active controls and status colors reserved for meaningful states. Shared controls are in `src/components/ui.tsx`, so new UI should reuse them.

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

Changes to `electron/main.ts` or `electron/preload.ts` need a full restart of the app (not just a reload). Changes to `native/helper.ps1` or any file under `native/modules/` take effect after **Restart Native Helper** in the tray menu.
---

## License

MIT License.
