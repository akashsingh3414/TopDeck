import React from 'react';

// Shared TopDeck primitives so every widget uses the same buttons, chips and surfaces.

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'ghost' | 'on' | 'primary';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'w-6 h-6 [&_svg]:w-3.5 [&_svg]:h-3.5',
  md: 'w-8 h-8 [&_svg]:w-4 [&_svg]:h-4',
  lg: 'w-10 h-10 [&_svg]:w-[18px] [&_svg]:h-[18px]',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  ghost: 'bg-white/[0.07] text-ink-muted hover:bg-white/[0.13] hover:text-ink',
  on: 'bg-accent text-white hover:bg-accent-hover',
  primary: 'bg-ink text-black hover:bg-white',
};

export const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
  children: React.ReactNode;
}> = ({ title, onClick, size = 'md', variant = 'ghost', children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={(e) => {
      // Clicks inside the island body collapse it, so controls must not bubble
      e.stopPropagation();
      onClick();
    }}
    className={`flex-shrink-0 rounded-full flex items-center justify-center transition-colors duration-150 active:scale-90 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`}
  >
    {children}
  </button>
);

export const Chip: React.FC<{
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, active = false, children }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`h-7 px-3 rounded-full text-caption font-medium tabular-nums transition-colors duration-150 active:scale-95 ${active
        ? 'bg-accent/20 text-accent-hover'
        : 'bg-white/[0.07] text-ink-muted hover:bg-white/[0.13] hover:text-ink'
      }`}
  >
    {children}
  </button>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-micro font-semibold uppercase text-ink-faint truncate">{children}</span>
);

export const formatDuration = (sec: number) => {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
