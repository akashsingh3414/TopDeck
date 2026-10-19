import React from 'react';

// Apple Atoll UI Primitives: Frosted glass buttons, chips, and micro typography

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonVariant = 'ghost' | 'glass' | 'on' | 'primary' | 'warn';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'w-5 h-5 [&_svg]:w-3 [&_svg]:h-3',
  sm: 'w-7 h-7 [&_svg]:w-3.5 [&_svg]:h-3.5',
  md: 'w-8 h-8 [&_svg]:w-4 [&_svg]:h-4',
  lg: 'w-11 h-11 [&_svg]:w-5 [&_svg]:h-5',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  ghost: 'bg-white/[0.08] text-white/70 hover:bg-white/[0.16] hover:text-white',
  glass: 'bg-white/[0.12] text-white/90 hover:bg-white/[0.22] hover:text-white border border-white/10 shadow-sm',
  on: 'bg-[#007AFF] text-white hover:bg-[#0A84FF] shadow-[0_0_12px_rgba(0,122,255,0.4)]',
  primary: 'bg-white text-black hover:bg-white/90 shadow-md',
  warn: 'bg-[#FF9500] text-black hover:bg-[#FF9500]/90 shadow-[0_0_12px_rgba(255,149,0,0.4)]',
};

export const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, size = 'md', variant = 'ghost', className = '', disabled = false, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
  >
    {children}
  </button>
);

export const Chip: React.FC<{
  onClick: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, active = false, className = '', children }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`h-7 px-3 rounded-full text-[11px] font-medium tabular-nums transition-all duration-150 active:scale-95 flex items-center justify-center ${
      active
        ? 'bg-[#FF9500]/25 text-[#FF9500] border border-[#FF9500]/30 shadow-sm'
        : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white border border-white/[0.04]'
    } ${className}`}
  >
    {children}
  </button>
);

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span className={`text-[10px] font-semibold uppercase tracking-wider text-white/45 truncate ${className}`}>
    {children}
  </span>
);
