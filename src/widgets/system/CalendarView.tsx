import React, { useState } from 'react';
import { useMediaAccent } from '../../hooks/useMediaAccent';

export const CalendarView: React.FC = () => {
  const accent = useMediaAccent();
  const [viewDate, setViewDate] = useState(() => new Date());
  const today = new Date();
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString([], { month: 'short', year: 'numeric' });
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  const changeMonth = (offset: number) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth + offset, 1));
  };

  return (
    <div className="flex flex-col w-full p-2 rounded-2xl bg-white/[0.06] border border-white/[0.05] shadow-sm select-none">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px] font-semibold text-white tracking-tight">{monthName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Previous month"
            onClick={changeMonth(-1)}
            className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-[13px] font-bold text-white/40 hover:text-white transition-colors cursor-pointer leading-none"
          >
            ‹
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              title="Today"
              onClick={(event) => {
                event.stopPropagation();
                setViewDate(new Date());
              }}
              className="px-1 text-[9px] font-medium text-[#007AFF] hover:underline cursor-pointer"
            >
              Today
            </button>
          )}
          <button
            type="button"
            title="Next month"
            onClick={changeMonth(1)}
            className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-[13px] font-bold text-white/40 hover:text-white transition-colors cursor-pointer leading-none"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span key={index} className="text-[9px] font-medium text-white/35">{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((day, index) => day === null
          ? <span key={`empty-${index}`} className="h-[18px]" />
          : (
            <span
              key={`day-${day}`}
              className={`h-[18px] flex items-center justify-center text-[10px] tabular-nums transition-all ${
                isCurrentMonth && day === today.getDate()
                  ? 'rounded-full font-extrabold shadow-sm'
                  : 'text-white/70 hover:text-white font-medium'
              }`}
              style={isCurrentMonth && day === today.getDate()
                ? { backgroundColor: accent, color: '#08090B' }
                : undefined}
            >
              {day}
            </span>
          ))}
      </div>
    </div>
  );
};
