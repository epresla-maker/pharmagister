"use client";

const SHIFT_TYPES = [
  { key: 'N', label: 'N', title: 'Nappali', bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { key: 'É', label: 'É', title: 'Éjszakai', bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { key: 'Ü', label: 'Ü', title: 'Ügyelet', bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
  { key: 'B', label: 'B', title: 'Beteg', bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { key: 'Sz', label: 'Sz', title: 'Szabadság', bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' },
  { key: 'P', label: 'P', title: 'Pihenő', bg: 'bg-sky-400', text: 'text-white', border: 'border-sky-500' },
];

function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayKey() {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getHungarianHolidays(year) {
  const fixed = ['01-01', '03-15', '05-01', '08-20', '10-23', '11-01', '12-25', '12-26'];
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const emonth = Math.floor((h + l - 7 * m + 114) / 31);
  const eday = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, emonth - 1, eday);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMon = new Date(easter); easterMon.setDate(easter.getDate() + 1);
  const pentecostMon = new Date(easter); pentecostMon.setDate(easter.getDate() + 50);
  const fmt = dt => `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return new Set([...fixed, fmt(goodFriday), fmt(easterMon), fmt(pentecostMon)]);
}

function getCalendarCells(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = getDaysInMonth(year, month);
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function getShiftType(key) {
  return SHIFT_TYPES.find(t => t.key === key) || SHIFT_TYPES[0];
}

export function Field({ label, required = false, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </label>
  );
}

export function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain no-scrollbar px-0.5 py-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`relative flex-none rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap sm:flex-1 ${
            active === tab.key
              ? 'bg-[#6B46C1] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {tab.label}
          {tab.badge > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function MonthCalendar({ year, month, selectedDate, schedules, ownScheduleIds, onSelectDate, darkMode, filterOwn, pendingSwapRequests, onOpenSwaps }) {
  const cells = getCalendarCells(year, month);
  const today = getTodayKey();
  const DOW_SHORT = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V'];
  const holidays = getHungarianHolidays(year);

  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
      <div className={`grid grid-cols-7 border-b ${darkMode ? 'border-gray-700' : 'border-[#E5E7EB]'}`}>
        {DOW_SHORT.map((d, i) => (
          <div key={i} className={`py-2 text-center text-[11px] font-semibold ${i >= 5 ? 'text-red-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const dateKey = day ? formatDateKey(year, month, day) : null;
          const allDaySchedules = dateKey ? schedules.filter(item => item.date === dateKey && item.status !== 'deleted') : [];
          const daySchedules = (filterOwn && ownScheduleIds)
            ? allDaySchedules.filter(item => ownScheduleIds.has(item.id))
            : allDaySchedules;
          const hasOwn = daySchedules.some(item => ownScheduleIds?.has(item.id));
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDate;
          const colIdx = index % 7;
          const isWeekend = colIdx >= 5;
          const mmdd = day ? `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const isHoliday = mmdd ? holidays.has(mmdd) : false;
          const isLastInRow = colIdx === 6;
          const isInLastRow = index >= cells.length - 7;
          const daySwaps = (filterOwn && pendingSwapRequests && dateKey)
            ? pendingSwapRequests.filter(r => {
                const rd = r.requesterScheduleDate || r.date;
                const td = r.targetScheduleDate || r.targetDate;
                return rd === dateKey || td === dateKey;
              })
            : [];

          return (
            <button
              key={`${dateKey || 'empty'}-${index}`}
              type="button"
              disabled={!day}
              onClick={() => day && onSelectDate(dateKey)}
              className={`relative flex flex-col items-center pt-1.5 pb-2 border-b border-r transition-colors
                ${isLastInRow ? 'border-r-0' : ''}
                ${isInLastRow ? 'border-b-0' : ''}
                ${darkMode ? 'border-gray-800' : 'border-[#F0F0F0]'}
                ${!day ? 'opacity-0 pointer-events-none' : ''}
                ${day && !isSelected && !isToday ? (darkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50') : ''}
              `}
              style={{ minHeight: '62px' }}
            >
              {day && (
                <>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm
                    ${isToday
                      ? 'bg-violet-600 text-white font-semibold'
                      : isSelected
                        ? darkMode ? 'bg-gray-600 text-white font-semibold' : 'bg-gray-200 text-gray-900 font-semibold'
                        : isHoliday
                          ? darkMode ? 'text-rose-400 font-bold' : 'text-rose-500 font-bold'
                          : isWeekend
                            ? darkMode ? 'text-gray-500 font-normal' : 'text-gray-400 font-normal'
                            : darkMode ? 'text-gray-100 font-semibold' : 'text-gray-900 font-semibold'
                    }
                  `}>{day}</span>
                  {filterOwn ? (
                    daySchedules.length > 0 && (() => {
                      const schedule = daySchedules[0];
                      const shift = getShiftType(schedule.shiftType);
                      const start = schedule.startTime || schedule.from;
                      const end = schedule.endTime || schedule.to;
                      const timeLabel = (start && end) ? `${start.replace(':00', '')}-${end.replace(':00', '')}` : shift.label;
                      const bgMap = { N: '#10b981', 'É': '#6366f1', 'Ü': '#8b5cf6', B: '#f43f5e', Sz: '#fb923c', P: '#38bdf8' };
                      const bg = bgMap[schedule.shiftType] || '#8b5cf6';
                      return (
                        <div className="mt-1 w-full px-0.5">
                          <div
                            className="rounded text-white text-[9px] font-bold leading-tight text-center py-[2px] px-0.5 truncate"
                            style={{ backgroundColor: bg }}
                          >
                            {timeLabel}
                          </div>
                          {daySchedules.length > 1 && (
                            <div className="text-center text-[8px] leading-none mt-0.5" style={{ color: bg }}>
                              +{daySchedules.length - 1}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    daySchedules.length > 0 && (
                      <div className="mt-1 flex gap-0.5 justify-center flex-wrap max-w-[36px]">
                        {hasOwn && (
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                        )}
                        {daySchedules.filter(s => !ownScheduleIds?.has(s.id)).slice(0, 3).map((_, i) => (
                          <span key={i} className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${darkMode ? 'bg-gray-500' : 'bg-gray-300'}`} />
                        ))}
                      </div>
                    )
                  )}
                  {filterOwn && daySwaps.length > 0 && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onOpenSwaps && onOpenSwaps(); }}
                      className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-center"
                      style={{ top: '28px', background: 'transparent' }}
                    >
                      <div style={{ transform: 'rotate(-6deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        <svg width="26" height="14" viewBox="0 0 26 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
                          <path d="M3 11 C6 3 10 2 13 6 C16 10 20 9 23 3" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" strokeOpacity="0.7"/>
                          <path d="M20 1 L23 3 L21 6" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.7"/>
                          <path d="M6 13 L3 11 L5 8" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.7"/>
                          <path d="M3 11 C6 3 10 2 13 6 C16 10 20 9 23 3" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none"/>
                          <path d="M20 1 L23 3 L21 6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <path d="M6 13 L3 11 L5 8" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                        <span style={{
                          fontSize: '7px',
                          fontWeight: 900,
                          color: '#f97316',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          textShadow: '0 0 4px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.8)',
                          lineHeight: 1,
                        }}>Csere</span>
                      </div>
                    </button>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
