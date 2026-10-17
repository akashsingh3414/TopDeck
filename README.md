# TopDeck for Windows

A Dynamic Island-style overlay for Windows 10 & 11. Built with **Electron + React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand**, plus a lightweight native PowerShell/WinRT helper for media controls, system volume, Wi-Fi, Bluetooth, battery, and fullscreen auto-hide.

---

## What You Get

* **Clean iOS-style Look**
  * A pure-black island that blends into the top of your screen, with a single blue accent for anything switched on (Wi-Fi, Bluetooth, pin, Super Hide, the timer).
  * Expanded view has one header row: `‹ System | Music | Timer ›` with a sliding highlight, plus Pin and Super Hide on the right. Nothing overlaps the widget content.
  * Green, orange and red appear only for status: charging, timer finished, low battery.
* **Universal Music & Video HUD**
  * Play/Pause, Next, Previous, a **system volume slider**, and a **mute button that shows Windows' real mute state**, even when you mute from the keyboard or taskbar.
  * Live album artwork, track title and artist.
  * Works with **Spotify, YouTube (Chrome, Edge, Brave, Firefox), Apple Music, VLC, Windows Media Player**, and any app that shows up in Windows' media controls.
  * Artwork stays correct across track changes, including songs from the same album and apps that fill in the title/artist late.
* **Wi-Fi & Bluetooth Quick Controls**
  * Tap the round icon to turn Wi-Fi or Bluetooth on/off.
  * Tap the rest of the tile to open a list:
    * **Wi-Fi:** nearby networks. Tap a saved network to connect; anything else opens Windows Wi-Fi settings.
    * **Bluetooth:** paired devices and whether they're connected. Tap one to manage it in Windows Settings.
* **Clock, Calendar & Battery**
  * Large clock with seconds, weekday and full date.
  * Battery bar with charging and low-battery states. Peeks automatically when you plug/unplug the charger and when power drops below 20%.
* **Focus Timer**
  * Presets: **1, 5, 15 and 25 min**, shown as a progress ring.
  * When it finishes: a chime, a Windows notification, and a "Time's up" banner that stays until you see it, with **Restart** and **Dismiss**.
  * Survives restarts. A running or paused timer picks up where it left off after you close TopDeck, reboot, or the PC sleeps.
* **Stealth Mode (Super Hide)**
  * Tucks the island into a 4px hairline at the top center of your screen, and it slides down when your cursor touches the top edge.
* **Plays Nicely with Windows**
  * Everything outside the black pill is click-through.
  * Hides itself in full-screen games, full-screen video and presentations.
  * Follows **Settings → Accessibility → Visual effects → Animation effects**: with animations off, motion is instant and decorative loops stop.

---

## Installation

No Node.js, no terminal. It's a normal Windows installer (about 70 MB).

1. Go to the [**Releases**](../../releases) page of this repo.
2. Download the latest `TopDeck Setup X.X.X.exe`.
3. Double-click it and follow the installer prompts (install directory and shortcut preferences).
4. If Windows shows a SmartScreen warning, click **More info → Run anyway**. (The installer isn't code-signed.)
5. Launch **TopDeck** from the Start Menu or Desktop shortcut.

### Start with Windows

Right-click the **TopDeck** icon in the system tray (near the clock) and tick **Start with Windows**.

The tray menu also has **Toggle Super Hide**, **Reposition to Center**, **Restart Native Helper** (if media or Wi-Fi info stops updating), and **Quit TopDeck**.

### Updating

Download the newer `TopDeck Setup X.X.X.exe` from Releases and run it. It upgrades your existing install in place, and your settings and autostart preference are kept.

---

## Controls & Shortcuts

* **Hover** the island to expand it; move the pointer away to collapse it.
* **Hover the top edge** (in Super Hide mode): the island slides down into view.
* **Arrow Right (`→`) / Arrow Left (`←`)**: next / previous tab (System → Music → Timer).
* **Header row** (expanded island)
  * `‹` `System | Music | Timer` `›`: switch tabs.
  * `📌` Pin: keep the island expanded even when the mouse leaves.
  * `👁️` Super Hide: toggle stealth mode on/off.

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
│   ├── icon.png                 # High-resolution application icon
│   └── tray.png                 # Windows system tray icon
├── electron/
│   ├── main.ts                  # Main process: window, click-through hit-testing, tray, notifications, IPC
│   └── preload.ts               # Secure typed contextBridge API
├── native/
│   └── helper.ps1               # Media session, volume/mute, Wi-Fi & Bluetooth, battery, fullscreen helper
├── scripts/
│   └── make-icon.js             # Generates the tray icon
├── src/
│   ├── components/
│   │   ├── DynamicIsland.tsx    # Island shell, header controls, spring physics
│   │   └── ui.tsx               # Shared buttons, chips, duration formatting
│   ├── store/
│   │   └── useIslandStore.ts    # Zustand state: island states, media, audio, radios, lists
│   ├── types/
│   │   └── island.ts            # Island dimensions, states, and data models
│   ├── widgets/
│   │   ├── ClockWidget.tsx      # Clock, battery, Wi-Fi & Bluetooth tiles and lists
│   │   ├── MediaWidget.tsx      # Media player and volume slider
│   │   ├── TimerWidget.tsx      # Focus timer (persisted), progress ring, chime
│   │   └── types.ts             # Widget interface definition
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

Colors live in `tailwind.config.js`: a pure-black island, one accent (`accent`, iOS blue `#0A84FF`) for anything switched on, and `ok` / `warn` / `danger` only for status (charging, timer finished, low battery). Shared controls are in `src/components/ui.tsx`, so new UI should reuse them.

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

Changes to `electron/main.ts` or `electron/preload.ts` need a full restart of the app (not just a reload). Changes to `native/helper.ps1` take effect after **Restart Native Helper** in the tray menu.

---

## License

MIT License.
