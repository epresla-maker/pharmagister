"use client";

import { useEffect, useState } from 'react';

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

const SHIFT_TYPES = [
  { key: 'N', label: 'N', title: 'Nappali', bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { key: 'É', label: 'É', title: 'Éjszakai', bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { key: 'Ü', label: 'Ü', title: 'Ügyelet', bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
  { key: 'B', label: 'B', title: 'Beteg', bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { key: 'Sz', label: 'Sz', title: 'Szabadság', bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' },
  { key: 'P', label: 'P', title: 'Pihenő', bg: 'bg-sky-400', text: 'text-white', border: 'border-sky-500' },
];

const HU_DAYS_LONG = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

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

function calcAgeAt(birthDateStr, refYear) {
  if (!birthDateStr) return 0;
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const ref = new Date(refYear, 11, 31);
  let age = refYear - by;
  if (ref.getMonth() + 1 < bm || (ref.getMonth() + 1 === bm && ref.getDate() < bd)) age--;
  return Math.max(0, age);
}

function calcAnnualVacationDays(birthDateStr, childrenCount, refYear) {
  const age = calcAgeAt(birthDateStr, refYear || new Date().getFullYear());
  let days = 20;
  if (age >= 45) days += 10;
  else if (age >= 43) days += 9;
  else if (age >= 41) days += 8;
  else if (age >= 39) days += 7;
  else if (age >= 37) days += 6;
  else if (age >= 35) days += 5;
  else if (age >= 33) days += 4;
  else if (age >= 31) days += 3;
  else if (age >= 28) days += 2;
  else if (age >= 25) days += 1;
  const c = Number(childrenCount) || 0;
  if (c >= 3) days += 7;
  else if (c === 2) days += 4;
  else if (c === 1) days += 2;
  return days;
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

function countWorkdaysInMonth(year, month) {
  const holidays = getHungarianHolidays(year);
  let count = 0;
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d += 1) {
    const dow = new Date(year, month - 1, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const mmdd = `${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!isWeekend && !holidays.has(mmdd)) count += 1;
  }
  return count;
}

function calcMonthlyRequiredHours(contractHours, year, month) {
  const h = Number(contractHours);
  if (!h) return 0;
  return h * countWorkdaysInMonth(year, month);
}

function isOffShift(shiftType) {
  return shiftType === 'Sz' || shiftType === 'P';
}

function getShiftType(key) {
  return SHIFT_TYPES.find(t => t.key === key) || SHIFT_TYPES[0];
}

function calcHours(from, to) {
  if (!from || !to) return null;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}ó` : `${h}ó${m}p`;
}

export default function EmployeePreferenceCalendar({
  year, month, onChangeMonth, onClose,
  preferences,
  ownEmployeeRecord,
  user, darkMode,
  onSaveDayPreferences, saving,
  employeeProfile,
  initialDay,
  onPublish,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [shiftType, setShiftType] = useState('N');
  const [from, setFrom] = useState('08:00');
  const [to, setTo] = useState('20:00');
  const [notes, setNotes] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [checked, setChecked] = useState(true);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('calendar-overlay-open'));
    return () => window.dispatchEvent(new CustomEvent('calendar-overlay-close'));
  }, []);

  const today = getTodayKey();
  const monthLabel = MONTHS_HU[month - 1];
  const holidays = getHungarianHolidays(year);
  const DOW_LABELS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

  const ownPrefs = preferences.filter(p =>
    p.status !== 'deleted' &&
    (p.employeeId === ownEmployeeRecord?.id ||
      (p.linkedUserId && p.linkedUserId === user?.uid) ||
      (p.employeeEmail && user?.email && p.employeeEmail.toLowerCase() === user.email.toLowerCase()))
  );
  const othersPrefs = preferences.filter(p =>
    p.status !== 'deleted' &&
    !(p.employeeId === ownEmployeeRecord?.id ||
      (p.linkedUserId && p.linkedUserId === user?.uid) ||
      (p.employeeEmail && user?.email && p.employeeEmail.toLowerCase() === user.email.toLowerCase()))
  );

  const ownMonthCount = ownPrefs.length;
  const contractHours = Number(employeeProfile?.contractHours) || 0;
  const monthlyRequiredHours = contractHours ? calcMonthlyRequiredHours(contractHours, year, month) : 0;
  const plannedWorkPrefs = ownPrefs.filter(p => !isOffShift(p.shiftType));
  const plannedSzPrefs = ownPrefs.filter(p => p.shiftType === 'Sz');
  const plannedHoursTotal = plannedWorkPrefs.reduce((sum, p) => {
    if (!p.startTime || !p.endTime) return sum + contractHours;
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
  const remainingHours = monthlyRequiredHours - plannedHoursTotal;
  const annualVacDays = employeeProfile?.birthDate
    ? calcAnnualVacationDays(employeeProfile.birthDate, employeeProfile.childrenCount, year)
    : 0;
  const carryOver = Number(employeeProfile?.vacationCarriedOver) || 0;
  const takenThisYear = Number(employeeProfile?.vacationTakenThisYear) || 0;
  const totalRemainingVac = annualVacDays + carryOver - takenThisYear;
  const thisMonthSzDays = plannedSzPrefs.length;
  const vacAfterThisMonth = totalRemainingVac - thisMonthSzDays;

  const lastPlannedDay = plannedWorkPrefs.length > 0
    ? Math.max(...plannedWorkPrefs.map(p => Number(p.date.split('-')[2])))
    : null;

  function openDay(day) {
    const dateKey = formatDateKey(year, month, day);
    const own = ownPrefs.find(p => p.date === dateKey);
    const isSzabadon = isOffShift(own?.shiftType);
    setChecked(own ? !isSzabadon : true);
    setShiftType(own && !isSzabadon ? own.shiftType : 'N');
    setFrom(own?.startTime || '08:00');
    setTo(own?.endTime || '20:00');
    setNotes(own?.notes || '');
    setSelectedDay(day);
    setShowModal(true);
  }

  const selectedDayName = selectedDay
    ? HU_DAYS_LONG[new Date(year, month - 1, selectedDay).getDay()]
    : '';

  useEffect(() => {
    if (initialDay) {
      openDay(initialDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className={`flex-shrink-0 flex items-center gap-2 px-3 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-gradient-to-r from-emerald-600 to-teal-600'}`} style={{minHeight:'56px', paddingTop:'8px', paddingBottom:'8px'}}>
        <button type="button" onClick={onClose} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none">×</button>
        <button type="button" onClick={() => onChangeMonth('prev')} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none">‹</button>
        <div className="flex-1 text-center">
          <div className="text-white font-bold text-base tracking-tight whitespace-nowrap">{monthLabel} {year}</div>
          {monthlyRequiredHours > 0 ? (
            <div className="text-xs font-medium text-white/80 whitespace-nowrap">
              havi {monthlyRequiredHours} · tervben {Math.round(plannedHoursTotal)} · maradt {remainingHours > 0 ? Math.round(remainingHours) : '✓'}
            </div>
          ) : annualVacDays > 0 ? (
            <div className="text-xs font-medium text-white/80 whitespace-nowrap">{ownMonthCount} nap</div>
          ) : (
            <div className="text-xs font-medium text-white/70">{ownMonthCount} tervezett nap</div>
          )}
          {annualVacDays > 0 && (
            <div className="text-xs font-medium text-white/80 whitespace-nowrap">maradék szabi: {Math.max(0, vacAfterThisMonth)}</div>
          )}
        </div>
        <button type="button" onClick={() => onChangeMonth('next')} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none">›</button>
      </div>

      <div className={`flex-shrink-0 flex items-center gap-4 px-4 py-2 text-xs border-b ${darkMode ? 'border-gray-800 bg-gray-850 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500"/> Saját tervem</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-400"/> Kollégák tervei</span>
      </div>

      {(() => {
        const unpublished = ownPrefs.filter(p => !p.publishedAt).length;
        if (unpublished === 0) return null;
        return (
          <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b ${
            darkMode ? 'bg-amber-900/30 border-amber-700/50' : 'bg-amber-50 border-amber-200'
          }`}>
            <span className="text-xl flex-shrink-0">📢</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                {unpublished} nap mentve, de még nincs elküldve
              </p>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-amber-400/80' : 'text-amber-700/80'}`}>
                A gyógyszertár csak publikálás után látja a tervezetedet
              </p>
            </div>
            {onPublish && (
              <button
                type="button"
                onClick={onPublish}
                disabled={saving}
                className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                  darkMode ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {saving ? '...' : 'Publikálás'}
              </button>
            )}
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map(d => {
          const dateKey = formatDateKey(year, month, d);
          const isToday = dateKey === today;
          const dow = new Date(year, month - 1, d).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const mmdd = `${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isHoliday = holidays.has(mmdd);
          const dowLabel = DOW_LABELS[dow];
          const dayOwn = ownPrefs.filter(p => p.date === dateKey);
          const dayOthers = othersPrefs.filter(p => p.date === dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => openDay(d)}
              className={[
                'w-full text-left px-4 py-3 transition-colors',
                isToday ? darkMode ? 'bg-violet-900/20' : 'bg-violet-50' : darkMode ? 'bg-transparent' : 'bg-white',
                isWeekend
                  ? darkMode ? 'border-b-2 border-gray-700' : 'border-b-2 border-gray-200'
                  : darkMode ? 'border-b border-gray-800/60' : 'border-b border-gray-200/70',
              ].join(' ')}
            >
              <div className="flex items-center mb-1.5">
                <div className="flex items-baseline flex-1 gap-0">
                  <span className={[
                    'text-[17px] tabular-nums inline-block w-10 flex-shrink-0',
                    dow === 0 ? 'font-bold' : 'font-semibold',
                    isToday ? darkMode ? 'text-violet-300' : 'text-violet-700'
                      : isHoliday ? darkMode ? 'text-rose-400' : 'text-rose-500'
                      : isWeekend ? darkMode ? 'text-rose-400' : 'text-rose-600'
                      : darkMode ? 'text-gray-200' : 'text-gray-700',
                  ].join(' ')}>{d}.</span>
                  <span className={[
                    'text-[17px] underline underline-offset-4',
                    dow === 0 ? 'font-bold' : 'font-semibold',
                    isToday ? darkMode ? 'text-violet-300 decoration-violet-400' : 'text-violet-700 decoration-violet-500'
                      : isHoliday ? darkMode ? 'text-rose-400 decoration-rose-400' : 'text-rose-500 decoration-rose-500'
                      : isWeekend ? darkMode ? 'text-rose-400 decoration-rose-400' : 'text-rose-600 decoration-rose-600'
                      : darkMode ? 'text-gray-200 decoration-gray-400' : 'text-gray-700 decoration-gray-700',
                  ].join(' ')}>{dowLabel}{isHoliday && !isWeekend ? ' 🔴' : ''}</span>
                </div>
                {(dayOwn.length + dayOthers.length) > 0 && (
                  <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${darkMode ? 'bg-black/30 text-gray-300' : 'bg-black/10 text-gray-600'}`}>
                    {dayOwn.length + dayOthers.length} terv
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {dayOwn.length === 0 && dayOthers.length === 0 && (
                  <p className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Kattints a tervezéshez</p>
                )}
                {dayOwn.map(p => {
                  const isSz = isOffShift(p.shiftType);
                  const st = getShiftType(p.shiftType || 'N');
                  const hrs = calcHours(p.startTime, p.endTime);
                  const isLastDay = d === lastPlannedDay;
                  return (
                    <div key={p.id} className={`flex flex-col gap-1 rounded-xl px-3 py-2 border ${isSz ? (darkMode ? 'border-orange-700/50 bg-orange-900/20' : 'border-orange-200 bg-orange-50') : (darkMode ? 'border-emerald-700/50 bg-emerald-900/30' : 'border-emerald-200 bg-emerald-50')}`}>
                      <div className="flex items-center gap-2">
                        <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className={`flex-1 text-sm font-medium ${isSz ? (darkMode ? 'text-orange-300' : 'text-orange-700') : (darkMode ? 'text-emerald-200' : 'text-emerald-800')}`}>
                          {isSz ? 'Szabadságot kértem' : 'Saját tervem'}
                        </span>
                        {!isSz && contractHours > 0 && (
                          <span className="flex-shrink-0 text-xs font-bold tabular-nums text-emerald-600">{hrs || `${contractHours}.00`}</span>
                        )}
                        {p.startTime && p.endTime && !isSz && <span className="flex-shrink-0 text-xs tabular-nums text-emerald-500">{p.startTime}–{p.endTime}</span>}
                      </div>
                      {!isSz && isLastDay && monthlyRequiredHours > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-0.5 pt-1 border-t ${darkMode ? 'border-emerald-700/40' : 'border-emerald-200'}`}>
                          <span className={`text-[11px] font-semibold ${remainingHours <= 0 ? 'text-emerald-500' : darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                            Havi maradék: {Math.max(0, Math.round(remainingHours))} óra {remainingHours <= 0 ? '✓' : ''}
                          </span>
                          {annualVacDays > 0 && (
                            <span className={`text-[11px] font-semibold ${vacAfterThisMonth <= 3 ? 'text-rose-500' : darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
                              · Szabadság maradék: {Math.max(0, vacAfterThisMonth)} nap
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayOthers.map(p => {
                  const st = getShiftType(p.shiftType || 'N');
                  const hrs = calcHours(p.startTime, p.endTime);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white/70'}`}>
                      <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${st.bg} ${st.text}`}>{st.label}</span>
                      <span className={`flex-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{p.employeeName}</span>
                      {hrs && <span className={`flex-shrink-0 text-xs font-semibold tabular-nums ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{hrs}</span>}
                      {p.startTime && p.endTime && <span className={`flex-shrink-0 text-xs tabular-nums ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{p.startTime}–{p.endTime}</span>}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {showModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 px-4 pb-4" style={{backdropFilter:'blur(6px)', background:'rgba(0,0,0,0.55)'}}>
          <div className={`relative w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-5 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-1">{monthLabel} {year} – tervezet</p>
                  <h3 className="text-2xl font-black text-white">{selectedDayName}, {selectedDay}.</h3>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl leading-none ml-4 mt-1">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChecked(v => !v)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-200'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                </button>
                <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {checked ? 'Ezen a napon szeretnék dolgozni' : 'Szabadságot kérek'}
                </span>
              </div>
              {checked && (
                <>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Preferált műszak típusa</p>
                    <div className="flex gap-1.5">
                      {SHIFT_TYPES.map(st => (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => setShiftType(st.key)}
                          className={`flex-1 flex flex-col items-center rounded-xl px-1 py-2 border-2 font-bold transition-all ${shiftType === st.key ? `${st.bg} ${st.text} border-transparent shadow-md` : darkMode ? 'border-gray-700 text-gray-300 hover:border-gray-500' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                        >
                          <span className="text-base font-black">{st.key}</span>
                          <span className="text-[9px] font-normal mt-0.5 leading-tight text-center">{st.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isOffShift(shiftType) && (
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Preferált időszak</p>
                    <div className="flex items-center gap-3">
                      <input type="time" value={from} onChange={e => setFrom(e.target.value)} className={`w-28 rounded-xl border px-3 py-2 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}/>
                      <span className={`font-bold ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>–</span>
                      <input type="time" value={to} onChange={e => setTo(e.target.value)} className={`w-28 rounded-xl border px-3 py-2 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}/>
                    </div>
                  </div>
                  )}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Megjegyzés (opcionális)</p>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300'}`} placeholder="Pl. Csak délelőtt tudok, orvos délután..."/>
                  </div>
                </>
              )}
              {(() => {
                const dateKey = formatDateKey(year, month, selectedDay);
                const dayOthers = othersPrefs.filter(p => p.date === dateKey);
                if (dayOthers.length === 0) return null;
                return (
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Kollégák erre a napra terveztek</p>
                    <div className="flex flex-col gap-1.5">
                      {dayOthers.map(p => {
                        const st = getShiftType(p.shiftType || 'N');
                        const hrs = calcHours(p.startTime, p.endTime);
                        return (
                          <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                            <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${st.bg} ${st.text}`}>{st.label}</span>
                            <span className={`flex-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{p.employeeName}</span>
                            {hrs && <span className={`text-xs tabular-nums ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{hrs}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className={`flex-shrink-0 flex gap-3 px-5 py-4 border-t ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-gray-50'}`}>
              <button type="button" onClick={() => setShowModal(false)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>Mégse</button>
              <button type="button" onClick={async () => {
                setModalSaving(true);
                try {
                  const dateKey = formatDateKey(year, month, selectedDay);
                  await onSaveDayPreferences(dateKey, { checked, shiftType, from, to, notes });
                  setShowModal(false);
                } finally { setModalSaving(false); }
              }} disabled={modalSaving} className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-8 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60">
                {modalSaving ? 'Mentés...' : checked ? 'Terv mentése' : 'Szabadság kérése'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
