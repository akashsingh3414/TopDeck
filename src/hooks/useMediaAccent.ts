import { useEffect, useState } from 'react';
import { useIslandStore } from '../store/useIslandStore';

const DEFAULT_ACCENT = '#88AFFF';

const getArtworkAccent = (image: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return DEFAULT_ACCENT;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let best = { r: 136, g: 175, b: 255, score: 0 };

  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (pixels[i + 3] < 180) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const score = saturation * Math.min(1, luminance / 120) * Math.min(1, (255 - luminance) / 50);
    if (score > best.score) best = { r, g, b, score };
  }

  const brightest = Math.max(best.r, best.g, best.b);
  const lift = brightest < 180 ? 180 / Math.max(brightest, 1) : 1;
  const channels = [best.r, best.g, best.b].map((value) =>
    Math.min(255, Math.round(value * lift))
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

export const useMediaAccent = () => {
  const albumArt = useIslandStore((state) => state.media.albumArt);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    if (!albumArt) {
      setAccent(DEFAULT_ACCENT);
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        setAccent(getArtworkAccent(image));
      } catch {
        setAccent(DEFAULT_ACCENT);
      }
    };
    image.onerror = () => setAccent(DEFAULT_ACCENT);
    image.src = albumArt;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [albumArt]);

  return accent;
};
