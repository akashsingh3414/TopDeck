import React from 'react';
import { useMediaAccent } from '../../hooks/useMediaAccent';

const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Month name with ‹ › and a Today shortcut; sits in the Calendar section header
export const MonthNav: React.FC<{ viewDate: Date; onChange: (date: Date) => void }> = ({ viewDate, onChange }) => {
  const changeMonth = (offset: number) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  return (
    <div className="flex items-center gap-1">
      {!isSameMonth(viewDate, new Date()) && (
        <button
          type="button"
          title="Today"
          onClick={(event) => {
            event.stopPropagation();
            onChange(new Date());
          }}
          className="px-1 text-[9px] font-medium text-[#007AFF] hover:underline cursor-pointer"
        >
          Today
        </button>
      )}
      <button
        type="button"
        title="Previous month"
        onClick={changeMonth(-1)}
        className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-[13px] font-bold text-white/40 hover:text-white transition-colors cursor-pointer leading-none"
      >
        ‹
      </button>
      <span className="text-[10px] font-semibold text-white tabular-nums">
        {viewDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}
      </span>
      <button
        type="button"
        title="Next month"
        onClick={changeMonth(1)}
        className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-[13px] font-bold text-white/40 hover:text-white transition-colors cursor-pointer leading-none"
      >
        ›
      </button>
    </div>
  );
};

export const CalendarGrid: React.FC<{ viewDate: Date }> = ({ viewDate }) => {
  const accent = useMediaAccent();
  const today = new Date();
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isCurrentMonth = isSameMonth(today, viewDate);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  return (
    <div className="flex flex-col w-full h-full px-1.5 pt-1 pb-1.5 rounded-xl bg-white/[0.06] select-none">
      <div className="grid grid-cols-7 text-center mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span key={index} className="text-[8.5px] font-medium text-white/35">{day}</span>
        ))}
      </div>
      {/* Rows stretch to fill the section; the day circle shrinks if a 6-week month is tight */}
      <div className="grid grid-cols-7 auto-rows-fr flex-1 min-h-0 text-center">
        {cells.map((day, index) => day === null
          ? <span key={`empty-${index}`} />
          : (
            <span key={`day-${day}`} className="flex items-center justify-center min-h-0">
              <span
                className={`h-full max-h-[18px] aspect-square flex items-center justify-center text-[9.5px] tabular-nums ${
                  isCurrentMonth && day === today.getDate()
                    ? 'rounded-full font-extrabold shadow-sm'
                    : 'text-white/70 font-medium'
                }`}
                style={isCurrentMonth && day === today.getDate()
                  ? { backgroundColor: accent, color: '#08090B' }
                  : undefined}
              >
                {day}
              </span>
            </span>
          ))}
      </div>
    </div>
  );
};
