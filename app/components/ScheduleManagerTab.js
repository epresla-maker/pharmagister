"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import {
  AlertTriangle,
  BarChart3,
  ArrowLeftRight,
  Bell,
  CheckCircle,
  CheckCircle2,
  Copy,
  Download,
  Info,
  Plane,
  Plus,
  RefreshCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  UserX,
  Wand2,
  XCircle,
} from 'lucide-react';

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

const WEEKDAYS_HU = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

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

// ── Magyar Munka Törvénykönyve: éves szabadságnapok kiszámítása ───────────
function calcAgeAt(birthDateStr, refYear) {
  if (!birthDateStr) return 0;
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const ref = new Date(refYear, 11, 31); // dec 31 of ref year
  let age = refYear - by;
  if (ref.getMonth() + 1 < bm || (ref.getMonth() + 1 === bm && ref.getDate() < bd)) age--;
  return Math.max(0, age);
}

function calcAnnualVacationDays(birthDateStr, childrenCount, refYear) {
  const age = calcAgeAt(birthDateStr, refYear || new Date().getFullYear());
  let days = 20; // alap (Mt. 115.§)
  // Kor szerinti pótszabadság (Mt. 116.§)
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
  // Gyermek utáni pótszabadság (Mt. 118.§)
  const c = Number(childrenCount) || 0;
  if (c >= 3) days += 7;
  else if (c === 2) days += 4;
  else if (c === 1) days += 2;
  return days;
}

// Munkanapok száma egy hónapban (hétköznapok - ünnepnapok)
function countWorkdaysInMonth(year, month) {
  const holidays = getHungarianHolidays(year);
  let count = 0;
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const mmdd = `${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (!isWeekend && !holidays.has(mmdd)) count++;
  }
  return count;
}

// Havi kötelező munkaórák (napi munkaóra × munkanapok száma)
function calcMonthlyRequiredHours(contractHours, year, month) {
  const h = Number(contractHours);
  if (!h) return 0;
  // 12h-s műszak esetén havonta kb. munkaidő-keret: (contractHours/8)*munkanapok*8
  // De a törvényes keret alapján inkább: napi h × munkanapok
  return h * countWorkdaysInMonth(year, month);
}

function getDateRangeKeys(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const keys = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    keys.push(formatDateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function getPreviousMonth(year, month) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Returns a Set of 'MM-DD' strings for Hungarian public holidays in a given year
function getHungarianHolidays(year) {
  const fixed = ['01-01','03-15','05-01','08-20','10-23','11-01','12-25','12-26'];
  // Easter (Meeus/Jones/Butcher algorithm)
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

// Pastel bg colors per weekday (0=Sun..6=Sat), light mode
const DAY_PASTEL = [
  { bg: '#E5E7EB', chipBg: 'rgba(255,255,255,0.70)' }, // Sun  – darker grey (weekend)
  { bg: '#EFF6FF', chipBg: 'rgba(255,255,255,0.80)' }, // Mon  – sky blue
  { bg: '#F0FDF4', chipBg: 'rgba(255,255,255,0.80)' }, // Tue  – mint green
  { bg: '#F5F3FF', chipBg: 'rgba(255,255,255,0.80)' }, // Wed  – lavender
  { bg: '#FFFBEB', chipBg: 'rgba(255,255,255,0.80)' }, // Thu  – amber
  { bg: '#FFF1F2', chipBg: 'rgba(255,255,255,0.80)' }, // Fri  – rose
  { bg: '#E5E7EB', chipBg: 'rgba(255,255,255,0.70)' }, // Sat  – darker grey (weekend)
];
const DAY_PASTEL_DARK = [
  { bg: 'rgba(15,23,42,0.75)', chipBg: 'rgba(255,255,255,0.05)' }, // Sun  – darker
  { bg: 'rgba(30,58,138,0.2)', chipBg: 'rgba(255,255,255,0.07)' }, // Mon
  { bg: 'rgba(20,83,45,0.2)',  chipBg: 'rgba(255,255,255,0.07)' }, // Tue
  { bg: 'rgba(46,16,101,0.25)',chipBg: 'rgba(255,255,255,0.07)' }, // Wed
  { bg: 'rgba(120,53,15,0.2)', chipBg: 'rgba(255,255,255,0.07)' }, // Thu
  { bg: 'rgba(136,19,55,0.15)',chipBg: 'rgba(255,255,255,0.07)' }, // Fri
  { bg: 'rgba(15,23,42,0.75)', chipBg: 'rgba(255,255,255,0.05)' }, // Sat  – darker
];

function isPublishedSchedule(schedule) {
  return Boolean(schedule?.publishedAt);
}

// Hungarian weekday display order: Mon(1) … Sat(6), Sun(0)
const WEEKDAY_DISPLAY = [
  { label: 'H', fullLabel: 'Hétfő', day: 1 },
  { label: 'K', fullLabel: 'Kedd', day: 2 },
  { label: 'Sze', fullLabel: 'Szerda', day: 3 },
  { label: 'Cs', fullLabel: 'Csütörtök', day: 4 },
  { label: 'P', fullLabel: 'Péntek', day: 5 },
  { label: 'Szo', fullLabel: 'Szombat', day: 6 },
  { label: 'V', fullLabel: 'Vasárnap', day: 0 },
];

const CRITERIA_WIZARD_STEPS = [
  { key: 'open_sunday', title: 'Nyitva vagytok vasárnap?', hint: 'A rendszer ezt használja a vasárnapi normál műszakokhoz.' },
  { key: 'on_call_enabled', title: 'Van rendszeres ügyelet?', hint: 'Ha igen, külön ügyeleti sávot és létszámot kezelünk.' },
  { key: 'on_call_days', title: 'Mely napokon legyen ügyelet?', hint: 'Jelöld a napokat, amikor kötelező az ügyeleti lefedés.' },
  { key: 'day_min_pharmacists', title: 'Nappali nyitvatartásban hány gyógyszerész kell minimum?', hint: 'Ez minden normál napi műszak ellenőrzésére kihat.' },
  { key: 'on_call_min_pharmacists', title: 'Ügyeletben hány gyógyszerész kell minimum?', hint: 'Ez külön az ügyeleti sávra vonatkozik.' },
];

const DEFAULT_PREFERENCES = {
  avoidWeekdays: [],
  preferWeekdays: [],
  preferredShiftType: 'any',
  preferredWeekend: 'neutral',
  preferredNight: 'neutral',
  canWorkWeekends: true,
  canWorkNight: true,
  targetWeeklyHours: 40,
  schedulingNotes: '',
};

function getDefaultPlanningConfig() {
  return {
    minStaffPerShift: 2,
    minPharmacistsPerShift: 1,
    shiftTemplates: [
      { key: 'day', startTime: '08:00', endTime: '16:00', requiredStaff: 2, requiredPharmacists: 1, onCall: false },
      { key: 'evening', startTime: '16:00', endTime: '20:00', requiredStaff: 1, requiredPharmacists: 1, onCall: false },
    ],
    operations: {
      enforceOpeningHours: true,
      allowOnCallOutsideOpening: true,
      openingHoursByWeekday: {
        0: { isOpen: false, openTime: '08:00', closeTime: '12:00' },
        1: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
        2: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
        3: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
        4: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
        5: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
        6: { isOpen: true, openTime: '08:00', closeTime: '14:00' },
      },
      onCall: {
        enabled: false,
        days: [0, 6],
        startTime: '20:00',
        endTime: '08:00',
        requiredStaff: 1,
        requiredPharmacists: 1,
        useAutoTemplate: true,
      },
    },
    laborLaw: {
      enforceHungarianLaborLaw: true,
      maxDailyHoursLegal: 12,
      maxWeeklyHoursLegal: 48,
      minDailyRestHoursLegal: 11,
      maxNightShiftHoursLegal: 8,
      requireBreakAfterHours: 6,
    },
  };
}

function normalizePlanningConfig(config) {
  const defaults = getDefaultPlanningConfig();
  const templates = Array.isArray(config?.shiftTemplates) && config.shiftTemplates.length > 0
    ? config.shiftTemplates
    : defaults.shiftTemplates;
  const openingHoursByWeekday = {
    ...defaults.operations.openingHoursByWeekday,
    ...(config?.operations?.openingHoursByWeekday || {}),
  };

  return {
    minStaffPerShift: Math.max(1, Number(config?.minStaffPerShift || defaults.minStaffPerShift)),
    minPharmacistsPerShift: Math.max(0, Number(config?.minPharmacistsPerShift || defaults.minPharmacistsPerShift)),
    shiftTemplates: templates.map((item, index) => ({
      key: item.key || `shift-${index + 1}`,
      startTime: item.startTime || '08:00',
      endTime: item.endTime || '16:00',
      requiredStaff: Math.max(1, Number(item.requiredStaff || 1)),
      requiredPharmacists: Math.max(0, Number(item.requiredPharmacists || 0)),
      onCall: Boolean(item.onCall),
    })),
    operations: {
      enforceOpeningHours: config?.operations?.enforceOpeningHours !== false,
      allowOnCallOutsideOpening: config?.operations?.allowOnCallOutsideOpening !== false,
      openingHoursByWeekday: Object.fromEntries(
        Object.entries(openingHoursByWeekday).map(([k, v]) => [k, {
          isOpen: v?.isOpen !== false,
          openTime: v?.openTime || '08:00',
          closeTime: v?.closeTime || '20:00',
        }])
      ),
      onCall: {
        enabled: config?.operations?.onCall?.enabled === true,
        days: Array.isArray(config?.operations?.onCall?.days)
          ? config.operations.onCall.days.map(Number).filter((d) => d >= 0 && d <= 6)
          : defaults.operations.onCall.days,
        startTime: config?.operations?.onCall?.startTime || defaults.operations.onCall.startTime,
        endTime: config?.operations?.onCall?.endTime || defaults.operations.onCall.endTime,
        requiredStaff: Math.max(0, Number(config?.operations?.onCall?.requiredStaff ?? defaults.operations.onCall.requiredStaff)),
        requiredPharmacists: Math.max(0, Number(config?.operations?.onCall?.requiredPharmacists ?? defaults.operations.onCall.requiredPharmacists)),
        useAutoTemplate: config?.operations?.onCall?.useAutoTemplate !== false,
      },
    },
    laborLaw: {
      enforceHungarianLaborLaw: config?.laborLaw?.enforceHungarianLaborLaw !== false,
      maxDailyHoursLegal: Math.max(1, Number(config?.laborLaw?.maxDailyHoursLegal || defaults.laborLaw.maxDailyHoursLegal)),
      maxWeeklyHoursLegal: Math.max(1, Number(config?.laborLaw?.maxWeeklyHoursLegal || defaults.laborLaw.maxWeeklyHoursLegal)),
      minDailyRestHoursLegal: Math.max(1, Number(config?.laborLaw?.minDailyRestHoursLegal || defaults.laborLaw.minDailyRestHoursLegal)),
      maxNightShiftHoursLegal: Math.max(1, Number(config?.laborLaw?.maxNightShiftHoursLegal || defaults.laborLaw.maxNightShiftHoursLegal)),
      requireBreakAfterHours: Math.max(1, Number(config?.laborLaw?.requireBreakAfterHours || defaults.laborLaw.requireBreakAfterHours)),
    },
  };
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

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function prettyRole(role) {
  if (role === 'pharmacist') return 'Gyógyszerész';
  if (role === 'assistant') return 'Szakasszisztens';
  return 'Egyéb';
}

function normalizeRoleFromProfile(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'pharmacist' || normalized === 'gyógyszerész') return 'pharmacist';
  if (normalized === 'assistant' || normalized === 'szakasszisztens') return 'assistant';
  if (normalized === 'other' || normalized === 'egyéb') return 'other';
  return null;
}

function sortByDateAndTime(items) {
  return [...items].sort((a, b) => {
    if ((a.date || '') !== (b.date || '')) return (a.date || '').localeCompare(b.date || '');
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

function Field({ label, required = false, hint, children }) {
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

function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            active === tab.key
              ? 'bg-[#6B46C1] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function getShiftChipClasses(item, isOwn, darkMode) {
  if (isOwn) {
    return 'bg-emerald-600 text-white border border-emerald-500';
  }
  if (item.role === 'pharmacist') {
    return darkMode
      ? 'bg-sky-900/60 text-sky-100 border border-sky-700'
      : 'bg-sky-100 text-sky-800 border border-sky-200';
  }
  if (item.role === 'assistant') {
    return darkMode
      ? 'bg-amber-900/50 text-amber-100 border border-amber-700'
      : 'bg-amber-100 text-amber-800 border border-amber-200';
  }
  return darkMode
    ? 'bg-fuchsia-900/50 text-fuchsia-100 border border-fuchsia-700'
    : 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200';
}

function MonthCalendar({ year, month, selectedDate, schedules, ownScheduleIds, onSelectDate, darkMode }) {
  const cells = getCalendarCells(year, month);
  const today = getTodayKey();

  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className={`rounded-full px-2.5 py-1 ${darkMode ? 'bg-emerald-900/60 text-emerald-100 border border-emerald-700' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>Saját műszak</span>
          <span className={`rounded-full px-2.5 py-1 ${darkMode ? 'bg-sky-900/60 text-sky-100 border border-sky-700' : 'bg-sky-100 text-sky-800 border border-sky-200'}`}>Gyógyszerész</span>
          <span className={`rounded-full px-2.5 py-1 ${darkMode ? 'bg-amber-900/50 text-amber-100 border border-amber-700' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>Szakasszisztens</span>
          <span className={`rounded-full px-2.5 py-1 ${darkMode ? 'bg-fuchsia-900/50 text-fuchsia-100 border border-fuchsia-700' : 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200'}`}>Egyéb</span>
        </div>
        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Kattints egy napra a részletekhez</p>
      </div>
      <div className={`grid grid-cols-7 ${darkMode ? 'bg-gray-800' : 'bg-[#F9FAFB]'} border-b ${darkMode ? 'border-gray-700' : 'border-[#E5E7EB]'}`}>
        {WEEKDAYS_HU.map(day => (
          <div key={day} className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const dateKey = day ? formatDateKey(year, month, day) : null;
          const daySchedules = dateKey ? schedules.filter(item => item.date === dateKey && item.status !== 'deleted') : [];
          const hasOwnSchedule = daySchedules.some(item => ownScheduleIds.has(item.id));

          return (
            <button
              key={`${dateKey || 'empty'}-${index}`}
              type="button"
              disabled={!day}
              onClick={() => day && onSelectDate(dateKey)}
              className={`min-h-[132px] border-r border-b p-2.5 text-left align-top transition-colors ${
                darkMode ? 'border-gray-800' : 'border-[#E5E7EB]'
              } ${
                !day
                  ? darkMode ? 'bg-gray-950' : 'bg-[#F9FAFB]'
                  : selectedDate === dateKey
                    ? 'bg-violet-100 ring-2 ring-violet-400 ring-inset dark:bg-violet-900/30'
                    : hasOwnSchedule
                      ? 'bg-emerald-50 dark:bg-emerald-900/15'
                      : daySchedules.length > 0
                        ? darkMode ? 'bg-slate-800/70 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {day ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${dateKey === today ? 'text-[#6B46C1]' : ''}`}>{day}</span>
                    {daySchedules.length > 0 ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasOwnSchedule ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100'}`}>
                        {daySchedules.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {daySchedules.slice(0, 3).map(item => (
                      <div
                        key={item.id}
                        className={`truncate rounded-md px-2 py-1 text-[11px] ${getShiftChipClasses(item, ownScheduleIds.has(item.id), darkMode)}`}
                        title={`${item.employeeName} ${item.startTime || ''}-${item.endTime || ''}`}
                      >
                        {item.startTime && item.endTime ? `${item.startTime}-${item.endTime} ` : ''}{item.employeeName}
                      </div>
                    ))}
                    {daySchedules.length > 3 ? (
                      <div className={`text-[11px] font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        +{daySchedules.length - 3} további műszak
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shift type config ────────────────────────────────────────────────────────
const SHIFT_TYPES = [
  { key: 'N', label: 'N', title: 'Nappali',   bg: 'bg-emerald-500',  text: 'text-white', border: 'border-emerald-600' },
  { key: 'É', label: 'É', title: 'Éjszakai',  bg: 'bg-indigo-500',   text: 'text-white', border: 'border-indigo-600' },
  { key: 'Ü', label: 'Ü', title: 'Ügyelet',   bg: 'bg-violet-500',   text: 'text-white', border: 'border-violet-600' },
  { key: 'B', label: 'B', title: 'Beteg',      bg: 'bg-rose-500',     text: 'text-white', border: 'border-rose-600' },
  { key: 'Sz', label: 'Sz', title: 'Szabadság', bg: 'bg-orange-400',  text: 'text-white', border: 'border-orange-500' },
  { key: 'P', label: 'P', title: 'Pihenő',    bg: 'bg-sky-400',      text: 'text-white', border: 'border-sky-500' },
];
function isOffShift(shiftType) { return shiftType === 'Sz' || shiftType === 'P'; }

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

const HU_DAYS_LONG = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

// ── Full-screen pharmacy schedule calendar ────────────────────────────────────
function PharmacyScheduleCalendar({
  year, month, onChangeMonth, onClose,
  schedules, employees,
  preferences,
  user, userData, darkMode,
  onSaveDaySchedules, saving,
  // action handlers passed through for the overlay toolbar
  onCopyPrev, onExport, onPublish, onAutoFix,
  activeMonthSchedules, publishedScheduleCount,
  readOnly, ownScheduleIds,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [openFrom, setOpenFrom] = useState('08:00');
  const [openTo, setOpenTo] = useState('20:00');
  const [employeeRows, setEmployeeRows] = useState([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [publishBlockModal, setPublishBlockModal] = useState(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState(null);

  // Hide bottom nav while overlay is visible
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('calendar-overlay-open'));
    return () => window.dispatchEvent(new CustomEvent('calendar-overlay-close'));
  }, []);

  const today = getTodayKey();
  const monthLabel = MONTHS_HU[month - 1];

  function openDay(day) {
    const dateKey = formatDateKey(year, month, day);
    const dayScheds = schedules.filter(s => s.date === dateKey && s.status !== 'deleted');

    let defFrom = '08:00';
    let defTo = '20:00';
    if (dayScheds.length > 0) {
      const timed = dayScheds.filter(s => s.startTime && s.endTime);
      if (timed.length > 0) {
        defFrom = timed.reduce((min, s) => s.startTime < min ? s.startTime : min, timed[0].startTime);
        defTo = timed.reduce((max, s) => s.endTime > max ? s.endTime : max, timed[0].endTime);
      }
    }
    setOpenFrom(defFrom);
    setOpenTo(defTo);

    const activeEmps = employees.filter(e => e.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    const rows = activeEmps.map(emp => {
      const existing = dayScheds.find(s =>
        s.employeeId === emp.id ||
        (s.employeeEmail && emp.email && s.employeeEmail.toLowerCase() === emp.email.toLowerCase())
      );
      return {
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        email: emp.email || '',
        linkedUserId: emp.linkedUserId || null,
        checked: !!existing,
        from: existing?.startTime || defFrom,
        to: existing?.endTime || defTo,
        shiftType: existing?.shiftType || 'N',
        notes: existing?.notes || '',
        existingId: existing?.id || null,
        isPublished: existing ? Boolean(existing.publishedAt) : false,
        locked: existing ? Boolean(existing.locked) : false,
      };
    });

    setEmployeeRows(rows);
    setSelectedDay(day);
    setShowModal(true);
  }

  function applyOpeningHours() {
    setEmployeeRows(prev => prev.map(r => (r.isPublished || r.locked) ? r : { ...r, from: openFrom, to: openTo }));
  }

  function updateRow(idx, patch) {
    setEmployeeRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function toggleAll(checked) {
    setEmployeeRows(prev => prev.map(r => (r.isPublished || r.locked) ? r : { ...r, checked }));
  }

  async function handleSave() {
    setModalSaving(true);
    try {
      const dateKey = formatDateKey(year, month, selectedDay);
      await onSaveDaySchedules(dateKey, employeeRows);
      setShowModal(false);
    } finally {
      setModalSaving(false);
    }
  }

  async function handlePublishClick() {
    if ((activeMonthSchedules ?? 0) === 0) {
      setPublishBlockModal([{ message: 'Nincs kitöltött beosztás ebben a hónapban.' }]);
      return;
    }
    const result = await onPublish();
    if (result && !result.success && result.blockingErrors?.length > 0) {
      setPublishBlockModal(result.blockingErrors);
    }
  }

  const selectedDateKey = selectedDay ? formatDateKey(year, month, selectedDay) : null;
  const selectedDayName = selectedDay
    ? HU_DAYS_LONG[new Date(year, month - 1, selectedDay).getDay()]
    : '';
  const holidays = getHungarianHolidays(year);
  const DOW_LABELS = ['Vasárnap','Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat'];

  // ── Calendar render — full-screen fixed overlay ───────────────────────────
  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`} style={{touchAction:'pan-x'}}>
      {/* Publish block modal (bottom sheet) */}
      {publishBlockModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setPublishBlockModal(null)}>
          <div className={`rounded-t-2xl p-5 space-y-4 max-h-[60vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Miért nem publikálható?</h3>
              <button type="button" onClick={() => { setPublishBlockModal(null); setAutoFixResult(null); }} className={`h-8 w-8 flex items-center justify-center rounded-full text-lg font-bold ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>×</button>
            </div>

            {/* Auto-fix button */}
            {onAutoFix && (
              <button
                type="button"
                disabled={autoFixing}
                onClick={async () => {
                  setAutoFixing(true);
                  setAutoFixResult(null);
                  const res = await onAutoFix(publishBlockModal);
                  setAutoFixing(false);
                  setAutoFixResult(res);
                  // Re-run publish check to get fresh error list
                  const fresh = await onPublish();
                  if (fresh?.success) {
                    setPublishBlockModal(null);
                    setAutoFixResult(null);
                  } else if (fresh?.blockingErrors?.length > 0) {
                    setPublishBlockModal(fresh.blockingErrors);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm transition-colors ${
                  autoFixing
                    ? 'opacity-60 cursor-not-allowed bg-violet-500 text-white'
                    : darkMode ? 'bg-violet-700 hover:bg-violet-600 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}
              >
                {autoFixing ? (
                  <><span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" /><span>Javítás folyamatban...</span></>
                ) : (
                  <><span>✨</span><span>Automatikus javítás</span></>
                )}
              </button>
            )}

            {autoFixResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                autoFixResult.fixed > 0
                  ? (darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                  : (darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-700')
              }`}>
                {autoFixResult.fixed > 0 ? `✅ ${autoFixResult.fixed} műszak javítva – ellenőrzés folyamatban...` : '⚠️ Nem találtam automatikusan javítható hibát. Kézzel ellenőrizd a beosztást.'}
              </div>
            )}

            <div className="space-y-2">
              {publishBlockModal.map((err, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-rose-700 bg-rose-900/30 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0">🚫</span>
                    <span>{err.message}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Javítsd a hibákat, majd próbáld újra a publikálást.</p>
          </div>
        </div>
      )}

      {/* Overlay header */}
      <div className={`flex-shrink-0 flex items-center gap-2 px-3 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-gradient-to-r from-violet-600 to-indigo-600'}`} style={{height:'56px'}}>
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
        >
          ×
        </button>
        {/* Prev month */}
        <button
          type="button"
          onClick={() => onChangeMonth('prev')}
          className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
        >
          ‹
        </button>
        {/* Title */}
        <div className="flex-1 text-center">
          <span className="text-white font-bold text-base tracking-tight">{monthLabel} {year}</span>
          <span className={`ml-2 text-xs font-medium text-white/70`}>{activeMonthSchedules ?? 0} műszak</span>
        </div>
        {/* Next month */}
        <button
          type="button"
          onClick={() => onChangeMonth('next')}
          className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
        >
          ›
        </button>
        {/* Actions — hidden in readOnly mode */}
        {!readOnly && (
          <>
            <button type="button" onClick={onCopyPrev} disabled={saving} title="Előző hónap másolása" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={onExport} title="CSV export" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white">
              <Download className="h-4 w-4" />
            </button>
            <button type="button" onClick={handlePublishClick} disabled={saving} title="Publikálás" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {/* Publish status bar */}
      {!readOnly && (() => {
        const cnt = activeMonthSchedules ?? 0;
        const canPublish = cnt > 0;
        const alreadyPublished = publishedScheduleCount > 0;
        const statusText = !canPublish
          ? 'Nem publikálható – Nincs kitöltött beosztás'
          : alreadyPublished
            ? 'Már publikálva – Újra publikálható'
            : 'Kész a publikálásra';
        return (
          <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b ${
            !canPublish
              ? (darkMode ? 'bg-rose-900/30 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600')
              : alreadyPublished
                ? (darkMode ? 'bg-violet-900/30 border-violet-800/60 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-700')
                : (darkMode ? 'bg-emerald-900/30 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
          }`}>
            <span>{!canPublish ? '⛔' : alreadyPublished ? '✅' : '✅'}</span>
            <span>{statusText}</span>
          </div>
        );
      })()}

      {/* Day list — full width, vertically scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map(day => {
          const dateKey = formatDateKey(year, month, day);
          const dayScheds = schedules.filter(s => s.date === dateKey && s.status !== 'deleted');
          const dayPrefs = preferences ? preferences.filter(p => p.date === dateKey && p.status !== 'deleted') : [];
          const isToday = dateKey === today;
          const dow = new Date(year, month - 1, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const mmdd = `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isHoliday = holidays.has(mmdd);
          const dowLabel = DOW_LABELS[dow];
          const pastel = darkMode ? DAY_PASTEL_DARK[dow] : DAY_PASTEL[dow];
          const rowBg = isToday
            ? (darkMode ? 'rgba(109,40,217,0.22)' : '#EDE9FE')
            : pastel.bg;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => openDay(day)}
              style={{ background: rowBg }}
              className={[
                'w-full text-left px-4 py-3 transition-colors',
                isWeekend
                  ? darkMode ? 'border-b-2 border-gray-700' : 'border-b-2 border-gray-200'
                  : darkMode ? 'border-b border-gray-800/60' : 'border-b border-gray-200/70',
              ].join(' ')}
            >
              {/* Row header: left-aligned, number fixed-width then day name */}
              <div className="flex items-center mb-2">
                <div className="flex items-baseline flex-1 gap-0">
                  <span className={[
                    'text-[17px] tabular-nums inline-block w-10 flex-shrink-0',
                    dow === 0 ? 'font-bold' : 'font-semibold',
                    isToday ? darkMode ? 'text-violet-300' : 'text-violet-700'
                      : isHoliday ? darkMode ? 'text-rose-400' : 'text-rose-500'
                      : isWeekend ? darkMode ? 'text-rose-400' : 'text-rose-600'
                      : darkMode ? 'text-gray-200' : 'text-gray-700',
                  ].join(' ')}>
                    {day}.
                  </span>
                  <span className={[
                    'text-[17px] underline underline-offset-4',
                    dow === 0 ? 'font-bold' : 'font-semibold',
                    isToday ? darkMode ? 'text-violet-300 decoration-violet-400' : 'text-violet-700 decoration-violet-500'
                      : isHoliday ? darkMode ? 'text-rose-400 decoration-rose-400' : 'text-rose-500 decoration-rose-500'
                      : isWeekend ? darkMode ? 'text-rose-400 decoration-rose-400' : 'text-rose-600 decoration-rose-600'
                      : darkMode ? 'text-gray-200 decoration-gray-400' : 'text-gray-700 decoration-gray-700',
                  ].join(' ')}>
                    {dowLabel}{isHoliday && !isWeekend ? ' 🔴' : ''}
                  </span>
                </div>
                {dayScheds.length > 0 && (
                  <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${darkMode ? 'bg-black/30 text-gray-300' : 'bg-black/10 text-gray-600'}`}>
                    {dayScheds.length} műszak
                  </span>
                )}
                {dayPrefs.length > 0 && (
                  <span className={`flex-shrink-0 ml-1.5 text-xs font-semibold rounded-full px-2 py-0.5 ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                    {dayPrefs.length} preferencia
                  </span>
                )}
              </div>
              {/* Employee chips */}
              {dayScheds.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {dayScheds.map(s => {
                    const st = getShiftType(s.shiftType || 'N');
                    const hrs = calcHours(s.startTime, s.endTime);
                    return (
                      <div
                        key={s.id}
                        style={{ background: pastel.chipBg }}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${darkMode ? 'border-white/5' : 'border-black/5'} shadow-sm`}
                      >
                        <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        <span className={`flex-1 text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                          {s.employeeName}
                        </span>
                        {hrs && (
                          <span className={`flex-shrink-0 text-xs font-semibold tabular-nums ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {hrs}
                          </span>
                        )}
                        {s.startTime && s.endTime && (
                          <span className={`flex-shrink-0 text-xs tabular-nums ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {s.startTime}–{s.endTime}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Nincs beosztás</p>
              )}
              {/* Preference chips */}
              {dayPrefs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {dayPrefs.map(p => {
                    const st = getShiftType(p.shiftType || 'N');
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium border ${darkMode ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                      >
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${st.bg} ${st.text}`}>{p.shiftType}</span>
                        {p.employeeName}
                        {!isOffShift(p.shiftType) && p.startTime && p.endTime && <span className="opacity-70">{p.startTime}–{p.endTime}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>{/* end day list */}

      {/* Day edit modal */}
      {showModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backdropFilter:'blur(6px)', background:'rgba(0,0,0,0.55)'}}>
          <div
            className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-5 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-violet-200 text-xs font-semibold uppercase tracking-widest mb-1">{monthLabel} {year}</p>
                  <h3 className="text-2xl font-black text-white">{selectedDayName}, {selectedDay}.</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-white/70 hover:text-white text-2xl leading-none ml-4 mt-1"
                >
                  ×
                </button>
              </div>

              {/* Opening hours */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-violet-200 text-xs font-medium">Nyitvatartás:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={openFrom}
                      onChange={e => setOpenFrom(e.target.value)}
                      className="rounded-xl bg-white/20 text-white border border-white/30 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                    <span className="text-white/80 font-bold">–</span>
                    <input
                      type="time"
                      value={openTo}
                      onChange={e => setOpenTo(e.target.value)}
                      className="rounded-xl bg-white/20 text-white border border-white/30 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                    <button
                      type="button"
                      onClick={applyOpeningHours}
                      className="rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      Alkalmaz mindenkire
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {/* Select all row */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Dolgozók ({employeeRows.filter(r => r.checked).length}/{employeeRows.length} kiválasztva)
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => toggleAll(true)} className={`text-xs px-3 py-1 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    Mindenki
                  </button>
                  <button type="button" onClick={() => toggleAll(false)} className={`text-xs px-3 py-1 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    Senki
                  </button>
                </div>
              </div>

              {employeeRows.length === 0 && (
                <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Nincs aktív dolgozó. Adj hozzá dolgozókat a Dolgozók fülön.
                </p>
              )}

              {employeeRows.map((row, idx) => {
                const rowReadOnly = row.isPublished || row.locked;
                const st = getShiftType(row.shiftType);
                const hrs = calcHours(row.from, row.to);
                // Find this employee's draft preference for the selected day
                const dayKey = selectedDay ? formatDateKey(year, month, selectedDay) : null;
                const empPref = dayKey && preferences
                  ? preferences.find(p =>
                      p.date === dayKey &&
                      p.status !== 'deleted' &&
                      (p.employeeId === row.employeeId ||
                        (p.linkedUserId && p.linkedUserId === row.linkedUserId))
                    )
                  : null;
                return (
                  <div
                    key={row.employeeId}
                    className={[
                      'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                      row.isPublished
                        ? darkMode ? 'border-amber-700 bg-amber-900/20 opacity-70' : 'border-amber-200 bg-amber-50 opacity-75'
                        : row.locked
                          ? darkMode ? 'border-sky-700 bg-sky-900/20 opacity-80' : 'border-sky-200 bg-sky-50 opacity-80'
                        : row.checked
                          ? darkMode ? 'border-violet-600 bg-violet-900/20' : 'border-violet-300 bg-violet-50'
                          : darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={row.checked}
                      disabled={rowReadOnly}
                      onChange={e => updateRow(idx, { checked: e.target.checked })}
                      className="h-5 w-5 rounded accent-violet-600 flex-shrink-0"
                    />

                    {/* Name */}
                    <span className={`flex-1 font-semibold text-sm min-w-[120px] ${row.isPublished ? 'opacity-60' : ''} ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                      {row.name}
                      {row.isPublished && <span className="ml-2 text-[10px] font-normal text-amber-600">zárolt</span>}
                      {!row.isPublished && row.locked && <span className="ml-2 text-[10px] font-normal text-sky-600">locked</span>}
                    </span>

                    {!row.isPublished && (
                      <button
                        type="button"
                        onClick={() => updateRow(idx, { locked: !row.locked })}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold border ${row.locked
                          ? (darkMode ? 'border-sky-500 bg-sky-700/50 text-sky-100' : 'border-sky-300 bg-sky-100 text-sky-700')
                          : (darkMode ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-300 bg-white text-gray-600')}`}
                        title="Kézi lock: a tervező nem módosítja"
                      >
                        {row.locked ? 'Lock: BE' : 'Lock: KI'}
                      </button>
                    )}

                    {/* Shift type selector */}
                    <div className="flex gap-1">
                      {SHIFT_TYPES.map(t => (
                        <button
                          key={t.key}
                          type="button"
                          disabled={rowReadOnly}
                          onClick={() => updateRow(idx, { shiftType: t.key })}
                          title={t.title}
                          className={[
                            'h-7 w-7 rounded-full text-[11px] font-black transition-all',
                            row.shiftType === t.key
                              ? `${t.bg} ${t.text} shadow-sm scale-110`
                              : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                          ].join(' ')}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Times */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={row.from}
                        disabled={rowReadOnly || !row.checked}
                        onChange={e => updateRow(idx, { from: e.target.value })}
                        className={`w-24 rounded-lg border px-2 py-1.5 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} disabled:opacity-40`}
                      />
                      <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>–</span>
                      <input
                        type="time"
                        value={row.to}
                        disabled={rowReadOnly || !row.checked}
                        onChange={e => updateRow(idx, { to: e.target.value })}
                        className={`w-24 rounded-lg border px-2 py-1.5 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} disabled:opacity-40`}
                      />
                      {hrs && row.checked && (
                        <span className={`w-10 text-right text-xs font-bold tabular-nums ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                          {hrs}
                        </span>
                      )}
                    </div>
                    {/* Employee preference indicator */}
                    {empPref && (
                      <div className={`w-full mt-2 flex items-start gap-2 rounded-lg px-3 py-2 border ${darkMode ? 'border-emerald-800 bg-emerald-900/25' : 'border-emerald-200 bg-emerald-50'}`}>
                        <span className="flex-shrink-0 text-emerald-500 text-sm mt-0.5">👁</span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {row.name} szeretné ezt a műszakot: {getShiftType(empPref.shiftType).title}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {empPref.startTime && empPref.endTime && (
                              <span className={`text-xs tabular-nums ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{empPref.startTime}–{empPref.endTime}</span>
                            )}
                            {(() => { const h = calcHours(empPref.startTime, empPref.endTime); return h ? <span className={`text-xs font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{h}</span> : null; })()}
                            {empPref.notes && <span className={`text-xs italic ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>"{empPref.notes}"</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className={`flex-shrink-0 flex items-center justify-between gap-3 border-t px-6 py-4 ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={modalSaving}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 transition-all"
              >
                {modalSaving ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee preference / draft calendar ─────────────────────────────────────
// Same UX as PharmacyScheduleCalendar, but only the current employee's own
// row is editable. All others' drafts are shown as read-only indicators.
function EmployeePreferenceCalendar({
  year, month, onChangeMonth, onClose,
  preferences,          // all schedulePreferences for this pharmacy+year+month
  ownEmployeeRecord,    // { id, name, email, linkedUserId, ... }
  user, darkMode,
  onSaveDayPreferences, saving,
  employeeProfile,      // { contractHours, birthDate, childrenCount, vacationTakenThisYear, vacationCarriedOver }
  initialDay,           // optional: auto-open this day's modal on mount
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
  const DOW_LABELS = ['Vasárnap','Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat'];

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

  // ── Havi óra + szabadság számítás ──────────────────────────────────────
  const contractHours = Number(employeeProfile?.contractHours) || 0;
  const monthlyRequiredHours = contractHours ? calcMonthlyRequiredHours(contractHours, year, month) : 0;
  // Sum up planned working hours (non-off prefs)
  const plannedWorkPrefs = ownPrefs.filter(p => !isOffShift(p.shiftType));
  const plannedSzPrefs = ownPrefs.filter(p => p.shiftType === 'Sz');
  const plannedHoursTotal = plannedWorkPrefs.reduce((sum, p) => {
    if (!p.startTime || !p.endTime) return sum + contractHours;
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
  const remainingHours = monthlyRequiredHours - plannedHoursTotal;
  // Vacation
  const annualVacDays = employeeProfile?.birthDate
    ? calcAnnualVacationDays(employeeProfile.birthDate, employeeProfile.childrenCount, year)
    : 0;
  const carryOver = Number(employeeProfile?.vacationCarriedOver) || 0;
  const takenThisYear = Number(employeeProfile?.vacationTakenThisYear) || 0;
  const totalRemainingVac = annualVacDays + carryOver - takenThisYear;
  const thisMonthSzDays = plannedSzPrefs.length;
  const vacAfterThisMonth = totalRemainingVac - thisMonthSzDays;

  // Find last planned day index for showing "maradék" label
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

  async function handleSave() {
    setModalSaving(true);
    try {
      const dateKey = formatDateKey(year, month, day_);
      await onSaveDayPreferences(dateKey, { checked, shiftType, from, to, notes });
      setShowModal(false);
    } finally {
      setModalSaving(false);
    }
  }
  // helper — avoid shadowing `day` in the map
  const day_ = selectedDay;

  // Auto-open a specific day modal when initialDay is provided (e.g. from vacations tab)
  useEffect(() => {
    if (initialDay) {
      openDay(initialDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDayName = selectedDay
    ? HU_DAYS_LONG[new Date(year, month - 1, selectedDay).getDay()]
    : '';

  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
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

      {/* Legend */}
      <div className={`flex-shrink-0 flex items-center gap-4 px-4 py-2 text-xs border-b ${darkMode ? 'border-gray-800 bg-gray-850 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500"/> Saját tervem</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-400"/> Kollégák tervei</span>
      </div>

      {/* Day list */}
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
                  // running hours up to this day
                  const runningHrs = plannedWorkPrefs
                    .filter(pp => pp.date <= formatDateKey(year, month, d))
                    .reduce((sum, pp) => {
                      if (!pp.startTime || !pp.endTime) return sum + contractHours;
                      const [sh, sm] = pp.startTime.split(':').map(Number);
                      const [eh, em] = pp.endTime.split(':').map(Number);
                      return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                    }, 0);
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

      {/* Day preference modal */}
      {showModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 px-4 pb-4" style={{backdropFilter:'blur(6px)', background:'rgba(0,0,0,0.55)'}}>
          <div className={`relative w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            {/* Header */}
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
              {/* Want to work toggle */}
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
                  {/* Shift type */}
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
                  {/* Time — hidden for Sz/P */}
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
                  {/* Notes */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Megjegyzés (opcionális)</p>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300'}`} placeholder="Pl. Csak délelőtt tudok, orvos délután..."/>
                  </div>
                </>
              )}
              {/* Others on this day */}
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
            {/* Footer */}
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

export default function ScheduleManagerTab({ pharmaRole }) {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const isPharmacy = pharmaRole === 'pharmacy';

  const now = new Date();
  const [mainTab, setMainTab] = useState(isPharmacy ? 'schedule' : 'mine');
  const [workerTab, setWorkerTab] = useState('add');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');

  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [vacationRequests, setVacationRequests] = useState([]);

  const [employeeForm, setEmployeeForm] = useState({
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  const [scheduleForm, setScheduleForm] = useState({
    employeeId: '',
    startTime: '08:00',
    endTime: '16:00',
    notes: '',
  });

  const [swapForm, setSwapForm] = useState({
    requesterScheduleId: '',
    targetScheduleId: '',
    message: '',
  });

  const [vacationForm, setVacationForm] = useState({
    startDate: getTodayKey(),
    endDate: getTodayKey(),
    reason: '',
  });

  const [plannerLoading, setPlannerLoading] = useState(false);
  const [applyingPlanner, setApplyingPlanner] = useState(false);
  const [plannerConfigSaving, setPlannerConfigSaving] = useState(false);
  const [plannerResult, setPlannerResult] = useState(null);
  const [plannerConfigForm, setPlannerConfigForm] = useState(getDefaultPlanningConfig());
  const [showCriteriaPage, setShowCriteriaPage] = useState(false);
  const [plannerWizardStep, setPlannerWizardStep] = useState(0);
  const [plannerDraftSaving, setPlannerDraftSaving] = useState(false);
  const [plannerDraftSavedAt, setPlannerDraftSavedAt] = useState(null);
  const [plannerLastSavedJson, setPlannerLastSavedJson] = useState('');
  const [bettiChatInput, setBettiChatInput] = useState('');
  const [bettiChatLoading, setBettiChatLoading] = useState(false);
  const [bettiChatMessages, setBettiChatMessages] = useState([]);
  const [bettiQuickActions, setBettiQuickActions] = useState([]);
  const [bettiChatOpen, setBettiChatOpen] = useState(false);
  const [bettiKeyboardInset, setBettiKeyboardInset] = useState(0);
  const [replanForm, setReplanForm] = useState({
    employeeId: '',
    startDate: getTodayKey(),
    endDate: getTodayKey(),
  });

  const [preferencesForm, setPreferencesForm] = useState(DEFAULT_PREFERENCES);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // Employee profile (birth date, children, contract type, vacation tracking)
  const [employeeProfile, setEmployeeProfile] = useState(null); // loaded from Firestore
  const [profileForm, setProfileForm] = useState({
    birthDate: '',
    childrenCount: '0',
    contractHours: '8',
    vacationTakenThisYear: '0',
    vacationCarriedOver: '0',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);

  // Full-screen calendar overlay (pharmacy schedule)
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Full-screen preference calendar overlay (employee draft)
  const [preferenceCalendarOpen, setPreferenceCalendarOpen] = useState(false);
  const [preferenceInitialDay, setPreferenceInitialDay] = useState(null);
  // schedulePreferences drafts
  const [schedulePreferences, setSchedulePreferences] = useState([]);
  const [allPreferences, setAllPreferences] = useState([]);
  const [expandedWorker, setExpandedWorker] = useState(null);

  // Quick swap: which own schedule is currently open for partner selection
  const [quickSwapScheduleId, setQuickSwapScheduleId] = useState(null);
  const [quickSwapMessage, setQuickSwapMessage] = useState('');

  const selectedDate = formatDateKey(year, month, day);
  const today = getTodayKey();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const availableYears = [thisYear, thisYear + 1, thisYear + 2];
  const pastYears = [thisYear - 1, thisYear - 2].filter(y => y > 2020);

  const activeEmployees = useMemo(
    () => employees.filter(item => item.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name, 'hu')),
    [employees]
  );

  const ownEmployeeRecords = useMemo(() => {
    const email = normalizeEmail(user?.email);
    return activeEmployees.filter(item => item.linkedUserId === user?.uid || normalizeEmail(item.email) === email);
  }, [activeEmployees, user]);

  const ownScheduleIds = useMemo(() => {
    const employeeIds = new Set(ownEmployeeRecords.map(item => item.id));
    const email = normalizeEmail(user?.email);
    return new Set(
      schedules
        .filter(item => item.status !== 'deleted')
        .filter(item => employeeIds.has(item.employeeId) || item.linkedUserId === user?.uid || normalizeEmail(item.employeeEmail) === email)
        .map(item => item.id)
    );
  }, [ownEmployeeRecords, schedules, user]);

  const selectedDateSchedules = useMemo(
    () => sortByDateAndTime(schedules.filter(item => item.date === selectedDate && item.status !== 'deleted')),
    [schedules, selectedDate]
  );

  const ownSchedules = useMemo(
    () => sortByDateAndTime(schedules.filter(item => ownScheduleIds.has(item.id) && item.status !== 'deleted')),
    [schedules, ownScheduleIds]
  );

  const otherSchedules = useMemo(
    () => sortByDateAndTime(schedules.filter(item => !ownScheduleIds.has(item.id) && item.status !== 'deleted')),
    [schedules, ownScheduleIds]
  );

  const selectedEmployee = useMemo(
    () => activeEmployees.find(item => item.id === scheduleForm.employeeId) || null,
    [activeEmployees, scheduleForm.employeeId]
  );

  const activeMonthSchedules = useMemo(
    () => sortByDateAndTime(schedules.filter(item => item.status !== 'deleted')),
    [schedules]
  );

  const publishedScheduleCount = useMemo(
    () => activeMonthSchedules.filter(item => item.publishedAt).length,
    [activeMonthSchedules]
  );

  useEffect(() => {
    const maxDays = getDaysInMonth(year, month);
    if (day > maxDays) setDay(maxDays);
  }, [year, month, day]);

  useEffect(() => {
    if (!bettiChatOpen) {
      setBettiKeyboardInset(0);
      return;
    }
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateInset = () => {
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setBettiKeyboardInset(overlap);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, [bettiChatOpen]);

  useEffect(() => {
    if (!user || !pharmaRole) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.uid, user?.email, pharmaRole, year, month]);

  useEffect(() => {
    if (!scheduleForm.employeeId && activeEmployees.length > 0) {
      setScheduleForm(prev => ({
        ...prev,
        employeeId: activeEmployees[0].id,
      }));
    }
  }, [activeEmployees, scheduleForm.employeeId]);

  async function loadData() {
    setLoading(true);
    setStatusError('');
    try {
      if (isPharmacy) {
        await loadPharmacyData();
      } else {
        await loadEmployeeData();
      }
    } catch (error) {
      console.error('Schedule manager load error:', error);
      setStatusError('Hiba történt az adatok betöltésekor.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPharmacyData() {
    const [employeesSnapshot, schedulesSnapshot, swapSnapshot, vacationSnapshot, prefsSnapshot, allPrefsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'pharmacyEmployees'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'pharmacySchedules'), where('pharmacyId', '==', user.uid), where('year', '==', year), where('month', '==', month))),
      getDocs(query(collection(db, 'scheduleSwapRequests'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'scheduleVacationRequests'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'schedulePreferences'), where('pharmacyId', '==', user.uid), where('year', '==', year), where('month', '==', month))),
      getDocs(query(collection(db, 'schedulePreferences'), where('pharmacyId', '==', user.uid))),
    ]);

    setEmployees(employeesSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setSchedules(sortByDateAndTime(schedulesSnapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
    setSwapRequests(swapSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setVacationRequests(vacationSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setSchedulePreferences(prefsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setAllPreferences(allPrefsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(p => p.status !== 'deleted'));
  }

  async function loadEmployeeData() {
    const email = normalizeEmail(user?.email);
    const [uidEmployeesSnapshot, emailEmployeesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'pharmacyEmployees'), where('linkedUserId', '==', user.uid))),
      email ? getDocs(query(collection(db, 'pharmacyEmployees'), where('email', '==', email))) : Promise.resolve({ docs: [] }),
    ]);

    const employeeMap = new Map();
    [...uidEmployeesSnapshot.docs, ...emailEmployeesSnapshot.docs].forEach(item => {
      const data = { id: item.id, ...item.data() };
      if (data.status !== 'inactive') employeeMap.set(item.id, data);
    });

    const employeeList = [...employeeMap.values()];
    setEmployees(employeeList);

    const pharmacyIds = [...new Set(employeeList.map(item => item.pharmacyId).filter(Boolean))];
    const collectedSchedules = [];
    const collectedSwapRequests = [];
    const collectedVacationRequests = [];

    for (const pharmacyId of pharmacyIds) {
      const [scheduleSnapshot, requesterSwapsSnapshot, targetSwapsSnapshot, vacationSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'pharmacySchedules'), where('pharmacyId', '==', pharmacyId), where('year', '==', year), where('month', '==', month))),
        getDocs(query(collection(db, 'scheduleSwapRequests'), where('requesterUserId', '==', user.uid))),
        getDocs(query(collection(db, 'scheduleSwapRequests'), where('targetUserId', '==', user.uid))),
        getDocs(query(collection(db, 'scheduleVacationRequests'), where('userId', '==', user.uid))),
      ]);

      collectedSchedules.push(...scheduleSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedSwapRequests.push(...requesterSwapsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedSwapRequests.push(...targetSwapsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedVacationRequests.push(...vacationSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));

      // Load all preferences for this pharmacy+year+month so employees can see each other's drafts
      const prefsSnapshot = await getDocs(query(
        collection(db, 'schedulePreferences'),
        where('pharmacyId', '==', pharmacyId),
        where('year', '==', year),
        where('month', '==', month)
      ));
      setSchedulePreferences(prefsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }

    const uniqueSwapMap = new Map();
    collectedSwapRequests.forEach(item => uniqueSwapMap.set(item.id, item));

    setSchedules(sortByDateAndTime(collectedSchedules));
    setSwapRequests([...uniqueSwapMap.values()]);
    setVacationRequests(collectedVacationRequests);

    // Load employee profile
    const profileDocs = await getDocs(query(
      collection(db, 'employeeProfiles'),
      where('userId', '==', user.uid)
    ));
    if (!profileDocs.empty) {
      const prof = { id: profileDocs.docs[0].id, ...profileDocs.docs[0].data() };
      setEmployeeProfile(prof);
      setProfileForm({
        birthDate: prof.birthDate || '',
        childrenCount: String(prof.childrenCount ?? '0'),
        contractHours: String(prof.contractHours ?? '8'),
        vacationTakenThisYear: String(prof.vacationTakenThisYear ?? '0'),
        vacationCarriedOver: String(prof.vacationCarriedOver ?? '0'),
      });
    } else {
      setEmployeeProfile(null);
    }
  }

  async function handleSaveEmployeeProfile() {
    if (!user?.uid) return;
    setProfileSaving(true);
    try {
      const payload = {
        userId: user.uid,
        birthDate: profileForm.birthDate,
        childrenCount: Number(profileForm.childrenCount) || 0,
        contractHours: Number(profileForm.contractHours) || 8,
        vacationTakenThisYear: Number(profileForm.vacationTakenThisYear) || 0,
        vacationCarriedOver: Number(profileForm.vacationCarriedOver) || 0,
        updatedAt: serverTimestamp(),
      };
      if (employeeProfile?.id) {
        await updateDoc(doc(db, 'employeeProfiles', employeeProfile.id), payload);
        setEmployeeProfile({ ...employeeProfile, ...payload });
      } else {
        const ref = await addDoc(collection(db, 'employeeProfiles'), { ...payload, createdAt: serverTimestamp() });
        setEmployeeProfile({ id: ref.id, ...payload });
      }
      setShowProfileForm(false);
    } finally {
      setProfileSaving(false);
    }
  }

  // Save a single employee's preference for one day
  async function handleSavePreferenceDaySchedules(dateKey, { checked, shiftType, from, to, notes }) {
    setSaving(true);
    try {
      const [syear, smonth, sday] = dateKey.split('-').map(Number);
      const ownRec = ownEmployeeRecords[0];
      const pharmacyId = ownRec?.pharmacyId;
      if (!pharmacyId) { setSaving(false); return; }

      // Find existing own preference doc for this date
      const existing = schedulePreferences.find(p =>
        p.date === dateKey &&
        (p.employeeId === ownRec?.id ||
          (p.linkedUserId && p.linkedUserId === user?.uid) ||
          (p.employeeEmail && user?.email && p.employeeEmail.toLowerCase() === user.email.toLowerCase()))
      );

      const payload = {
        pharmacyId,
        employeeId: ownRec?.id || '',
        employeeName: ownRec?.name || userData?.name || user.email,
        employeeEmail: normalizeEmail(user?.email) || '',
        linkedUserId: user?.uid || null,
        date: dateKey,
        year: syear, month: smonth, day: sday,
        shiftType: checked ? (shiftType || 'N') : 'Sz',
        startTime: (checked && !isOffShift(shiftType)) ? from : null,
        endTime: (checked && !isOffShift(shiftType)) ? to : null,
        notes: notes || '',
        status: 'draft',
        updatedAt: serverTimestamp(),
      };
      if (existing) {
        await updateDoc(doc(db, 'schedulePreferences', existing.id), payload);
      } else {
        await addDoc(collection(db, 'schedulePreferences'), { ...payload, createdAt: serverTimestamp() });
      }

      // Értesítés a gyógyszertárnak
      await createNotificationWithPush({
        userId: pharmacyId,
        type: 'schedule_preference_saved',
        title: 'Új beosztás tervezet',
        message: `${payload.employeeName} beosztás tervezetet mentett: ${dateKey}.`,
        data: { employeeId: ownRec?.id || '', date: dateKey },
        url: '/pharmagister?tab=schedule-manager',
        dedupeWindowSeconds: 60,
        dedupeByDataKeys: ['employeeId', 'date'],
      });

      await loadData();
    } catch (err) {
      console.error('handleSavePreferenceDaySchedules error:', err);
      setStatusError('Nem sikerült menteni a tervezetet.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEmployee(event) {
    event.preventDefault();
    setStatusError('');
    setStatusMessage('');

    setSaving(true);
    try {
      const employeeEmail = normalizeEmail(employeeForm.email);
      if (!employeeEmail) {
        setStatusError('Dolgozó hozzáadásához regisztrált Pharmagister email cím megadása kötelező.');
        setSaving(false);
        return;
      }

      const existingAtPharmacy = activeEmployees.some(item => normalizeEmail(item.email) === employeeEmail);
      if (existingAtPharmacy) {
        setStatusError('Ez az email cím már hozzá van adva ehhez a gyógyszertárhoz.');
        setSaving(false);
        return;
      }

      const existingSnapshot = await getDocs(
        query(
          collection(db, 'pharmacyEmployees'),
          where('pharmacyId', '==', user.uid),
          where('email', '==', employeeEmail)
        )
      );
      const existingActiveRecord = existingSnapshot.docs.some(item => item.data()?.status !== 'inactive');
      if (existingActiveRecord) {
        setStatusError('Ez az email cím már hozzá van adva ehhez a gyógyszertárhoz.');
        setSaving(false);
        return;
      }

      const userSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', employeeEmail)));
      if (userSnapshot.empty) {
        setStatusError('A megadott email cím még nincs regisztrálva a Pharmagister rendszerben. Csak regisztrált felhasználó vehető fel.');
        setSaving(false);
        return;
      }

      const linkedUser = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
      const autoRole = normalizeRoleFromProfile(linkedUser.pharmagisterRole);
      if (!autoRole) {
        setStatusError('A felhasználó szerepköre nem megfelelő a beosztáshoz. Csak gyógyszerész vagy szakasszisztens profil vehető fel.');
        setSaving(false);
        return;
      }
      const employeeNameFromProfile = (linkedUser.displayName || linkedUser.name || '').trim();
      if (!employeeNameFromProfile) {
        setStatusError('A felhasználó profiljában nincs név megadva. Kérd meg, hogy előbb töltse ki a profilját.');
        setSaving(false);
        return;
      }

      const pharmacyName = userData?.pharmacyName || userData?.name || user?.displayName || user?.email || 'Gyógyszertár';

      await addDoc(collection(db, 'pharmacyEmployees'), {
        pharmacyId: user.uid,
        pharmacyName,
        pharmacyEmail: user.email || '',
        name: employeeNameFromProfile,
        email: employeeEmail,
        phone: employeeForm.phone.trim(),
        address: employeeForm.address.trim(),
        role: autoRole,
        notes: employeeForm.notes.trim(),
        linkedUserId: linkedUser.id,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const token = await user.getIdToken();
      await fetch('/api/pharmagister/notify-employee-added', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeEmail,
          employeeName: employeeNameFromProfile,
          pharmacyName,
          pharmacyEmail: user.email || '',
        }),
      });

      await createNotificationWithPush({
        userId: linkedUser.id,
        type: 'employee_added_to_pharmacy',
        title: 'Új gyógyszertári kapcsolat',
        message: `${pharmacyName} felvett a Pharmagisterben a dolgozói közé.`,
        data: { pharmacyId: user.uid, pharmacyName },
        url: '/pharmagister?tab=schedule-manager',
        dedupeWindowSeconds: 120,
        dedupeByDataKeys: ['pharmacyId'],
      });

      setEmployeeForm({ email: '', phone: '', address: '', notes: '' });
      setStatusMessage('A dolgozó sikeresen hozzáadva.');
      await loadData();
    } catch (error) {
      console.error('Add employee error:', error);
      setStatusError('Nem sikerült a dolgozó hozzáadása.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveEmployee(employeeId) {
    const employee = activeEmployees.find(item => item.id === employeeId);
    if (!employee) {
      setStatusError('A kiválasztott dolgozó nem található.');
      return;
    }

    const confirmed = window.confirm(`Biztosan törölni szeretnéd ${employee.name} dolgozót a beosztásból?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      await updateDoc(doc(db, 'pharmacyEmployees', employeeId), {
        status: 'inactive',
        updatedAt: serverTimestamp(),
        removedAt: serverTimestamp(),
      });

      let linkedUserId = employee.linkedUserId || null;
      const employeeEmail = normalizeEmail(employee.email);
      if (!linkedUserId && employeeEmail) {
        const userSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', employeeEmail)));
        if (!userSnapshot.empty) {
          linkedUserId = userSnapshot.docs[0].id;
        }
      }

      if (linkedUserId) {
        const pharmacyName = userData?.pharmacyName || userData?.name || user?.displayName || user?.email || 'Gyógyszertár';
        await createNotificationWithPush({
          userId: linkedUserId,
          type: 'employee_removed_from_pharmacy',
          title: 'Gyógyszertári kapcsolat törölve',
          message: `${pharmacyName} eltávolított a dolgozói listájából.`,
          data: { pharmacyId: user.uid, pharmacyName, employeeId },
          url: '/pharmagister?tab=schedule-manager',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['pharmacyId', 'employeeId'],
        });
      }

      setStatusMessage('A dolgozó eltávolítva.');
      await loadData();
    } catch (error) {
      console.error('Remove employee error:', error);
      setStatusError('Nem sikerült eltávolítani a dolgozót.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSchedule(event) {
    event.preventDefault();
    setStatusError('');
    setStatusMessage('');

    const employee = activeEmployees.find(item => item.id === scheduleForm.employeeId);
    if (!employee) {
      setStatusError('Válassz dolgozót a beosztáshoz.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'pharmacySchedules'), {
        pharmacyId: user.uid,
        pharmacyName: userData?.pharmacyName || userData?.name || user.email,
        date: selectedDate,
        year,
        month,
        day,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email || '',
        linkedUserId: employee.linkedUserId || null,
        role: employee.role || 'other',
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        notes: scheduleForm.notes.trim(),
        locked: false,
        status: 'active',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setScheduleForm(prev => ({ ...prev, notes: '' }));
      setStatusMessage('Beosztás rögzítve.');
      await loadData();
    } catch (error) {
      console.error('Create schedule error:', error);
      setStatusError('Nem sikerült menteni a beosztást.');
    } finally {
      setSaving(false);
    }
  }

  // Batch save all employees for a given date from the PharmacyScheduleCalendar modal
  async function handleSaveDaySchedules(dateKey, rows) {
    setSaving(true);
    setStatusError('');
    setStatusMessage('');
    const [syear, smonth, sday] = dateKey.split('-').map(Number);
    try {
      for (const row of rows) {
        if (row.isPublished || row.locked) continue; // never touch published or manual locks

        const emp = employees.find(e => e.id === row.employeeId);

        if (row.checked) {
          // Upsert
          const payload = {
            pharmacyId: user.uid,
            pharmacyName: userData?.pharmacyName || userData?.name || user.email,
            date: dateKey,
            year: syear,
            month: smonth,
            day: sday,
            employeeId: row.employeeId,
            employeeName: row.name,
            employeeEmail: row.email || '',
            linkedUserId: row.linkedUserId || null,
            role: emp?.role || 'other',
            startTime: row.from,
            endTime: row.to,
            shiftType: row.shiftType || 'N',
            notes: row.notes || '',
            locked: Boolean(row.locked),
            status: 'active',
            updatedAt: serverTimestamp(),
          };
          if (row.existingId) {
            await updateDoc(doc(db, 'pharmacySchedules', row.existingId), payload);
          } else {
            await addDoc(collection(db, 'pharmacySchedules'), {
              ...payload,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
            });
          }
        } else if (!row.checked && row.existingId) {
          // Delete
          await updateDoc(doc(db, 'pharmacySchedules', row.existingId), {
            status: 'deleted',
            updatedAt: serverTimestamp(),
          });
        }
      }
      setStatusMessage('Beosztás mentve.');
      await loadData();
    } catch (err) {
      console.error('handleSaveDaySchedules error:', err);
      setStatusError('Nem sikerült menteni a beosztást.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    const scheduleItem = schedules.find(item => item.id === scheduleId);
    if (!scheduleItem) {
      setStatusError('A kiválasztott beosztás nem található.');
      return;
    }
    if (isPublishedSchedule(scheduleItem)) {
      setStatusError('A publikált műszak zárolt, előbb új tervet készíts és publikáld újra.');
      return;
    }
    if (scheduleItem.locked === true) {
      setStatusError('Ez a műszak kézzel zárolt (locked), előbb oldd fel a zárolást.');
      return;
    }

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      await updateDoc(doc(db, 'pharmacySchedules', scheduleId), {
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });

      if (scheduleItem.linkedUserId) {
        const pharmacyName = scheduleItem.pharmacyName || userData?.pharmacyName || userData?.name || user?.displayName || user?.email || 'Gyógyszertár';
        await createNotificationWithPush({
          userId: scheduleItem.linkedUserId,
          type: 'schedule_removed_from_employee',
          title: 'Beosztás törölve',
          message: `${pharmacyName} törölte a beosztásodat: ${scheduleItem.date} (${scheduleItem.startTime}-${scheduleItem.endTime}).`,
          data: { pharmacyId: user.uid, scheduleId, date: scheduleItem.date },
          url: '/pharmagister?tab=schedule-manager',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['scheduleId'],
        });
      }

      setStatusMessage('Beosztás törölve.');
      await loadData();
    } catch (error) {
      console.error('Delete schedule error:', error);
      setStatusError('Nem sikerült törölni a beosztást.');
    } finally {
      setSaving(false);
    }
  }

  function handleSuggestEmployee() {
    const candidates = activeEmployees;
    const freeCandidates = candidates.filter(item => !schedules.some(schedule => schedule.employeeId === item.id && schedule.date === selectedDate && schedule.status !== 'deleted'));
    const pool = freeCandidates.length > 0 ? freeCandidates : candidates;

    if (pool.length === 0) {
      setStatusError('Nincs megfelelő dolgozó az AI javaslathoz.');
      return;
    }

    const suggested = [...pool].sort((a, b) => {
      const countA = schedules.filter(item => item.employeeId === a.id && item.status !== 'deleted').length;
      const countB = schedules.filter(item => item.employeeId === b.id && item.status !== 'deleted').length;
      return countA - countB;
    })[0];

    setScheduleForm(prev => ({ ...prev, employeeId: suggested.id }));
    setStatusMessage(`AI javaslat: ${suggested.name}`);
  }

  async function handleCreateSwapRequest() {
    setStatusError('');
    setStatusMessage('');

    if (!swapForm.requesterScheduleId || !swapForm.targetScheduleId) {
      setStatusError('Válassz saját és cél beosztást is.');
      return;
    }

    const requesterSchedule = schedules.find(item => item.id === swapForm.requesterScheduleId);
    const targetSchedule = schedules.find(item => item.id === swapForm.targetScheduleId);

    if (!requesterSchedule || !targetSchedule) {
      setStatusError('A kiválasztott beosztás nem található.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'scheduleSwapRequests'), {
        pharmacyId: requesterSchedule.pharmacyId,
        requesterUserId: user.uid,
        requesterName: requesterSchedule.employeeName,
        requesterEmail: user.email || requesterSchedule.employeeEmail || '',
        requesterScheduleId: requesterSchedule.id,
        targetScheduleId: targetSchedule.id,
        targetUserId: targetSchedule.linkedUserId || null,
        targetName: targetSchedule.employeeName,
        targetEmail: targetSchedule.employeeEmail || '',
        date: requesterSchedule.date,
        targetDate: targetSchedule.date,
        message: swapForm.message.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (targetSchedule.linkedUserId) {
        await createNotificationWithPush({
          userId: targetSchedule.linkedUserId,
          type: 'schedule_swap_request',
          title: 'Beosztás csere igény',
          message: `${requesterSchedule.employeeName} csereigényt küldött a beosztásodra (${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime}).`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager',
        });
      }

      await createNotificationWithPush({
        userId: requesterSchedule.pharmacyId,
        type: 'schedule_swap_request_for_pharmacy',
        title: 'Új beosztás csere igény indult',
        message: `${requesterSchedule.employeeName} cserét kezdeményezett ${targetSchedule.employeeName} beosztásával.`,
        data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
        url: '/pharmagister?tab=schedule-manager',
      });

      setSwapForm({ requesterScheduleId: '', targetScheduleId: '', message: '' });
      setStatusMessage('Csereigény elküldve, az értesítés megérkezett a csere alanyához.');
      await loadData();
    } catch (error) {
      console.error('Create swap request error:', error);
      setStatusError('Nem sikerült elküldeni a csereigényt.');
    } finally {
      setSaving(false);
    }
  }

  // Quick-swap: initiated from a specific own shift card
  async function handleQuickSwapRequest(requesterScheduleId, targetScheduleId, message) {
    const requesterSchedule = schedules.find(item => item.id === requesterScheduleId);
    const targetSchedule = schedules.find(item => item.id === targetScheduleId);
    if (!requesterSchedule || !targetSchedule) {
      setStatusError('Beosztás nem található.');
      return;
    }

    setSaving(true);
    setStatusError('');
    setStatusMessage('');
    try {
      await addDoc(collection(db, 'scheduleSwapRequests'), {
        pharmacyId: requesterSchedule.pharmacyId,
        requesterUserId: user.uid,
        requesterName: requesterSchedule.employeeName,
        requesterEmail: user.email || requesterSchedule.employeeEmail || '',
        requesterScheduleId: requesterSchedule.id,
        targetScheduleId: targetSchedule.id,
        targetUserId: targetSchedule.linkedUserId || null,
        targetName: targetSchedule.employeeName,
        targetEmail: targetSchedule.employeeEmail || '',
        date: requesterSchedule.date,
        targetDate: targetSchedule.date,
        message: (message || '').trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (targetSchedule.linkedUserId) {
        await createNotificationWithPush({
          userId: targetSchedule.linkedUserId,
          type: 'schedule_swap_request',
          title: 'Beosztás csere igény',
          message: `${requesterSchedule.employeeName} cserét kér a ${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime} műszakodra.`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager',
        });
      }

      await createNotificationWithPush({
        userId: requesterSchedule.pharmacyId,
        type: 'schedule_swap_request_for_pharmacy',
        title: 'Új beosztás csere igény indult',
        message: `${requesterSchedule.employeeName} csereigényt nyújtott be ${targetSchedule.employeeName} beosztásával. Az elfogadáshoz a kollégája döntése után még jóváhagyásra van szükség.`,
        data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
        url: '/pharmagister?tab=schedule-manager',
        dedupeWindowSeconds: 60,
        dedupeByDataKeys: ['requesterScheduleId', 'targetScheduleId'],
      });

      setQuickSwapScheduleId(null);
      setQuickSwapMessage('');
      setStatusMessage(`Csereigény elküldve ${targetSchedule.employeeName} felé.`);
      await loadData();
    } catch (error) {
      console.error('Quick swap request error:', error);
      setStatusError('Nem sikerült elküldeni a csereigényt.');
    } finally {
      setSaving(false);
    }
  }

  // Employee target responds (pending → employee_accepted / rejected)
  async function handleRespondToSwapRequest(requestId, decision) {
    const requestItem = swapRequests.find(item => item.id === requestId);
    if (!requestItem) return;

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      if (decision === 'accepted') {
        // Employee accepts: status becomes employee_accepted, pharmacy must still confirm
        await updateDoc(doc(db, 'scheduleSwapRequests', requestId), {
          status: 'employee_accepted',
          employeeRespondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Notify requester: colleague accepted, waiting for pharmacy
        if (requestItem.requesterUserId) {
          await createNotificationWithPush({
            userId: requestItem.requesterUserId,
            type: 'schedule_swap_employee_accepted',
            title: 'Csere elfogadva – gyógyszertár jóváhagyása szükséges',
            message: `${requestItem.targetName} elfogadta a csereigényt. A csere végrehajtásához még a gyógyszertár jóváhagyása szükséges.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }

        // Notify pharmacy: both parties agreed, awaiting confirmation
        await createNotificationWithPush({
          userId: requestItem.pharmacyId,
          type: 'schedule_swap_awaiting_pharmacy',
          title: 'Csere jóváhagyása szükséges',
          message: `${requestItem.requesterName} és ${requestItem.targetName} beosztáscseréje elfogadásra vár. Kérjük, erősítse meg vagy utasítsa el.`,
          data: { requestId },
          url: '/pharmagister?tab=schedule-manager',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['requestId'],
        });

        setStatusMessage('Elfogadtad a csereigényt. Várakozás a gyógyszertár jóváhagyására.');
      } else {
        // Employee rejects
        await updateDoc(doc(db, 'scheduleSwapRequests', requestId), {
          status: 'rejected',
          employeeRespondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (requestItem.requesterUserId) {
          await createNotificationWithPush({
            userId: requestItem.requesterUserId,
            type: 'schedule_swap_result',
            title: 'Csereigény elutasítva',
            message: `${requestItem.targetName} elutasította a csereigényt.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }

        await createNotificationWithPush({
          userId: requestItem.pharmacyId,
          type: 'schedule_swap_result_for_pharmacy',
          title: 'Csere elutasítva',
          message: `${requestItem.targetName} nem fogadta el a csereigényt (${requestItem.requesterName} kezdeményezte).`,
          data: { requestId },
          url: '/pharmagister?tab=schedule-manager',
        });

        setStatusMessage('A csereigényt elutasítottad.');
      }

      await loadData();
    } catch (error) {
      console.error('Respond to swap request error:', error);
      setStatusError(error.message || 'Nem sikerült lezárni a csereigényt.');
    } finally {
      setSaving(false);
    }
  }

  // Pharmacy responds (employee_accepted → accepted / rejected_by_pharmacy)
  async function handlePharmacyRespondToSwapRequest(requestId, decision) {
    const requestItem = swapRequests.find(item => item.id === requestId);
    if (!requestItem) return;

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      if (decision === 'accepted') {
        const requesterSchedule = schedules.find(item => item.id === requestItem.requesterScheduleId);
        const targetSchedule = schedules.find(item => item.id === requestItem.targetScheduleId);

        if (!requesterSchedule || !targetSchedule) {
          throw new Error('A csere egyik beosztása már nem található.');
        }
        if (isPublishedSchedule(requesterSchedule) || isPublishedSchedule(targetSchedule)) {
          throw new Error('Publikált műszak nem cserélhető közvetlenül. Készíts új tervet és publikáld újra.');
        }

        // Execute actual swap
        await updateDoc(doc(db, 'pharmacySchedules', requesterSchedule.id), {
          employeeId: targetSchedule.employeeId,
          employeeName: targetSchedule.employeeName,
          employeeEmail: targetSchedule.employeeEmail || '',
          linkedUserId: targetSchedule.linkedUserId || null,
          role: targetSchedule.role,
          swappedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'pharmacySchedules', targetSchedule.id), {
          employeeId: requesterSchedule.employeeId,
          employeeName: requesterSchedule.employeeName,
          employeeEmail: requesterSchedule.employeeEmail || '',
          linkedUserId: requesterSchedule.linkedUserId || null,
          role: requesterSchedule.role,
          swappedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'scheduleSwapRequests', requestId), {
          status: 'accepted',
          pharmacyRespondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Notify both employees
        if (requestItem.requesterUserId) {
          await createNotificationWithPush({
            userId: requestItem.requesterUserId,
            type: 'schedule_swap_result',
            title: 'Csere jóváhagyva és végrehajtva',
            message: `A gyógyszertár jóváhagyta a cserét ${requestItem.targetName} dolgozóval. A beosztás frissítve.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }
        if (requestItem.targetUserId) {
          await createNotificationWithPush({
            userId: requestItem.targetUserId,
            type: 'schedule_swap_result',
            title: 'Csere jóváhagyva és végrehajtva',
            message: `A gyógyszertár jóváhagyta a cserét ${requestItem.requesterName} dolgozóval. A beosztás frissítve.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }

        setStatusMessage('Csere jóváhagyva és végrehajtva.');
      } else {
        // Pharmacy rejects
        await updateDoc(doc(db, 'scheduleSwapRequests', requestId), {
          status: 'rejected_by_pharmacy',
          pharmacyRespondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (requestItem.requesterUserId) {
          await createNotificationWithPush({
            userId: requestItem.requesterUserId,
            type: 'schedule_swap_result',
            title: 'Csere elutasítva a gyógyszertár által',
            message: `A gyógyszertár nem hagyta jóvá a cserét ${requestItem.targetName} dolgozóval.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }
        if (requestItem.targetUserId) {
          await createNotificationWithPush({
            userId: requestItem.targetUserId,
            type: 'schedule_swap_result',
            title: 'Csere elutasítva a gyógyszertár által',
            message: `A gyógyszertár nem hagyta jóvá a cserét ${requestItem.requesterName} dolgozóval.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager',
          });
        }

        setStatusMessage('A cserét elutasítottad.');
      }

      await loadData();
    } catch (error) {
      console.error('Pharmacy respond to swap error:', error);
      setStatusError(error.message || 'Nem sikerült lezárni a csereigényt.');
    } finally {
      setSaving(false);
    }
  }

  // Compute eligible swap partners for a given own schedule
  function getSwapCandidatesForSchedule(scheduleId) {
    const own = schedules.find(item => item.id === scheduleId);
    if (!own) return [];

    // All schedules on the same day, not own, not deleted
    return schedules.filter((item) => {
      if (item.id === scheduleId) return false;
      if (item.status === 'deleted') return false;
      if (item.date !== own.date) return false;
      // Exclude if the exact same employee already (shouldn't happen, but guard)
      if (item.employeeId === own.employeeId) return false;
      return true;
    });
  }

  async function handleCreateVacationRequest() {
    setStatusError('');
    setStatusMessage('');

    if (!vacationForm.startDate || !vacationForm.endDate) {
      setStatusError('Add meg a szabadság időszakát.');
      return;
    }
    if (vacationForm.endDate < vacationForm.startDate) {
      setStatusError('A záró dátum nem lehet korábbi a kezdő dátumnál.');
      return;
    }

    const employeeRecord = ownEmployeeRecords[0];
    if (!employeeRecord) {
      setStatusError('Ehhez a fiókhoz nincs kapcsolt dolgozói rekord.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'scheduleVacationRequests'), {
        pharmacyId: employeeRecord.pharmacyId,
        employeeId: employeeRecord.id,
        userId: user.uid,
        employeeName: employeeRecord.name,
        employeeEmail: employeeRecord.email || user.email || '',
        role: employeeRecord.role || pharmaRole,
        startDate: vacationForm.startDate,
        endDate: vacationForm.endDate,
        reason: vacationForm.reason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await createNotificationWithPush({
        userId: employeeRecord.pharmacyId,
        type: 'vacation_request_created',
        title: 'Új szabadságigény',
        message: `${employeeRecord.name} szabadságigényt küldött be.`,
        data: { employeeId: employeeRecord.id },
        url: '/pharmagister?tab=schedule-manager',
      });

      setVacationForm(prev => ({ ...prev, reason: '' }));
      setStatusMessage('Szabadságigény elküldve.');
      await loadData();
    } catch (error) {
      console.error('Create vacation request error:', error);
      setStatusError('Nem sikerült elküldeni a szabadságigényt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRespondToVacationRequest(requestId, decision) {
    const requestItem = vacationRequests.find(item => item.id === requestId);
    if (!requestItem) return;

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      await updateDoc(doc(db, 'scheduleVacationRequests', requestId), {
        status: decision,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (requestItem.userId) {
        await createNotificationWithPush({
          userId: requestItem.userId,
          type: 'vacation_request_result',
          title: decision === 'accepted' ? 'Szabadság jóváhagyva' : 'Szabadság elutasítva',
          message: decision === 'accepted'
            ? `${requestItem.startDate} - ${requestItem.endDate} közötti szabadságigényed jóvá lett hagyva.`
            : `${requestItem.startDate} - ${requestItem.endDate} közötti szabadságigényed el lett utasítva.`,
          data: { requestId, pharmacyId: requestItem.pharmacyId },
          url: '/pharmagister?tab=schedule-manager',
        });
      }

      if (decision === 'accepted') {
        await runAutoPlanner({
          action: 'replan',
          sickEmployeeId: requestItem.employeeId,
          affectedDates: getDateRangeKeys(requestItem.startDate, requestItem.endDate),
        });
        setStatusMessage('A szabadságigény jóváhagyva, és újratervezési javaslat készült az érintett napokra.');
      } else {
        setStatusMessage('A szabadságigény elutasítva.');
      }
      await loadData();
    } catch (error) {
      console.error('Respond to vacation request error:', error);
      setStatusError(error.message || 'Nem sikerült frissíteni a szabadságigényt.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishSchedules() {
    if (!user || activeMonthSchedules.length === 0) {
      setStatusError('Nincs publikálható beosztás a kiválasztott hónapban.');
      return { success: false, blockingErrors: [{ message: 'Nincs kitöltött beosztás ebben a hónapban.' }] };
    }

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pharmagister/schedule-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employees: activeEmployees,
          schedules: activeMonthSchedules,
          vacationRequests,
          year,
          month,
          config: normalizePlanningConfig(plannerConfigForm),
          action: 'validate',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Nem sikerült validálni a beosztást.');
      }

      const blockingErrors = (result.conflicts || []).filter(item => item.severity === 'error');
      if (blockingErrors.length > 0) {
        setPlannerResult(result);
        setStatusError(`A publikálás blokkolva: ${blockingErrors.length} piros hiba maradt a beosztásban.`);
        return { success: false, blockingErrors };
      }

      const publishedAtIso = new Date().toISOString();
      for (const item of activeMonthSchedules) {
        await updateDoc(doc(db, 'pharmacySchedules', item.id), {
          publishedAt: publishedAtIso,
          publishedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      const employeeById = new Map(employees.map(item => [item.id, item]));
      const notifyTargets = new Set();
      const missingLinkedUsers = new Set();

      for (const item of activeMonthSchedules) {
        const employeeRecord = item.employeeId ? employeeById.get(item.employeeId) : null;
        const linkedUserId = item.linkedUserId || employeeRecord?.linkedUserId || null;
        if (linkedUserId) {
          notifyTargets.add(linkedUserId);
        } else {
          missingLinkedUsers.add(item.employeeName || item.employeeEmail || item.employeeId || 'ismeretlen dolgozo');
        }
      }

      for (const userId of notifyTargets) {
        await createNotificationWithPush({
          userId,
          type: 'schedule_published',
          title: 'Uj beosztas publikalva',
          message: `${MONTHS_HU[month - 1]} ${year} havi beosztasod publikalva lett.`,
          data: { pharmacyId: user.uid, year, month },
          url: '/pharmagister?tab=schedule-manager',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['pharmacyId', 'year', 'month'],
        });
      }

      const missingCount = missingLinkedUsers.size;
      if (missingCount > 0) {
        setStatusMessage(`A ${MONTHS_HU[month - 1]} ${year}. havi beosztas publikalva lett. Ertesites elkuldve ${notifyTargets.size} dolgozonak, ${missingCount} dolgozohoz nincs kapcsolt fiok.`);
      } else {
        setStatusMessage(`A ${MONTHS_HU[month - 1]} ${year}. havi beosztas publikalva lett. Ertesites elkuldve minden erintett dolgozonak.`);
      }
      await loadData();
      return { success: true };
    } catch (error) {
      console.error('Publish schedules error:', error);
      const msg = error.message || 'Nem sikerült publikálni a beosztásokat.';
      setStatusError(msg);
      return { success: false, blockingErrors: [{ message: msg }] };
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoFixSchedules(blockingErrors) {
    if (!user || !blockingErrors?.length) return { fixed: 0 };
    setSaving(true);
    let fixedCount = 0;
    try {
      const LEGAL_MAX_DAILY = 12; // Hungarian labor law
      const LEGAL_MAX_WEEKLY = 48;

      // Helper: "HH:MM" → minutes
      const toMins = (t) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      // minutes → "HH:MM" (clamp to 24h)
      const toTime = (mins) => {
        const clamped = Math.min(Math.max(0, mins), 24 * 60);
        return `${String(Math.floor(clamped / 60)).padStart(2,'0')}:${String(clamped % 60).padStart(2,'0')}`;
      };
      // Shift duration in hours (handles overnight)
      const durHours = (start, end) => {
        const s = toMins(start), e = toMins(end);
        return e > s ? (e - s) / 60 : (24 * 60 - s + e) / 60;
      };

      // Preference lookup: employeeId|date → best matching preference entry
      const prefByEmpDate = new Map();
      for (const pref of schedulePreferences) {
        if (pref.status === 'deleted') continue;
        const key = `${pref.employeeId}|${pref.date}`;
        if (!prefByEmpDate.has(key)) prefByEmpDate.set(key, pref);
      }

      // Employee config lookup
      const empById = new Map(activeEmployees.map(e => [e.id, e]));

      // Categorise blocking errors
      const dailyOverflow = new Set();   // employeeId|date
      const doubleShiftSet = new Set();  // employeeId|date
      const timeOffSet = new Set();      // employeeId|date
      const weeklyOverflow = new Set();  // employeeId|weekStartDate

      for (const err of blockingErrors) {
        if ((err.code === 'max_daily_hours' || err.code === 'legal_max_daily_hours') && err.employeeId && err.date)
          dailyOverflow.add(`${err.employeeId}|${err.date}`);
        else if (err.code === 'double_shift' && err.employeeId && err.date)
          doubleShiftSet.add(`${err.employeeId}|${err.date}`);
        else if (err.code === 'time_off_violation' && err.employeeId && err.date)
          timeOffSet.add(`${err.employeeId}|${err.date}`);
        else if (err.code === 'legal_weekly_hours_limit' && err.employeeId && err.week)
          weeklyOverflow.add(`${err.employeeId}|${err.week}`);
      }

      // ── 1. Time-off violations: delete the shift (employee is on leave) ──────
      for (const item of activeMonthSchedules) {
        if (item.publishedAt || item.locked) continue;
        const k = `${item.employeeId}|${item.date}`;
        if (timeOffSet.has(k)) {
          await updateDoc(doc(db, 'pharmacySchedules', item.id), { status: 'deleted', updatedAt: serverTimestamp() });
          fixedCount++;
        }
      }

      // ── 2. Double shifts: keep the one matching employee preference, delete rest ──
      for (const k of doubleShiftSet) {
        const [empId, dateKey] = k.split('|');
        const shifts = activeMonthSchedules.filter(s =>
          s.employeeId === empId && s.date === dateKey && !s.publishedAt && !s.locked && s.status !== 'deleted'
        );
        if (shifts.length <= 1) continue;
        const pref = prefByEmpDate.get(k);
        let keepId;
        if (pref) {
          // Prefer the shift whose shiftType or times match the employee's request
          const byType = shifts.find(s => s.shiftType === pref.shiftType);
          const byTime = shifts.find(s => s.startTime === pref.startTime && s.endTime === pref.endTime);
          keepId = (byTime || byType || shifts[0]).id;
        } else {
          // Keep the first non-midnight shift (likely intentional)
          const nonMidnight = shifts.find(s => !(s.startTime === '00:00' && s.endTime === '00:00'));
          keepId = (nonMidnight || shifts[0]).id;
        }
        for (const s of shifts) {
          if (s.id !== keepId) {
            await updateDoc(doc(db, 'pharmacySchedules', s.id), { status: 'deleted', updatedAt: serverTimestamp() });
            fixedCount++;
          }
        }
      }

      // ── 3. Daily hour overflows: adjust times to fit within legal max ─────────
      // Re-fetch after deletions above
      const freshSnapshots = activeMonthSchedules.filter(s => s.status !== 'deleted' && !s.publishedAt && !s.locked);
      for (const item of freshSnapshots) {
        const k = `${item.employeeId}|${item.date}`;
        if (!dailyOverflow.has(k)) continue;

        const emp = empById.get(item.employeeId);
        const maxH = Math.min(emp?.maxDailyHours ?? LEGAL_MAX_DAILY, LEGAL_MAX_DAILY);
        const pref = prefByEmpDate.get(k);

        let newStart, newEnd;

        if (pref?.startTime && pref?.endTime) {
          // Employee requested specific times – honour them if they fit, otherwise clip end
          if (durHours(pref.startTime, pref.endTime) <= maxH) {
            newStart = pref.startTime;
            newEnd = pref.endTime;
          } else {
            newStart = pref.startTime;
            newEnd = toTime(toMins(pref.startTime) + maxH * 60);
          }
        } else if (item.startTime && item.startTime !== '00:00') {
          // Keep employee's start time, clip end to legal max
          newStart = item.startTime;
          newEnd = toTime(toMins(item.startTime) + maxH * 60);
        } else {
          // Midnight placeholder → use standard day shift
          newStart = '08:00';
          newEnd = toTime(8 * 60 + maxH * 60);
        }

        await updateDoc(doc(db, 'pharmacySchedules', item.id), {
          startTime: newStart,
          endTime: newEnd,
          updatedAt: serverTimestamp(),
        });
        fixedCount++;
      }

      // ── 4. Weekly hour overflows: remove least-preferred shifts that week ──────
      if (weeklyOverflow.size > 0) {
        const isoWeekStart = (dateStr) => {
          const d = new Date(dateStr);
          const day = d.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          d.setDate(d.getDate() + diff);
          return d.toISOString().slice(0, 10);
        };

        for (const wk of weeklyOverflow) {
          const [empId, weekKey] = wk.split('|');
          const emp = empById.get(empId);
          const maxW = Math.min(emp?.weeklyHoursLimit ?? LEGAL_MAX_WEEKLY, LEGAL_MAX_WEEKLY);

          const weekShifts = activeMonthSchedules.filter(s =>
            s.employeeId === empId && !s.publishedAt && !s.locked && s.status !== 'deleted' &&
            isoWeekStart(s.date) === weekKey
          ).sort((a, b) => {
            // Non-preferred days first → those get removed first
            const aP = prefByEmpDate.has(`${empId}|${a.date}`);
            const bP = prefByEmpDate.has(`${empId}|${b.date}`);
            if (aP !== bP) return aP ? 1 : -1;
            return a.date.localeCompare(b.date);
          });

          let totalH = weekShifts.reduce((sum, s) => sum + durHours(s.startTime, s.endTime), 0);
          for (const s of weekShifts) {
            if (totalH <= maxW) break;
            const h = durHours(s.startTime, s.endTime);
            await updateDoc(doc(db, 'pharmacySchedules', s.id), { status: 'deleted', updatedAt: serverTimestamp() });
            totalH -= h;
            fixedCount++;
          }
        }
      }

      await loadData();
      return { fixed: fixedCount };
    } catch (err) {
      console.error('AutoFix error:', err);
      return { fixed: fixedCount };
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPreviousMonth() {
    if (!user) return;

    const { year: previousYear, month: previousMonth } = getPreviousMonth(year, month);
    const confirmed = window.confirm(`Átmásoljam a ${MONTHS_HU[previousMonth - 1]} ${previousYear}. havi beosztásokat erre a hónapra?`);
    if (!confirmed) return;

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const previousSnapshot = await getDocs(
        query(
          collection(db, 'pharmacySchedules'),
          where('pharmacyId', '==', user.uid),
          where('year', '==', previousYear),
          where('month', '==', previousMonth)
        )
      );

      const currentSet = new Set(activeMonthSchedules.map(item => `${item.day}|${item.startTime}|${item.endTime}|${item.employeeId}`));
      const targetMonthDays = getDaysInMonth(year, month);
      let created = 0;

      for (const docItem of previousSnapshot.docs) {
        const item = docItem.data();
        if (item.status === 'deleted') continue;
        const targetDay = Number(item.day || String(item.date || '').split('-')[2]);
        if (!targetDay || targetDay > targetMonthDays) continue;

        const dedupeKey = `${targetDay}|${item.startTime}|${item.endTime}|${item.employeeId}`;
        if (currentSet.has(dedupeKey)) continue;

        await addDoc(collection(db, 'pharmacySchedules'), {
          pharmacyId: user.uid,
          pharmacyName: userData?.pharmacyName || userData?.name || user.email,
          date: formatDateKey(year, month, targetDay),
          year,
          month,
          day: targetDay,
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          employeeEmail: item.employeeEmail || '',
          linkedUserId: item.linkedUserId || null,
          role: item.role || 'other',
          startTime: item.startTime,
          endTime: item.endTime,
          notes: item.notes ? `${item.notes} | Másolva előző hónapból` : 'Másolva előző hónapból',
          status: 'active',
          createdBy: user.uid,
          planningSource: 'copied-previous-month',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        currentSet.add(dedupeKey);
        created += 1;
      }

      setStatusMessage(`${created} műszak átmásolva az előző hónapból.`);
      await loadData();
    } catch (error) {
      console.error('Copy previous month schedules error:', error);
      setStatusError('Nem sikerült átmásolni az előző havi beosztást.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportSchedules() {
    if (activeMonthSchedules.length === 0) {
      setStatusError('Nincs exportálható beosztás a kiválasztott hónapban.');
      return;
    }

    const header = ['Datum', 'Tol', 'Ig', 'Dolgozo', 'Email', 'Szerepkor', 'Publikalva', 'Forras', 'Megjegyzes'];
    const rows = activeMonthSchedules.map(item => ([
      item.date,
      item.startTime,
      item.endTime,
      item.employeeName,
      item.employeeEmail || '',
      prettyRole(item.role),
      item.publishedAt ? 'igen' : 'nem',
      item.planningSource || item.source || 'manual',
      item.notes || '',
    ].map(escapeCsvValue).join(',')));

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `beosztas-${year}-${String(month).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage('CSV export elkészült.');
  }

  const topTabs = isPharmacy
    ? [
        { key: 'schedule', label: 'Beosztás', fullLabel: 'Beosztások kezelése' },
        { key: 'workers', label: 'Dolgozók', fullLabel: 'Dolgozók kezelése' },
      ]
    : [
        { key: 'mine', label: 'Beosztásom' },
        { key: 'planner', label: 'Beosztás-tervező' },
        { key: 'vacations', label: 'Szabadságolások' },
        { key: 'preferences', label: 'Preferenciák' },
      ];

  const visibleSchedules = schedules.filter(item => item.status !== 'deleted');

  const pendingVacationRequests = vacationRequests
    .filter(item => item.status === 'pending')
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  useEffect(() => {
    const source = userData?.schedulePlanningConfigDraft || userData?.schedulePlanningConfig;
    const normalized = normalizePlanningConfig(source);
    setPlannerConfigForm(normalized);
    setPlannerLastSavedJson(JSON.stringify(normalized));
  }, [userData?.schedulePlanningConfig, userData?.schedulePlanningConfigDraft]);

  useEffect(() => {
    if (!user?.uid || !showCriteriaPage) return;
    const normalized = normalizePlanningConfig(plannerConfigForm);
    const currentJson = JSON.stringify(normalized);
    if (!currentJson || currentJson === plannerLastSavedJson) return;

    const timer = setTimeout(async () => {
      try {
        setPlannerDraftSaving(true);
        await updateDoc(doc(db, 'users', user.uid), {
          schedulePlanningConfigDraft: normalized,
          schedulePlanningConfigDraftUpdatedAt: serverTimestamp(),
        });
        setPlannerLastSavedJson(currentJson);
        setPlannerDraftSavedAt(new Date());
      } catch (error) {
        console.error('Planner draft autosave error:', error);
      } finally {
        setPlannerDraftSaving(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [plannerConfigForm, plannerLastSavedJson, showCriteriaPage, user?.uid]);

  useEffect(() => {
    const rec = ownEmployeeRecords[0];
    if (!rec) return;
    setPreferencesForm({
      avoidWeekdays: Array.isArray(rec.avoidWeekdays) ? rec.avoidWeekdays : [],
      preferWeekdays: Array.isArray(rec.preferWeekdays) ? rec.preferWeekdays : [],
      preferredShiftType: rec.preferredShiftType || 'any',
      preferredWeekend: rec.preferredWeekend || 'neutral',
      preferredNight: rec.preferredNight || 'neutral',
      canWorkWeekends: rec.canWorkWeekends !== false,
      canWorkNight: rec.canWorkNight !== false,
      targetWeeklyHours: rec.targetWeeklyHours || 40,
      schedulingNotes: rec.schedulingNotes || '',
    });
  }, [ownEmployeeRecords]);

  function updateShiftTemplate(index, patch) {
    setPlannerConfigForm(prev => ({
      ...prev,
      shiftTemplates: prev.shiftTemplates.map((item, idx) => idx === index ? { ...item, ...patch } : item),
    }));
  }

  function updateOpeningHoursDay(day, patch) {
    setPlannerConfigForm((prev) => ({
      ...prev,
      operations: {
        ...(prev.operations || {}),
        openingHoursByWeekday: {
          ...((prev.operations || {}).openingHoursByWeekday || {}),
          [day]: {
            ...(((prev.operations || {}).openingHoursByWeekday || {})[day] || {}),
            ...patch,
          },
        },
      },
    }));
  }

  function toggleOnCallDay(day) {
    setPlannerConfigForm((prev) => {
      const current = Array.isArray(prev.operations?.onCall?.days) ? prev.operations.onCall.days : [];
      const nextDays = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
      return {
        ...prev,
        operations: {
          ...(prev.operations || {}),
          onCall: {
            ...((prev.operations || {}).onCall || {}),
            days: nextDays.sort((a, b) => a - b),
          },
        },
      };
    });
  }

  function toggleWeekdayPreference(dayNum) {
    setPreferencesForm((prev) => {
      const isAvoid = prev.avoidWeekdays.includes(dayNum);
      const isPrefer = prev.preferWeekdays.includes(dayNum);
      if (!isAvoid && !isPrefer) {
        return { ...prev, preferWeekdays: [...prev.preferWeekdays, dayNum] };
      }
      if (isPrefer) {
        return {
          ...prev,
          preferWeekdays: prev.preferWeekdays.filter((d) => d !== dayNum),
          avoidWeekdays: [...prev.avoidWeekdays, dayNum],
        };
      }
      return { ...prev, avoidWeekdays: prev.avoidWeekdays.filter((d) => d !== dayNum) };
    });
  }

  async function handleSavePreferences() {
    if (ownEmployeeRecords.length === 0) {
      setStatusError('Ehhez a fiókhoz nincs kapcsolt dolgozói rekord.');
      return;
    }
    setPreferencesSaving(true);
    setStatusError('');
    setStatusMessage('');
    try {
      const payload = {
        avoidWeekdays: preferencesForm.avoidWeekdays,
        preferWeekdays: preferencesForm.preferWeekdays,
        preferredShiftType: preferencesForm.preferredShiftType,
        preferredWeekend: preferencesForm.preferredWeekend,
        preferredNight: preferencesForm.preferredNight,
        canWorkWeekends: preferencesForm.canWorkWeekends,
        canWorkNight: preferencesForm.canWorkNight,
        targetWeeklyHours: Number(preferencesForm.targetWeeklyHours || 40),
        schedulingNotes: String(preferencesForm.schedulingNotes || '').trim(),
        updatedAt: serverTimestamp(),
      };
      for (const rec of ownEmployeeRecords) {
        await updateDoc(doc(db, 'pharmacyEmployees', rec.id), payload);
      }
      setStatusMessage('Preferenciák mentve. A következő automatikus tervezésnél figyelembe lesznek véve.');
      await loadData();
    } catch (error) {
      console.error('Save preferences error:', error);
      setStatusError('Nem sikerült menteni a preferenciákat.');
    } finally {
      setPreferencesSaving(false);
    }
  }

  function getWeekdayState(dayNum) {
    if (preferencesForm.avoidWeekdays.includes(dayNum)) return 'avoid';
    if (preferencesForm.preferWeekdays.includes(dayNum)) return 'prefer';
    return 'neutral';
  }

  function addShiftTemplate() {
    setPlannerConfigForm(prev => ({
      ...prev,
      shiftTemplates: [
        ...prev.shiftTemplates,
        { key: `shift-${prev.shiftTemplates.length + 1}`, startTime: '20:00', endTime: '08:00', requiredStaff: 1, requiredPharmacists: 1, onCall: false },
      ],
    }));
  }

  function removeShiftTemplate(index) {
    setPlannerConfigForm(prev => ({
      ...prev,
      shiftTemplates: prev.shiftTemplates.filter((_, idx) => idx !== index),
    }));
  }

  async function savePlannerConfig() {
    if (!user) return;
    setPlannerConfigSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const normalized = normalizePlanningConfig(plannerConfigForm);
      await updateDoc(doc(db, 'users', user.uid), {
        schedulePlanningConfig: normalized,
        schedulePlanningConfigUpdatedAt: serverTimestamp(),
        schedulePlanningConfigDraft: null,
        schedulePlanningConfigDraftUpdatedAt: serverTimestamp(),
      });
      setPlannerConfigForm(normalized);
      setPlannerLastSavedJson(JSON.stringify(normalized));
      setStatusMessage('Tervezési szabályok mentve.');
    } catch (error) {
      console.error('Save planner config error:', error);
      setStatusError('Nem sikerült menteni a tervezési szabályokat.');
    } finally {
      setPlannerConfigSaving(false);
    }
  }

  async function runAutoPlanner({ action = 'plan', sickEmployeeId = null, affectedDates = [] } = {}) {
    if (!user) return;
    setPlannerLoading(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pharmagister/schedule-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employees: activeEmployees,
          schedules,
          vacationRequests,
          year,
          month,
          config: normalizePlanningConfig(plannerConfigForm),
          action,
          sickEmployeeId,
          affectedDates,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Automatikus tervezési hiba történt.');
      }

      setPlannerResult(result);
      const errorCount = (result.conflicts || []).filter(item => item.severity === 'error').length;
      const warningCount = (result.conflicts || []).filter(item => item.severity === 'warning').length;
      setStatusMessage(`Automatikus tervezés kész: ${result.proposedShifts?.length || 0} javasolt műszak, ${errorCount} piros, ${warningCount} narancs jelzés.`);
    } catch (error) {
      console.error('Auto planner error:', error);
      setStatusError(error.message || 'Nem sikerült lefuttatni az automatikus tervezést.');
    } finally {
      setPlannerLoading(false);
    }
  }

  function getMonthDatesByWeekday(targetWeekdayIndex) {
    const days = getDaysInMonth(year, month);
    const out = [];
    for (let d = 1; d <= days; d += 1) {
      const dt = new Date(year, month - 1, d);
      if (dt.getDay() === targetWeekdayIndex) out.push(formatDateKey(year, month, d));
    }
    return out;
  }

  function expandDateRange(startDate, endDate) {
    const start = new Date(`${startDate || ''}T00:00:00`);
    const end = new Date(`${endDate || startDate || ''}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const dates = [];
    const cursor = new Date(start.getTime());
    while (cursor <= end) {
      dates.push(formatDateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function buildOwnVacationDateSet() {
    const ownEmpIds = new Set(ownEmployeeRecords.map((item) => item.id));
    const ownEmail = normalizeEmail(user?.email);
    const set = new Set();

    for (const req of vacationRequests || []) {
      const status = String(req.status || '').toLowerCase();
      if (!['accepted', 'pending', 'approved'].includes(status)) continue;

      const isOwn = req.userId === user?.uid
        || ownEmpIds.has(req.employeeId)
        || normalizeEmail(req.employeeEmail) === ownEmail;
      if (!isOwn) continue;

      const dates = expandDateRange(req.startDate, req.endDate || req.startDate);
      dates.forEach((d) => set.add(d));
    }
    return set;
  }

  function formatHuDate(dateKey) {
    const dt = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return dateKey;
    return dt.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' });
  }

  function getLocalBettiPersonalReply(text) {
    if (isPharmacy) return { handled: false };

    const norm = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const ownMonthShifts = ownSchedules
      .filter((s) => s.year === year && s.month === month && s.status !== 'deleted')
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

    const ownVacationDates = buildOwnVacationDateSet();

    if (/(beosztast szeretnek irni|beosztast irni|tervezetet irok)/.test(norm)) {
      setMainTab('planner');
      setPreferenceCalendarOpen(true);
      return {
        handled: true,
        reply: 'Atviszlek a Beosztas-tervezo fulre. Ott napra bontva be tudod jelolni, mikor szeretnel dolgozni vagy szabadsagon lenni.',
      };
    }

    if (/(mikor dolgozom|beosztasom|mikor vagyok beosztva|mikor dolgozok)/.test(norm)) {
      const nextShifts = ownMonthShifts.filter((s) => s.date >= today).slice(0, 6);
      if (nextShifts.length === 0) {
        return { handled: true, reply: 'A kivalasztott idoszakban nincs publikalt vagy rogzitett muszakod.' };
      }
      const lines = nextShifts.map((s) => `${formatHuDate(s.date)}: ${s.startTime}-${s.endTime}`);
      return { handled: true, reply: `A kovetkezo muszakjaid:\n- ${lines.join('\n- ')}` };
    }

    if (/(mikor vagyok szabin|szabin leszek|szabadsag|szabi)/.test(norm)) {
      const nextVac = [...ownVacationDates].filter((d) => d >= today).sort().slice(0, 8);
      if (nextVac.length === 0) {
        return { handled: true, reply: 'Jelenleg nincs jovahagyott vagy fuggoben levo szabadsagod a rendszerben.' };
      }
      return { handled: true, reply: `Szabadsag napjaid: ${nextVac.map(formatHuDate).join(', ')}` };
    }

    if (/(mikor vagyok szabadnapos|szabadnapos|szabadnap|mikor vagyok szabad)/.test(norm)) {
      const freeDays = [];
      const monthDays = getDaysInMonth(year, month);
      for (let d = 1; d <= monthDays; d += 1) {
        const dateKey = formatDateKey(year, month, d);
        if (dateKey < today) continue;
        const hasShift = ownMonthShifts.some((s) => s.date === dateKey);
        const onVacation = ownVacationDates.has(dateKey);
        if (!hasShift && !onVacation) freeDays.push(dateKey);
        if (freeDays.length >= 8) break;
      }

      if (freeDays.length === 0) {
        return { handled: true, reply: 'A kovetkezo idoszakban nem latok tiszta szabadnapot ebben a honapban.' };
      }
      return { handled: true, reply: `Kovetkezo szabadnapjaid: ${freeDays.map(formatHuDate).join(', ')}` };
    }

    return { handled: false };
  }

  async function handleBettiAction(action, entities = {}) {
    if (action === 'replan_all') {
      await runAutoPlanner({ action: 'plan' });
      return;
    }

    if (action === 'replan_specific_day') {
      const weekdayIndex = entities?.weekday?.weekdayIndex;
      const dates = Number.isInteger(weekdayIndex)
        ? getMonthDatesByWeekday(weekdayIndex)
        : [selectedDate];
      await runAutoPlanner({ action: 'replan', affectedDates: dates });
      return;
    }

    if (action === 'find_replacement') {
      await runAutoPlanner({ action: 'replan', affectedDates: [selectedDate] });
      return;
    }

    if (action === 'show_overtime') {
      const overtimeRows = (plannerResult?.stats?.employees || [])
        .filter((item) => Number(item.overtimeHours || 0) > 0)
        .sort((a, b) => Number(b.overtimeHours || 0) - Number(a.overtimeHours || 0))
        .slice(0, 5);
      const text = overtimeRows.length > 0
        ? `Tulorasok: ${overtimeRows.map((item) => `${item.name} (${item.overtimeHours}h)`).join(', ')}`
        : 'Jelenleg nincs olyan dolgozo, aki tuloraban lenne.';
      setBettiChatMessages((prev) => [...prev, { role: 'assistant', text }]);
      return;
    }

    if (action === 'optimize_fairness' || action === 'optimize_overtime' || action === 'minimal_change_replan') {
      await runAutoPlanner({ action: 'plan' });
      return;
    }
  }

  async function sendBettiChatMessage(messageText) {
    const text = String(messageText || '').trim();
    if (!text || !user) return;

    // Check if this is a training input (starts with "xx ")
    const isTrainingInput = text.startsWith('xx ') || text.startsWith('XX ');
    
    // Get the PREVIOUS user message (for training context)
    // If training input, we need the question that prompted this training
    let lastUserQuestion = text;
    if (isTrainingInput) {
      // Find the last user message BEFORE this training input
      for (let i = bettiChatMessages.length - 1; i >= 0; i--) {
        if (bettiChatMessages[i].role === 'user') {
          lastUserQuestion = bettiChatMessages[i].text;
          break;
        }
      }
    }
    
    // Get the intent of the last Betti message (for training context)
    const previousMessage = bettiChatMessages[bettiChatMessages.length - 1];
    const previousMessageIntent = previousMessage?.role === 'assistant' 
      ? previousMessage?.intent 
      : undefined;

    setBettiChatMessages((prev) => [...prev, { role: 'user', text }]);
    setBettiChatInput('');
    setBettiChatLoading(true);

    try {
      const localReply = getLocalBettiPersonalReply(text);
      if (localReply.handled) {
        setBettiChatMessages((prev) => [...prev, { role: 'assistant', text: localReply.reply, intent: 'local_reply' }]);
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/pharmagister/schedule-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          previousMessageIntent,
          context: {
            stats: plannerResult?.stats || null,
            conflicts: plannerResult?.conflicts || [],
            assignmentReasons: plannerResult?.assignmentReasons || [],
            lastUserMessage: lastUserQuestion,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Betti most nem elerheto.');
      }

      setBettiChatMessages((prev) => [...prev, { role: 'assistant', text: result.reply || 'Rendben, rajta vagyok.', intent: result.intent }]);
      setBettiQuickActions(Array.isArray(result.quickActions) ? result.quickActions : []);

      if (result?.payload?.action) {
        await handleBettiAction(result.payload.action, result.payload.entities || {});
      }
    } catch (error) {
      setBettiChatMessages((prev) => [...prev, { role: 'assistant', text: error.message || 'Betti: Nem sikerult ertelmezni a kerdest.', intent: 'error' }]);
    } finally {
      setBettiChatLoading(false);
    }
  }

  function renderBettiMessageBanners(limit = 10) {
    const visibleMessages = bettiChatMessages.slice(-limit);

    if (visibleMessages.length === 0) {
      return (
        <div className={`text-sm leading-relaxed rounded-2xl border px-4 py-3 ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
          Betti: Szia! Kerdezz nyugodtan, segitek a beosztassal kapcsolatban.
        </div>
      );
    }

    return visibleMessages.map((msg, index) => {
      const isUser = msg.role === 'user';
      return (
        <div key={`${msg.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[96%] sm:max-w-[90%] relative ${isUser ? 'mr-1' : 'ml-1'}`}>
            <div
              className={`absolute top-5 h-0 w-0 border-y-[7px] border-y-transparent ${isUser
                ? `right-[-7px] border-l-[7px] ${darkMode ? 'border-l-sky-700' : 'border-l-sky-100'}`
                : `left-[-7px] border-r-[7px] ${darkMode ? 'border-r-gray-700' : 'border-r-white'}`}`}
            />
            <div
              className={`whitespace-pre-line text-sm leading-relaxed rounded-3xl border px-4 py-3 shadow-md ${isUser
                ? (darkMode ? 'border-sky-600 bg-sky-700/80 text-sky-100' : 'border-sky-200 bg-sky-100 text-sky-800')
                : (darkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-200 bg-white text-gray-700')}`}
            >
              {msg.text}
            </div>
            <p className={`mt-1.5 text-[11px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isUser ? 'Te' : 'Betti'}
            </p>
          </div>
        </div>
      );
    });
  }

  function getBettiPresetQuestions() {
    if (isPharmacy || showCriteriaPage) {
      return [
        'Mutasd a tulorasokat',
        'Tervezd ujra csak a hetfot',
        'Ki tudna atvenni a holnapi estet?',
      ];
    }
    return [
      'Mikor dolgozom?',
      'Mikor vagyok szabin?',
      'Mikor vagyok szabadnapos?',
      'Beosztast szeretnek irni',
    ];
  }

  // Intelligens generálás + azonnali mentés egylépésben (a dashboard "Generálás" gomb)
  async function generateAndApplySchedule() {
    if (!user) return;
    setPlannerLoading(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/pharmagister/schedule-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employees: activeEmployees,
          schedules,
          vacationRequests,
          year,
          month,
          config: normalizePlanningConfig(plannerConfigForm),
          action: 'plan',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Automatikus tervezési hiba történt.');
      }

      const proposed = result.proposedShifts || [];
      if (proposed.length === 0) {
        setStatusMessage('Az automatikus tervező nem javasolt új műszakot (lehet már minden nap ki van töltve).');
        return;
      }

      // Meglévő műszakok dedup key-jei
      const existingSet = new Set(
        schedules
          .filter(item => item.status !== 'deleted')
          .map(item => `${item.date}|${item.startTime}|${item.endTime}|${item.employeeId}`)
      );
      const employeeMap = new Map(activeEmployees.map(item => [item.id, item]));
      const pharmacyName = userData?.pharmacyName || userData?.name || user.email;

      let created = 0;
      for (const item of proposed) {
        const dedupeKey = `${item.date}|${item.startTime}|${item.endTime}|${item.employeeId}`;
        if (existingSet.has(dedupeKey)) continue;
        const employee = employeeMap.get(item.employeeId);
        await addDoc(collection(db, 'pharmacySchedules'), {
          pharmacyId: user.uid,
          pharmacyName,
          date: item.date,
          year,
          month,
          day: Number(item.date.split('-')[2]),
          employeeId: item.employeeId,
          employeeName: item.employeeName || employee?.name || 'Ismeretlen dolgozó',
          employeeEmail: item.employeeEmail || employee?.email || '',
          linkedUserId: item.linkedUserId || employee?.linkedUserId || null,
          role: item.role || employee?.role || 'other',
          startTime: item.startTime,
          endTime: item.endTime,
          onCall: Boolean(item.onCall),
          notes: 'Automatikus tervezés (AI)',
          locked: false,
          status: 'active',
          createdBy: user.uid,
          planningSource: 'auto-planner',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        existingSet.add(dedupeKey);
        created++;
      }

      const errorCount = (result.conflicts || []).filter(c => c.severity === 'error').length;
      const warningCount = (result.conflicts || []).filter(c => c.severity === 'warning').length;
      setStatusMessage(
        `✅ Intelligens beosztás generálva: ${created} műszak mentve` +
        (errorCount ? `, ${errorCount} piros figyelmeztetés` : '') +
        (warningCount ? `, ${warningCount} narancs figyelmeztetés` : '') +
        '.'
      );
      setPlannerResult(result);
      await loadData();
    } catch (error) {
      console.error('generateAndApply error:', error);
      setStatusError(error.message || 'Nem sikerült lefuttatni az automatikus tervezést.');
    } finally {
      setPlannerLoading(false);
    }
  }

  async function handleApplyPlannerResult() {
    if (!plannerResult?.proposedShifts?.length) {
      setStatusError('Nincs alkalmazható javasolt műszak.');
      return;
    }

    setApplyingPlanner(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const existingSet = new Set(
        schedules
          .filter(item => item.status !== 'deleted')
          .map(item => `${item.date}|${item.startTime}|${item.endTime}|${item.employeeId}`)
      );

      const employeeMap = new Map(activeEmployees.map(item => [item.id, item]));
      const pharmacyName = userData?.pharmacyName || userData?.name || user.email;

      let created = 0;
      for (const item of plannerResult.proposedShifts) {
        const dedupeKey = `${item.date}|${item.startTime}|${item.endTime}|${item.employeeId}`;
        if (existingSet.has(dedupeKey)) continue;

        const employee = employeeMap.get(item.employeeId);
        await addDoc(collection(db, 'pharmacySchedules'), {
          pharmacyId: user.uid,
          pharmacyName,
          date: item.date,
          year,
          month,
          day: Number(item.date.split('-')[2]),
          employeeId: item.employeeId,
          employeeName: item.employeeName || employee?.name || 'Ismeretlen dolgozó',
          employeeEmail: item.employeeEmail || employee?.email || '',
          linkedUserId: item.linkedUserId || employee?.linkedUserId || null,
          role: item.role || employee?.role || 'other',
          startTime: item.startTime,
          endTime: item.endTime,
          onCall: Boolean(item.onCall),
          notes: 'Automatikus tervezés (AI)',
          locked: false,
          status: 'active',
          createdBy: user.uid,
          planningSource: 'auto-planner',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        existingSet.add(dedupeKey);
        created += 1;
      }

      setStatusMessage(`Automatikus terv alkalmazva: ${created} új műszak mentve.`);
      setPlannerResult(null);
      await loadData();
    } catch (error) {
      console.error('Apply planner result error:', error);
      setStatusError('Nem sikerült alkalmazni az automatikus tervet.');
    } finally {
      setApplyingPlanner(false);
    }
  }

  function getConflictStyles(severity) {
    if (severity === 'error') return 'border-red-200 bg-red-50 text-red-800';
    if (severity === 'warning') return 'border-orange-200 bg-orange-50 text-orange-800';
    if (severity === 'info') return 'border-blue-200 bg-blue-50 text-blue-800';
    return 'border-green-200 bg-green-50 text-green-800';
  }

  function getConflictIcon(severity) {
    if (severity === 'error') return <ShieldAlert className="h-4 w-4" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4" />;
    if (severity === 'info') return <Info className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  }

  const onCallDaysSelected = Array.isArray(plannerConfigForm.operations?.onCall?.days)
    ? plannerConfigForm.operations.onCall.days
    : [];
  const visibleWizardSteps = CRITERIA_WIZARD_STEPS.filter((step) => {
    if ((step.key === 'on_call_days' || step.key === 'on_call_min_pharmacists') && plannerConfigForm.operations?.onCall?.enabled !== true) {
      return false;
    }
    return true;
  });
  const wizardTotal = visibleWizardSteps.length;
  const safeWizardStepIndex = Math.min(plannerWizardStep, Math.max(0, wizardTotal - 1));
  const wizardStep = visibleWizardSteps[safeWizardStepIndex] || visibleWizardSteps[0];
  const wizardCompleted = [
    plannerConfigForm.operations?.openingHoursByWeekday?.[0]?.isOpen !== undefined,
    plannerConfigForm.operations?.onCall?.enabled !== undefined,
    (plannerConfigForm.operations?.onCall?.enabled !== true) || onCallDaysSelected.length > 0,
    Number(plannerConfigForm.minPharmacistsPerShift) >= 0,
    Number(plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 0) >= 0,
  ].filter(Boolean).length;
  const wizardCompletedDisplay = Math.min(wizardCompleted, wizardTotal);

  const activePharmacists = activeEmployees.filter((e) => e.role === 'pharmacist').length;
  const weekdayOpenDays = WEEKDAY_DISPLAY.filter(({ day }) => plannerConfigForm.operations?.openingHoursByWeekday?.[day]?.isOpen !== false).length;
  const estimatedDayPharmacistDemand = weekdayOpenDays * Number(plannerConfigForm.minPharmacistsPerShift || 0);
  const estimatedOnCallDemand = plannerConfigForm.operations?.onCall?.enabled
    ? onCallDaysSelected.length * Number(plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 0)
    : 0;
  const contradictionWarnings = [];
  if (plannerConfigForm.operations?.onCall?.enabled && onCallDaysSelected.length === 0) {
    contradictionWarnings.push('Az ügyelet be van kapcsolva, de nincs kiválasztott ügyeleti nap.');
  }
  if (activePharmacists === 0 && (Number(plannerConfigForm.minPharmacistsPerShift || 0) > 0 || estimatedOnCallDemand > 0)) {
    contradictionWarnings.push('A rendszer gyógyszerészt vár el, de jelenleg nincs egyetlen aktív gyógyszerész sem a dolgozók között.');
  }
  if (activePharmacists > 0 && (estimatedDayPharmacistDemand + estimatedOnCallDemand) > activePharmacists * 6) {
    contradictionWarnings.push('A megadott gyógyszerész-igény nagyon magas a jelenlegi létszámhoz képest, várhatóan sok lefedetlen műszak lesz.');
  }
  if (plannerConfigForm.operations?.enforceOpeningHours !== false && plannerConfigForm.operations?.onCall?.enabled && plannerConfigForm.operations?.allowOnCallOutsideOpening === false) {
    contradictionWarnings.push('Az ügyelet aktív, de nyitvatartáson kívüli ügyelet nincs engedélyezve, így az ügyeleti sáv ütközhet a nyitvatartással.');
  }

  const aiSummaryLines = [
    `Normál nyitvatartási napok: ${weekdayOpenDays} nap / hét`,
    `Minimum nappali gyógyszerész igény: ${plannerConfigForm.minPharmacistsPerShift || 0} fő / nyitott nap`,
    plannerConfigForm.operations?.onCall?.enabled
      ? `Ügyelet: ${onCallDaysSelected.length} kijelölt nap, ${plannerConfigForm.operations?.onCall?.startTime || '20:00'}-${plannerConfigForm.operations?.onCall?.endTime || '08:00'}, minimum ${plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 0} gyógyszerész`
      : 'Ügyelet: nincs bekapcsolva',
    `Aktív dolgozók: ${activeEmployees.length} fő, ebből gyógyszerész: ${activePharmacists} fő`,
  ];

  const goWizardPrev = () => setPlannerWizardStep((prev) => Math.max(0, Math.min(safeWizardStepIndex - 1, prev - 1)));
  const goWizardNext = () => setPlannerWizardStep((prev) => Math.min(wizardTotal - 1, Math.max(safeWizardStepIndex + 1, prev + 1)));

  // ── Beosztási alapkritériumok teljes oldal ──────────────────────────────────
  if (showCriteriaPage) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            type="button"
            onClick={() => setShowCriteriaPage(false)}
            className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold text-lg ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            ‹
          </button>
          <div className="flex-1">
            <h2 className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Beosztási alapkritériumok</h2>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ezek alapján ellenőrzi és tervezi a rendszer a beosztásokat</p>
          </div>
          <button
            type="button"
            onClick={savePlannerConfig}
            disabled={plannerConfigSaving}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {plannerConfigSaving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>

        {bettiChatOpen && (
          <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setBettiChatOpen(false)}>
            <div
              className={`absolute inset-x-0 top-0 bottom-0 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <div>
                  <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Betti chat</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Teljes kepernyos beszelgetes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBettiChatOpen(false)}
                  className={`h-9 w-9 rounded-xl text-lg font-bold ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {renderBettiMessageBanners(30)}
              </div>

              <div
                className={`sticky bottom-0 border-t p-3 space-y-2 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}
                style={{
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                  marginBottom: `${Math.max(0, bettiKeyboardInset)}px`,
                }}
              >
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[...getBettiPresetQuestions(), ...bettiQuickActions.slice(0, 3).map((a) => a.label)].slice(0, 6).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendBettiChatMessage(q)}
                      className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${darkMode ? 'bg-sky-800 text-sky-100' : 'bg-sky-100 text-sky-700'}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (bettiChatLoading) return;
                    await sendBettiChatMessage(bettiChatInput);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={bettiChatInput}
                    onChange={(e) => setBettiChatInput(e.target.value)}
                    placeholder="Irj Bettinek..."
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                  <button
                    type="submit"
                    disabled={bettiChatLoading || !bettiChatInput.trim()}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Kuldes
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-5">

          {/* ── Betti kérdés-flow + autosave ───────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-violet-700 bg-violet-900/20' : 'border-violet-200 bg-violet-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-bold ${darkMode ? 'text-violet-200' : 'text-violet-900'}`}>Betti kérdései</p>
              <span className={`text-xs font-semibold rounded-full px-2 py-1 shrink-0 ${darkMode ? 'bg-violet-800 text-violet-100' : 'bg-violet-100 text-violet-800'}`}>
                {wizardCompletedDisplay}/{wizardTotal} kész
              </span>
            </div>

            {contradictionWarnings.length > 0 && (
              <div className={`rounded-xl border px-3 py-3 space-y-2 ${darkMode ? 'border-amber-700 bg-amber-900/20' : 'border-amber-200 bg-amber-50'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Betti észrevételei</p>
                {contradictionWarnings.map((warning, index) => (
                  <div key={index} className={`text-xs ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>
                    {index + 1}. {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Betti bemutatkozás – csak az első lépésnél */}
            {safeWizardStepIndex === 0 && (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl shadow-sm ${darkMode ? 'bg-violet-800' : 'bg-violet-100'}`}>
                    👩‍⚕️
                  </div>
                  <span className={`text-[10px] font-bold ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>Betti</span>
                </div>
                <div className="flex-1 relative">
                  <div className={`absolute left-[-7px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[7px] ${darkMode ? 'border-r-violet-900' : 'border-r-violet-100'}`} />
                  <div className={`rounded-2xl rounded-tl-sm border px-4 py-3 shadow-sm ${darkMode ? 'border-violet-700 bg-violet-900/40' : 'border-violet-200 bg-violet-50'}`}>
                    <p className={`text-sm font-semibold ${darkMode ? 'text-violet-100' : 'text-violet-900'}`}>Szia! Én vagyok Betti 👋</p>
                    <p className={`text-xs mt-1 leading-relaxed ${darkMode ? 'text-violet-200/80' : 'text-violet-800/80'}`}>
                      A Pharmagister beosztástervező asszisztense vagyok. Néhány rövid kérdéssel segítek beállítani a gyógyszertárad működési kritériumait, hogy az automatikus beosztás a legjobban illeszkedjen hozzátok. Minden válasz azonnal mentődik. Kezdjük! 🚀
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Speech bubble from Betti */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl shadow-sm ${darkMode ? 'bg-violet-800' : 'bg-violet-100'}`}>
                  👩‍⚕️
                </div>
                <span className={`text-[10px] font-bold ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>Betti</span>
              </div>
              {/* Bubble */}
              <div className="flex-1 relative">
                <div className={`absolute left-[-7px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[7px] ${darkMode ? 'border-r-gray-800' : 'border-r-white'}`} />
                <div className={`rounded-2xl rounded-tl-sm border px-4 py-3 shadow-sm ${darkMode ? 'border-violet-700 bg-gray-800' : 'border-violet-200 bg-white'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
                    Kérdés {safeWizardStepIndex + 1}/{wizardTotal}
                  </p>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{wizardStep.title}</p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{wizardStep.hint}</p>

                  <div className="mt-3">
                    {wizardStep.key === 'open_sunday' && (
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plannerConfigForm.operations?.openingHoursByWeekday?.[0]?.isOpen !== false}
                          onChange={e => updateOpeningHoursDay(0, { isOpen: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                        <span className={darkMode ? 'text-gray-200' : 'text-gray-700'}>Vasárnap nyitva</span>
                      </label>
                    )}

                    {wizardStep.key === 'on_call_enabled' && (
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plannerConfigForm.operations?.onCall?.enabled === true}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            operations: {
                              ...(prev.operations || {}),
                              onCall: {
                                ...((prev.operations || {}).onCall || {}),
                                enabled: e.target.checked,
                              },
                            },
                          }))}
                          className="h-4 w-4 rounded"
                        />
                        <span className={darkMode ? 'text-gray-200' : 'text-gray-700'}>Van ügyeleti szolgálat</span>
                      </label>
                    )}

                    {wizardStep.key === 'on_call_days' && (
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_DISPLAY.map(({ day, label }) => {
                          const active = onCallDaysSelected.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleOnCallDay(day)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${active ? 'bg-violet-600 border-violet-600 text-white' : darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {wizardStep.key === 'day_min_pharmacists' && (
                      <input
                        type="number"
                        min="0"
                        value={plannerConfigForm.minPharmacistsPerShift}
                        onChange={e => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber }))}
                        className={`w-28 rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      />
                    )}

                    {wizardStep.key === 'on_call_min_pharmacists' && (
                      <input
                        type="number"
                        min="0"
                        value={plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 1}
                        onChange={e => {
                          const val = isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber;
                          setPlannerConfigForm(prev => ({
                            ...prev,
                            operations: {
                              ...(prev.operations || {}),
                              onCall: {
                                ...((prev.operations || {}).onCall || {}),
                                requiredPharmacists: val,
                              },
                            },
                          }));
                        }}
                        className={`w-28 rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      />
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {plannerDraftSaving
                        ? 'Mentés...'
                        : plannerDraftSavedAt
                          ? `Mentve: ${plannerDraftSavedAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Automatikusan mentődik'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={goWizardPrev}
                        disabled={plannerWizardStep === 0}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${darkMode ? 'bg-gray-700 text-gray-200 disabled:opacity-40' : 'bg-gray-200 text-gray-700 disabled:opacity-40'}`}
                      >
                        Előző
                      </button>
                      {safeWizardStepIndex < wizardTotal - 1 ? (
                        <button
                          type="button"
                          onClick={goWizardNext}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Következő
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={savePlannerConfig}
                          disabled={plannerConfigSaving}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {plannerConfigSaving ? 'Mentés...' : 'Kész ✓'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Betti záró üzenet – csak az utolsó lépésnél */}
            {safeWizardStepIndex === wizardTotal - 1 && (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl shadow-sm ${darkMode ? 'bg-violet-800' : 'bg-violet-100'}`}>
                    👩‍⚕️
                  </div>
                  <span className={`text-[10px] font-bold ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>Betti</span>
                </div>
                <div className="flex-1 relative">
                  <div className={`absolute left-[-7px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[7px] ${darkMode ? 'border-r-emerald-900' : 'border-r-emerald-50'}`} />
                  <div className={`rounded-2xl rounded-tl-sm border px-4 py-3 shadow-sm ${darkMode ? 'border-emerald-700 bg-emerald-900/30' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className={`text-sm font-semibold ${darkMode ? 'text-emerald-100' : 'text-emerald-900'}`}>Szuper, minden megvan! 🎉</p>
                    <p className={`text-xs mt-1 leading-relaxed ${darkMode ? 'text-emerald-200/80' : 'text-emerald-800/80'}`}>
                      Összegyűjtöttem a beállításaitokat. Nézd át az összefoglalót, és ha minden rendben, kattints a <strong>Jóváhagyom</strong> gombra – ezek alapján fogom elkészíteni a beosztást. 💊
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={`rounded-xl border px-3 py-3 ${darkMode ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-bold ${darkMode ? 'text-emerald-200' : 'text-emerald-900'}`}>Betti összefoglalója</p>
                  <p className={`text-xs ${darkMode ? 'text-emerald-300/80' : 'text-emerald-700/80'}`}>Ezt fogja használni Betti a beosztás generálásnál.</p>
                </div>
                <button
                  type="button"
                  onClick={savePlannerConfig}
                  disabled={plannerConfigSaving}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {plannerConfigSaving ? 'Jóváhagyás...' : 'Jóváhagyom'}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {aiSummaryLines.map((line, index) => (
                  <div key={index} className={`text-xs rounded-lg px-3 py-2 ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-700'}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-xl border px-3 py-3 space-y-3 ${darkMode ? 'border-sky-700 bg-sky-900/20' : 'border-sky-200 bg-sky-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-bold ${darkMode ? 'text-sky-200' : 'text-sky-900'}`}>Beszelj Bettivel</p>
                  <p className={`text-xs ${darkMode ? 'text-sky-300/80' : 'text-sky-700/80'}`}>Pl.: "Mutasd a tulorasokat" vagy "Tervezd ujra csak a hetfot".</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBettiChatOpen(true)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Chat megnyitasa
                </button>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-sky-800 bg-gray-900' : 'border-sky-200 bg-white'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Teljes kepernyos chat elerheto. Nyisd meg, es kerdezz Bettitol szabad szovegben.
                </p>
              </div>
            </div>
          </div>

          {/* ── Napi létszám ────────────────────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Napi létszám követelmények</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum létszám / nap">
                <input
                  type="number" min="1"
                  value={plannerConfigForm.minStaffPerShift}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, minStaffPerShift: Number(e.target.value || 1) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Min. gyógyszerész / nap">
                <input
                  type="number" min="0"
                  value={plannerConfigForm.minPharmacistsPerShift}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: Number(e.target.value || 0) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Az automatikus terv és az ellenőrzés ennek alapján figyeli a fedettséget.</p>
          </div>

          {/* ── Munkaügyi jog ─────────────────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Magyar munkajogi határok</h3>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={plannerConfigForm.laborLaw?.enforceHungarianLaborLaw !== false}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), enforceHungarianLaborLaw: e.target.checked } }))}
                  className="h-4 w-4 rounded"
                />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Bekapcsolva</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max. napi óra">
                <input type="number" min="1" max="24"
                  value={plannerConfigForm.laborLaw?.maxDailyHoursLegal || 12}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), maxDailyHoursLegal: Number(e.target.value || 12) } }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Max. heti óra">
                <input type="number" min="1" max="80"
                  value={plannerConfigForm.laborLaw?.maxWeeklyHoursLegal || 48}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), maxWeeklyHoursLegal: Number(e.target.value || 48) } }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Min. napi pihenő (óra)">
                <input type="number" min="1" max="24"
                  value={plannerConfigForm.laborLaw?.minDailyRestHoursLegal || 11}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), minDailyRestHoursLegal: Number(e.target.value || 11) } }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Max. éjszakai műszak (óra)">
                <input type="number" min="1" max="24"
                  value={plannerConfigForm.laborLaw?.maxNightShiftHoursLegal || 8}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), maxNightShiftHoursLegal: Number(e.target.value || 8) } }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Kötelező szünet ettől (óra)">
                <input type="number" min="1" max="12"
                  value={plannerConfigForm.laborLaw?.requireBreakAfterHours || 6}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, laborLaw: { ...(prev.laborLaw || {}), requireBreakAfterHours: Number(e.target.value || 6) } }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
            </div>
          </div>

          {/* ── Nyitvatartás + ügyelet ───────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nyitvatartás és ügyelet</h3>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={plannerConfigForm.operations?.enforceOpeningHours !== false}
                  onChange={e => setPlannerConfigForm(prev => ({
                    ...prev,
                    operations: {
                      ...(prev.operations || {}),
                      enforceOpeningHours: e.target.checked,
                    },
                  }))}
                  className="h-4 w-4 rounded"
                />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Nyitvatartás ellenőrzése</span>
              </label>
            </div>

            <div className="space-y-2">
              {WEEKDAY_DISPLAY.map(({ day, fullLabel, label }) => {
                const dayCfg = plannerConfigForm.operations?.openingHoursByWeekday?.[day] || { isOpen: true, openTime: '08:00', closeTime: '20:00' };
                return (
                  <div key={day} className={`rounded-xl border px-3 py-2 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>{label}</div>
                      <p className={`text-sm font-semibold min-w-[92px] ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{fullLabel}</p>
                      <label className="ml-auto flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dayCfg.isOpen !== false}
                          onChange={e => updateOpeningHoursDay(day, { isOpen: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                        <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Nyitva</span>
                      </label>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={dayCfg.openTime || '08:00'}
                        disabled={dayCfg.isOpen === false}
                        onChange={e => updateOpeningHoursDay(day, { openTime: e.target.value })}
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white disabled:opacity-50' : 'bg-white border-gray-300 disabled:opacity-60'}`}
                      />
                      <input
                        type="time"
                        value={dayCfg.closeTime || '20:00'}
                        disabled={dayCfg.isOpen === false}
                        onChange={e => updateOpeningHoursDay(day, { closeTime: e.target.value })}
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white disabled:opacity-50' : 'bg-white border-gray-300 disabled:opacity-60'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`rounded-xl border p-3 space-y-3 ${darkMode ? 'border-violet-700 bg-violet-900/20' : 'border-violet-200 bg-violet-50'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-bold ${darkMode ? 'text-violet-200' : 'text-violet-900'}`}>Ügyeleti sajátosságok</p>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plannerConfigForm.operations?.onCall?.enabled === true}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          enabled: e.target.checked,
                        },
                      },
                    }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Ügyelet van</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Ügyelet kezdés">
                  <input
                    type="time"
                    value={plannerConfigForm.operations?.onCall?.startTime || '20:00'}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          startTime: e.target.value,
                        },
                      },
                    }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </Field>
                <Field label="Ügyelet vége">
                  <input
                    type="time"
                    value={plannerConfigForm.operations?.onCall?.endTime || '08:00'}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          endTime: e.target.value,
                        },
                      },
                    }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </Field>
                <Field label="Ügyelet létszám">
                  <input
                    type="number"
                    min="0"
                    value={plannerConfigForm.operations?.onCall?.requiredStaff ?? 1}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          requiredStaff: Number(e.target.value || 0),
                        },
                      },
                    }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </Field>
                <Field label="Ügyelet gyógyszerész">
                  <input
                    type="number"
                    min="0"
                    value={plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 1}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          requiredPharmacists: Number(e.target.value || 0),
                        },
                      },
                    }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                {WEEKDAY_DISPLAY.map(({ day, label }) => {
                  const active = (plannerConfigForm.operations?.onCall?.days || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleOnCallDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${active ? 'bg-violet-600 border-violet-600 text-white' : darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plannerConfigForm.operations?.allowOnCallOutsideOpening !== false}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        allowOnCallOutsideOpening: e.target.checked,
                      },
                    }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Ügyelet nyitvatartáson kívül engedélyezett</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plannerConfigForm.operations?.onCall?.useAutoTemplate !== false}
                    onChange={e => setPlannerConfigForm(prev => ({
                      ...prev,
                      operations: {
                        ...(prev.operations || {}),
                        onCall: {
                          ...((prev.operations || {}).onCall || {}),
                          useAutoTemplate: e.target.checked,
                        },
                      },
                    }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Automatikus ügyeleti sablon használat</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Műszaksablonok ────────────────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Műszaksablonok</h3>
              <button
                type="button"
                onClick={addShiftTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />Új műszak
              </button>
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Meghatározza, hogy naponta hány ember szükséges az egyes sávokban.</p>
            {plannerConfigForm.shiftTemplates.map((template, index) => (
              <div key={`${template.key}-${index}`} className={`rounded-xl border p-3 space-y-3 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{template.key || `Műszak ${index + 1}`}</p>
                  <button
                    type="button"
                    onClick={() => removeShiftTemplate(index)}
                    disabled={plannerConfigForm.shiftTemplates.length <= 1}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Törlés
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kezdés">
                    <input type="time" value={template.startTime}
                      onChange={e => updateShiftTemplate(index, { startTime: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </Field>
                  <Field label="Befejezés">
                    <input type="time" value={template.endTime}
                      onChange={e => updateShiftTemplate(index, { endTime: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </Field>
                  <Field label="Szükséges létszám">
                    <input type="number" min="1" value={template.requiredStaff}
                      onChange={e => updateShiftTemplate(index, { requiredStaff: Number(e.target.value || 1) })}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </Field>
                  <Field label="Kötelező gyógyszerész">
                    <input type="number" min="0" value={template.requiredPharmacists}
                      onChange={e => updateShiftTemplate(index, { requiredPharmacists: Number(e.target.value || 0) })}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(template.onCall)}
                    onChange={e => updateShiftTemplate(index, { onCall: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Ügyeleti műszak (zárvatartási napon is érvényes)</span>
                </label>
              </div>
            ))}
          </div>

          {/* ── Mit néz a rendszer — összefoglaló ────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Mit ellenőriz a rendszer?</h3>
            {[
              { icon: '🔴', label: 'Napi óratúllépés', desc: `Max ${plannerConfigForm.laborLaw?.maxDailyHoursLegal || 12} óra/nap dolgozónként` },
              { icon: '🔴', label: 'Heti óratúllépés', desc: `Max ${plannerConfigForm.laborLaw?.maxWeeklyHoursLegal || 48} óra/hét dolgozónként` },
              { icon: '🔴', label: 'Nyitvatartási idő sérülés', desc: 'Normál műszak nyitvatartáson kívül nem lehet' },
              { icon: '🔴', label: 'Átfedő műszakok', desc: 'Ugyanaz a dolgozó nem lehet kétszer ugyanazon a napon' },
              { icon: '🔴', label: 'Szabadság sérülés', desc: 'Jóváhagyott szabadság alatt nem lehet beosztva' },
              { icon: '🟡', label: 'Zárvatartási napi műszak', desc: 'Nem ügyeleti műszak zárt napon figyelmeztetést ad' },
              { icon: '🟡', label: 'Heti pihenőnap hiány', desc: 'Hetenként legalább 1 pihenőnap szükséges' },
              { icon: '🟡', label: 'Havi órakeret túllépés', desc: 'Dolgozói havi órakeret figyelése' },
              { icon: '🔵', label: 'Preferencia figyelmen kívül', desc: 'Dolgozó kért napja nem szerepel a beosztásban' },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <span className="flex-shrink-0 text-base">{item.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{item.label}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Save button at bottom */}
          <button
            type="button"
            onClick={async () => { await savePlannerConfig(); setShowCriteriaPage(false); }}
            disabled={plannerConfigSaving}
            className="w-full rounded-2xl bg-violet-600 py-3.5 text-base font-bold text-white disabled:opacity-60"
          >
            {plannerConfigSaving ? 'Mentés...' : 'Mentés és visszatérés'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
          {isPharmacy
            ? (topTabs.find(t => t.key === mainTab)?.fullLabel || topTabs.find(t => t.key === mainTab)?.label)
            : (mainTab === 'mine' ? 'Beosztásom' : mainTab === 'vacations' ? 'Szabadságolások' : mainTab === 'planner' ? 'Beosztás-tervező' : 'Preferenciák')}
        </h2>
        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
          {isPharmacy
            ? (mainTab === 'workers' ? 'Dolgozók hozzáadása, eltávolítása és preferenciáik megtekintése.' : 'Beosztások írása, publikálása és csereigények kezelése.')
            : 'Saját beosztások, csereigények és szabadságigények egy helyen.'}
        </p>
      </div>

      <SegmentedTabs tabs={topTabs} active={mainTab} onChange={setMainTab} />

      {statusMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {statusMessage}
        </div>
      ) : null}

      {statusError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statusError}
        </div>
      ) : null}

      {loading ? (
        <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'border-gray-700 bg-gray-900 text-gray-300' : 'border-[#E5E7EB] bg-white text-[#374151]'}`}>
          Betöltés...
        </div>
      ) : null}

      {!loading && isPharmacy && mainTab === 'workers' ? (
        <div className="space-y-6">
          <SegmentedTabs
            tabs={[
              { key: 'add', label: 'Dolgozó hozzáadása' },
              { key: 'remove', label: 'Dolgozó eltávolítása' },
            ]}
            active={workerTab}
            onChange={setWorkerTab}
          />

          {/* ── Always-visible employee list ─────────────────────────── */}
          <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
            <p className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Aktív dolgozók ({activeEmployees.length})
            </p>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-gray-500">Még nincs aktív dolgozó.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeEmployees.map(employee => {
                  const empPrefs = allPreferences.filter(p =>
                    p.employeeId === employee.id ||
                    (p.linkedUserId && p.linkedUserId === employee.linkedUserId) ||
                    (p.employeeEmail && employee.email && p.employeeEmail.toLowerCase() === employee.email.toLowerCase())
                  );
                  // Group by year-month
                  const byMonth = {};
                  empPrefs.forEach(p => {
                    const key = `${p.year}-${String(p.month).padStart(2,'0')}`;
                    if (!byMonth[key]) byMonth[key] = { year: p.year, month: p.month, entries: [] };
                    byMonth[key].entries.push(p);
                  });
                  const monthKeys = Object.keys(byMonth).sort();
                  const isExpanded = expandedWorker === employee.id;

                  return (
                    <div key={employee.id} className={`rounded-xl border transition-all ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      {/* Card header — clickable */}
                      <button
                        type="button"
                        onClick={() => setExpandedWorker(isExpanded ? null : employee.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${darkMode ? 'bg-violet-900 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
                          {(employee.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{employee.name}</p>
                          <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{employee.email} · {prettyRole(employee.role)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {empPrefs.length > 0 && (
                            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                              {empPrefs.length} preferencia
                            </span>
                          )}
                          {workerTab === 'remove' && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleRemoveEmployee(employee.id); }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Eltávolítás
                            </button>
                          )}
                          <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* Expanded: preferences grouped by month */}
                      {isExpanded && (
                        <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                          {monthKeys.length === 0 ? (
                            <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Még nincs mentett preferencia.</p>
                          ) : monthKeys.map(mk => {
                            const { year: y, month: m, entries } = byMonth[mk];
                            const label = `${MONTHS_HU[m - 1]} ${y}`;
                            const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
                            return (
                              <div key={mk}>
                                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                                <div className="flex flex-col gap-1">
                                  {sorted.map(p => {
                                    const st = getShiftType(p.shiftType || 'N');
                                    const hrs = calcHours(p.startTime, p.endTime);
                                    const dow = new Date(p.year, p.month - 1, p.day || parseInt(p.date.split('-')[2])).getDay();
                                    const DOW_SHORT = ['V','H','K','Sz','Cs','P','Szo'];
                                    return (
                                      <div key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                        <span className={`flex-shrink-0 text-xs font-bold w-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{DOW_SHORT[dow]}</span>
                                        <span className={`flex-shrink-0 text-sm font-semibold tabular-nums w-6 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{p.date.split('-')[2]}.</span>
                                        <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${st.bg} ${st.text}`}>{st.label}</span>
                                        {p.startTime && p.endTime ? (
                                          <span className={`text-xs tabular-nums ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{p.startTime}–{p.endTime}</span>
                                        ) : null}
                                        {hrs ? <span className={`text-xs font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{hrs}</span> : null}
                                        {p.notes ? <span className={`flex-1 text-xs italic truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{p.notes}</span> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Add employee form (only on 'add' tab) ───────────────── */}
          {workerTab === 'add' && (
            <form onSubmit={handleAddEmployee} className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Email cím" required hint="Csak regisztrált Pharmagister email adható meg. A szerepkört automatikusan a profilból vesszük át.">
                  <input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(prev => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" placeholder="nev@email.hu" />
                </Field>
                <Field label="Telefonszám">
                  <input type="text" value={employeeForm.phone} onChange={e => setEmployeeForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
                <Field label="Cím">
                  <input type="text" value={employeeForm.address} onChange={e => setEmployeeForm(prev => ({ ...prev, address: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
                <Field label="Megjegyzés">
                  <input type="text" value={employeeForm.notes} onChange={e => setEmployeeForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 font-medium text-white disabled:opacity-60">
                  <UserPlus className="h-4 w-4" />
                  Dolgozó hozzáadása
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {!loading && ((isPharmacy && mainTab === 'schedule') || !isPharmacy) ? (
        <div className="space-y-6">

          {bettiChatOpen && (
            <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setBettiChatOpen(false)}>
              <div
                className={`absolute inset-x-0 top-0 bottom-0 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                  <div>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Betti chat</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Teljes kepernyos beszelgetes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBettiChatOpen(false)}
                    className={`h-9 w-9 rounded-xl text-lg font-bold ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {renderBettiMessageBanners(30)}
                </div>

                <div
                  className={`sticky bottom-0 border-t p-3 space-y-2 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}
                  style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                    marginBottom: `${Math.max(0, bettiKeyboardInset)}px`,
                  }}
                >
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[...getBettiPresetQuestions(), ...bettiQuickActions.slice(0, 3).map((a) => a.label)].slice(0, 6).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendBettiChatMessage(q)}
                        className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${darkMode ? 'bg-sky-800 text-sky-100' : 'bg-sky-100 text-sky-700'}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (bettiChatLoading) return;
                      await sendBettiChatMessage(bettiChatInput);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={bettiChatInput}
                      onChange={(e) => setBettiChatInput(e.target.value)}
                      placeholder="Irj Bettinek..."
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                    />
                    <button
                      type="submit"
                      disabled={bettiChatLoading || !bettiChatInput.trim()}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Kuldes
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {((isPharmacy && mainTab === 'schedule') || (!isPharmacy && mainTab === 'mine')) && (
            <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-sky-700 bg-sky-900/20' : 'border-sky-200 bg-sky-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-bold ${darkMode ? 'text-sky-200' : 'text-sky-900'}`}>Betti chat</p>
                  <p className={`text-xs ${darkMode ? 'text-sky-300/80' : 'text-sky-700/80'}`}>
                    {isPharmacy
                      ? 'Kerdezhetsz ujratervezesrol, tulorarol, helyettesitesrol.'
                      : 'Kerdezhetsz a sajat muszakjaidrol, szabadsagrol es szabadnapokrol.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBettiChatOpen(true)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Chat megnyitasa
                </button>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-sky-800 bg-gray-900' : 'border-sky-200 bg-white'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Nyisd meg a teljes kepernyos chatet, ahol kenyelmesen tudsz irni Bettinek, es alul azonnali gyors gombokat is kapsz.
                </p>
              </div>
            </div>
          )}

          {/* ── Full-screen pharmacy schedule calendar ─────────────────── */}
          {isPharmacy && mainTab === 'schedule' ? (
            <div className="space-y-4">

              {/* ── Dashboard: hónap navigáció + info egy kártyában ── */}
              {(() => {
                const totalDays = getDaysInMonth(year, month);
                const filledDays = new Set(activeMonthSchedules.filter(s => s.year === year && s.month === month).map(s => s.date)).size;
                const pendingPrefs = schedulePreferences.filter(p => p.year === year && p.month === month && p.status !== 'deleted').length;
                const ignoredPrefs = schedulePreferences.filter(p => {
                  if (p.year !== year || p.month !== month || p.status === 'deleted') return false;
                  return !activeMonthSchedules.some(s => s.date === p.date && (s.employeeId === p.employeeId || s.linkedUserId === p.linkedUserId));
                }).length;
                const isPublished = publishedScheduleCount > 0;
                const goPrev = () => { const p = getPreviousMonth(year, month); setYear(p.year); setMonth(p.month); };
                const goNext = () => { const n = month === 12 ? { year: year+1, month: 1 } : { year, month: month+1 }; setYear(n.year); setMonth(n.month); };
                return (
                  <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'border-violet-800 bg-violet-900/20' : 'border-violet-200 bg-violet-50'}`}>
                    {/* Hónap navigáció fejléc */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-violet-800 bg-violet-900/40' : 'border-violet-200 bg-violet-100'}`}>
                      <button type="button" onClick={goPrev} className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold text-xl ${darkMode ? 'bg-violet-800/60 text-violet-200 hover:bg-violet-700' : 'bg-white text-violet-600 hover:bg-violet-50 shadow-sm border border-violet-200'}`}>‹</button>
                      <span className={`font-bold text-base ${darkMode ? 'text-white' : 'text-violet-800'}`}>{MONTHS_HU[month-1]} {year}</span>
                      <button type="button" onClick={goNext} className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold text-xl ${darkMode ? 'bg-violet-800/60 text-violet-200 hover:bg-violet-700' : 'bg-white text-violet-600 hover:bg-violet-50 shadow-sm border border-violet-200'}`}>›</button>
                    </div>
                    {/* Info adatok */}
                    <div className="p-4 flex flex-wrap gap-x-5 gap-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👥</span>
                        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{activeEmployees.length} dolgozó</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📅</span>
                        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{filledDays}/{totalDays} nap kitöltve</span>
                      </div>
                      {ignoredPrefs > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span className="text-sm font-semibold text-amber-600">{ignoredPrefs} preferencia figyelmen kívül</span>
                        </div>
                      )}
                      {pendingPrefs > 0 && ignoredPrefs === 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💬</span>
                          <span className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{pendingPrefs} dolgozói kérés</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {isPublished
                          ? <><span className="text-lg">✅</span><span className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>Publikálva ({publishedScheduleCount})</span></>
                          : <><span className="text-lg">🔒</span><span className="text-sm font-semibold text-rose-500">Még nem publikált</span></>
                        }
                      </div>
                    </div>
                    {/* Kritériumok gomb */}
                    <div className={`px-4 pb-3 border-t pt-3 ${darkMode ? 'border-violet-800' : 'border-violet-200'}`}>
                      <button
                        type="button"
                        onClick={() => setShowCriteriaPage(true)}
                        className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'bg-violet-900/40 hover:bg-violet-800/60 text-violet-200' : 'bg-violet-100 hover:bg-violet-200 text-violet-700'}`}
                      >
                        <span>⚙️ Beosztási alapkritériumok</span>
                        <span className="text-base">›</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Onboarding checklist (csak ha nincs dolgozó) ─────── */}
              {activeEmployees.length === 0 && (
                <div className={`rounded-2xl border-2 border-dashed p-5 space-y-3 ${darkMode ? 'border-violet-700 bg-violet-900/10' : 'border-violet-300 bg-violet-50'}`}>
                  <p className={`font-bold text-base ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>🚀 Kezdj el beosztást írni!</p>
                  <div className="space-y-2">
                    {[
                      { done: activeEmployees.length > 0, label: 'Adj hozzá legalább egy dolgozót' },
                      { done: activeMonthSchedules.length > 0, label: 'Írj meg egy beosztást (kattints egy hónapra)' },
                      { done: publishedScheduleCount > 0, label: 'Publikáld a beosztást (a dolgozók ekkor látják)' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${item.done ? 'bg-emerald-500 text-white' : darkMode ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-white text-gray-400 border border-gray-300'}`}>
                          {item.done ? '✓' : ''}
                        </span>
                        <span className={`text-sm ${item.done ? 'line-through opacity-50' : darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Smart hints ──────────────────────────────────────── */}
              {(() => {
                const hints = [];
                const daysLeft = getDaysInMonth(year, month) - new Date().getDate();
                const filledDays = new Set(activeMonthSchedules.filter(s => s.year === year && s.month === month).map(s => s.date)).size;
                const ignoredPrefs = schedulePreferences.filter(p => {
                  if (p.year !== year || p.month !== month || p.status === 'deleted') return false;
                  return !activeMonthSchedules.some(s => s.date === p.date && (s.employeeId === p.employeeId || s.linkedUserId === p.linkedUserId));
                }).length;
                if (activeEmployees.length > 0 && filledDays === 0)
                  hints.push('💡 Kattints a hónap nevére a beosztás elkezdéséhez');
                if (ignoredPrefs > 0)
                  hints.push(`💬 ${ignoredPrefs} dolgozói kérés van, amit még nem vettél figyelembe`);
                if (year === thisYear && month === thisMonth && daysLeft < 5 && publishedScheduleCount === 0 && activeMonthSchedules.length > 0)
                  hints.push('⏰ Hamarosan véget ér a hónap — ne feledd publikálni a beosztást!');
                if (hints.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {hints.map((hint, i) => (
                      <div key={i} className={`rounded-xl px-4 py-2.5 text-sm ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{hint}</div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Month picker ─────────────────────────────────────── */}
              {availableYears.map(y => {
                // Current year starts from current month; future years from January
                const startMonth = y === thisYear ? thisMonth : 1;
                const months = MONTHS_HU.slice(startMonth - 1).map((label, i) => ({ label, m: startMonth + i }));
                return (
                  <div key={y}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {months.map(({ label, m }) => {
                        const isActive = y === year && m === month;
                        const monthScheds = schedules.filter(s => s.status !== 'deleted' && s.year === y && s.month === m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setYear(y); setMonth(m); setCalendarOpen(true); }}
                            className={[
                              'flex-shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 transition-all border',
                              isActive
                                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent shadow-lg shadow-violet-200'
                                : darkMode
                                  ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-violet-50 hover:border-violet-300',
                            ].join(' ')}
                          >
                            <span className="font-bold text-sm whitespace-nowrap">{label}</span>
                            {monthScheds.length > 0 && (
                              <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isActive ? 'bg-white/25 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-violet-100 text-violet-700'}`}>
                                {monthScheds.length} műszak
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* ── Javasolt beosztás gyors-gomb ─────────────────────── */}
              {activeEmployees.length > 0 && (
                <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${darkMode ? 'border-emerald-800 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div>
                    <p className={`font-bold text-sm ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>🤖 Javasolt beosztás</p>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-emerald-400/70' : 'text-emerald-700/70'}`}>
                      Automatikus előzetes beosztás az előző hónap + dolgozói preferenciák alapján — {MONTHS_HU[month - 1]} {year}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={plannerLoading}
                    onClick={generateAndApplySchedule}
                    className="flex-shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-60"
                  >
                    {plannerLoading ? 'Generálás...' : 'Generálás'}
                  </button>
                </div>
              )}

              {/* Pending vacation + swap panels */}
              {pendingVacationRequests.length > 0 ? (
                <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#6B46C1]" />
                    <h3 className="text-lg font-semibold">Függő szabadságigények</h3>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{pendingVacationRequests.length}</span>
                  </div>
                  {pendingVacationRequests.map(item => (
                    <div key={item.id} className="border-b py-2 last:border-b-0 border-gray-200 dark:border-gray-700">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-sm text-gray-500">{item.startDate} - {item.endDate}</p>
                      {item.reason ? <p className="mt-1 text-sm">{item.reason}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">
                          <CheckCircle2 className="h-4 w-4" />Jóváhagyás
                        </button>
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white">
                          <XCircle className="h-4 w-4" />Elutasítás
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {swapRequests.filter(r => r.status === 'employee_accepted').length > 0 ? (
                <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                    <h3 className="text-lg font-semibold">Csereigények – jóváhagyásra várnak</h3>
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'employee_accepted').length}</span>
                  </div>
                  <div className="space-y-3">
                    {swapRequests.filter(r => r.status === 'employee_accepted').map(item => (
                      <div key={item.id} className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="font-semibold">{item.requesterName} ↔ {item.targetName}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={saving} onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                              <CheckCircle2 className="h-4 w-4" />Jóváhagyom
                            </button>
                            <button type="button" disabled={saving} onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                              <XCircle className="h-4 w-4" />Elutasítom
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Full-screen calendar overlay */}
              {calendarOpen && (
                <PharmacyScheduleCalendar
                  year={year}
                  month={month}
                  onChangeMonth={(dir) => {
                    if (dir === 'prev') {
                      const p = getPreviousMonth(year, month);
                      setYear(p.year); setMonth(p.month);
                    } else {
                      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
                      setYear(next.year); setMonth(next.month);
                    }
                  }}
                  onClose={() => setCalendarOpen(false)}
                  schedules={schedules.filter(s => s.status !== 'deleted')}
                  employees={employees}
                  preferences={schedulePreferences}
                  user={user}
                  userData={userData}
                  darkMode={darkMode}
                  onSaveDaySchedules={handleSaveDaySchedules}
                  saving={saving}
                  onCopyPrev={handleCopyPreviousMonth}
                  onExport={handleExportSchedules}
                  onPublish={handlePublishSchedules}
                  onAutoFix={handleAutoFixSchedules}
                  activeMonthSchedules={activeMonthSchedules.length}
                  publishedScheduleCount={publishedScheduleCount}
                />
              )}
            </div>
          ) : null}

          {/* ── Old month/day selectors + calendar (shown for history and employee views) ── */}
          {!(isPharmacy && mainTab === 'schedule') && !(!isPharmacy && (mainTab === 'mine' || mainTab === 'preferences' || mainTab === 'planner' || mainTab === 'vacations')) ? (
          <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Év">
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2 bg-transparent">
                  {availableYears.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Hónap">
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2 bg-transparent">
                  {MONTHS_HU.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
              </Field>
              <Field label="Nap">
                <select value={day} onChange={e => setDay(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2 bg-transparent">
                  {Array.from({ length: getDaysInMonth(year, month) }, (_, index) => index + 1).map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
            </div>

            <MonthCalendar
              year={year}
              month={month}
              selectedDate={selectedDate}
              schedules={visibleSchedules}
              ownScheduleIds={ownScheduleIds}
              onSelectDate={(dateKey) => {
                const [, nextMonth, nextDay] = dateKey.split('-').map(Number);
                setMonth(nextMonth);
                setDay(nextDay);
              }}
              darkMode={darkMode}
            />
          </div>
          ) : null}

          {false && isPharmacy && mainTab === 'schedule' ? (
            <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
              <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Beosztás írása - {selectedDate}</h3>
                    <p className="text-sm text-gray-500">Egyszerű, napra kattintós beosztáskezelés.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleCopyPreviousMonth} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                      <Copy className="h-4 w-4" />
                      Előző hónap másolása
                    </button>
                    <button type="button" onClick={handleExportSchedules} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                      <Download className="h-4 w-4" />
                      CSV export
                    </button>
                    <button type="button" onClick={handlePublishSchedules} disabled={saving || activeMonthSchedules.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                      <Send className="h-4 w-4" />
                      Publikálás
                    </button>
                    {false && <button type="button" onClick={handleSuggestEmployee} className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-4 py-2 text-sm font-medium text-white">
                      <Sparkles className="h-4 w-4" />
                      AI javaslat
                    </button>}
                    {false && <button
                      type="button"
                      onClick={() => runAutoPlanner({ action: 'plan' })}
                      disabled={plannerLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      <Wand2 className="h-4 w-4" />
                      {plannerLoading ? 'Tervezés...' : 'Automatikus tervezés'}
                    </button>}
                  </div>
                </div>

                <div className={`rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                  Ebben a hónapban {activeMonthSchedules.length} aktív műszak van, ebből {publishedScheduleCount} publikált.
                </div>

                {false && <div className={`rounded-xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold">Tervezési szabályok</h4>
                      <p className="text-xs text-gray-500">Hard szabályok alapbeállítása az automatikus tervezéshez</p>
                    </div>
                    <button
                      type="button"
                      onClick={savePlannerConfig}
                      disabled={plannerConfigSaving}
                      className="rounded-lg bg-[#6B46C1] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {plannerConfigSaving ? 'Mentés...' : 'Szabályok mentése'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Minimum létszám / műszak">
                      <input
                        type="number"
                        min="1"
                        value={plannerConfigForm.minStaffPerShift}
                        onChange={e => setPlannerConfigForm(prev => ({ ...prev, minStaffPerShift: Number(e.target.value || 1) }))}
                        className="w-full rounded-xl border px-3 py-2 bg-transparent"
                      />
                    </Field>
                    <Field label="Kötelező gyógyszerész / műszak">
                      <input
                        type="number"
                        min="0"
                        value={plannerConfigForm.minPharmacistsPerShift}
                        onChange={e => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: Number(e.target.value || 0) }))}
                        className="w-full rounded-xl border px-3 py-2 bg-transparent"
                      />
                    </Field>
                  </div>

                  <div className={`rounded-lg border p-3 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                    <label className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={plannerConfigForm.laborLaw?.enforceHungarianLaborLaw !== false}
                        onChange={e => setPlannerConfigForm(prev => ({
                          ...prev,
                          laborLaw: {
                            ...(prev.laborLaw || {}),
                            enforceHungarianLaborLaw: e.target.checked,
                          },
                        }))}
                      />
                      Magyar munkaügyi jogi guardrail-ek bekapcsolása
                    </label>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <Field label="Max napi óra (jogi)">
                        <input
                          type="number"
                          min="1"
                          value={plannerConfigForm.laborLaw?.maxDailyHoursLegal || 12}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            laborLaw: {
                              ...(prev.laborLaw || {}),
                              maxDailyHoursLegal: Number(e.target.value || 12),
                            },
                          }))}
                          className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                      </Field>
                      <Field label="Max heti óra (jogi)">
                        <input
                          type="number"
                          min="1"
                          value={plannerConfigForm.laborLaw?.maxWeeklyHoursLegal || 48}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            laborLaw: {
                              ...(prev.laborLaw || {}),
                              maxWeeklyHoursLegal: Number(e.target.value || 48),
                            },
                          }))}
                          className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                      </Field>
                      <Field label="Min napi pihenő (óra)">
                        <input
                          type="number"
                          min="1"
                          value={plannerConfigForm.laborLaw?.minDailyRestHoursLegal || 11}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            laborLaw: {
                              ...(prev.laborLaw || {}),
                              minDailyRestHoursLegal: Number(e.target.value || 11),
                            },
                          }))}
                          className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                      </Field>
                      <Field label="Max éjszakai műszak (óra)">
                        <input
                          type="number"
                          min="1"
                          value={plannerConfigForm.laborLaw?.maxNightShiftHoursLegal || 8}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            laborLaw: {
                              ...(prev.laborLaw || {}),
                              maxNightShiftHoursLegal: Number(e.target.value || 8),
                            },
                          }))}
                          className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                      </Field>
                      <Field label="Kötelező szünet ettől (óra)">
                        <input
                          type="number"
                          min="1"
                          value={plannerConfigForm.laborLaw?.requireBreakAfterHours || 6}
                          onChange={e => setPlannerConfigForm(prev => ({
                            ...prev,
                            laborLaw: {
                              ...(prev.laborLaw || {}),
                              requireBreakAfterHours: Number(e.target.value || 6),
                            },
                          }))}
                          className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Műszaksablonok</p>
                      <button
                        type="button"
                        onClick={addShiftTemplate}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Új műszak
                      </button>
                    </div>

                    {plannerConfigForm.shiftTemplates.map((template, index) => (
                      <div key={`${template.key}-${index}`} className={`rounded-lg border p-3 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide">{template.key || `Műszak ${index + 1}`}</p>
                          <button
                            type="button"
                            onClick={() => removeShiftTemplate(index)}
                            disabled={plannerConfigForm.shiftTemplates.length <= 1}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <input
                            type="time"
                            value={template.startTime}
                            onChange={e => updateShiftTemplate(index, { startTime: e.target.value })}
                            className="rounded-lg border px-2 py-1.5 bg-transparent text-sm"
                          />
                          <input
                            type="time"
                            value={template.endTime}
                            onChange={e => updateShiftTemplate(index, { endTime: e.target.value })}
                            className="rounded-lg border px-2 py-1.5 bg-transparent text-sm"
                          />
                          <input
                            type="number"
                            min="1"
                            value={template.requiredStaff}
                            onChange={e => updateShiftTemplate(index, { requiredStaff: Number(e.target.value || 1) })}
                            className="rounded-lg border px-2 py-1.5 bg-transparent text-sm"
                            placeholder="Létszám"
                          />
                          <input
                            type="number"
                            min="0"
                            value={template.requiredPharmacists}
                            onChange={e => updateShiftTemplate(index, { requiredPharmacists: Number(e.target.value || 0) })}
                            className="rounded-lg border px-2 py-1.5 bg-transparent text-sm"
                            placeholder="Gyógyszerész"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>}

                {false && <div className={`rounded-xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4 text-orange-600" />
                    <p className="font-medium">Gyors újratervezés (beteg dolgozó)</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Dolgozó">
                      <select value={replanForm.employeeId} onChange={e => setReplanForm(prev => ({ ...prev, employeeId: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent">
                        <option value="">Válassz dolgozót</option>
                        {activeEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Kezdő nap">
                      <input type="date" value={replanForm.startDate} onChange={e => setReplanForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                    </Field>
                    <Field label="Záró nap">
                      <input type="date" value={replanForm.endDate} onChange={e => setReplanForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={plannerLoading || !replanForm.employeeId}
                      onClick={() => runAutoPlanner({
                        action: 'replan',
                        sickEmployeeId: replanForm.employeeId,
                        affectedDates: getDateRangeKeys(replanForm.startDate, replanForm.endDate),
                      })}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      <UserX className="h-4 w-4" />
                      Érintett napok újratervezése
                    </button>
                  </div>
                </div>}

                {false && plannerResult ? (
                  <div className={`rounded-xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">Automatikus tervezés eredménye</h4>
                        <p className="text-xs text-gray-500">Konfliktusmotor + optimalizáló javaslatok</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyPlannerResult}
                        disabled={applyingPlanner || !plannerResult.proposedShifts?.length}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {applyingPlanner ? 'Mentés...' : `Javaslatok mentése (${plannerResult.proposedShifts?.length || 0})`}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'error', label: 'Piros hiba', value: (plannerResult.conflicts || []).filter(item => item.severity === 'error').length, cls: 'border-red-200 bg-red-50 text-red-800' },
                        { key: 'warning', label: 'Narancs figy.', value: (plannerResult.conflicts || []).filter(item => item.severity === 'warning').length, cls: 'border-orange-200 bg-orange-50 text-orange-800' },
                        { key: 'info', label: 'Kék info', value: (plannerResult.conflicts || []).filter(item => item.severity === 'info').length, cls: 'border-blue-200 bg-blue-50 text-blue-800' },
                        { key: 'ok', label: 'Zöld rendben', value: Math.max(0, (plannerResult.proposedShifts || []).length - (plannerResult.conflicts || []).filter(item => item.severity === 'error').length), cls: 'border-green-200 bg-green-50 text-green-800' },
                      ].map(item => (
                        <div key={item.key} className={`rounded-lg border px-3 py-2 ${item.cls}`}>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-lg font-bold">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold">Okos javaslatok</h5>
                      {(plannerResult.suggestions || []).map((item, idx) => (
                        <div key={`${item.type}-${idx}`} className={`rounded-lg border px-3 py-2 text-sm ${
                          item.priority === 'critical'
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : item.priority === 'high'
                              ? 'border-orange-200 bg-orange-50 text-orange-800'
                              : item.priority === 'medium'
                                ? 'border-blue-200 bg-blue-50 text-blue-800'
                                : 'border-green-200 bg-green-50 text-green-800'
                        }`}>
                          {item.text}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold">Konfliktusok (prioritás szerint)</h5>
                      {(plannerResult.conflicts || []).slice(0, 12).map((item, idx) => (
                        <div key={`${item.code}-${idx}`} className={`rounded-lg border px-3 py-2 text-sm ${getConflictStyles(item.severity)}`}>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5">{getConflictIcon(item.severity)}</span>
                            <span>{item.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {plannerResult.stats?.summary ? (
                      <div className={`rounded-lg border p-3 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="mb-2 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-[#6B46C1]" />
                          <h5 className="text-sm font-semibold">Statisztikák</h5>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Havi órák: <strong>{Number(plannerResult.stats.summary.totalMonthlyHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Túlóra: <strong>{Number(plannerResult.stats.summary.totalOvertimeHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Hétvégék: <strong>{plannerResult.stats.summary.totalWeekendShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Vasárnapok: <strong>{plannerResult.stats.summary.totalSundayShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Munkaszüneti napok: <strong>{plannerResult.stats.summary.totalPublicHolidayShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Éjszakák: <strong>{plannerResult.stats.summary.totalNightShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Vasárnapi pótlék órák*: <strong>{Number(plannerResult.stats.summary.totalEstimatedSundayPremiumHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Ünnepnapi pótlék órák*: <strong>{Number(plannerResult.stats.summary.totalEstimatedHolidayPremiumHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Szabadságok: <strong>{plannerResult.stats.summary.totalVacationDays || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">Hiányzások: <strong>{plannerResult.stats.summary.totalAbsences || 0}</strong></div>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">* Tájékoztató mutató a bérszámfejtés ellenőrzéséhez, nem minősül automatikus bérszámításnak.</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Dolgozó" required>
                    <select value={scheduleForm.employeeId} onChange={e => {
                      setScheduleForm(prev => ({ ...prev, employeeId: e.target.value }));
                    }} className="w-full rounded-xl border px-3 py-2 bg-transparent">
                      <option value="">Válassz dolgozót</option>
                      {activeEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Szerepkör (automatikus)">
                    <input
                      type="text"
                      value={selectedEmployee ? prettyRole(selectedEmployee.role) : '-'}
                      readOnly
                      className="w-full rounded-xl border px-3 py-2 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </Field>
                  <Field label="Mettől">
                    <input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                  </Field>
                  <Field label="Meddig">
                    <input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Megjegyzés">
                      <textarea value={scheduleForm.notes} onChange={e => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))} className="min-h-[90px] w-full rounded-xl border px-3 py-2 bg-transparent" placeholder="Pl. nyitás, zárás, csak délelőtt" />
                    </Field>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" disabled={saving || selectedDateSchedules.some(isPublishedSchedule)} className="rounded-xl bg-[#16a34a] px-4 py-2 font-medium text-white disabled:opacity-60">
                      Beosztás mentése
                    </button>
                  </div>
                </form>
                {selectedDateSchedules.some(isPublishedSchedule) ? (
                  <p className="text-xs text-amber-600">Ehhez a naphoz már tartozik publikált műszak, ezért a nap zárolt. Módosításhoz új tervet készíts, majd publikáld újra.</p>
                ) : null}
              </div>

              <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                <h3 className="text-lg font-semibold">Napi beosztások</h3>
                {selectedDateSchedules.length === 0 ? (
                  <p className="text-sm text-gray-500">Erre a napra még nincs rögzített beosztás.</p>
                ) : selectedDateSchedules.map(item => (
                  <div key={item.id} className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.employeeName}</p>
                        {isPublishedSchedule(item) ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Publikált, zárolt</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-500">{item.startTime} - {item.endTime}</p>
                      <p className="text-sm text-gray-500">{prettyRole(item.role)}</p>
                      {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
                    </div>
                    <button type="button" onClick={() => handleDeleteSchedule(item.id)} disabled={isPublishedSchedule(item)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                      {isPublishedSchedule(item) ? 'Zárolt' : 'Törlés'}
                    </button>
                  </div>
                ))}

                <div className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#6B46C1]" />
                    <h4 className="font-semibold">Függő szabadságigények</h4>
                  </div>
                  {pendingVacationRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">Nincs függő szabadságigény.</p>
                  ) : pendingVacationRequests.map(item => (
                    <div key={item.id} className="border-b py-2 last:border-b-0 border-gray-200 dark:border-gray-700">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-sm text-gray-500">{item.startDate} - {item.endDate}</p>
                      {item.reason ? <p className="mt-1 text-sm">{item.reason}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">
                          <CheckCircle2 className="h-4 w-4" />
                          Jóváhagyás
                        </button>
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white">
                          <XCircle className="h-4 w-4" />
                          Elutasítás
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pharmacy swap approvals: global panel for employee_accepted swaps */}
            {swapRequests.filter(r => r.status === 'employee_accepted').length > 0 ? (
              <div className={`rounded-2xl border p-5 space-y-4 mt-6 ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">Csereigények – jóváhagyásra várnak</h3>
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'employee_accepted').length}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Az alábbi cseréket mindkét dolgozó elfogadta. A tényleges beosztásváltozás csak az Ön jóváhagyása után lép érvénybe.</p>
                <div className="space-y-3">
                  {swapRequests.filter(r => r.status === 'employee_accepted').map(item => (
                    <div key={item.id} className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold">{item.requesterName} ↔ {item.targetName}</p>
                          <p className="text-sm text-gray-500">
                            {item.requesterName}: {item.date} {schedules.find(s => s.id === item.requesterScheduleId)?.startTime}–{schedules.find(s => s.id === item.requesterScheduleId)?.endTime}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.targetName}: {item.targetDate} {schedules.find(s => s.id === item.targetScheduleId)?.startTime}–{schedules.find(s => s.id === item.targetScheduleId)?.endTime}
                          </p>
                          {item.message ? <p className="mt-1 text-sm italic text-gray-500">"{item.message}"</p> : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'accepted')}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Jóváhagyom
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'rejected')}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" />
                            Elutasítom
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
            ) : null}

          {isPharmacy && mainTab === 'history' ? (
            <div className="space-y-4">
              {/* Past years month picker */}
              {[thisYear, ...pastYears].map(y => {
                // Current year: only past months (before this month); past years: all 12
                const endMonth = y === thisYear ? thisMonth - 1 : 12;
                if (endMonth < 1) return null;
                const months = MONTHS_HU.slice(0, endMonth).map((label, i) => ({ label, m: i + 1 })).reverse();
                if (months.length === 0) return null;
                return (
                  <div key={y}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {months.map(({ label, m }) => {
                        const isActive = y === year && m === month;
                        const monthScheds = schedules.filter(s => s.status !== 'deleted' && s.year === y && s.month === m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setYear(y); setMonth(m); setCalendarOpen(true); }}
                            className={[
                              'flex-shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 transition-all border',
                              isActive
                                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent shadow-lg shadow-violet-200'
                                : darkMode
                                  ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-violet-50 hover:border-violet-300',
                            ].join(' ')}
                          >
                            <span className="font-bold text-sm whitespace-nowrap">{label}</span>
                            {monthScheds.length > 0 && (
                              <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isActive ? 'bg-white/25 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-violet-100 text-violet-700'}`}>
                                {monthScheds.length} műszak
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Full-screen overlay for past months */}
              {calendarOpen && (
                <PharmacyScheduleCalendar
                  year={year}
                  month={month}
                  onChangeMonth={(dir) => {
                    if (dir === 'prev') {
                      const p = getPreviousMonth(year, month);
                      setYear(p.year); setMonth(p.month);
                    } else {
                      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
                      setYear(next.year); setMonth(next.month);
                    }
                  }}
                  onClose={() => setCalendarOpen(false)}
                  schedules={schedules.filter(s => s.status !== 'deleted')}
                  employees={employees}
                  preferences={schedulePreferences}
                  user={user}
                  userData={userData}
                  darkMode={darkMode}
                  onSaveDaySchedules={handleSaveDaySchedules}
                  saving={saving}
                  onCopyPrev={handleCopyPreviousMonth}
                  onExport={handleExportSchedules}
                  onPublish={handlePublishSchedules}
                  activeMonthSchedules={activeMonthSchedules.length}
                  publishedScheduleCount={publishedScheduleCount}
                />
              )}
            </div>
          ) : null}

          {!isPharmacy && mainTab === 'mine' ? (
            <div className="space-y-4">
              {/* Profile warning + Alap adataim gomb */}
              {!employeeProfile?.birthDate && (
                <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${darkMode ? 'border-amber-700 bg-amber-900/20' : 'border-amber-300 bg-amber-50'}`}>
                  <AlertTriangle className={`flex-shrink-0 mt-0.5 h-5 w-5 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>Az alap adataid hiányoznak</p>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-amber-400/80' : 'text-amber-700/80'}`}>A szabadságnapok kiszámításához és a beosztás-tervező teljes funkcionalitásához add meg az adataidat.</p>
                  </div>
                  <button type="button" onClick={() => { setMainTab('preferences'); setShowProfileForm(true); }} className="flex-shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">Megadom</button>
                </div>
              )}
              {employeeProfile?.birthDate && (
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                  <div className="flex-1">
                    {(() => {
                      const totalVac = calcAnnualVacationDays(employeeProfile.birthDate, employeeProfile.childrenCount, thisYear);
                      const carryOver = employeeProfile.vacationCarriedOver || 0;
                      const taken = employeeProfile.vacationTakenThisYear || 0;
                      const remaining = totalVac + carryOver - taken;
                      const reqHours = calcMonthlyRequiredHours(employeeProfile.contractHours, year, month);
                      return (
                        <div className="flex flex-wrap gap-4">
                          <div className="text-center">
                            <p className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Éves szabadság</p>
                            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{totalVac} nap</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Maradt ({thisYear})</p>
                            <p className={`text-lg font-bold ${remaining <= 5 ? 'text-rose-500' : darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{remaining} nap</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{MONTHS_HU[month-1]} kötelező</p>
                            <p className={`text-lg font-bold ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>{reqHours} óra</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button type="button" onClick={() => { setMainTab('preferences'); setShowProfileForm(true); }} className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Szerkesztés</button>
                </div>
              )}

              {availableYears.map(y => {
                const startM = 1;
                const endM = 12;
                const months = MONTHS_HU.slice(startM - 1, endM).map((label, i) => ({ label, m: startM + i }));
                const publishedMonths = months.filter(({ m }) =>
                  schedules.some(s => s.status !== 'deleted' && s.year === y && s.month === m && s.isPublished)
                );
                if (publishedMonths.length === 0 && y !== thisYear) return null;
                return (
                  <div key={y}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {months.map(({ label, m }) => {
                        const isActive = y === year && m === month && calendarOpen;
                        const monthScheds = schedules.filter(s => s.status !== 'deleted' && s.year === y && s.month === m && s.isPublished);
                        const ownCount = monthScheds.filter(s => ownScheduleIds.has(s.id)).length;
                        if (monthScheds.length === 0) return null;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setYear(y); setMonth(m); setCalendarOpen(true); }}
                            className={[
                              'flex-shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 transition-all border',
                              isActive
                                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent shadow-lg shadow-violet-200'
                                : darkMode
                                  ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-violet-50 hover:border-violet-300',
                            ].join(' ')}
                          >
                            <span className="font-bold text-sm whitespace-nowrap">{label}</span>
                            {ownCount > 0 && (
                              <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isActive ? 'bg-white/25 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-violet-100 text-violet-700'}`}>
                                {ownCount} saját műszak
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {schedules.filter(s => s.status !== 'deleted' && s.isPublished).length === 0 && (
                <p className={`text-sm text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Még nincs publikált beosztás.</p>
              )}
              {/* Full-screen calendar overlay */}
              {calendarOpen && (
                <PharmacyScheduleCalendar
                  year={year}
                  month={month}
                  onChangeMonth={(dir) => {
                    if (dir === 'prev') {
                      const p = getPreviousMonth(year, month);
                      setYear(p.year); setMonth(p.month);
                    } else {
                      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
                      setYear(next.year); setMonth(next.month);
                    }
                  }}
                  onClose={() => setCalendarOpen(false)}
                  schedules={schedules.filter(s => s.status !== 'deleted' && s.isPublished)}
                  employees={employees}
                  preferences={[]}
                  user={user}
                  userData={userData}
                  darkMode={darkMode}
                  onSaveDaySchedules={() => {}}
                  saving={false}
                  onCopyPrev={() => {}}
                  onExport={() => {}}
                  onPublish={() => {}}
                  activeMonthSchedules={schedules.filter(s => s.status !== 'deleted' && s.isPublished && s.year === year && s.month === month).length}
                  publishedScheduleCount={0}
                  readOnly={true}
                  ownScheduleIds={ownScheduleIds}
                />
              )}
            </div>
          ) : null}

          {!isPharmacy && mainTab === 'planner' ? (
            <div className="space-y-6">
              {ownEmployeeRecords.length > 0 ? (
                <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-emerald-800 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50/40'}`}>
                  <div>
                    <h3 className={`text-lg font-semibold flex items-center gap-2 ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>
                      <span>📅</span> Beosztás-tervezet
                    </h3>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-emerald-300/70' : 'text-emerald-700/80'}`}>
                      Add meg, hogy mikor szeretnél dolgozni. A tervezet látható lesz a gyógyszertár számára és a kollégáknak is.
                    </p>
                  </div>
                  {[thisYear, thisYear + 1].map(y => {
                    const startM = y === thisYear ? thisMonth : 1;
                    const months = MONTHS_HU.slice(startM - 1).map((label, i) => ({ label, m: startM + i }));
                    return (
                      <div key={y}>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {months.map(({ label, m }) => {
                            const isActive = y === year && m === month && preferenceCalendarOpen;
                            const myPrefs = schedulePreferences.filter(p =>
                              p.status !== 'deleted' && p.year === y && p.month === m &&
                              (p.linkedUserId === user?.uid || (p.employeeEmail && user?.email && p.employeeEmail.toLowerCase() === user.email.toLowerCase()))
                            );
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => { setYear(y); setMonth(m); setPreferenceCalendarOpen(true); }}
                                className={[
                                  'flex-shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 transition-all border',
                                  isActive
                                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-transparent shadow-lg shadow-emerald-200'
                                    : darkMode
                                      ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                                      : 'bg-white border-gray-200 text-gray-800 hover:bg-emerald-50 hover:border-emerald-300',
                                ].join(' ')}
                              >
                                <span className="font-bold text-sm whitespace-nowrap">{label}</span>
                                {myPrefs.length > 0 && (
                                  <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isActive ? 'bg-white/25 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {myPrefs.length} tervezett nap
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {preferenceCalendarOpen && ownEmployeeRecords[0] && (
                    <EmployeePreferenceCalendar
                      year={year}
                      month={month}
                      onChangeMonth={(dir) => {
                        if (dir === 'prev') {
                          const p = getPreviousMonth(year, month);
                          setYear(p.year); setMonth(p.month);
                        } else {
                          const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
                          setYear(next.year); setMonth(next.month);
                        }
                      }}
                      onClose={() => { setPreferenceCalendarOpen(false); setPreferenceInitialDay(null); }}
                      preferences={schedulePreferences.filter(p => p.year === year && p.month === month)}
                      ownEmployeeRecord={ownEmployeeRecords[0]}
                      user={user}
                      darkMode={darkMode}
                      onSaveDayPreferences={handleSavePreferenceDaySchedules}
                      saving={saving}
                      employeeProfile={employeeProfile}
                      initialDay={preferenceInitialDay}
                    />
                  )}
                </div>
              ) : (
                <p className={`text-sm text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Nincs hozzárendelt dolgozói profil.</p>
              )}
            </div>
          ) : null}

          {!isPharmacy && mainTab === 'vacations' ? (() => {
            // Collect all own Sz (vacation) preferences across all months
            const ownSzPrefs = schedulePreferences.filter(p =>
              p.status !== 'deleted' &&
              p.shiftType === 'Sz' &&
              (p.linkedUserId === user?.uid || (p.employeeEmail && user?.email && p.employeeEmail.toLowerCase() === user.email.toLowerCase()))
            ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            const todayKey = getTodayKey();
            const pastSz = ownSzPrefs.filter(p => p.date < todayKey);
            const futureSz = ownSzPrefs.filter(p => p.date >= todayKey);

            const annualVacDaysV = employeeProfile?.birthDate
              ? calcAnnualVacationDays(employeeProfile.birthDate, employeeProfile.childrenCount, thisYear)
              : 0;
            const carryOverV = Number(employeeProfile?.vacationCarriedOver) || 0;
            const takenV = Number(employeeProfile?.vacationTakenThisYear) || 0;
            const totalRemV = annualVacDaysV + carryOverV - takenV;
            const usedInPlannerV = ownSzPrefs.length;

            const SzRow = ({ p }) => {
              const d = new Date(p.date + 'T00:00:00');
              const isPast = p.date < todayKey;
              const monthLabel2 = MONTHS_HU[d.getMonth()];
              const dow2 = ['V','H','K','Sze','Cs','P','Szo'][d.getDay()];
              return (
                <button
                  type="button"
                  onClick={() => {
                    setYear(d.getFullYear());
                    setMonth(d.getMonth() + 1);
                    setPreferenceInitialDay(d.getDate());
                    setPreferenceCalendarOpen(true);
                    setMainTab('planner');
                  }}
                  className={`w-full text-left flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                    isPast
                      ? darkMode ? 'border-gray-700 bg-gray-800/50 opacity-60' : 'border-gray-200 bg-gray-50 opacity-60'
                      : darkMode ? 'border-orange-700/60 bg-orange-900/20 hover:bg-orange-900/30' : 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                  }`}
                >
                  <span className={`flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${isPast ? darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500' : 'bg-orange-100 text-orange-700'}`}>
                    {isPast ? '✓' : '🌴'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isPast ? darkMode ? 'text-gray-400' : 'text-gray-500' : darkMode ? 'text-orange-200' : 'text-orange-800'}`}>
                      {d.getFullYear()}. {monthLabel2} {d.getDate()}. ({dow2})
                    </p>
                    {p.notes && <p className={`text-xs mt-0.5 truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{p.notes}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>→</span>
                </button>
              );
            };

            return (
              <div className="space-y-5">
                {/* Summary card */}
                {annualVacDaysV > 0 && (
                  <div className={`rounded-2xl border p-4 ${darkMode ? 'border-orange-800/50 bg-orange-950/20' : 'border-orange-200 bg-orange-50/60'}`}>
                    <div className="flex flex-wrap gap-4">
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>Jár ({thisYear})</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-orange-200' : 'text-orange-700'}`}>{annualVacDaysV + carryOverV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-orange-400/60' : 'text-orange-500/70'}`}>{carryOverV > 0 ? `+${carryOverV} áthozva` : 'nap'}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>Kivett</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{takenV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>rögzítve</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>Tervezett</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>{usedInPlannerV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-amber-500/70' : 'text-amber-500/80'}`}>nap a tervben</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>Marad</p>
                        <p className={`text-xl font-black ${totalRemV - usedInPlannerV <= 3 ? 'text-rose-500' : darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{Math.max(0, totalRemV - usedInPlannerV)}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>nap</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upcoming vacations */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tervezett szabadságok</p>
                  {futureSz.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Nincs tervezett szabadság. Adj hozzá a Beosztás-tervezőben.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {futureSz.map(p => <SzRow key={p.id || p.date} p={p} />)}
                    </div>
                  )}
                </div>

                {/* Past vacations */}
                {pastSz.length > 0 && (
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Letelt szabadságok</p>
                    <div className="space-y-2">
                      {[...pastSz].reverse().map(p => <SzRow key={p.id || p.date} p={p} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : null}

          {!isPharmacy && mainTab === 'preferences' ? (
            <div className="space-y-6">

            {/* ── Alap adataim form ─────────────────────────────────────── */}
            <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold">👤 Alap adataim</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Szabadságnapok kiszámításához szükséges adatok</p>
                </div>
                {!showProfileForm && (
                  <button type="button" onClick={() => setShowProfileForm(true)} className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {employeeProfile?.birthDate ? 'Szerkesztés' : '+ Megadás'}
                  </button>
                )}
              </div>

              {/* Display current values */}
              {!showProfileForm && employeeProfile?.birthDate && (() => {
                const totalVac = calcAnnualVacationDays(employeeProfile.birthDate, employeeProfile.childrenCount, thisYear);
                const carryOver = employeeProfile.vacationCarriedOver || 0;
                const taken = employeeProfile.vacationTakenThisYear || 0;
                const remaining = totalVac + carryOver - taken;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Születési dátum', val: employeeProfile.birthDate },
                      { label: 'Gyermekek száma', val: `${employeeProfile.childrenCount || 0} gyermek` },
                      { label: 'Szerződés típus', val: `${employeeProfile.contractHours || 8} h/nap` },
                      { label: `${thisYear}. évi szabadság`, val: `${totalVac} nap (Mt. alapján)` },
                      { label: 'Áthozott szabadság', val: `${carryOver} nap` },
                      { label: 'Felvett idén', val: `${taken} nap felvett` },
                      { label: 'Maradék szabadság', val: `${remaining} nap`, highlight: remaining <= 5 ? 'rose' : 'emerald' },
                    ].map(({ label, val, highlight }) => (
                      <div key={label} className={`rounded-xl border px-3 py-2 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${
                          highlight === 'rose' ? 'text-rose-500' :
                          highlight === 'emerald' ? (darkMode ? 'text-emerald-300' : 'text-emerald-600') :
                          darkMode ? 'text-white' : 'text-gray-800'
                        }`}>{val}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {!showProfileForm && !employeeProfile?.birthDate && (
                <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>⚠️ Az adatok megadása szükséges a szabadságnapok kiszámításához.</p>
              )}

              {/* Form */}
              {showProfileForm && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Születési dátum</label>
                    <input
                      type="date"
                      value={profileForm.birthDate}
                      onChange={e => setProfileForm(p => ({ ...p, birthDate: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gyermekek száma</label>
                    <select
                      value={profileForm.childrenCount}
                      onChange={e => setProfileForm(p => ({ ...p, childrenCount: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {['0','1','2','3','4','5+'].map(v => <option key={v} value={v}>{v} gyermek</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Munkaszerződés típusa</label>
                    <select
                      value={profileForm.contractHours}
                      onChange={e => setProfileForm(p => ({ ...p, contractHours: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      <option value="4">4 h/nap (részmunkaidő 50%)</option>
                      <option value="6">6 h/nap (részmunkaidő 75%)</option>
                      <option value="8">8 h/nap (teljes munkaidő)</option>
                      <option value="12">12 h/nap (műszakos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Eddig felvett szabadság idén</label>
                    <select
                      value={profileForm.vacationTakenThisYear}
                      onChange={e => setProfileForm(p => ({ ...p, vacationTakenThisYear: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {Array.from({ length: 51 }, (_, i) => i).map(v => <option key={v} value={v}>{v} nap</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Ha évközben regisztráltál, add meg az eddig felvett szabadságnapok számát.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Előző évről áthozott szabadság</label>
                    <select
                      value={profileForm.vacationCarriedOver}
                      onChange={e => setProfileForm(p => ({ ...p, vacationCarriedOver: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {Array.from({ length: 31 }, (_, i) => i).map(v => <option key={v} value={v}>{v} nap</option>)}
                    </select>
                  </div>
                  {/* Preview */}
                  {profileForm.birthDate && (() => {
                    const totalVac = calcAnnualVacationDays(profileForm.birthDate, profileForm.childrenCount, thisYear);
                    const age = calcAgeAt(profileForm.birthDate, thisYear);
                    const carryOver = Number(profileForm.vacationCarriedOver) || 0;
                    const taken = Number(profileForm.vacationTakenThisYear) || 0;
                    const remaining = totalVac + carryOver - taken;
                    const reqHours = calcMonthlyRequiredHours(profileForm.contractHours, year, month);
                    return (
                      <div className={`rounded-xl border px-4 py-3 space-y-1 ${darkMode ? 'border-emerald-800 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Kiszámított értékek ({thisYear})</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>Életkor: <strong>{age} év</strong></p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>Járó szabadság: <strong>{totalVac} nap</strong> (alap 20 + kor + gyermek)</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>Maradék idén: <strong>{remaining} nap</strong> ({totalVac}+{carryOver}−{taken})</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{MONTHS_HU[month-1]} kötelező munkaóra: <strong>{reqHours} óra</strong> ({countWorkdaysInMonth(year, month)} munkanap × {profileForm.contractHours} h)</p>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowProfileForm(false)} className={`rounded-xl border px-4 py-2 text-sm font-medium ${darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}>Mégse</button>
                    <button type="button" onClick={handleSaveEmployeeProfile} disabled={profileSaving || !profileForm.birthDate} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {profileSaving ? 'Mentés...' : 'Mentés'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 space-y-6 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
              <div>
                <h3 className="text-lg font-semibold">Egyéni beosztási preferenciák</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Az itt megadott beállításokat az automatikus tervező figyelembe veszi, de a gyógyszertár kézzel felülírhatja, ha arra szükség van.
                </p>
              </div>

              {/* Weekday preferences */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Heti napok preferenciái</p>
                <p className="text-xs text-gray-500">
                  Kattintás: semleges → <span className="text-green-600 font-medium">előnyben részesítve</span> → <span className="text-red-600 font-medium">kerülendő</span> → semleges
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_DISPLAY.map(({ label, fullLabel, day }) => {
                    const state = getWeekdayState(day);
                    const cls = state === 'avoid'
                      ? 'border-red-400 bg-red-100 text-red-800 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'
                      : state === 'prefer'
                        ? 'border-green-400 bg-green-100 text-green-800 dark:border-green-600 dark:bg-green-900/30 dark:text-green-300'
                        : darkMode
                          ? 'border-gray-600 bg-gray-800 text-gray-300'
                          : 'border-gray-300 bg-gray-100 text-gray-700';
                    return (
                      <button
                        key={day}
                        type="button"
                        title={`${fullLabel}: ${state === 'avoid' ? 'kerülendő' : state === 'prefer' ? 'előnyben részesítve' : 'semleges'} — kattints a váltáshoz`}
                        onClick={() => toggleWeekdayPreference(day)}
                        className={`min-w-[52px] rounded-xl border-2 px-2 py-3 text-center text-sm font-bold transition-colors ${cls}`}
                      >
                        <div>{label}</div>
                        <div className="mt-1 text-[10px] font-normal leading-tight">
                          {state === 'avoid' ? 'kerülöm' : state === 'prefer' ? 'szívesen' : 'ok'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift type preference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Preferált műszaktípus">
                  <select
                    value={preferencesForm.preferredShiftType}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredShiftType: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="any">Bármelyik (nincs preferencia)</option>
                    <option value="day">Nappali (reggel–délután)</option>
                    <option value="evening">Délutáni / esti</option>
                    <option value="night">Éjszakai</option>
                  </select>
                </Field>

                <Field label="Célzott heti munkaórák">
                  <input
                    type="number"
                    min="4"
                    max="60"
                    value={preferencesForm.targetWeeklyHours}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, targetWeeklyHours: Number(e.target.value || 40) }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  />
                </Field>
              </div>

              {/* Weekend / night / can work toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Hétvégi műszak preferencia">
                  <select
                    value={preferencesForm.preferredWeekend}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredWeekend: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="prefer">Szívesen dolgozom hétvégén</option>
                    <option value="neutral">Semleges</option>
                    <option value="avoid">Lehetőleg kerülöm</option>
                  </select>
                </Field>
                <Field label="Éjszakai műszak preferencia">
                  <select
                    value={preferencesForm.preferredNight}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredNight: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="prefer">Szívesen dolgozom éjszaka</option>
                    <option value="neutral">Semleges</option>
                    <option value="avoid">Lehetőleg kerülöm</option>
                  </select>
                </Field>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 select-none">
                  <input
                    type="checkbox"
                    checked={preferencesForm.canWorkWeekends}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, canWorkWeekends: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Vállalok hétvégi műszakot</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 select-none">
                  <input
                    type="checkbox"
                    checked={preferencesForm.canWorkNight}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, canWorkNight: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Vállalok éjszakai műszakot</span>
                </label>
              </div>

              {/* Notes for pharmacy manager */}
              <Field label="Megjegyzés a gyógyszertárnak" hint="Pl. rendszeres orvosi ellenőrzés hétfőnként, tanulmányok stb.">
                <textarea
                  value={preferencesForm.schedulingNotes}
                  onChange={(e) => setPreferencesForm((prev) => ({ ...prev, schedulingNotes: e.target.value }))}
                  className="min-h-[90px] w-full rounded-xl border px-3 py-2 bg-transparent"
                  placeholder="Pl. minden kedden 16:00 után nem érek rá, este tanulok"
                />
              </Field>

              <div className={`rounded-xl border px-4 py-3 text-xs ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                Ezek a beállítások lágy preferenciák: az automatikus tervező figyelembe veszi őket, de a gyógyszertár szükség esetén kézzel felülírhatja.
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={preferencesSaving || ownEmployeeRecords.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-5 py-2.5 font-medium text-white disabled:opacity-60"
                >
                  {preferencesSaving ? 'Mentés...' : 'Preferenciák mentése'}
                </button>
              </div>
            </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
