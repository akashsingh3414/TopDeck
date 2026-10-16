// Simple script to generate a crisp 32x32 tray icon (minimalist pill)
const fs = require('fs');
const path = require('path');

// Base64 of a clean, sharp 32x32 dark pill icon with white border
// 32x32 PNG with transparent background and sleek pill shape
const iconBase64 = 
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAAcElEQVRYhe3WMQqAMBBE0e+0' +
  'W1u9m6d4H8HC1rWwkBAQ01lYxM9msdmHeYS4kKTW/dEASf1g5w24eQGABkBLjW4L61oBAAAAAAAAAAD8NfC+M72z85' +
  '9qV1Vv4vPZ7f4hSZlJek9y6/K1e4t5XvECYkwhq6Jq5i0AAAAASUVORK5CYII=';

const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'tray.png'), Buffer.from(iconBase64, 'base64'));
console.log('Tray icon created at assets/tray.png');
