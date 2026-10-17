// Renders the logo sources in assets/ to the PNGs the app and installer use:
//   assets/icon.svg -> assets/icon.png (512x512, app + installer icon)
//   assets/tray.svg -> assets/tray.png (32x32, system tray icon)
// Run with: npx electron scripts/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');
const targets = [
  { src: 'icon.svg', out: 'icon.png', size: 512 },
  { src: 'tray.svg', out: 'tray.png', size: 32 },
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('about:blank');

  for (const { src, out, size } of targets) {
    const svg = fs.readFileSync(path.join(assetsDir, src), 'utf8');
    // Rasterize through a canvas so the PNG keeps its transparent background
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ${size};
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(${JSON.stringify(svg)});
    })`);
    fs.writeFileSync(path.join(assetsDir, out), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`assets/${out} (${size}x${size}) created from assets/${src}`);
  }

  app.quit();
});
