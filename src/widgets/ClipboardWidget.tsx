import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ClipboardList, Trash2, X } from 'lucide-react';
import { LIMIT_OPTIONS, RETENTION_OPTIONS, useClipboardStore } from '../store/useClipboardStore';

const timeAgo = (timestamp: number) => {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// Built in the page rather than a native <select>: its popup window would make the island collapse
const OptionMenu: React.FC<{
  label: string;
  title: string;
  value: string;
  options: { label: string; value: number }[];
  selected: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (value: number) => void;
}> = ({ label, title, value, options, selected, open, onToggle, onSelect }) => (
  <div className="relative">
    <button
      type="button"
      title={title}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`h-6 pl-2 pr-1.5 rounded-full flex items-center gap-1 text-[10px] font-medium tabular-nums transition-colors cursor-pointer ${
        open ? 'bg-white/[0.16] text-white' : 'bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white'
      }`}
    >
      <span className="text-white/50">{label}</span>
      <span>{value}</span>
      <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && (
      <div
        role="listbox"
        className="absolute right-0 top-full mt-1 z-30 min-w-full p-1 rounded-xl bg-[#1C1C1E] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === selected}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(option.value);
            }}
            className="flex items-center justify-between gap-3 w-full h-6 px-2 rounded-lg text-[11px] text-white/85 hover:bg-white/[0.1] whitespace-nowrap tabular-nums cursor-pointer"
          >
            {option.label}
            {option.value === selected && <Check className="w-3 h-3 text-[#007AFF]" />}
          </button>
        ))}
      </div>
    )}
  </div>
);

export const ClipboardExpanded: React.FC = () => {
  const { items, limit, retentionMs, remove, clear, setLimit, setRetention } = useClipboardStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<'limit' | 'retention' | null>(null);
  const retention = RETENTION_OPTIONS.find((o) => o.ms === retentionMs) ?? RETENTION_OPTIONS[1];

  useEffect(() => {
    if (!copiedId) return;
    const timeout = setTimeout(() => setCopiedId(null), 1200);
    return () => clearTimeout(timeout);
  }, [copiedId]);

  const copy = (id: string, text: string) => {
    window.islandAPI?.writeClipboard?.(text);
    setCopiedId(id);
  };

  return (
    <div className="relative flex flex-col w-full h-full px-4 pb-3 select-none">
      {openMenu && (
        <div
          className="absolute inset-0 z-20"
          onClick={(event) => {
            event.stopPropagation();
            setOpenMenu(null);
          }}
        />
      )}
      <div className="relative z-30 flex items-center gap-1.5 h-7 flex-shrink-0 mb-1">
        <span className="text-[11px] font-semibold text-white mr-auto">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <OptionMenu
          label="Max items"
          title="How many copied items to keep"
          value={String(limit)}
          options={LIMIT_OPTIONS.map((n) => ({ label: `${n} items`, value: n }))}
          selected={limit}
          open={openMenu === 'limit'}
          onToggle={() => setOpenMenu(openMenu === 'limit' ? null : 'limit')}
          onSelect={(n) => {
            setLimit(n);
            setOpenMenu(null);
          }}
        />
        <OptionMenu
          label="Delete after"
          title="How long to keep copied items before deleting them"
          value={retention.label}
          options={RETENTION_OPTIONS.map((o) => ({ label: o.label, value: o.ms }))}
          selected={retentionMs}
          open={openMenu === 'retention'}
          onToggle={() => setOpenMenu(openMenu === 'retention' ? null : 'retention')}
          onSelect={(ms) => {
            setRetention(ms);
            setOpenMenu(null);
          }}
        />
        <button
          type="button"
          title="Clear clipboard history"
          disabled={items.length === 0}
          onClick={(event) => {
            event.stopPropagation();
            clear();
          }}
          className="h-6 px-2 rounded-full flex items-center gap-1 text-[10px] font-medium text-[#FF453A] hover:bg-[#FF453A]/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 pr-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 text-white/40">
            <ClipboardList className="w-5 h-5" />
            <span className="text-[11px]">Text you copy shows up here</span>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              role="button"
              title="Click to copy"
              onClick={(event) => {
                event.stopPropagation();
                copy(item.id, item.text);
              }}
              className="group flex items-center gap-2 w-full h-8 px-2.5 rounded-xl hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              <span className="flex-1 min-w-0 truncate text-[12px] text-white/90">
                {item.text.replace(/\s+/g, ' ').trim()}
              </span>
              {copiedId === item.id ? (
                <span className="flex items-center gap-1 flex-shrink-0 text-[10px] font-medium text-[#30D158]">
                  <Check className="w-3 h-3" />
                  Copied
                </span>
              ) : (
                <span className="flex-shrink-0 text-[10px] text-white/40 tabular-nums">{timeAgo(item.copiedAt)}</span>
              )}
              <button
                type="button"
                title="Delete"
                aria-label="Delete"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(item.id);
                }}
                className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
