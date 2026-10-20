import { create } from 'zustand';

export interface ClipboardItem {
  id: string;
  text: string;
  copiedAt: number;
}

export const LIMIT_OPTIONS = [10, 25, 50, 100];
export const RETENTION_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
];

interface ClipboardState {
  items: ClipboardItem[];
  limit: number;
  retentionMs: number;
}

interface ClipboardStore extends ClipboardState {
  add: (text: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setLimit: (limit: number) => void;
  setRetention: (ms: number) => void;
  prune: () => void;
}

const CLIPBOARD_STORAGE_KEY = 'island_clipboard';
const DEFAULTS: ClipboardState = { items: [], limit: 25, retentionMs: RETENTION_OPTIONS[1].ms };

// Drops expired items and anything beyond the limit (items are newest first)
const trim = (items: ClipboardItem[], limit: number, retentionMs: number) => {
  const cutoff = Date.now() - retentionMs;
  return items.filter((item) => item.copiedAt >= cutoff).slice(0, limit);
};

const loadClipboard = (): ClipboardState => {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIPBOARD_STORAGE_KEY) || 'null') as ClipboardState | null;
    if (!saved || !Array.isArray(saved.items)) return DEFAULTS;
    const limit = LIMIT_OPTIONS.includes(saved.limit) ? saved.limit : DEFAULTS.limit;
    const retentionMs = RETENTION_OPTIONS.some((o) => o.ms === saved.retentionMs) ? saved.retentionMs : DEFAULTS.retentionMs;
    return { items: trim(saved.items, limit, retentionMs), limit, retentionMs };
  } catch {
    return DEFAULTS;
  }
};

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  ...loadClipboard(),

  add: (text) => {
    const { items, limit, retentionMs } = get();
    // Copying something already in the list moves it back to the top
    const next = [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, copiedAt: Date.now() },
      ...items.filter((item) => item.text !== text),
    ];
    set({ items: trim(next, limit, retentionMs) });
  },

  remove: (id) => set({ items: get().items.filter((item) => item.id !== id) }),

  clear: () => set({ items: [] }),

  setLimit: (limit) => set({ limit, items: trim(get().items, limit, get().retentionMs) }),

  setRetention: (retentionMs) => set({ retentionMs, items: trim(get().items, get().limit, retentionMs) }),

  prune: () => {
    const { items, limit, retentionMs } = get();
    const next = trim(items, limit, retentionMs);
    if (next.length !== items.length) set({ items: next });
  },
}));

useClipboardStore.subscribe(({ items, limit, retentionMs }) => {
  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify({ items, limit, retentionMs }));
  } catch {}
});
