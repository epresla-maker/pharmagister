"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getClientMarket, getLocalizedDemandPositionLabel } from '@/lib/marketI18n';
import { isDocInMarket } from '@/lib/market';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
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
  ChevronRight,
  Copy,
  Download,
  Info,
  Mic,
  MicOff,
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
  Volume2,
  VolumeX,
  Wand2,
  XCircle,
} from 'lucide-react';

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

const MONTHS_DE = [
  'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const DAYS_LONG_HU = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const DAYS_LONG_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function getWeekdayDisplay(market) {
  if (market === 'de') {
    return [
      { label: 'Mo', fullLabel: 'Montag', day: 1 },
      { label: 'Di', fullLabel: 'Dienstag', day: 2 },
      { label: 'Mi', fullLabel: 'Mittwoch', day: 3 },
      { label: 'Do', fullLabel: 'Donnerstag', day: 4 },
      { label: 'Fr', fullLabel: 'Freitag', day: 5 },
      { label: 'Sa', fullLabel: 'Samstag', day: 6 },
      { label: 'So', fullLabel: 'Sonntag', day: 0 },
    ];
  }
  return [
    { label: 'H', fullLabel: 'Hétfő', day: 1 },
    { label: 'K', fullLabel: 'Kedd', day: 2 },
    { label: 'Sze', fullLabel: 'Szerda', day: 3 },
    { label: 'Cs', fullLabel: 'Csütörtök', day: 4 },
    { label: 'P', fullLabel: 'Péntek', day: 5 },
    { label: 'Szo', fullLabel: 'Szombat', day: 6 },
    { label: 'V', fullLabel: 'Vasárnap', day: 0 },
  ];
}

function getCriteriaWizardSteps(market) {
  if (market === 'de') {
    return [
      { key: 'open_sunday', title: 'Habt ihr sonntags geoeffnet?', hint: 'Das System nutzt dies fuer normale Sonntagsschichten.' },
      { key: 'on_call_enabled', title: 'Gibt es regulaeren Bereitschaftsdienst?', hint: 'Wenn ja, verwalten wir ein separates Bereitschaftsfenster und Personalbedarf.' },
      { key: 'on_call_days', title: 'An welchen Tagen soll Bereitschaftsdienst laufen?', hint: 'Markiere die Tage mit verpflichtender Bereitschaftsabdeckung.' },
      { key: 'day_min_pharmacists', title: 'Wie viele Apotheker/innen braucht ihr tagsueber mindestens?', hint: 'Das beeinflusst die Pruefung aller normalen Tagesschichten.' },
      { key: 'on_call_min_pharmacists', title: 'Wie viele Apotheker/innen braucht ihr in Bereitschaft mindestens?', hint: 'Das gilt getrennt fuer das Bereitschaftsfenster.' },
    ];
  }
  return [
    { key: 'open_sunday', title: 'Nyitva vagytok vasárnap?', hint: 'A rendszer ezt használja a vasárnapi normál műszakokhoz.' },
    { key: 'on_call_enabled', title: 'Van rendszeres ügyelet?', hint: 'Ha igen, külön ügyeleti sávot és létszámot kezelünk.' },
    { key: 'on_call_days', title: 'Mely napokon legyen ügyelet?', hint: 'Jelöld a napokat, amikor kötelező az ügyeleti lefedés.' },
    { key: 'day_min_pharmacists', title: 'Nappali nyitvatartásban hány gyógyszerész kell minimum?', hint: 'Ez minden normál napi műszak ellenőrzésére kihat.' },
    { key: 'on_call_min_pharmacists', title: 'Ügyeletben hány gyógyszerész kell minimum?', hint: 'Ez külön az ügyeleti sávra vonatkozik.' },
  ];
}

const AI_COMMAND_POLICY = {
  navigate_url: { allowedRoles: ['pharmacy', 'employee'], riskLevel: 'read', requiresConfirm: false },
  set_main_tab: { allowedRoles: ['pharmacy', 'employee'], riskLevel: 'read', requiresConfirm: false },
  set_worker_tab: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  rerun_action: { allowedRoles: ['pharmacy', 'employee'], riskLevel: 'write', requiresConfirm: false },
  local_list_open_demands: { allowedRoles: ['pharmacy', 'employee'], riskLevel: 'read', requiresConfirm: false },
  local_list_my_demands: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  local_apply_demand: { allowedRoles: ['employee'], riskLevel: 'write', requiresConfirm: true },
  local_list_pending_applications: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  local_decide_application: { allowedRoles: ['pharmacy'], riskLevel: 'critical', requiresConfirm: true },
  local_schedule_wizard_start: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  local_schedule_control_panel: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  local_run_auto_planner: { allowedRoles: ['pharmacy'], riskLevel: 'write', requiresConfirm: false },
  local_apply_planner_result: { allowedRoles: ['pharmacy'], riskLevel: 'write', requiresConfirm: false },
  local_create_demand_wizard_start: { allowedRoles: ['pharmacy'], riskLevel: 'read', requiresConfirm: false },
  local_demand_wizard_set_position: { allowedRoles: ['pharmacy'], riskLevel: 'write', requiresConfirm: false },
  local_demand_wizard_set_date_offset: { allowedRoles: ['pharmacy'], riskLevel: 'write', requiresConfirm: false },
  local_demand_wizard_set_hours: { allowedRoles: ['pharmacy'], riskLevel: 'write', requiresConfirm: false },
  local_demand_wizard_submit: { allowedRoles: ['pharmacy'], riskLevel: 'critical', requiresConfirm: true },
  send_message: { allowedRoles: ['pharmacy', 'employee'], riskLevel: 'read', requiresConfirm: false },
};

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
  { bg: '#F3F4F6', chipBg: 'rgba(255,255,255,0.80)' }, // Sun  – weekend light grey
  { bg: '#FFFFFF', chipBg: 'rgba(255,255,255,0.80)' }, // Mon
  { bg: '#FFFFFF', chipBg: 'rgba(255,255,255,0.80)' }, // Tue
  { bg: '#FFFFFF', chipBg: 'rgba(255,255,255,0.80)' }, // Wed
  { bg: '#FFFFFF', chipBg: 'rgba(255,255,255,0.80)' }, // Thu
  { bg: '#FFFFFF', chipBg: 'rgba(255,255,255,0.80)' }, // Fri
  { bg: '#F3F4F6', chipBg: 'rgba(255,255,255,0.80)' }, // Sat  – weekend light grey
];
const DAY_PASTEL_DARK = [
  { bg: 'rgba(15,23,42,0.60)', chipBg: 'rgba(255,255,255,0.05)' }, // Sun  – darker
  { bg: 'rgba(30,41,59,0.35)', chipBg: 'rgba(255,255,255,0.06)' }, // Mon
  { bg: 'rgba(30,41,59,0.35)', chipBg: 'rgba(255,255,255,0.06)' }, // Tue
  { bg: 'rgba(30,41,59,0.35)', chipBg: 'rgba(255,255,255,0.06)' }, // Wed
  { bg: 'rgba(30,41,59,0.35)', chipBg: 'rgba(255,255,255,0.06)' }, // Thu
  { bg: 'rgba(30,41,59,0.35)', chipBg: 'rgba(255,255,255,0.06)' }, // Fri
  { bg: 'rgba(15,23,42,0.60)', chipBg: 'rgba(255,255,255,0.05)' }, // Sat  – darker
];

function isPublishedSchedule(schedule) {
  return Boolean(schedule?.publishedAt);
}

function isPharmacistRole(role) {
  const r = (role || '').toLowerCase();
  return r.includes('pharmacist') || r.includes('gyógyszerész') || r.includes('gyogyszeresz');
}

function getPreferenceOwnerKey(item) {
  const employeeId = String(item?.employeeId || '').trim();
  if (employeeId) return `emp:${employeeId}`;

  const linkedUserId = String(item?.linkedUserId || '').trim();
  if (linkedUserId) return `uid:${linkedUserId}`;

  const email = normalizeEmail(item?.employeeEmail || item?.email || '');
  if (email) return `mail:${email}`;

  return null;
}

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
    maxStaffPerShift: 0,
    maxPharmacistsPerShift: 0,
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
    maxStaffPerShift: Math.max(0, Number(config?.maxStaffPerShift ?? defaults.maxStaffPerShift)),
    maxPharmacistsPerShift: Math.max(0, Number(config?.maxPharmacistsPerShift ?? defaults.maxPharmacistsPerShift)),
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

function prettyRole(role, market = 'hu') {
  if (role === 'pharmacist') return market === 'de' ? 'Apotheker/in' : 'Gyógyszerész';
  if (role === 'assistant') return market === 'de' ? 'PTA' : 'Szakasszisztens';
  if (role === 'pka') return 'PKA';
  return market === 'de' ? 'Andere' : 'Egyéb';
}

function normalizeRoleFromProfile(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'pharmacist' || normalized === 'gyógyszerész') return 'pharmacist';
  if (normalized === 'assistant' || normalized === 'szakasszisztens') return 'assistant';
  if (normalized === 'pka') return 'pka';
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

function MonthCalendar({ year, month, selectedDate, schedules, ownScheduleIds, onSelectDate, darkMode, filterOwn, pendingSwapRequests, onOpenSwaps, market = 'hu' }) {
  const cells = getCalendarCells(year, month);
  const today = getTodayKey();
  const DOW_SHORT = market === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
  const holidays = getHungarianHolidays(year);

  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
      {/* Weekday headers */}
      <div className={`grid grid-cols-7 border-b ${darkMode ? 'border-gray-700' : 'border-[#E5E7EB]'}`}>
        {DOW_SHORT.map((d, i) => (
          <div key={i} className={`py-2 text-center text-[11px] font-semibold ${i >= 5 ? 'text-red-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
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
          const colIdx = index % 7; // 0=Mon…6=Sun
          const isWeekend = colIdx >= 5;
          const mmdd = day ? `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
          const isHoliday = mmdd ? holidays.has(mmdd) : false;
          const isLastInRow = colIdx === 6;
          const isInLastRow = index >= cells.length - 7;
          // Pending swap requests targeting this day's own schedule
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
                  {/* Day number */}
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
                  {/* Shift indicator */}
                  {filterOwn ? (
                    // Saját nézet: színes kocka az idővel
                    daySchedules.length > 0 && (() => {
                      const s = daySchedules[0];
                      const st = getShiftType(s.shiftType, market);
                      const start = s.startTime || s.from;
                      const end = s.endTime || s.to;
                      const timeLabel = (start && end) ? `${start.replace(':00','')}-${end.replace(':00','')}` : st.label;
                      // inline bg color map
                      const bgMap = { N: '#10b981', 'É': '#6366f1', 'Ü': '#8b5cf6', B: '#f43f5e', Sz: '#fb923c', P: '#38bdf8' };
                      const bg = bgMap[s.shiftType] || '#8b5cf6';
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
                    // Összes / admin nézet: pontok
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
                  {/* Pending swap badge – "drawn on" overlay */}
                  {filterOwn && daySwaps.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenSwaps && onOpenSwaps(); }}
                      className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-center"
                      style={{ top: '28px', background: 'transparent' }}
                    >
                      <div style={{ transform: 'rotate(-6deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        <svg width="26" height="14" viewBox="0 0 26 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
                          {/* white outline for contrast over colored shift blocks */}
                          <path d="M3 11 C6 3 10 2 13 6 C16 10 20 9 23 3" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" strokeOpacity="0.7"/>
                          <path d="M20 1 L23 3 L21 6" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.7"/>
                          <path d="M6 13 L3 11 L5 8" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.7"/>
                          {/* main orange arrow */}
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
                        }}>{market === 'de' ? 'Tausch' : 'Csere'}</span>
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

// ── Shift type config ────────────────────────────────────────────────────────
const SHIFT_TYPES = [
  { key: 'N', label: 'N', title: 'Nappali',   bg: 'bg-emerald-500',  text: 'text-white', border: 'border-emerald-600' },
  { key: 'É', label: 'É', title: 'Éjszakai',  bg: 'bg-indigo-500',   text: 'text-white', border: 'border-indigo-600' },
  { key: 'Ü', label: 'Ü', title: 'Ügyelet',   bg: 'bg-violet-500',   text: 'text-white', border: 'border-violet-600' },
  { key: 'B', label: 'B', title: 'Beteg',      bg: 'bg-rose-500',     text: 'text-white', border: 'border-rose-600' },
  { key: 'Sz', label: 'Sz', title: 'Szabadság', bg: 'bg-orange-400',  text: 'text-white', border: 'border-orange-500' },
  { key: 'P', label: 'P', title: 'Pihenő',    bg: 'bg-sky-400',      text: 'text-white', border: 'border-sky-500' },
];
const LEGACY_SHIFT_TYPE_MAP = {
  nappali: 'N',
  tagdienst: 'N',
  day: 'N',
  ejszakai: 'É',
  'éjszakai': 'É',
  nachtdienst: 'É',
  nachtschicht: 'É',
  night: 'É',
  ugyelet: 'Ü',
  'ügyelet': 'Ü',
  bereitschaft: 'Ü',
  'on-call': 'Ü',
  'on call': 'Ü',
  beteg: 'B',
  krank: 'B',
  sick: 'B',
  szabadsag: 'Sz',
  'szabadság': 'Sz',
  urlaub: 'Sz',
  vacation: 'Sz',
  piheno: 'P',
  'pihenő': 'P',
  ruhetag: 'P',
  restday: 'P',
  'rest day': 'P',
};

function normalizeShiftTypeKey(shiftType) {
  const raw = String(shiftType || '').trim();
  if (!raw) return 'N';
  if (SHIFT_TYPES.some((item) => item.key === raw)) return raw;
  const normalized = raw.toLowerCase();
  if (LEGACY_SHIFT_TYPE_MAP[normalized]) return LEGACY_SHIFT_TYPE_MAP[normalized];
  if (normalized === 'e') return 'É';
  if (normalized === 'u') return 'Ü';
  return 'N';
}

function isOffShift(shiftType) {
  const normalized = normalizeShiftTypeKey(shiftType);
  return normalized === 'Sz' || normalized === 'P';
}

function getShiftType(key, market = 'hu') {
  const normalizedKey = normalizeShiftTypeKey(key);
  const base = SHIFT_TYPES.find(t => t.key === normalizedKey) || SHIFT_TYPES[0];
  if (market !== 'de') return base;
  const titleMapDe = {
    N: 'Tagdienst',
    'É': 'Nachtdienst',
    'Ü': 'Bereitschaft',
    B: 'Krank',
    Sz: 'Urlaub',
    P: 'Ruhetag',
  };
  return { ...base, title: titleMapDe[base.key] || base.title };
}

function calcHours(from, to, market = 'hu') {
  if (!from || !to) return null;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (market === 'de') {
    return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
  }
  return m === 0 ? `${h}ó` : `${h}ó${m}p`;
}

function getErrorAdvice(code, market = 'hu') {
  if (market === 'de') {
    const mapDe = {
      min_staff: {
        title: 'Personalunterdeckung',
        tip: 'In dieser Schicht sind weniger Mitarbeitende eingeplant als das erforderliche Minimum.',
        suggestion: 'Erhoehe die verfuegbare Teamgroesse, reduziere die Mindestbesetzung in den Planungskriterien oder fuege fuer die fehlenden Tage manuell Schichten hinzu.',
      },
      missing_pharmacist: {
        title: 'Apotheker/in fehlt',
        tip: 'Fuer diese Schicht ist mindestens ein/e Apotheker/in erforderlich, aber niemand mit dieser Rolle ist eingeplant.',
        suggestion: 'Plane eine/n Apotheker/in fuer diesen Tag ein oder deaktiviere die Apothekerpflicht in den Planungskriterien.',
      },
      rest_time: {
        title: 'Unzureichende Ruhezeit',
        tip: 'Zwischen zwei aufeinanderfolgenden Schichten liegt laut individueller Grenze zu wenig Ruhezeit.',
        suggestion: 'Passe die betroffenen Schichtzeiten an oder teile fuer den Folgetag eine andere Person ein.',
      },
      legal_rest_time: {
        title: 'Gesetzliche Ruhezeit verletzt',
        tip: 'Zwischen zwei aufeinanderfolgenden Schichten liegen weniger als 11 Stunden Ruhezeit.',
        suggestion: 'Plane die Schichten so um, dass mindestens 11 Stunden Pause dazwischen liegen, oder ersetze die Person am Folgetag.',
      },
      max_daily_hours: {
        title: 'Tageslimit ueberschritten',
        tip: 'Die gesamten Arbeitsstunden dieser Person an diesem Tag ueberschreiten das eingestellte Tagesmaximum.',
        suggestion: 'Verkuerze die Schicht, entferne an diesem Tag eine Einteilung oder erhoehe das Tagesmaximum im Profil.',
      },
      legal_max_daily_hours: {
        title: 'Gesetzliches Tagesmaximum ueberschritten',
        tip: 'Die taeglichen Arbeitsstunden ueberschreiten das gesetzliche Maximum (in der Regel 12 Stunden).',
        suggestion: 'Reduziere die gesamte Arbeitszeit dieses Tages auf unter 12 Stunden.',
      },
      legal_weekly_hours_limit: {
        title: 'Gesetzliches Wochenmaximum ueberschritten',
        tip: 'Die Wochenarbeitszeit dieser Person ueberschreitet das gesetzliche Maximum (in der Regel 48 Stunden).',
        suggestion: 'Entferne eine Schicht in dieser Woche oder verteile die Last gleichmaessiger ueber den Wochenplan.',
      },
      double_shift: {
        title: 'Ueberlappende Schichten',
        tip: 'Dieselbe Person hat am gleichen Tag zwei sich ueberschneidende Schichten.',
        suggestion: 'Loesche oder korrigiere eine der ueberlappenden Schichten.',
      },
      time_off_violation: {
        title: 'Einteilung waehrend Abwesenheit',
        tip: 'Fuer diesen Tag ist bereits eine genehmigte Abwesenheit hinterlegt, die Person wurde trotzdem eingeplant.',
        suggestion: 'Loesche diese Schicht und teile stattdessen eine verfuegbare Kollegin oder einen verfuegbaren Kollegen ein.',
      },
      outside_opening_hours: {
        title: 'Schicht ausserhalb der Oeffnungszeiten',
        tip: 'Schichtbeginn oder Schichtende liegt ausserhalb der eingestellten Oeffnungszeiten.',
        suggestion: 'Passe die Schichtzeit an die Oeffnungszeiten an oder aktualisiere die Oeffnungszeiten in den Planungskriterien.',
      },
      shift_type_permission: {
        title: 'Schichttyp nicht erlaubt',
        tip: 'Die Person ist fuer diesen Schichttyp nicht freigegeben (z. B. Nacht- oder Wochenendschicht).',
        suggestion: 'Erlaube den Schichttyp im Profil oder ersetze die Person durch eine freigegebene Kollegin bzw. einen Kollegen.',
      },
      site_permission: {
        title: 'Standortberechtigung fehlt',
        tip: 'Die Person hat keine Berechtigung fuer diesen Standort.',
        suggestion: 'Fuege den Standort in den Mitarbeitenden-Einstellungen hinzu oder waehle eine berechtigte Person.',
      },
      max_staff: {
        title: 'Zu viele Mitarbeitende in der Schicht',
        tip: 'Die eingeplante Teamgroesse ueberschreitet das in den Basiskriterien eingestellte Maximum.',
        suggestion: 'Entferne eine Person aus der Schicht oder erhoehe das maximale Teamlimit in den Basiskriterien.',
      },
      max_pharmacist: {
        title: 'Zu viele Apotheker/innen in der Schicht',
        tip: 'Die Anzahl der eingeplanten Apotheker/innen ueberschreitet das eingestellte Maximum.',
        suggestion: 'Entferne eine/n Apotheker/in aus der Schicht oder erhoehe den Maximalwert in den Basiskriterien.',
      },
    };
    return mapDe[code] || {
      title: 'Unbekannter Fehler',
      tip: null,
      suggestion: 'Pruefe den Dienstplan manuell und korrigiere den Fehler.',
    };
  }
  const map = {
    min_staff: {
      title: 'Létszámhiány',
      tip: 'Az adott műszakban kevesebb dolgozó van beosztva a megkövetelt minimumnál.',
      suggestion: 'Bővítsd a dolgozói létszámot, csökkentsd a minimális létszámkövetelményt a tervezési kritériumokban, vagy adj be kézzel beosztást a hiányzó napokra.',
    },
    missing_pharmacist: {
      title: 'Hiányzó gyógyszerész',
      tip: 'A beállított műszakhoz legalább egy gyógyszerész jelenléte kötelező, de nincs ilyen szerepkörű dolgozó beosztva.',
      suggestion: 'Osztj be gyógyszerész végzettségű dolgozót erre a napra, vagy kapcsold ki a gyógyszerész-kötelezettséget a tervezési kritériumokban.',
    },
    rest_time: {
      title: 'Elégtelen pihenőidő',
      tip: 'Két egymást követő műszak között nincs elegendő pihenőidő az alkalmazott egyéni korlátja szerint.',
      suggestion: 'Módosítsd az érintett műszakok időpontját, vagy ossz be másik dolgozót a következő napra.',
    },
    legal_rest_time: {
      title: 'Törvényi pihenőidő-sérülés',
      tip: 'Két egymást követő műszak között kevesebb mint 11 óra pihenőidő van – ez sérti a Munka Törvénykönyvét.',
      suggestion: 'Állítsd be a műszakokat úgy, hogy köztük legalább 11 óra szünet legyen, vagy cseréld le a dolgozót a következő napra.',
    },
    max_daily_hours: {
      title: 'Napi óratúllépés',
      tip: 'A dolgozó aznapi összes munkaórái meghaladják a beállított napi maximumot.',
      suggestion: 'Rövidítsd le a műszakot, vegyél ki egy beosztást aznap, vagy növeld a dolgozó napi maximumát a profiljában.',
    },
    legal_max_daily_hours: {
      title: 'Törvényi napi maximum túllépés',
      tip: 'A napi munkaórák meghaladják a törvényi maximumot (általában 12 óra).',
      suggestion: 'Csökkentsd az aznapi összesített munkaidőt 12 óra alá.',
    },
    legal_weekly_hours_limit: {
      title: 'Törvényi heti maximum túllépés',
      tip: 'A dolgozó adott heti munkaórái meghaladják a törvényi heti maximumot (általában 48 óra).',
      suggestion: 'Vegyél ki egy műszakot ebből a hétből, vagy oszd el egyenletesebben a terhelést a heti beosztásban.',
    },
    double_shift: {
      title: 'Átfedő műszakok',
      tip: 'Ugyanannak a dolgozónak ugyanazon a napon két egymást átfedő műszakja van.',
      suggestion: 'Töröld vagy igazítsd az átfedő műszakok egyikét.',
    },
    time_off_violation: {
      title: 'Szabadságon lévő dolgozó beosztva',
      tip: 'A dolgozónak erre a napra jóváhagyott szabadsága vagy távolléte van, mégis be lett osztva.',
      suggestion: 'Töröld ezt a műszakot, és jelölj ki helyette egy elérhető kollégát.',
    },
    outside_opening_hours: {
      title: 'Nyitvatartáson kívüli műszak',
      tip: 'A beosztott műszak kezdete vagy vége kívül esik a beállított nyitvatartási időn.',
      suggestion: 'Igazítsd a műszak időpontját a nyitvatartáshoz, vagy módosítsd a nyitvatartást a tervezési kritériumokban.',
    },
    shift_type_permission: {
      title: 'Jogosulatlan műszaktípus',
      tip: 'A dolgozónak nincs engedélye az adott műszaktípushoz (pl. éjszakai, hétvégi műszak).',
      suggestion: 'Engedélyezd a műszaktípust a dolgozó profiljában, vagy cseréld le egy jogosult kollégára.',
    },
    site_permission: {
      title: 'Telephely-jogosultság hiánya',
      tip: 'A dolgozó nem rendelkezik jogosultsággal erre a telephelyre.',
      suggestion: 'Add hozzá a telephelyet a dolgozó beállításaihoz, vagy jelölj ki erre jogosult kollégát.',
    },
    max_staff: {
      title: 'Túl sok dolgozó a műszakban',
      tip: 'A beosztott létszám meghaladja az alapkritériumokban beállított maximumot.',
      suggestion: 'Vegyél ki egy dolgozót a műszakból, vagy emeld a maximum létszámot az alapkritériumokban.',
    },
    max_pharmacist: {
      title: 'Túl sok gyógyszerész a műszakban',
      tip: 'A beosztott gyógyszerészek száma meghaladja a beállított maximumot.',
      suggestion: 'Vegyél ki egy gyógyszerészt a műszakból, vagy emeld a maximum gyógyszerész értéket az alapkritériumokban.',
    },
  };
  return map[code] || {
    title: 'Ismeretlen hiba',
    tip: null,
    suggestion: 'Ellenőrizd a beosztást kézzel és javítsd a hibát.',
  };
}

// ── Full-screen pharmacy schedule calendar ────────────────────────────────────
function PharmacyScheduleCalendar({
  year, month, onChangeMonth, onClose,
  schedules, employees,
  preferences,
  user, userData, darkMode,
  market = 'hu',
  onSaveDaySchedules, saving,
  // action handlers passed through for the overlay toolbar
  onCopyPrev, onExport, onPublish, onAutoFix, onDeleteMonth, onPublishChanges,
  swapLog, setSwapLog, showSwapLog, setShowSwapLog,
  activeMonthSchedules, publishedScheduleCount,
  readOnly, ownScheduleIds, initialOwnView = true,
  config,
  pendingSwapRequests, onOpenSwaps,
  onAutoGenerate,
  plannerLoading,
  applyingPlanner: isApplying,
}) {
  // Prefer client-side market detection to avoid stale prop values in mode switches.
  market = market === 'de' || getClientMarket() === 'de' ? 'de' : 'hu';
  const isGenerating = plannerLoading || isApplying;
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [openFrom, setOpenFrom] = useState('08:00');
  const [openTo, setOpenTo] = useState('20:00');
  const [employeeRows, setEmployeeRows] = useState([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [publishBlockModal, setPublishBlockModal] = useState(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryProfiles, setSummaryProfiles] = useState([]);
  const [summaryProfilesLoading, setSummaryProfilesLoading] = useState(false);
  const [swapPickerRowIdx, setSwapPickerRowIdx] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null); // { scheduleId, date, employeeId, employeeName, from, to }
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapIgnoreRole, setSwapIgnoreRole] = useState(false);
  const [readOnlySwapSaving, setReadOnlySwapSaving] = useState(false);
  const [readOnlySwapDone, setReadOnlySwapDone] = useState(null); // success message
  const [ownView, setOwnView] = useState(initialOwnView); // readOnly: default to own-only view
  const [publishChangesLoading, setPublishChangesLoading] = useState(false);
  const [deleteMonthConfirm, setDeleteMonthConfirm] = useState(0); // 0=off 1=first 2=second

  // ── Load employee profiles when summary modal opens ───────────────────
  useEffect(() => {
    if (!showSummary) return;
    setSummaryProfilesLoading(false);
    setSummaryProfiles(employees
      .filter(e => e.linkedUserId)
      .map(e => ({
        userId: e.linkedUserId,
        birthDate: e.birthDate || '',
        childrenCount: e.childrenCount || 0,
        contractHours: e.contractHours || 8,
        vacationTakenThisYear: e.vacationTakenThisYear || 0,
        vacationCarriedOver: e.vacationCarriedOver || 0,
      })));
  }, [showSummary, employees]);

  // ── Staffing warnings: detect under-staffed templates when rows change ────
  const staffingWarnings = useMemo(() => {
    if (!showModal || !selectedDay || !config?.shiftTemplates?.length) return [];
    const dow = new Date(year, month - 1, selectedDay).getDay();
    const dayOpening = config?.operations?.openingHoursByWeekday?.[dow];
    if (dayOpening && !dayOpening.isOpen) return [];

    const openTime = dayOpening?.openTime || '00:00';
    const closeTime = dayOpening?.closeTime || '24:00';
    const enforce = config?.operations?.enforceOpeningHours !== false;

    function minsOf(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
    function fitsInDay(start, end) {
      if (!enforce) return true;
      return minsOf(start) >= minsOf(openTime) && minsOf(end) <= minsOf(closeTime);
    }
    function normalizeRoleLocal(r) {
      if (!r) return 'assistant';
      const s = String(r).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (s === 'pharmacist' || s === 'gyogyszeresz' || s === 'gyógyszerész') return 'pharmacist';
      return 'assistant';
    }

    const activeRows = employeeRows.filter(r => r.checked && !isOffShift(r.shiftType));
    // Only show warnings if there are some scheduled workers (day is not empty)
    if (activeRows.length === 0) return [];

    const warnings = [];
    for (const template of config.shiftTemplates) {
      if (template.onCall) continue;
      if (!fitsInDay(template.startTime, template.endTime)) continue;

      const workers = activeRows.filter(r => r.from === template.startTime && r.to === template.endTime);
      const pharmacists = workers.filter(r => normalizeRoleLocal(r.role) === 'pharmacist');
      const shortage = (template.requiredStaff || 0) - workers.length;
      const pharmacistShortage = (template.requiredPharmacists || 0) - pharmacists.length;

      if (shortage > 0 || pharmacistShortage > 0) {
        // Available replacements: unchecked employees (not already on vacation)
        const available = employeeRows.filter(r =>
          (!r.checked || isOffShift(r.shiftType)) && !r.isPublished
        );
        // Sort: pharmacists first if pharmacist is missing
        const sorted = [...available].sort((a, b) => {
          if (pharmacistShortage > 0) {
            const aP = normalizeRoleLocal(a.role) === 'pharmacist';
            const bP = normalizeRoleLocal(b.role) === 'pharmacist';
            if (aP && !bP) return -1;
            if (!aP && bP) return 1;
          }
          return a.name.localeCompare(b.name, 'hu');
        });
        warnings.push({ template, workers: workers.length, required: template.requiredStaff || 0, pharmacists: pharmacists.length, requiredPharmacists: template.requiredPharmacists || 0, shortage: Math.max(0, shortage), pharmacistShortage: Math.max(0, pharmacistShortage), suggestions: sorted });
      }
    }
    return warnings;
  }, [showModal, selectedDay, employeeRows, config, year, month]);

  // Hide bottom nav while overlay is visible
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('calendar-overlay-open'));
    return () => window.dispatchEvent(new CustomEvent('calendar-overlay-close'));
  }, []);

  const today = getTodayKey();
  const monthNames = market === 'de' ? MONTHS_DE : MONTHS_HU;
  const dayNamesLong = market === 'de' ? DAYS_LONG_DE : DAYS_LONG_HU;
  const monthLabel = monthNames[month - 1];

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
      setSwapPickerRowIdx(null);
      setSwapTarget(null);
      setSwapIgnoreRole(false);
      setShowModal(false);
    } finally {
      setModalSaving(false);
    }
  }

  async function executeSwap(rowIdx) {
    if (!swapTarget) return;
    const row = employeeRows[rowIdx];
    const currentDateKey = formatDateKey(year, month, selectedDay);
    setSwapSaving(true);
    try {
      const bScheduleData = schedules.find(s => s.id === swapTarget.scheduleId);
      const empA = employees.find(e => e.id === row.employeeId);

      // 1. Mark B's schedule on the target day as deleted
      await updateDoc(doc(db, 'pharmacySchedules', swapTarget.scheduleId), {
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });

      // 2. Create A's schedule on the target day (with B's times)
      await addDoc(collection(db, 'pharmacySchedules'), {
        pharmacyId: user?.uid || '',
        pharmacyName: userData?.pharmacyName || userData?.name || user?.email || '',
        date: swapTarget.date,
        year: Number(swapTarget.date.split('-')[0]),
        month: Number(swapTarget.date.split('-')[1]),
        day: Number(swapTarget.date.split('-')[2]),
        employeeId: row.employeeId,
        employeeName: row.name,
        employeeEmail: empA?.email || row.email || '',
        linkedUserId: empA?.linkedUserId || row.linkedUserId || null,
        role: empA?.role || row.role || 'other',
        startTime: swapTarget.from,
        endTime: swapTarget.to,
        shiftType: bScheduleData?.shiftType || 'N',
        notes: `Csere: ${row.name} ↔ ${swapTarget.employeeName}`,
        locked: false,
        status: 'active',
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Update current day rows: uncheck A, check B with A's times
      const newRows = employeeRows.map((r, i) => {
        if (i === rowIdx) return { ...r, checked: false, shiftType: 'N' };
        if (r.employeeId === swapTarget.employeeId) return { ...r, checked: true, shiftType: row.shiftType || 'N', from: row.from, to: row.to };
        return r;
      });
      setEmployeeRows(newRows);

      // 4. Save current day
      await onSaveDaySchedules(currentDateKey, newRows);

      setSwapLog(prev => [...prev, {
        nameA: row.name,
        dateA: currentDateKey,
        fromA: row.from,
        toA: row.to,
        nameB: swapTarget.employeeName,
        dateB: swapTarget.date,
        fromB: swapTarget.from,
        toB: swapTarget.to,
      }]);
      setSwapTarget(null);
      setSwapPickerRowIdx(null);
      setSwapIgnoreRole(false);
    } catch (err) {
      console.error('executeSwap error', err);
    } finally {
      setSwapSaving(false);
    }
  }

  async function executeReadOnlySwapRequest(rowIdx) {
    if (!swapTarget) return;
    const row = employeeRows[rowIdx];
    const requesterScheduleId = row.existingId;
    const targetScheduleId = swapTarget.scheduleId;
    if (!requesterScheduleId || !targetScheduleId) return;
    const requesterSchedule = schedules.find(s => s.id === requesterScheduleId);
    const targetSchedule = schedules.find(s => s.id === targetScheduleId);
    if (!requesterSchedule || !targetSchedule) return;
    setReadOnlySwapSaving(true);
    try {
      await addDoc(collection(db, 'scheduleSwapRequests'), {
        pharmacyId: requesterSchedule.pharmacyId,
        requesterUserId: user?.uid || '',
        requesterName: requesterSchedule.employeeName,
        requesterEmail: user?.email || requesterSchedule.employeeEmail || '',
        requesterScheduleId: requesterSchedule.id,
        requesterScheduleDate: requesterSchedule.date,
        requesterFrom: requesterSchedule.from || requesterSchedule.startTime || '',
        requesterTo: requesterSchedule.to || requesterSchedule.endTime || '',
        targetScheduleId: targetSchedule.id,
        targetUserId: targetSchedule.linkedUserId || null,
        targetName: targetSchedule.employeeName,
        targetEmail: targetSchedule.employeeEmail || '',
        targetScheduleDate: targetSchedule.date,
        targetFrom: targetSchedule.from || targetSchedule.startTime || '',
        targetTo: targetSchedule.to || targetSchedule.endTime || '',
        date: requesterSchedule.date,
        targetDate: targetSchedule.date,
        message: '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (targetSchedule.linkedUserId) {
        await createNotificationWithPush({
          userId: targetSchedule.linkedUserId,
          type: 'schedule_swap_request',
          title: market === 'de' ? 'Diensttausch-Anfrage' : 'Beosztás csere igény',
          message: market === 'de'
            ? `${requesterSchedule.employeeName} hat eine Tauschanfrage fuer deinen Dienst gesendet (${requesterSchedule.date} ${requesterSchedule.startTime}-${requesterSchedule.endTime}).`
            : `${requesterSchedule.employeeName} csereigényt küldött a beosztásodra (${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime}).`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }
      if (requesterSchedule.pharmacyId) {
        await createNotificationWithPush({
          userId: requesterSchedule.pharmacyId,
          type: 'schedule_swap_request_for_pharmacy',
          title: market === 'de' ? 'Neue Diensttausch-Anfrage' : 'Új beosztás csere igény',
          message: market === 'de'
            ? `${requesterSchedule.employeeName} hat einen Tausch mit dem Dienst von ${targetSchedule.employeeName} angefragt.`
            : `${requesterSchedule.employeeName} cserét kért ${targetSchedule.employeeName} beosztásával.`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }
      setReadOnlySwapDone(
        market === 'de'
          ? `Tauschanfrage an ${targetSchedule.employeeName} gesendet!`
          : `Csereigény elküldve ${targetSchedule.employeeName} felé!`
      );
      setSwapTarget(null);
      setSwapPickerRowIdx(null);
      setSwapIgnoreRole(false);
    } catch (err) {
      console.error('executeReadOnlySwapRequest error', err);
    } finally {
      setReadOnlySwapSaving(false);
    }
  }

  async function handlePublishClick() {
    if ((activeMonthSchedules?.length ?? 0) === 0) {
      setPublishBlockModal([{ message: market === 'de' ? 'In diesem Monat gibt es keinen ausgefuellten Dienstplan.' : 'Nincs kitöltött beosztás ebben a hónapban.' }]);
      return;
    }
    const result = await onPublish();
    if (result && !result.success && result.blockingErrors?.length > 0) {
      setPublishBlockModal(result.blockingErrors);
    }
  }

  const selectedDateKey = selectedDay ? formatDateKey(year, month, selectedDay) : null;
  const selectedDayName = selectedDay
    ? dayNamesLong[new Date(year, month - 1, selectedDay).getDay()]
    : '';
  const holidays = getHungarianHolidays(year);
  const DOW_LABELS = dayNamesLong;

  // ── Calendar render — full-screen fixed overlay ───────────────────────────
  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`} style={{touchAction:'pan-x'}}>
      {/* Publish block modal (bottom sheet) */}
      {publishBlockModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setPublishBlockModal(null)}>
          <div className={`rounded-t-2xl p-5 space-y-4 max-h-[60vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Warum kann nicht veroeffentlicht werden?' : 'Miért nem publikálható?'}</h3>
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
                  <><span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" /><span>{market === 'de' ? 'Korrektur laeuft...' : 'Javítás folyamatban...'}</span></>
                ) : (
                  <><span>✨</span><span>{market === 'de' ? 'Automatische Korrektur' : 'Automatikus javítás'}</span></>
                )}
              </button>
            )}

            {autoFixResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                autoFixResult.fixed > 0
                  ? (darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                  : (darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-700')
              }`}>
                {autoFixResult.fixed > 0
                  ? (market === 'de' ? `✅ ${autoFixResult.fixed} Schichten korrigiert - Pruefung laeuft...` : `✅ ${autoFixResult.fixed} műszak javítva – ellenőrzés folyamatban...`)
                  : (market === 'de' ? '⚠️ Es wurden keine automatisch korrigierbaren Fehler gefunden. Bitte den Dienstplan manuell pruefen.' : '⚠️ Nem találtam automatikusan javítható hibát. Kézzel ellenőrizd a beosztást.')}
              </div>
            )}

            {/* Grouped error cards with explanations and suggestions */}
            {(() => {
              const seen = new Set();
              const uniqueErrors = publishBlockModal.filter(e => {
                const k = e.code || 'unknown';
                if (seen.has(k)) return false;
                seen.add(k); return true;
              });
              return (
                <div className="space-y-3">
                  {uniqueErrors.map((err, i) => {
                    const advice = getErrorAdvice(err.code, market);
                    const group = publishBlockModal.filter(e => (e.code || 'unknown') === (err.code || 'unknown'));
                    return (
                      <div key={i} className={`rounded-xl border p-4 ${darkMode ? 'border-rose-700 bg-rose-900/30' : 'border-rose-200 bg-rose-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex-shrink-0">🚫</span>
                          <span className={`font-semibold text-sm flex-1 ${darkMode ? 'text-rose-200' : 'text-rose-800'}`}>{advice.title}</span>
                          {group.length > 1 && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${darkMode ? 'bg-rose-800 text-rose-200' : 'bg-rose-200 text-rose-700'}`}>{group.length} eset</span>}
                        </div>
                        {advice.tip && <p className={`text-xs mb-2 ${darkMode ? 'text-rose-300' : 'text-rose-700'}`}>{advice.tip}</p>}
                        <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 mb-2 ${darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                          <span className="flex-shrink-0">💡</span>
                          <span>{advice.suggestion}</span>
                        </div>
                        <div className="space-y-1">
                          {group.map((e2, j) => (
                            <p key={j} className={`text-xs pl-2 border-l-2 ${darkMode ? 'border-rose-700 text-rose-400' : 'border-rose-300 text-rose-600'}`}>{e2.message}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Bitte behebe die Fehler und versuche die Veroeffentlichung erneut.' : 'Javítsd a hibákat, majd próbáld újra a publikálást.'}</p>
          </div>
        </div>
      )}

      {/* Overlay header */}
      <div className={`flex-shrink-0 flex flex-col border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-gradient-to-r from-violet-600 to-indigo-600'}`}>
        {/* Row 1: action buttons */}
        <div className="flex items-center gap-2 px-3" style={{height:'48px'}}>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
          >
            ×
          </button>
          {/* Summary info */}
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            title={market === 'de' ? 'Monatsuebersicht' : 'Havi összefoglaló'}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white"
          >
            <Info className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          {/* Own/All toggle — only in readOnly mode */}
          {readOnly && ownScheduleIds && (
            <div className={`flex rounded-xl overflow-hidden border ${darkMode ? 'border-white/20' : 'border-white/30'}`}>
              <button
                type="button"
                onClick={() => setOwnView(true)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  ownView ? 'bg-white text-violet-700' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >{market === 'de' ? 'Eigene' : 'Saját'}</button>
              <button
                type="button"
                onClick={() => setOwnView(false)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  !ownView ? 'bg-white text-violet-700' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >{market === 'de' ? 'Alle' : 'Összes'}</button>
            </div>
          )}
          {/* Actions — hidden in readOnly mode */}
          {!readOnly && (
            <>
              <button type="button" onClick={onCopyPrev} disabled={saving} title={market === 'de' ? 'Vorherigen Monat kopieren' : 'Előző hónap másolása'} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={onExport} title="CSV export" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white">
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setDeleteMonthConfirm(1)} disabled={saving} title={market === 'de' ? 'Monatsdienstplan loeschen' : 'Havi beosztás törlése'} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/70 hover:bg-rose-500/90 text-white disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {/* Row 2: month/year navigation */}
        <div className="flex items-center justify-center gap-3 px-3 pb-2">
          <button
            type="button"
            onClick={() => onChangeMonth('prev')}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
          >
            ‹
          </button>
          <div className="text-center">
            <span className="text-white font-bold text-lg tracking-tight">{monthLabel} {year}</span>
          </div>
          <button
            type="button"
            onClick={() => onChangeMonth('next')}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
          >
            ›
          </button>
        </div>
      </div>
      {/* Publish status bar */}
      {!readOnly && (() => {
        const cnt = activeMonthSchedules?.length ?? 0;
        const canPublish = cnt > 0;
        const alreadyPublished = publishedScheduleCount > 0;
        const statusText = !canPublish
          ? (market === 'de' ? 'Nicht veroeffentlichbar - Kein ausgefuellter Dienstplan' : 'Nem publikálható – Nincs kitöltött beosztás')
          : alreadyPublished
            ? (market === 'de' ? 'Bereits veroeffentlicht - Erneute Veroeffentlichung moeglich' : 'Már publikálva – Újra publikálható')
            : (market === 'de' ? 'Bereit zur Veroeffentlichung' : 'Kész a publikálásra');
        return (
          <div className={`flex-shrink-0 border-b ${
            !canPublish
              ? (darkMode ? 'bg-rose-900/30 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600')
              : alreadyPublished
                ? (darkMode ? 'bg-violet-900/30 border-violet-800/60 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-700')
                : (darkMode ? 'bg-emerald-900/30 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
          }`}>
            <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                <span>{!canPublish ? '⛔' : alreadyPublished ? '✅' : '✅'}</span>
                <span className="truncate">{statusText}</span>
              </div>
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={saving || !canPublish}
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                  canPublish
                    ? alreadyPublished
                      ? (darkMode ? 'bg-violet-500 text-white hover:bg-violet-400' : 'bg-violet-600 text-white hover:bg-violet-700')
                      : (darkMode ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-emerald-600 text-white hover:bg-emerald-700')
                    : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500')
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving
                  ? (market === 'de' ? 'Veroeffentlichen...' : 'Publikálás...')
                  : alreadyPublished
                    ? (market === 'de' ? 'Erneut veroeffentlichen' : 'Újrapublikálás')
                    : canPublish
                      ? (market === 'de' ? 'Dienstplan veroeffentlichen' : 'Beosztás publikálása')
                      : (market === 'de' ? 'Nichts zu veroeffentlichen' : 'Nincs mit publikálni')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* AI Schedule generation button */}
      {!readOnly && (
        <button
          type="button"
          onClick={onAutoGenerate}
          disabled={saving || plannerLoading}
          className={`flex-shrink-0 w-full flex items-center gap-3 px-4 py-3 text-sm font-bold border-b transition-colors disabled:opacity-50 ${
            darkMode
              ? 'bg-violet-900/40 border-violet-700/60 text-violet-200 hover:bg-violet-900/60'
              : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
          }`}
        >
          {plannerLoading
            ? <span className="animate-spin text-lg">⏳</span>
            : <span className="text-lg">✨</span>
          }
          <div className="flex flex-col items-start">
            <span>{plannerLoading ? (market === 'de' ? 'KI-Planung laeuft...' : 'AI tervezés folyamatban...') : (market === 'de' ? 'KI-Dienstplan-Generierung' : 'AI Beosztás-generálás')}</span>
            <span className={`text-[11px] font-normal ${darkMode ? 'text-violet-300/70' : 'text-violet-500/80'}`}>
              {plannerLoading
                ? (market === 'de' ? 'Das kann ein paar Sekunden dauern' : 'Ez eltarthat néhány másodpercig')
                : (market === 'de' ? 'Automatische Monatsplanung und sofortiges Speichern' : 'Automatikus havi beosztás tervezése és azonnali mentése')}
            </span>
          </div>
          {!plannerLoading && <ChevronRight className="h-4 w-4 ml-auto flex-shrink-0" />}
        </button>
      )}

      {/* Swap changes banner */}
      {swapLog.length > 0 && !readOnly && (
        <button
          type="button"
          onClick={() => setShowSwapLog(true)}
          className={`flex-shrink-0 w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b transition-colors ${darkMode ? 'bg-amber-900/30 border-amber-700/60 text-amber-300 hover:bg-amber-900/50' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
        >
          <span>🔄</span>
          <span>{market === 'de' ? `${swapLog.length} Tausch-Aenderungen sind noch nicht veroeffentlicht - Aenderungen anzeigen` : `${swapLog.length} csere nincs publikálva – Változtatások megtekintése`}</span>
          <ChevronRight className="h-3 w-3 ml-auto" />
        </button>
      )}

      {/* Swap log overlay */}
      {showSwapLog && (
        <div className={`absolute inset-0 z-30 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500">
            <button
              type="button"
              onClick={() => setShowSwapLog(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
            >×</button>
            <span className="text-white font-bold text-base flex-1">{market === 'de' ? 'Gespeicherte Aenderungen' : 'Rögzített változtatások'}</span>
            <span className="text-white/70 text-xs">{market === 'de' ? `${swapLog.length} Tausche` : `${swapLog.length} csere`}</span>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {swapLog.map((entry, idx) => {
              const [ayear, amonth, aday] = entry.dateA.split('-').map(Number);
              const [byear, bmonth, bday] = entry.dateB.split('-').map(Number);
              const dowA = new Date(ayear, amonth - 1, aday).getDay();
              const dowB = new Date(byear, bmonth - 1, bday).getDay();
              const labelA = `${monthNames[amonth-1]} ${aday}. (${DOW_LABELS[dowA]})`;
              const labelB = `${monthNames[bmonth-1]} ${bday}. (${DOW_LABELS[dowB]})`;
              return (
                <div key={idx} className={`rounded-xl border p-3 ${darkMode ? 'border-amber-700/60 bg-amber-900/20' : 'border-amber-200 bg-amber-50'}`}>
                  <div className={`flex items-center gap-2 text-sm font-bold mb-2 ${darkMode ? 'text-amber-200' : 'text-amber-900'}`}>
                    <span>{entry.nameA}</span>
                    <span className="text-amber-500">⇄</span>
                    <span>{entry.nameB}</span>
                  </div>
                  <div className={`text-xs space-y-1 ${darkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>
                    <div><span className="font-semibold">{entry.nameA}:</span> {labelA} {entry.fromA}–{entry.toA} → {labelB} {entry.fromB}–{entry.toB}</div>
                    <div><span className="font-semibold">{entry.nameB}:</span> {labelB} {entry.fromB}–{entry.toB} → {labelA} {entry.fromA}–{entry.toA}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div className={`flex-shrink-0 flex gap-3 p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={() => setShowSwapLog(false)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >{market === 'de' ? 'Schliessen' : 'Bezárás'}</button>
            <button
              type="button"
              disabled={publishChangesLoading}
              onClick={async () => {
                setPublishChangesLoading(true);
                try {
                  await onPublishChanges(swapLog);
                  setSwapLog([]);
                  setShowSwapLog(false);
                } finally {
                  setPublishChangesLoading(false);
                }
              }}
              className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {publishChangesLoading ? <span className="animate-spin">⏳</span> : <Send className="h-4 w-4" />}
              {publishChangesLoading
                ? (market === 'de' ? 'Veroeffentlichen...' : 'Publikálás...')
                : (market === 'de' ? 'Aenderungen veroeffentlichen' : 'Változtatások publikálása')}
            </button>
          </div>
        </div>
      )}

      {/* Day list — full width, vertically scrollable */}
      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        {/* AI generation loading overlay */}
        {isGenerating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 px-8 text-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-2xl">✨</span>
              </div>
              <div>
                <p className="text-base font-bold text-violet-700">
                  {isApplying
                    ? (market === 'de' ? 'Dienste werden gespeichert...' : 'Műszakok mentése...')
                    : (market === 'de' ? 'KI-Planung laeuft...' : 'AI tervezés folyamatban...')}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {isApplying
                    ? (market === 'de' ? 'Der vorgeschlagene Dienstplan wird gespeichert' : 'A javasolt beosztás rögzítése történik')
                    : (market === 'de' ? 'Die Planung erfolgt anhand von Praeferenzen und Regeln' : 'Preferenciák és szabályok alapján tervezünk')}
                </p>
              </div>
              <div className="flex gap-1 mt-2">
                {[0,1,2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {/* readOnly + Saját nézet: iOS-style month grid */}
        {readOnly && ownView && (
          <div className="px-3 pt-3 pb-2">
            <MonthCalendar
              year={year}
              month={month}
              selectedDate={selectedDay ? formatDateKey(year, month, selectedDay) : null}
              schedules={schedules}
              ownScheduleIds={ownScheduleIds}
              onSelectDate={(dateKey) => {
                const day = Number(dateKey.split('-')[2]);
                openDay(day);
              }}
              darkMode={darkMode}
              filterOwn={ownView}
              pendingSwapRequests={pendingSwapRequests}
              onOpenSwaps={onOpenSwaps}
              market={market}
            />
          </div>
        )}
        {/* Admin mode + readOnly Összes: full day list */}
        {(!readOnly || !ownView) && Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map(day => {
          const dateKey = formatDateKey(year, month, day);
          const allDayScheds = schedules.filter(s => s.date === dateKey && s.status !== 'deleted');
          const dayScheds = (readOnly && ownView && ownScheduleIds)
            ? allDayScheds.filter(s => ownScheduleIds.has(s.id))
            : allDayScheds;
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

              </div>
              {/* Employee chips */}
              {dayScheds.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {dayScheds.map(s => {
                    const st = getShiftType(s.shiftType || 'N', market);
                    const hrs = calcHours(s.startTime, s.endTime, market);
                    return (
                      <div
                        key={s.id}
                        style={{ background: pastel.chipBg }}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${darkMode ? 'border-white/5' : 'border-black/5'} shadow-sm`}
                      >
                        <span className={`flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        <span className={`flex-1 text-sm font-medium ${
                          readOnly
                            ? ownScheduleIds?.has(s.id)
                              ? (darkMode ? 'text-sky-300 font-bold' : 'text-sky-700 font-bold')
                              : (darkMode ? 'text-gray-500' : 'text-gray-400')
                            : (darkMode ? 'text-gray-100' : 'text-gray-800')
                        }`}>
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
                <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  {readOnly && ownView
                    ? (market === 'de' ? 'Keine eigenen Dienste' : 'Nincs műszakod')
                    : (market === 'de' ? 'Kein Dienstplan' : 'Nincs beosztás')}
                </p>
              )}
              {/* Preference chips */}
              {dayPrefs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {dayPrefs.map(p => {
                    const st = getShiftType(p.shiftType || 'N', market);
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium border ${darkMode ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                      >
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${st.bg} ${st.text}`}>{st.label}</span>
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

      {/* ── Delete month confirmation modal ──────────────────────────────── */}
      {deleteMonthConfirm > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{backdropFilter:'blur(6px)', background:'rgba(0,0,0,0.6)'}}>
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border border-rose-800' : 'bg-white border border-rose-200'}`}>
            <div className="bg-gradient-to-br from-rose-600 to-red-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🗑️</span>
                <div>
                  <p className="text-rose-100 text-xs font-semibold uppercase tracking-widest">{market === 'de' ? 'Achtung' : 'Figyelem'}</p>
                  <h3 className="text-white font-black text-lg">
                    {deleteMonthConfirm === 1
                      ? (market === 'de' ? 'Monatsdienstplan loeschen?' : 'Törlöd a havi beosztást?')
                      : (market === 'de' ? 'Wirklich loeschen?' : 'Biztosan törlöd?')}
                  </h3>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {deleteMonthConfirm === 1 ? (
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {market === 'de'
                    ? <>Dies loescht alle Dienstplan-Eintraege von <strong>{monthLabel} {year}</strong>, inklusive bereits veroeffentlichter Dienste.</>
                    : <>Ez törli <strong>{monthLabel} {year}</strong> összes beosztás-bejegyzését, beleértve a már publikált műszakokat is.</>}
                </p>
              ) : (
                <div className={`rounded-xl border px-4 py-3 ${darkMode ? 'border-rose-800 bg-rose-900/30 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <p className="text-sm font-bold">{market === 'de' ? 'Diese Aktion kann nicht rueckgaengig gemacht werden!' : 'Ez a művelet nem vonható vissza!'}</p>
                  <p className="text-xs mt-1">{market === 'de' ? `Alle Dienste (auch veroeffentlichte) werden aus ${monthLabel} ${year} endgueltig geloescht.` : `Az összes műszak (publikált is) véglegesen törlődik ${monthLabel} ${year} hónapból.`}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteMonthConfirm(0)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  {market === 'de' ? 'Abbrechen' : 'Mégse'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteMonthConfirm === 1) {
                      setDeleteMonthConfirm(2);
                    } else {
                      setDeleteMonthConfirm(0);
                      onDeleteMonth && onDeleteMonth();
                    }
                  }}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {deleteMonthConfirm === 1
                    ? (market === 'de' ? 'Weiter →' : 'Folytatás →')
                    : (market === 'de' ? '🗑️ Endgueltig loeschen' : '🗑️ Végleges törlés')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly summary overlay ───────────────────────────────────────── */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{background: darkMode ? '#111827' : '#F9FAFB'}}>
          {/* Header */}
          <div className={`flex-shrink-0 flex items-center gap-2 px-3 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-gradient-to-r from-violet-600 to-indigo-600'}`} style={{height:'56px'}}>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none"
            >
              ×
            </button>
            <div className="flex-1 text-center">
              <span className="text-white font-bold text-base tracking-tight">{monthLabel} {year} {market === 'de' ? '– Uebersicht' : '– összefoglaló'}</span>
            </div>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-3">
            {summaryProfilesLoading ? (
              <div className={`text-center text-sm py-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{market === 'de' ? 'Wird geladen...' : 'Betöltés…'}</div>
            ) : (() => {
              const activeEmps = employees.filter(e => e.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name, 'hu'));
              const monthSchedules = schedules.filter(s => s.status !== 'deleted');
              const monthPrefs = preferences ? preferences.filter(p => p.status !== 'deleted') : [];
              const daysInMonth = getDaysInMonth(year, month);

              return activeEmps.map(emp => {
                const empScheds = monthSchedules.filter(s =>
                  s.employeeId === emp.id ||
                  (s.employeeEmail && emp.email && s.employeeEmail.toLowerCase() === emp.email.toLowerCase())
                );
                const workScheds = empScheds.filter(s => !isOffShift(s.shiftType));
                const szScheds   = empScheds.filter(s => normalizeShiftTypeKey(s.shiftType) === 'Sz');
                const pScheds    = empScheds.filter(s => normalizeShiftTypeKey(s.shiftType) === 'P');

                // Hours from schedules
                const scheduledHours = workScheds.reduce((sum, s) => {
                  if (!s.startTime || !s.endTime) return sum;
                  const [sh, sm] = s.startTime.split(':').map(Number);
                  const [eh, em] = s.endTime.split(':').map(Number);
                  return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                }, 0);

                // Sz days from preferences too (count unique dates not already in schedules)
                const empPrefs = monthPrefs.filter(p =>
                  p.employeeId === emp.id ||
                  (p.employeeEmail && emp.email && p.employeeEmail.toLowerCase() === emp.email.toLowerCase())
                );
                const prefSzDates = new Set(empPrefs.filter(p => normalizeShiftTypeKey(p.shiftType) === 'Sz').map(p => p.date));
                const schedSzDates = new Set(szScheds.map(s => s.date));
                const allSzDates = new Set([...schedSzDates, ...prefSzDates]);
                const szDays = allSzDates.size;

                // Profile data
                const profile = summaryProfiles.find(pr => pr.userId === emp.linkedUserId);
                const contractHours = Number(profile?.contractHours) || 0;
                const monthlyRequired = contractHours ? calcMonthlyRequiredHours(contractHours, year, month) : 0;
                const hourDiff = monthlyRequired > 0 ? scheduledHours - monthlyRequired : null;

                const annualVac = profile?.birthDate
                  ? calcAnnualVacationDays(profile.birthDate, profile.childrenCount, year)
                  : null;
                const carryOver = Number(profile?.vacationCarriedOver) || 0;
                const takenThisYear = Number(profile?.vacationTakenThisYear) || 0;
                const totalVac = annualVac !== null ? annualVac + carryOver - takenThisYear : null;
                const vacAfter = totalVac !== null ? totalVac - szDays : null;

                const isPharmacist = (emp.role === 'pharmacist' || emp.role === 'gyógyszerész');
                const roleColor = isPharmacist
                  ? (darkMode ? 'text-violet-300' : 'text-violet-700')
                  : (darkMode ? 'text-emerald-300' : 'text-emerald-700');
                const roleBg = isPharmacist
                  ? (darkMode ? 'bg-violet-900/30 border-violet-700/40' : 'bg-violet-50 border-violet-200')
                  : (darkMode ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-emerald-50 border-emerald-200');

                return (
                  <div
                    key={emp.id}
                    className={`rounded-2xl border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} shadow-sm`}
                  >
                    {/* Name + role */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex-shrink-0`}>
                        {emp.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{emp.name}</p>
                        <p className={`text-xs font-medium ${roleColor}`}>{isPharmacist ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész') : (market === 'de' ? 'Assistenz' : 'Asszisztens')}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${roleBg} ${roleColor}`}>
                        {workScheds.length} {market === 'de' ? 'Dienste' : 'műszak'}
                      </span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Scheduled hours */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Eingeplante Stunden' : 'Beosztott órák'}</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {scheduledHours % 1 === 0 ? scheduledHours : scheduledHours.toFixed(1)}<span className="text-sm font-semibold ml-0.5">{market === 'de' ? 'Std' : 'ó'}</span>
                        </p>
                        {monthlyRequired > 0 && (
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? `Soll: ${monthlyRequired} Std` : `Keret: ${monthlyRequired}ó`}</p>
                        )}
                        {hourDiff !== null && (
                          <p className={`text-xs font-semibold mt-0.5 ${
                            hourDiff >= 0
                              ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                              : (darkMode ? 'text-rose-400' : 'text-rose-600')
                          }`}>
                            {hourDiff >= 0 ? '+' : ''}{hourDiff % 1 === 0 ? hourDiff : hourDiff.toFixed(1)}ó
                          </p>
                        )}
                      </div>

                      {/* Vacation */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Urlaub' : 'Szabadság'}</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                          {szDays}<span className="text-sm font-semibold ml-0.5">{market === 'de' ? 'Tage' : 'nap'}</span>
                        </p>
                        {totalVac !== null && (
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? `Jahreskontingent: ${totalVac} Tage` : `Éves keret: ${totalVac} nap`}</p>
                        )}
                        {vacAfter !== null && (
                          <p className={`text-xs font-semibold mt-0.5 ${
                            vacAfter >= 0
                              ? (darkMode ? 'text-sky-400' : 'text-sky-600')
                              : (darkMode ? 'text-rose-400' : 'text-rose-600')
                          }`}>
                            {market === 'de' ? 'Rest:' : 'Maradék:'} {Math.max(0, vacAfter)} {market === 'de' ? 'Tage' : 'nap'}
                          </p>
                        )}
                      </div>

                      {/* Working days */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Arbeitstage' : 'Munkanapok'}</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {workScheds.length}<span className={`text-xs font-medium ml-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>/ {daysInMonth}</span>
                        </p>
                      </div>

                      {/* Off days */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Abwesenheiten' : 'Távollétek'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {szDays > 0 && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-400 text-white`}>
                              Sz {szDays}
                            </span>
                          )}
                          {pScheds.length > 0 && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-400 text-white`}>
                              P {pScheds.length}
                            </span>
                          )}
                          {szDays === 0 && pScheds.length === 0 && (
                            <span className={`text-sm font-black ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>–</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

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
                  <span className="text-violet-200 text-xs font-medium">{market === 'de' ? 'Oeffnungszeiten:' : 'Nyitvatartás:'}</span>
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
                      {market === 'de' ? 'Auf alle anwenden' : 'Alkalmaz mindenkire'}
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
                  {market === 'de'
                    ? `Mitarbeitende (${employeeRows.filter(r => r.checked).length}/${employeeRows.length} ausgewaehlt)`
                    : `Dolgozók (${employeeRows.filter(r => r.checked).length}/${employeeRows.length} kiválasztva)`}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => toggleAll(true)} className={`text-xs px-3 py-1 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    {market === 'de' ? 'Alle' : 'Mindenki'}
                  </button>
                  <button type="button" onClick={() => toggleAll(false)} className={`text-xs px-3 py-1 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    {market === 'de' ? 'Keine' : 'Senki'}
                  </button>
                </div>
              </div>

              {employeeRows.length === 0 && (
                <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {market === 'de' ? 'Keine aktiven Mitarbeitenden. Fuege Personen im Tab Mitarbeitende hinzu.' : 'Nincs aktív dolgozó. Adj hozzá dolgozókat a Dolgozók fülön.'}
                </p>
              )}

              {employeeRows.map((row, idx) => {
                const rowReadOnly = row.isPublished || row.locked;
                const st = getShiftType(row.shiftType, market);
                const hrs = calcHours(row.from, row.to, market);
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
                    <span className={`flex-1 font-semibold text-sm min-w-[120px] ${row.isPublished ? 'opacity-60' : ''} ${
                      readOnly
                        ? ownScheduleIds?.has(row.existingId)
                          ? (darkMode ? 'text-sky-300' : 'text-sky-700')
                          : (darkMode ? 'text-gray-500' : 'text-gray-400')
                        : (darkMode ? 'text-gray-100' : 'text-gray-800')
                    }`}>
                      {row.name}
                      {row.isPublished && <span className="ml-2 text-[10px] font-normal text-amber-600">{market === 'de' ? 'gesperrt' : 'zárolt'}</span>}
                      {!row.isPublished && row.locked && <span className="ml-2 text-[10px] font-normal text-sky-600">locked</span>}
                    </span>

                    {!row.isPublished && (
                      <button
                        type="button"
                        onClick={() => updateRow(idx, { locked: !row.locked })}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold border ${row.locked
                          ? (darkMode ? 'border-sky-500 bg-sky-700/50 text-sky-100' : 'border-sky-300 bg-sky-100 text-sky-700')
                          : (darkMode ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-300 bg-white text-gray-600')}`}
                        title={market === 'de' ? 'Manuelle Sperre: Planer aendert nicht' : 'Kézi lock: a tervező nem módosítja'}
                      >
                        {row.locked
                          ? (market === 'de' ? 'Lock: AN' : 'Lock: BE')
                          : (market === 'de' ? 'Lock: AUS' : 'Lock: KI')}
                      </button>
                    )}

                    {/* Csere gomb – csak aktív (checked, nem kiadott) sorokon */}
                    {row.checked && !isOffShift(row.shiftType) && !row.isPublished && (
                      <button
                        type="button"
                        onClick={() => setSwapPickerRowIdx(swapPickerRowIdx === idx ? null : idx)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-colors ${
                          swapPickerRowIdx === idx
                            ? (darkMode ? 'border-rose-500 bg-rose-700/50 text-rose-100' : 'border-rose-400 bg-rose-50 text-rose-700')
                            : (darkMode ? 'border-indigo-600 bg-indigo-900/40 text-indigo-200' : 'border-indigo-300 bg-indigo-50 text-indigo-700')
                        }`}
                        title={market === 'de' ? 'Tausch: Vertretung auswaehlen' : 'Csere: helyettesítő kiválasztása'}
                      >
                        {market === 'de' ? '⇄ Tausch' : '⇄ Csere'}
                      </button>
                    )}

                    {/* Csere kérése gomb – readOnly nézetben saját műszakon */}
                    {readOnly && row.checked && !isOffShift(row.shiftType) && ownScheduleIds?.has(row.existingId) && (
                      <button
                        type="button"
                        onClick={() => { setReadOnlySwapDone(null); setSwapPickerRowIdx(swapPickerRowIdx === idx ? null : idx); setSwapTarget(null); }}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-colors ${
                          swapPickerRowIdx === idx
                            ? (darkMode ? 'border-rose-500 bg-rose-700/50 text-rose-100' : 'border-rose-400 bg-rose-50 text-rose-700')
                            : (darkMode ? 'border-sky-600 bg-sky-900/40 text-sky-200' : 'border-sky-300 bg-sky-50 text-sky-700')
                        }`}
                        title={market === 'de' ? 'Tausch mit Kollegin/Kollege anfragen' : 'Csere kérése egy kollégával'}
                      >
                        {market === 'de' ? '⇄ Tausch anfragen' : '⇄ Csere kérése'}
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
                            {market === 'de' ? `${row.name} moechte diese Schicht:` : `${row.name} szeretné ezt a műszakot:`} {getShiftType(empPref.shiftType, market).title}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {empPref.startTime && empPref.endTime && (
                              <span className={`text-xs tabular-nums ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{empPref.startTime}–{empPref.endTime}</span>
                            )}
                            {(() => { const h = calcHours(empPref.startTime, empPref.endTime, market); return h ? <span className={`text-xs font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{h}</span> : null; })()}
                            {empPref.notes && <span className={`text-xs italic ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>"{empPref.notes}"</span>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Csere panel ─────────────────────────────────────── */}
                    {swapPickerRowIdx === idx && (() => {
                      const currentDateKey = formatDateKey(year, month, selectedDay);
                      // Build candidate map from month schedules: employees with non-off, non-deleted shifts (excluding current employee)
                      const empMap = new Map();
                      const rowIsPharmacist = isPharmacistRole(row.role);
                      schedules.forEach(s => {
                        if (s.status === 'deleted') return;
                        if (isOffShift(s.shiftType)) return;
                        if (s.employeeId === row.employeeId) return;
                        if (!s.startTime || !s.endTime) return;
                        if (s.date === currentDateKey) return; // skip same-day shifts (no point swapping same day)
                        // Role rule: pharmacist ↔ pharmacist only, assistant ↔ assistant only (unless létszámkényszer override)
                        if (!swapIgnoreRole && isPharmacistRole(s.role) !== rowIsPharmacist) return;
                        if (!empMap.has(s.employeeId)) {
                          empMap.set(s.employeeId, { employeeId: s.employeeId, employeeName: s.employeeName, role: s.role, shifts: [] });
                        }
                        const d = new Date(s.date + 'T00:00:00');
                        empMap.get(s.employeeId).shifts.push({
                          scheduleId: s.id,
                          date: s.date,
                          day: s.day || Number(s.date.split('-')[2]),
                          dow: DOW_LABELS[d.getDay()],
                          from: s.startTime,
                          to: s.endTime,
                        });
                      });
                      empMap.forEach(emp => emp.shifts.sort((a, b) => a.date.localeCompare(b.date)));
                      const candidateEmps = [...empMap.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'hu'));

                      return (
                        <div className={`w-full mt-2 rounded-xl border overflow-hidden ${darkMode ? 'border-indigo-700/60 bg-indigo-900/20' : 'border-indigo-200 bg-indigo-50'}`}>
                          {/* Header */}
                          <div className={`px-3 py-2 border-b ${darkMode ? 'border-indigo-700/40' : 'border-indigo-200'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                                {swapTarget
                                  ? (market === 'de' ? '✅ Tausch bestaetigen' : '✅ Csere megerősítése')
                                  : (market === 'de' ? `⇄ ${row.name} - mit welcher Schicht tauschen?` : `⇄ ${row.name} – melyik műszakkal cseréljük?`)}
                              </span>
                              <button
                                type="button"
                                onClick={() => { setSwapPickerRowIdx(null); setSwapTarget(null); setSwapIgnoreRole(false); }}
                                className={`text-xs leading-none px-1.5 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                              >✕</button>
                            </div>
                            {!swapTarget && (
                              <label className={`flex items-center gap-1.5 mt-1.5 cursor-pointer w-fit select-none`}>
                                <input
                                  type="checkbox"
                                  checked={swapIgnoreRole}
                                  onChange={e => { setSwapIgnoreRole(e.target.checked); setSwapTarget(null); }}
                                  className="w-3 h-3 rounded accent-amber-500"
                                />
                                <span className={`text-[11px] ${swapIgnoreRole ? 'text-amber-500 font-semibold' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {market === 'de' ? 'Mindestbesetzung erzwingen - mit beliebiger eingeteilter Person' : 'Létszámkényszer – bármely beosztottal'}
                                </span>
                              </label>
                            )}
                          </div>

                          {swapTarget ? (
                            // ── Confirmation step ───────────────────────────────
                            <div className="px-3 py-3 space-y-3">
                              <div className={`rounded-xl border p-3 ${darkMode ? 'border-violet-700/50 bg-violet-900/20' : 'border-violet-200 bg-white'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`flex-1 text-center text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                    <p className="font-bold">{row.name}</p>
                                    <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentDateKey.slice(5).replace('-', '.')}. · {row.from}–{row.to}</p>
                                  </div>
                                  <span className="text-xl font-black text-indigo-500">⇄</span>
                                  <div className={`flex-1 text-center text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                    <p className="font-bold">{swapTarget.employeeName}</p>
                                    <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{swapTarget.date.slice(5).replace('-', '.')}. · {swapTarget.from}–{swapTarget.to}</p>
                                  </div>
                                </div>
                                <p className={`text-[10px] text-center mt-2.5 leading-snug ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {row.name} → {swapTarget.date.slice(5).replace('-', '.')}. ({swapTarget.from}–{swapTarget.to}){'  ·  '}{swapTarget.employeeName} → {currentDateKey.slice(5).replace('-', '.')}. ({row.from}–{row.to})
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSwapTarget(null)}
                                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                >{market === 'de' ? '← Zurueck' : '← Vissza'}</button>
                                {readOnly ? (
                                  <button
                                    type="button"
                                    disabled={readOnlySwapSaving}
                                    onClick={() => executeReadOnlySwapRequest(idx)}
                                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                                  >{readOnlySwapSaving ? (market === 'de' ? 'Senden...' : 'Küldés…') : (market === 'de' ? '⇄ Tauschanfrage senden' : '⇄ Csereigény küldése')}</button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={swapSaving}
                                    onClick={() => executeSwap(idx)}
                                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                                  >{swapSaving ? (market === 'de' ? 'Speichern...' : 'Mentés…') : (market === 'de' ? '⇄ Tausch ausfuehren' : '⇄ Csere elvégzése')}</button>
                                )}
                              </div>
                            </div>
                          ) : (
                            // ── Employee + shift picker ─────────────────────────
                            candidateEmps.length === 0 ? (
                              <p className={`text-xs px-3 py-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {swapIgnoreRole
                                  ? (market === 'de' ? 'In diesem Monat gibt es keine eingeteilten Mitarbeitenden.' : 'Nincs beosztott dolgozó ebben a hónapban.')
                                  : (market === 'de'
                                    ? `Keine tauschfaehige ${rowIsPharmacist ? 'Apothekerin/kein Apotheker' : 'PTA/Assistentin/Assistent'} in diesem Monat.`
                                    : `Nincs csereképes ${rowIsPharmacist ? 'gyógyszerész' : 'szakasszisztens'} ebben a hónapban.`)}
                              </p>
                            ) : (
                              <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
                                {candidateEmps.map(emp => {
                                  const isPharm = (emp.role || '').toLowerCase().includes('pharmacist') || (emp.role || '').toLowerCase().includes('gyógyszerész') || (emp.role || '').toLowerCase().includes('gyogyszeresz');
                                  return (
                                    <div key={emp.employeeId} className={`border-b last:border-0 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                      <div className={`flex items-center gap-2 px-3 pt-2 pb-1`}>
                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black flex-shrink-0 ${isPharm ? 'bg-violet-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                          {emp.employeeName.charAt(0)}
                                        </span>
                                        <span className={`text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{emp.employeeName}</span>
                                        <span className={`text-[10px] font-medium ${isPharm ? (darkMode ? 'text-violet-400' : 'text-violet-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                                          {isPharm ? 'Gyógyszerész' : 'Asszisztens'}
                                        </span>
                                      </div>
                                      <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                                        {emp.shifts.map(shift => (
                                          <button
                                            key={shift.scheduleId}
                                            type="button"
                                            onClick={() => setSwapTarget({
                                              scheduleId: shift.scheduleId,
                                              date: shift.date,
                                              employeeId: emp.employeeId,
                                              employeeName: emp.employeeName,
                                              from: shift.from,
                                              to: shift.to,
                                            })}
                                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${darkMode ? 'border-gray-600 bg-gray-800 hover:bg-indigo-800 hover:border-indigo-500 text-gray-200' : 'border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-gray-700'}`}
                                          >
                                            <span className="font-bold">{shift.day}.</span>
                                            <span className={`ml-0.5 text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{shift.dow.slice(0,2)}</span>
                                            <span className={`ml-1.5 tabular-nums ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>{shift.from}–{shift.to}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Staffing warning + replacement suggestions */}
            {staffingWarnings.length > 0 && (
              <div className={`flex-shrink-0 border-t px-6 py-4 space-y-3 ${darkMode ? 'border-amber-800/60 bg-amber-900/10' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-base">⚠️</span>
                  <span className={`text-sm font-bold ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                    {market === 'de' ? 'Unterbesetzung - Vorschlaege zur Abdeckung' : 'Létszámhiány – javaslat a pótláshoz'}
                  </span>
                </div>
                {staffingWarnings.map((w, wi) => (
                  <div key={wi} className={`rounded-xl border px-4 py-3 space-y-2 ${darkMode ? 'border-amber-700/50 bg-amber-900/20' : 'border-amber-200 bg-white'}`}>
                    <div className={`text-xs font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      {w.template.startTime}–{w.template.endTime} {market === 'de' ? 'Schicht' : 'műszak'}:{' '}
                      <span className="font-black">{w.workers}/{w.required} {market === 'de' ? 'Personen' : 'fő'}</span>
                      {w.pharmacistShortage > 0 && (
                        <span className={`ml-2 ${darkMode ? 'text-rose-300' : 'text-rose-600'}`}>
                          • {w.pharmacists}/{w.requiredPharmacists} {market === 'de' ? 'Apotheker/in' : 'gyógyszerész'}
                        </span>
                      )}
                    </div>
                    {w.suggestions.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className={`text-[11px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Verfuegbare Mitarbeitende:' : 'Elérhető dolgozók:'}</p>
                        <div className="flex flex-wrap gap-2">
                          {w.suggestions.map(s => {
                            const isPharm = (s.role || '').toLowerCase().includes('pharmacist') || (s.role || '').toLowerCase().includes('gyógyszerész') || (s.role || '').toLowerCase().includes('gyogyszeresz');
                            return (
                              <button
                                key={s.employeeId}
                                type="button"
                                onClick={() => {
                                  const idx = employeeRows.findIndex(r => r.employeeId === s.employeeId);
                                  if (idx >= 0) updateRow(idx, { checked: true, shiftType: 'N', from: w.template.startTime, to: w.template.endTime });
                                }}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  isPharm
                                    ? darkMode ? 'border-violet-600 bg-violet-900/30 text-violet-200 hover:bg-violet-800/50' : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                                    : darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${isPharm ? 'bg-violet-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                  {isPharm ? (market === 'de' ? 'Ap' : 'Gy') : 'A'}
                                </span>
                                {s.name}
                                <span className="text-[10px] opacity-60">{market === 'de' ? '+ hinzufuegen' : '+ hozzáad'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'Keine verfuegbare Person fuer diesen Tag.' : 'Nincs szabad dolgozó erre a napra.'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Swap log row */}
            {swapLog.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSwapLog(true)}
                className={`flex-shrink-0 w-full flex items-center gap-2 px-6 py-2.5 text-xs font-semibold border-t transition-colors ${darkMode ? 'bg-amber-900/30 border-amber-700/60 text-amber-300 hover:bg-amber-900/50' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
              >
                <span>🔄</span>
                <span>{market === 'de' ? `${swapLog.length} gespeicherte Tausche - Aenderungen anzeigen` : `${swapLog.length} rögzített csere – Változtatások megtekintése`}</span>
                <ChevronRight className="h-3 w-3 ml-auto" />
              </button>
            )}

            {/* ReadOnly swap success message */}
            {readOnly && readOnlySwapDone && (
              <div className={`flex-shrink-0 flex items-center gap-2 px-6 py-2.5 text-xs font-semibold border-t ${darkMode ? 'bg-sky-900/30 border-sky-700/60 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                <span>✅</span>
                <span>{readOnlySwapDone}</span>
                <button type="button" onClick={() => setReadOnlySwapDone(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {/* Footer */}
            <div className={`flex-shrink-0 flex items-center justify-between gap-3 border-t px-6 py-4 ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              >
                {market === 'de' ? 'Abbrechen' : 'Mégse'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={modalSaving}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-60 transition-all"
              >
                {modalSaving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Speichern' : 'Mentés')}
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
  market = 'hu',
  onSaveDayPreferences, saving,
  employeeProfile,      // { contractHours, birthDate, childrenCount, vacationTakenThisYear, vacationCarriedOver }
  initialDay,           // optional: auto-open this day's modal on mount
  onPublish,            // () => void — publish this month's drafts
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
  const monthNames = market === 'de' ? MONTHS_DE : MONTHS_HU;
  const dayNamesLong = market === 'de' ? DAYS_LONG_DE : DAYS_LONG_HU;
  const monthLabel = monthNames[month - 1];
  const holidays = getHungarianHolidays(year);
  const DOW_LABELS = dayNamesLong;

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
  const plannedSzPrefs = ownPrefs.filter(p => normalizeShiftTypeKey(p.shiftType) === 'Sz');
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
    ? dayNamesLong[new Date(year, month - 1, selectedDay).getDay()]
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
              {market === 'de'
                ? `Monatlich ${monthlyRequiredHours} · geplant ${Math.round(plannedHoursTotal)} · offen ${remainingHours > 0 ? Math.round(remainingHours) : '✓'}`
                : `havi ${monthlyRequiredHours} · tervben ${Math.round(plannedHoursTotal)} · maradt ${remainingHours > 0 ? Math.round(remainingHours) : '✓'}`}
            </div>
          ) : annualVacDays > 0 ? (
            <div className="text-xs font-medium text-white/80 whitespace-nowrap">{ownMonthCount} {market === 'de' ? 'Tage' : 'nap'}</div>
          ) : (
            <div className="text-xs font-medium text-white/70">{ownMonthCount} {market === 'de' ? 'geplante Tage' : 'tervezett nap'}</div>
          )}
          {annualVacDays > 0 && (
            <div className="text-xs font-medium text-white/80 whitespace-nowrap">{market === 'de' ? 'Urlaub offen' : 'maradék szabi'}: {Math.max(0, vacAfterThisMonth)}</div>
          )}
        </div>
        <button type="button" onClick={() => onChangeMonth('next')} className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xl leading-none">›</button>
      </div>

      {/* Legend */}
      <div className={`flex-shrink-0 flex items-center gap-4 px-4 py-2 text-xs border-b ${darkMode ? 'border-gray-800 bg-gray-850 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500"/> {market === 'de' ? 'Mein Entwurf' : 'Saját tervem'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-400"/> {market === 'de' ? 'Entwuerfe von Kolleg/innen' : 'Kollégák tervei'}</span>
      </div>

      {/* Unpublished banner */}
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
                {market === 'de' ? `${unpublished} Tage gespeichert, aber noch nicht gesendet` : `${unpublished} nap mentve, de még nincs elküldve`}
              </p>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-amber-400/80' : 'text-amber-700/80'}`}>
                {market === 'de' ? 'Die Apotheke sieht deinen Entwurf erst nach der Veroeffentlichung' : 'A gyógyszertár csak publikálás után látja a tervezetedet'}
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
                {saving ? '...' : (market === 'de' ? 'Veroeffentlichen' : 'Publikálás')}
              </button>
            )}
          </div>
        );
      })()}

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
                  <p className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{market === 'de' ? 'Klicke, um den Entwurf zu planen' : 'Kattints a tervezéshez'}</p>
                )}
                {dayOwn.map(p => {
                  const isSz = isOffShift(p.shiftType);
                  const st = getShiftType(p.shiftType || 'N', market);
                  const hrs = calcHours(p.startTime, p.endTime, market);
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
                          {isSz ? (market === 'de' ? 'Urlaub angefragt' : 'Szabadságot kértem') : (market === 'de' ? 'Mein Entwurf' : 'Saját tervem')}
                        </span>
                        {!isSz && contractHours > 0 && (
                          <span className="flex-shrink-0 text-xs font-bold tabular-nums text-emerald-600">{hrs || `${contractHours}.00`}</span>
                        )}
                        {p.startTime && p.endTime && !isSz && <span className="flex-shrink-0 text-xs tabular-nums text-emerald-500">{p.startTime}–{p.endTime}</span>}
                      </div>
                      {!isSz && isLastDay && monthlyRequiredHours > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-0.5 pt-1 border-t ${darkMode ? 'border-emerald-700/40' : 'border-emerald-200'}`}>
                          <span className={`text-[11px] font-semibold ${remainingHours <= 0 ? 'text-emerald-500' : darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                            {market === 'de' ? 'Monatlich offen' : 'Havi maradék'}: {Math.max(0, Math.round(remainingHours))} {market === 'de' ? 'Std' : 'óra'} {remainingHours <= 0 ? '✓' : ''}
                          </span>
                          {annualVacDays > 0 && (
                            <span className={`text-[11px] font-semibold ${vacAfterThisMonth <= 3 ? 'text-rose-500' : darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
                              · {market === 'de' ? 'Urlaub offen' : 'Szabadság maradék'}: {Math.max(0, vacAfterThisMonth)} {market === 'de' ? 'Tage' : 'nap'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayOthers.map(p => {
                  const st = getShiftType(p.shiftType || 'N', market);
                  const hrs = calcHours(p.startTime, p.endTime, market);
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
                  <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-1">{monthLabel} {year} {market === 'de' ? '– Entwurf' : '– tervezet'}</p>
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
                  {checked
                    ? (market === 'de' ? 'Ich moechte an diesem Tag arbeiten' : 'Ezen a napon szeretnék dolgozni')
                    : (market === 'de' ? 'Ich moechte Urlaub' : 'Szabadságot kérek')}
                </span>
              </div>
              {checked && (
                <>
                  {/* Shift type */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Bevorzugter Schichttyp' : 'Preferált műszak típusa'}</p>
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
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Bevorzugter Zeitraum' : 'Preferált időszak'}</p>
                    <div className="flex items-center gap-3">
                      <input type="time" value={from} onChange={e => setFrom(e.target.value)} className={`w-28 rounded-xl border px-3 py-2 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}/>
                      <span className={`font-bold ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>–</span>
                      <input type="time" value={to} onChange={e => setTo(e.target.value)} className={`w-28 rounded-xl border px-3 py-2 text-sm tabular-nums ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}/>
                    </div>
                  </div>
                  )}
                  {/* Notes */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Notiz (optional)' : 'Megjegyzés (opcionális)'}</p>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300'}`} placeholder={market === 'de' ? 'z. B. Ich kann nur vormittags, Arzttermin am Nachmittag...' : 'Pl. Csak délelőtt tudok, orvos délután...'}/>
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
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Kolleg/innen mit Planung fuer diesen Tag' : 'Kollégák erre a napra terveztek'}</p>
                    <div className="flex flex-col gap-1.5">
                      {dayOthers.map(p => {
                        const st = getShiftType(p.shiftType || 'N', market);
                        const hrs = calcHours(p.startTime, p.endTime, market);
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
              <button type="button" onClick={() => setShowModal(false)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>{market === 'de' ? 'Abbrechen' : 'Mégse'}</button>
              <button type="button" onClick={async () => {
                setModalSaving(true);
                try {
                  const dateKey = formatDateKey(year, month, selectedDay);
                  await onSaveDayPreferences(dateKey, { checked, shiftType, from, to, notes });
                  setShowModal(false);
                } finally { setModalSaving(false); }
              }} disabled={modalSaving} className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-8 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60">
                {modalSaving
                  ? (market === 'de' ? 'Speichern...' : 'Mentés...')
                  : checked
                    ? (market === 'de' ? 'Entwurf speichern' : 'Terv mentése')
                    : (market === 'de' ? 'Urlaub anfragen' : 'Szabadság kérése')}
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
  const market = getClientMarket();
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const monthNames = market === 'de' ? MONTHS_DE : MONTHS_HU;
  const weekdayDisplay = useMemo(() => getWeekdayDisplay(market), [market]);
  const criteriaWizardSteps = useMemo(() => getCriteriaWizardSteps(market), [market]);
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
  const [awaitingPharmacyAssignment, setAwaitingPharmacyAssignment] = useState(false);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeoutId = setTimeout(() => setStatusMessage(''), 4500);
    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  const handleMainTabChange = useCallback((nextTab) => {
    setMainTab(nextTab);
    setStatusMessage('');
    setStatusError('');
  }, []);

  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allYearSchedules, setAllYearSchedules] = useState([]);
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
  const [showIgnoredPrefsPanel, setShowIgnoredPrefsPanel] = useState(false);
  const [lockingPrefId, setLockingPrefId] = useState(null);
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
  const [bettiLastUnknownMessage, setBettiLastUnknownMessage] = useState('');
  const [bettiChatOpen, setBettiChatOpen] = useState(false);
  const [aiViewEnabled, setAiViewEnabled] = useState(false);
  const [bettiKeyboardInset, setBettiKeyboardInset] = useState(0);
  const [bettiVoiceListening, setBettiVoiceListening] = useState(false);
  const [bettiSpeakEnabled, setBettiSpeakEnabled] = useState(false);
  const [bettiDemandDraft, setBettiDemandDraft] = useState(null);
  const [bettiChatHydrated, setBettiChatHydrated] = useState(false);
  const [draftStatusTab, setDraftStatusTab] = useState('planned');
  const bettiNativeKeyboardHeightRef = useRef(0);
  const bettiRecognitionRef = useRef(null);
  const bettiChatScrollRef = useRef(null);
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

  useEffect(() => {
    setBettiChatHydrated(true);
  }, []);

  // Full-screen calendar overlay (pharmacy schedule)
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [swapLog, setSwapLog] = useState([]); // lifted from PharmacyScheduleCalendar
  const [showSwapLog, setShowSwapLog] = useState(false);
  // Full-screen preference calendar overlay (employee draft)
  const [preferenceCalendarOpen, setPreferenceCalendarOpen] = useState(false);
  const [preferenceInitialDay, setPreferenceInitialDay] = useState(null);
  // schedulePreferences drafts
  const [schedulePreferences, setSchedulePreferences] = useState([]);
  const [allPreferences, setAllPreferences] = useState([]);
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [workerEditForms, setWorkerEditForms] = useState({}); // { [employeeId]: { phone, address, notes, contractHours, birthDate, childrenCount, vacationTakenThisYear, vacationCarriedOver } }
  const [workerEditSaving, setWorkerEditSaving] = useState({}); // { [employeeId]: bool }
  const [workerEditSavedAt, setWorkerEditSavedAt] = useState({}); // { [employeeId]: Date }
  const workerEditSavedTimersRef = useRef({});
  const [workerProfiles, setWorkerProfiles] = useState({}); // { [linkedUserId]: { id, ...profileData } }

  useEffect(() => {
    return () => {
      Object.values(workerEditSavedTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Quick swap: which own schedule is currently open for partner selection
  const [quickSwapScheduleId, setQuickSwapScheduleId] = useState(null);
  const [quickSwapMessage, setQuickSwapMessage] = useState('');
  const [employeeCalendarView, setEmployeeCalendarView] = useState('own');

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

  const ownPreferenceMatcher = useMemo(() => {
    const ownEmployeeId = ownEmployeeRecords?.[0]?.id || '';
    const ownLinkedUserId = user?.uid || '';
    const ownEmail = normalizeEmail(user?.email);

    return (item) => {
      if (!item || item.status === 'deleted') return false;
      if (ownEmployeeId && item.employeeId === ownEmployeeId) return true;
      if (ownLinkedUserId && item.linkedUserId === ownLinkedUserId) return true;
      const itemEmail = normalizeEmail(item.employeeEmail || '');
      return Boolean(ownEmail && itemEmail && itemEmail === ownEmail);
    };
  }, [ownEmployeeRecords, user]);

  // Deep-link: subtab URL param → nyissa meg a megfelelő beosztás alfület
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const subtab = params.get('subtab');
    const allowedTabs = isPharmacy
      ? new Set(['schedule', 'workers', 'history'])
      : new Set(['mine', 'planner', 'swaps', 'vacations', 'preferences']);
    if (allowedTabs.has(subtab)) {
      setMainTab(subtab);
    }
  }, [isPharmacy]);

  // ── Build pharmacy worker profile map from pharmacyEmployees ───────────
  useEffect(() => {
    if (!isPharmacy || mainTab !== 'workers') return;
    const map = {};
    employees.forEach((employee) => {
      if (!employee.linkedUserId) return;
      map[employee.linkedUserId] = {
        userId: employee.linkedUserId,
        birthDate: employee.birthDate || '',
        childrenCount: employee.childrenCount || 0,
        contractHours: employee.contractHours || 8,
        vacationTakenThisYear: employee.vacationTakenThisYear || 0,
        vacationCarriedOver: employee.vacationCarriedOver || 0,
      };
    });
    setWorkerProfiles(map);
  }, [isPharmacy, mainTab, employees]);

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

  const publishedEmployeeSchedules = useMemo(
    () => sortByDateAndTime(schedules.filter(item => item.status !== 'deleted' && isPublishedSchedule(item))),
    [schedules]
  );

  const selectedEmployeeDateSchedules = useMemo(() => {
    const publishedItems = selectedDateSchedules.filter(isPublishedSchedule);
    if (employeeCalendarView === 'own') {
      return publishedItems.filter(item => ownScheduleIds.has(item.id));
    }
    return publishedItems;
  }, [employeeCalendarView, ownScheduleIds, selectedDateSchedules]);

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

  const currentMonthDraftPublishSummary = useMemo(() => {
    if (!isPharmacy) {
      return {
        missingEmployees: [],
        missingCount: 0,
        totalEligible: 0,
        plannedEmployees: [],
        plannedCount: 0,
        publishedEmployees: [],
        publishedCount: 0,
        noDraftEmployees: [],
        noDraftCount: 0,
      };
    }

    // Kiválasztott hónap tényleges beosztásai (pharmacySchedules)
    const currentMonthSchedules = schedules.filter(
      (item) => item.status !== 'deleted' && item.year === year && item.month === month
    );

    // Mely dolgozóknak van publikált beosztásuk (publishedAt)
    const publishedEmpIds = new Set(
      currentMonthSchedules.filter((item) => Boolean(item.publishedAt)).map((item) => item.employeeId).filter(Boolean)
    );
    // Mely dolgozóknak van bármilyen beosztásuk (akár még nem publikált)
    const anyScheduleEmpIds = new Set(
      currentMonthSchedules.map((item) => item.employeeId).filter(Boolean)
    );

    const eligibleEmployees = activeEmployees;
    const publishedEmployees = eligibleEmployees.filter((item) => publishedEmpIds.has(item.id));
    const plannedEmployees = eligibleEmployees.filter(
      (item) => anyScheduleEmpIds.has(item.id) && !publishedEmpIds.has(item.id)
    );
    const noDraftEmployees = eligibleEmployees.filter(
      (item) => !anyScheduleEmpIds.has(item.id)
    );

    return {
      missingEmployees: plannedEmployees,
      missingCount: plannedEmployees.length,
      totalEligible: eligibleEmployees.length,
      plannedEmployees,
      plannedCount: plannedEmployees.length,
      publishedEmployees,
      publishedCount: publishedEmployees.length,
      noDraftEmployees,
      noDraftCount: noDraftEmployees.length,
    };
  }, [activeEmployees, isPharmacy, schedules, year, month]);

  const ownSelectedMonthDraftSummary = useMemo(() => {
    if (isPharmacy) {
      return { total: 0, published: 0, fullyPublished: false };
    }

    const ownMonthItems = schedulePreferences.filter(
      (item) => item.year === year && item.month === month && ownPreferenceMatcher(item)
    );
    const published = ownMonthItems.filter((item) => Boolean(item.publishedAt)).length;

    return {
      total: ownMonthItems.length,
      published,
      fullyPublished: ownMonthItems.length > 0 && published === ownMonthItems.length,
    };
  }, [isPharmacy, month, ownPreferenceMatcher, schedulePreferences, year]);

  useEffect(() => {
    const maxDays = getDaysInMonth(year, month);
    if (day > maxDays) setDay(maxDays);
  }, [year, month, day]);

  useEffect(() => {
    if (!bettiChatOpen) {
      setBettiKeyboardInset(0);
      bettiNativeKeyboardHeightRef.current = 0;
      return;
    }
    if (typeof window === 'undefined') return;

    let keyboardShowSub = null;
    let keyboardDidShowSub = null;
    let keyboardHideSub = null;
    let keyboardDidHideSub = null;

    const viewport = window.visualViewport;
    const updateInsetFromViewport = () => {
      if (!viewport) return;
      const overlap = Math.max(
        0,
        window.innerHeight - viewport.height,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      const nextInset = Math.max(overlap, bettiNativeKeyboardHeightRef.current);
      setBettiKeyboardInset(nextInset > 20 ? nextInset : 0);
    };

    const isNativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    if (isNativeIos) {
      Keyboard.setScroll({ isDisabled: true }).catch(() => {});
      Keyboard.setResizeMode({ mode: 'none' }).catch(() => {});

      Keyboard.addListener('keyboardWillShow', (info) => {
        bettiNativeKeyboardHeightRef.current = Math.max(0, Number(info?.keyboardHeight || 0));
        updateInsetFromViewport();
      }).then((sub) => {
        keyboardShowSub = sub;
      });

      Keyboard.addListener('keyboardDidShow', (info) => {
        bettiNativeKeyboardHeightRef.current = Math.max(0, Number(info?.keyboardHeight || 0));
        updateInsetFromViewport();
      }).then((sub) => {
        keyboardDidShowSub = sub;
      });

      Keyboard.addListener('keyboardWillHide', () => {
        bettiNativeKeyboardHeightRef.current = 0;
        setBettiKeyboardInset(0);
      }).then((sub) => {
        keyboardHideSub = sub;
      });

      Keyboard.addListener('keyboardDidHide', () => {
        bettiNativeKeyboardHeightRef.current = 0;
        setBettiKeyboardInset(0);
      }).then((sub) => {
        keyboardDidHideSub = sub;
      });
    }

    updateInsetFromViewport();
    viewport?.addEventListener('resize', updateInsetFromViewport);
    viewport?.addEventListener('scroll', updateInsetFromViewport);

    return () => {
      viewport?.removeEventListener('resize', updateInsetFromViewport);
      viewport?.removeEventListener('scroll', updateInsetFromViewport);
      keyboardShowSub?.remove();
      keyboardDidShowSub?.remove();
      keyboardHideSub?.remove();
      keyboardDidHideSub?.remove();
      Keyboard.setScroll({ isDisabled: false }).catch(() => {});
    };
  }, [bettiChatOpen]);

  useEffect(() => {
    if (bettiChatScrollRef.current) {
      bettiChatScrollRef.current.scrollTop = bettiChatScrollRef.current.scrollHeight;
    }
  }, [bettiChatMessages, bettiChatLoading]);

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
    setSchedules([]);
    setStatusError('');
    setAwaitingPharmacyAssignment(false);
    try {
      if (isPharmacy) {
        await loadPharmacyData();
      } else {
        await loadEmployeeData();
      }
    } catch (error) {
      console.error('Schedule manager load error:', error);
      const code = String(error?.code || '').toLowerCase();
      const message = String(error?.message || '').toLowerCase();
      const isPermissionDenied =
        code === 'permission-denied' ||
        code.endsWith('/permission-denied') ||
        (message.includes('permission') && message.includes('denied'));

      if (!isPharmacy && isPermissionDenied) {
        setStatusError('');
        setAwaitingPharmacyAssignment(true);
      } else {
        setStatusError(market === 'de' ? 'Fehler beim Laden der Daten.' : 'Hiba történt az adatok betöltésekor.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPharmacyData() {
    const [employeesSnapshot, schedulesSnapshot, allYearSnapshot, swapSnapshot, vacationSnapshot, prefsSnapshot, allPrefsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'pharmacyEmployees'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'pharmacySchedules'), where('pharmacyId', '==', user.uid), where('year', '==', year), where('month', '==', month))),
      getDocs(query(collection(db, 'pharmacySchedules'), where('pharmacyId', '==', user.uid), where('year', '==', thisYear))),
      getDocs(query(collection(db, 'scheduleSwapRequests'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'scheduleVacationRequests'), where('pharmacyId', '==', user.uid))),
      getDocs(query(collection(db, 'schedulePreferences'), where('pharmacyId', '==', user.uid), where('year', '==', year), where('month', '==', month), where('publishedAt', '!=', null))),
      getDocs(query(collection(db, 'schedulePreferences'), where('pharmacyId', '==', user.uid), where('publishedAt', '!=', null))),
    ]);

    setEmployees(employeesSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setSchedules(sortByDateAndTime(schedulesSnapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
    setAllYearSchedules(allYearSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
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
    const collectedPreferences = [];

    for (const pharmacyId of pharmacyIds) {
      const [scheduleSnapshot, requesterSwapsSnapshot, targetSwapsSnapshot, vacationSnapshot, publishedPrefsSnapshot, ownPrefsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'pharmacySchedules'), where('pharmacyId', '==', pharmacyId), where('year', '==', year), where('month', '==', month), where('publishedAt', '!=', null))),
        getDocs(query(collection(db, 'scheduleSwapRequests'), where('requesterUserId', '==', user.uid))),
        getDocs(query(collection(db, 'scheduleSwapRequests'), where('targetUserId', '==', user.uid))),
        getDocs(query(collection(db, 'scheduleVacationRequests'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'schedulePreferences'), where('pharmacyId', '==', pharmacyId), where('year', '==', year), where('month', '==', month), where('publishedAt', '!=', null))),
        getDocs(query(collection(db, 'schedulePreferences'), where('linkedUserId', '==', user.uid), where('year', '==', year), where('month', '==', month))),
      ]);

      collectedSchedules.push(...scheduleSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedSwapRequests.push(...requesterSwapsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedSwapRequests.push(...targetSwapsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedVacationRequests.push(...vacationSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedPreferences.push(...publishedPrefsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      collectedPreferences.push(...ownPrefsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }

    const uniqueSwapMap = new Map();
    collectedSwapRequests.forEach(item => uniqueSwapMap.set(item.id, item));
    const uniquePreferenceMap = new Map();
    collectedPreferences.forEach(item => uniquePreferenceMap.set(item.id, item));

    setSchedules(sortByDateAndTime(collectedSchedules));
    setSwapRequests([...uniqueSwapMap.values()]);
    setVacationRequests(collectedVacationRequests);
    setSchedulePreferences([...uniquePreferenceMap.values()]);

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

      await loadData();
    } catch (err) {
      console.error('handleSavePreferenceDaySchedules error:', err);
      setStatusError(market === 'de' ? 'Entwurf konnte nicht gespeichert werden.' : 'Nem sikerült menteni a tervezetet.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishPreferenceDraftMonth(targetYear = year, targetMonth = month) {
    if (!user?.uid) return { success: false };

    const ownRec = ownEmployeeRecords[0];
    const pharmacyId = ownRec?.pharmacyId;
    if (!pharmacyId) {
      setStatusError(market === 'de' ? 'Keine zugeordnete Apotheke fuer die Veroeffentlichung.' : 'Nincs hozzárendelt gyógyszertár a publikáláshoz.');
      return { success: false };
    }

    const ownMonthItems = schedulePreferences.filter(
      (item) => item.year === targetYear && item.month === targetMonth && ownPreferenceMatcher(item)
    );

    if (ownMonthItems.length === 0) {
      setStatusError(market === 'de' ? 'Nichts zu veroeffentlichen: kein gespeicherter Entwurf in diesem Monat.' : 'Nincs mit publikálni: nincs mentett tervezeted ebben a hónapban.');
      return { success: false };
    }

    setSaving(true);
    setStatusError('');
    setStatusMessage('');

    try {
      const publishedAtIso = new Date().toISOString();
      let updatedCount = 0;

      for (const item of ownMonthItems) {
        if (item.publishedAt) continue;
        await updateDoc(doc(db, 'schedulePreferences', item.id), {
          publishedAt: publishedAtIso,
          publishedBy: user.uid,
          status: 'published',
          updatedAt: serverTimestamp(),
        });
        updatedCount += 1;
      }

      await createNotificationWithPush({
        userId: pharmacyId,
        type: 'schedule_preference_published',
        title: market === 'de' ? 'Mitarbeiter-Entwurf veroeffentlicht' : 'Dolgozói tervezet publikálva',
        message: market === 'de'
          ? `${ownRec?.name || userData?.name || user.email} hat den Monatsentwurf ${monthNames[targetMonth - 1]} ${targetYear} veroeffentlicht.`
          : `${ownRec?.name || userData?.name || user.email} publikálta a ${monthNames[targetMonth - 1]} ${targetYear} havi tervezetet.`,
        data: { employeeId: ownRec?.id || '', year: targetYear, month: targetMonth },
        url: '/pharmagister?tab=schedule-manager&subtab=workers',
        dedupeWindowSeconds: 120,
        dedupeByDataKeys: ['employeeId', 'year', 'month'],
      });

      if (updatedCount > 0) {
        setStatusMessage(
          market === 'de'
            ? `Erfolgreich veroeffentlicht: ${updatedCount} geplante Tage (${monthNames[targetMonth - 1]} ${targetYear}).`
            : `Sikeres publikálás: ${updatedCount} tervezett nap publikálva (${monthNames[targetMonth - 1]} ${targetYear}).`
        );
      } else {
        setStatusMessage(
          market === 'de'
            ? `Der Entwurf fuer ${monthNames[targetMonth - 1]} ${targetYear} wurde bereits frueher veroeffentlicht.`
            : `A ${monthNames[targetMonth - 1]} ${targetYear} havi tervezet már korábban publikálva lett.`
        );
      }

      await loadData();
      return { success: true, updatedCount };
    } catch (error) {
      console.error('Publish preference month error:', error);
      setStatusError(error.message || (market === 'de' ? 'Monatsentwurf konnte nicht veroeffentlicht werden.' : 'Nem sikerült publikálni a havi tervezetet.'));
      return { success: false };
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
        setStatusError(
          market === 'de'
            ? 'Zum Hinzufuegen eines Mitarbeiters ist eine registrierte Pharmagister-E-Mail-Adresse erforderlich.'
            : 'Dolgozó hozzáadásához regisztrált Pharmagister email cím megadása kötelező.'
        );
        setSaving(false);
        return;
      }

      const existingAtPharmacy = activeEmployees.some(item => normalizeEmail(item.email) === employeeEmail);
      if (existingAtPharmacy) {
        setStatusError(market === 'de' ? 'Diese E-Mail-Adresse ist dieser Apotheke bereits zugeordnet.' : 'Ez az email cím már hozzá van adva ehhez a gyógyszertárhoz.');
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
        setStatusError(market === 'de' ? 'Diese E-Mail-Adresse ist dieser Apotheke bereits zugeordnet.' : 'Ez az email cím már hozzá van adva ehhez a gyógyszertárhoz.');
        setSaving(false);
        return;
      }

      const userSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', employeeEmail)));
      if (userSnapshot.empty) {
        setStatusError(
          market === 'de'
            ? 'Diese E-Mail-Adresse ist im Pharmagister-System noch nicht registriert. Es koennen nur registrierte Nutzer hinzugefuegt werden.'
            : 'A megadott email cím még nincs regisztrálva a Pharmagister rendszerben. Csak regisztrált felhasználó vehető fel.'
        );
        setSaving(false);
        return;
      }

      const linkedUser = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
      const autoRole = normalizeRoleFromProfile(linkedUser.pharmagisterRole);
      if (!autoRole) {
        setStatusError(
          market === 'de'
            ? 'Die Benutzerrolle ist fuer die Dienstplanung nicht geeignet. Es koennen nur Apotheker/in oder Assistent/in hinzugefuegt werden.'
            : 'A felhasználó szerepköre nem megfelelő a beosztáshoz. Csak gyógyszerész vagy szakasszisztens profil vehető fel.'
        );
        setSaving(false);
        return;
      }
      const employeeNameFromProfile = (linkedUser.displayName || linkedUser.name || '').trim();
      if (!employeeNameFromProfile) {
        setStatusError(
          market === 'de'
            ? 'Im Benutzerprofil fehlt ein Name. Bitte den Nutzer zuerst das Profil vervollstaendigen lassen.'
            : 'A felhasználó profiljában nincs név megadva. Kérd meg, hogy előbb töltse ki a profilját.'
        );
        setSaving(false);
        return;
      }

      const pharmacyName = userData?.pharmacyName || userData?.name || user?.displayName || user?.email || (market === 'de' ? 'Apotheke' : 'Gyógyszertár');

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
        title: market === 'de' ? 'Neue Apothekenverknuepfung' : 'Új gyógyszertári kapcsolat',
        message: market === 'de' ? `${pharmacyName} hat dich in Pharmagister als Mitarbeitenden hinzugefuegt.` : `${pharmacyName} felvett a Pharmagisterben a dolgozói közé.`,
        data: { pharmacyId: user.uid, pharmacyName },
        url: '/pharmagister?tab=schedule-manager&subtab=mine',
        dedupeWindowSeconds: 120,
        dedupeByDataKeys: ['pharmacyId'],
      });

      setEmployeeForm({ email: '', phone: '', address: '', notes: '' });
      setStatusMessage(market === 'de' ? 'Mitarbeiter erfolgreich hinzugefuegt.' : 'A dolgozó sikeresen hozzáadva.');
      await loadData();
    } catch (error) {
      console.error('Add employee error:', error);
      setStatusError(market === 'de' ? 'Mitarbeiter konnte nicht hinzugefuegt werden.' : 'Nem sikerült a dolgozó hozzáadása.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWorkerBasicData(employeeId) {
    const form = workerEditForms[employeeId];
    if (!form) return;
    const employee = activeEmployees.find(e => e.id === employeeId);
    setWorkerEditSaving(prev => ({ ...prev, [employeeId]: true }));
    try {
      const contractHours = Number(form.contractHours) || 0;
      // Save to pharmacyEmployees
      const empPayload = {
        phone: (form.phone || '').trim(),
        address: (form.address || '').trim(),
        notes: (form.notes || '').trim(),
        contractHours,
        birthDate: form.birthDate || '',
        childrenCount: Number(form.childrenCount) || 0,
        vacationTakenThisYear: Number(form.vacationTakenThisYear) || 0,
        vacationCarriedOver: Number(form.vacationCarriedOver) || 0,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'pharmacyEmployees', employeeId), empPayload);
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, ...empPayload } : e));
      if (employee?.linkedUserId) {
        setWorkerProfiles(prev => ({ ...prev, [employee.linkedUserId]: { ...(prev[employee.linkedUserId] || {}), ...empPayload, userId: employee.linkedUserId } }));
      }
      setStatusError('');
      setStatusMessage(market === 'de' ? 'Mitarbeiter-Grunddaten gespeichert.' : 'Dolgozói alapadatok mentve.');
      setWorkerEditSavedAt(prev => ({ ...prev, [employeeId]: new Date() }));
      if (workerEditSavedTimersRef.current[employeeId]) {
        clearTimeout(workerEditSavedTimersRef.current[employeeId]);
      }
      workerEditSavedTimersRef.current[employeeId] = setTimeout(() => {
        setWorkerEditSavedAt(prev => {
          const next = { ...prev };
          delete next[employeeId];
          return next;
        });
        delete workerEditSavedTimersRef.current[employeeId];
      }, 3500);
    } catch (err) {
      setStatusError((market === 'de' ? 'Speichern fehlgeschlagen: ' : 'Mentés sikertelen: ') + err.message);
    } finally {
      setWorkerEditSaving(prev => ({ ...prev, [employeeId]: false }));
    }
  }

  async function handleRemoveEmployee(employeeId) {
    const employee = activeEmployees.find(item => item.id === employeeId);
    if (!employee) {
      setStatusError(market === 'de' ? 'Ausgewaehlter Mitarbeiter nicht gefunden.' : 'A kiválasztott dolgozó nem található.');
      return;
    }

    const confirmed = window.confirm(
      market === 'de'
        ? `Moechtest du ${employee.name} wirklich aus der Mitarbeiterliste entfernen?`
        : `Biztosan törölni szeretnéd ${employee.name} dolgozót a beosztásból?`
    );
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
        const pharmacyName = userData?.pharmacyName || userData?.name || user?.displayName || user?.email || (market === 'de' ? 'Apotheke' : 'Gyógyszertár');
        await createNotificationWithPush({
          userId: linkedUserId,
          type: 'employee_removed_from_pharmacy',
          title: market === 'de' ? 'Apothekenverknuepfung entfernt' : 'Gyógyszertári kapcsolat törölve',
          message: market === 'de' ? `${pharmacyName} hat dich aus der Mitarbeiterliste entfernt.` : `${pharmacyName} eltávolított a dolgozói listájából.`,
          data: { pharmacyId: user.uid, pharmacyName, employeeId },
          url: '/pharmagister?tab=schedule-manager&subtab=mine',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['pharmacyId', 'employeeId'],
        });
      }

      setStatusMessage(market === 'de' ? 'Mitarbeiter entfernt.' : 'A dolgozó eltávolítva.');
      await loadData();
    } catch (error) {
      console.error('Remove employee error:', error);
      setStatusError(market === 'de' ? 'Mitarbeiter konnte nicht entfernt werden.' : 'Nem sikerült eltávolítani a dolgozót.');
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
      setStatusError(market === 'de' ? 'Bitte waehle einen Mitarbeiter fuer den Dienstplan aus.' : 'Válassz dolgozót a beosztáshoz.');
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
      setStatusMessage(market === 'de' ? 'Dienst gespeichert.' : 'Beosztás rögzítve.');
      await loadData();
    } catch (error) {
      console.error('Create schedule error:', error);
      setStatusError(market === 'de' ? 'Dienstplan konnte nicht gespeichert werden.' : 'Nem sikerült menteni a beosztást.');
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
            shiftType: normalizeShiftTypeKey(row.shiftType),
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
          // Delete schedule
          await updateDoc(doc(db, 'pharmacySchedules', row.existingId), {
            status: 'deleted',
            updatedAt: serverTimestamp(),
          });
          // Cancel any pending swap requests referencing this schedule
          const relatedSwaps = swapRequests.filter(r =>
            (r.requesterScheduleId === row.existingId || r.targetScheduleId === row.existingId) &&
            !['accepted', 'rejected', 'rejected_by_pharmacy', 'cancelled', 'cancelled_schedule_deleted'].includes(r.status)
          );
          await Promise.all(relatedSwaps.map(r =>
            updateDoc(doc(db, 'scheduleSwapRequests', r.id), {
              status: 'cancelled_schedule_deleted',
              updatedAt: serverTimestamp(),
            })
          ));
        }
      }
      setStatusMessage(market === 'de' ? 'Dienstplan gespeichert.' : 'Beosztás mentve.');
      await loadData();
    } catch (err) {
      console.error('handleSaveDaySchedules error:', err);
      setStatusError(market === 'de' ? 'Dienstplan konnte nicht gespeichert werden.' : 'Nem sikerült menteni a beosztást.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    const scheduleItem = schedules.find(item => item.id === scheduleId);
    if (!scheduleItem) {
      setStatusError(market === 'de' ? 'Ausgewaehlter Dienst wurde nicht gefunden.' : 'A kiválasztott beosztás nem található.');
      return;
    }
    if (scheduleItem.locked === true) {
      setStatusError(market === 'de' ? 'Dieser Dienst ist manuell gesperrt (locked), bitte zuerst entsperren.' : 'Ez a műszak kézzel zárolt (locked), előbb oldd fel a zárolást.');
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

      // Cancel any pending swap requests for this schedule
      const relatedSwaps = swapRequests.filter(r =>
        (r.requesterScheduleId === scheduleId || r.targetScheduleId === scheduleId) &&
        !['accepted', 'rejected', 'rejected_by_pharmacy', 'cancelled', 'cancelled_schedule_deleted'].includes(r.status)
      );
      await Promise.all(relatedSwaps.map(r =>
        updateDoc(doc(db, 'scheduleSwapRequests', r.id), {
          status: 'cancelled_schedule_deleted',
          updatedAt: serverTimestamp(),
        })
      ));

      if (scheduleItem.linkedUserId) {
        const pharmacyName = scheduleItem.pharmacyName || userData?.pharmacyName || userData?.name || user?.displayName || user?.email || (market === 'de' ? 'Apotheke' : 'Gyógyszertár');
        const wasPublished = isPublishedSchedule(scheduleItem);
        await createNotificationWithPush({
          userId: scheduleItem.linkedUserId,
          type: wasPublished ? 'schedule_revoked' : 'schedule_removed_from_employee',
          title: wasPublished
            ? (market === 'de' ? 'Dienstplan zurueckgezogen' : 'Beosztás visszavonása')
            : (market === 'de' ? 'Dienst geloescht' : 'Beosztás törölve'),
          message: wasPublished
            ? (market === 'de'
              ? `${pharmacyName} hat deinen Dienst zurueckgezogen: ${scheduleItem.date} (${scheduleItem.startTime}-${scheduleItem.endTime}).`
              : `${pharmacyName} visszavonta a beosztásodat: ${scheduleItem.date} (${scheduleItem.startTime}-${scheduleItem.endTime}).`)
            : (market === 'de'
              ? `${pharmacyName} hat deinen Dienst geloescht: ${scheduleItem.date} (${scheduleItem.startTime}-${scheduleItem.endTime}).`
              : `${pharmacyName} törölte a beosztásodat: ${scheduleItem.date} (${scheduleItem.startTime}-${scheduleItem.endTime}).`),
          data: { pharmacyId: user.uid, scheduleId, date: scheduleItem.date },
          url: '/pharmagister?tab=schedule-manager&subtab=mine',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['scheduleId'],
        });
      }

      setStatusMessage(market === 'de' ? 'Dienst geloescht.' : 'Beosztás törölve.');
      await loadData();
    } catch (error) {
      console.error('Delete schedule error:', error);
      setStatusError(market === 'de' ? 'Dienst konnte nicht geloescht werden.' : 'Nem sikerült törölni a beosztást.');
    } finally {
      setSaving(false);
    }
  }

  function handleSuggestEmployee() {
    const candidates = activeEmployees;
    const freeCandidates = candidates.filter(item => !schedules.some(schedule => schedule.employeeId === item.id && schedule.date === selectedDate && schedule.status !== 'deleted'));
    const pool = freeCandidates.length > 0 ? freeCandidates : candidates;

    if (pool.length === 0) {
      setStatusError(market === 'de' ? 'Kein passender Mitarbeiter fuer den KI-Vorschlag.' : 'Nincs megfelelő dolgozó az AI javaslathoz.');
      return;
    }

    const suggested = [...pool].sort((a, b) => {
      const countA = schedules.filter(item => item.employeeId === a.id && item.status !== 'deleted').length;
      const countB = schedules.filter(item => item.employeeId === b.id && item.status !== 'deleted').length;
      return countA - countB;
    })[0];

    setScheduleForm(prev => ({ ...prev, employeeId: suggested.id }));
    setStatusMessage(market === 'de' ? `KI-Vorschlag: ${suggested.name}` : `AI javaslat: ${suggested.name}`);
  }

  async function handleCreateSwapRequest() {
    setStatusError('');
    setStatusMessage('');

    if (!swapForm.requesterScheduleId || !swapForm.targetScheduleId) {
      setStatusError(market === 'de' ? 'Bitte waehle sowohl einen eigenen als auch einen Ziel-Dienst aus.' : 'Válassz saját és cél beosztást is.');
      return;
    }

    const requesterSchedule = schedules.find(item => item.id === swapForm.requesterScheduleId);
    const targetSchedule = schedules.find(item => item.id === swapForm.targetScheduleId);

    if (!requesterSchedule || !targetSchedule) {
      setStatusError(market === 'de' ? 'Ausgewaehlter Dienst wurde nicht gefunden.' : 'A kiválasztott beosztás nem található.');
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
        requesterScheduleDate: requesterSchedule.date,
        requesterFrom: requesterSchedule.from || requesterSchedule.startTime || '',
        requesterTo: requesterSchedule.to || requesterSchedule.endTime || '',
        targetScheduleId: targetSchedule.id,
        targetUserId: targetSchedule.linkedUserId || null,
        targetName: targetSchedule.employeeName,
        targetEmail: targetSchedule.employeeEmail || '',
        targetScheduleDate: targetSchedule.date,
        targetFrom: targetSchedule.from || targetSchedule.startTime || '',
        targetTo: targetSchedule.to || targetSchedule.endTime || '',
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
          title: market === 'de' ? 'Diensttausch-Anfrage' : 'Beosztás csere igény',
          message: market === 'de'
            ? `${requesterSchedule.employeeName} hat eine Tauschanfrage fuer deinen Dienst gesendet (${requesterSchedule.date} ${requesterSchedule.startTime}-${requesterSchedule.endTime}).`
            : `${requesterSchedule.employeeName} csereigényt küldött a beosztásodra (${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime}).`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }

      await createNotificationWithPush({
        userId: requesterSchedule.pharmacyId,
        type: 'schedule_swap_request_for_pharmacy',
        title: market === 'de' ? 'Neue Diensttausch-Anfrage' : 'Új beosztás csere igény indult',
        message: market === 'de'
          ? `${requesterSchedule.employeeName} hat einen Tausch mit dem Dienst von ${targetSchedule.employeeName} angefragt.`
          : `${requesterSchedule.employeeName} cserét kezdeményezett ${targetSchedule.employeeName} beosztásával.`,
        data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
        url: '/pharmagister?tab=schedule-manager&subtab=swaps',
      });

      setSwapForm({ requesterScheduleId: '', targetScheduleId: '', message: '' });
      setStatusMessage(
        market === 'de'
          ? 'Tauschanfrage gesendet, Benachrichtigung wurde zugestellt.'
          : 'Csereigény elküldve, az értesítés megérkezett a csere alanyához.'
      );
      await loadData();
    } catch (error) {
      console.error('Create swap request error:', error);
      setStatusError(market === 'de' ? 'Tauschanfrage konnte nicht gesendet werden.' : 'Nem sikerült elküldeni a csereigényt.');
    } finally {
      setSaving(false);
    }
  }

  // Quick-swap: initiated from a specific own shift card
  async function handleQuickSwapRequest(requesterScheduleId, targetScheduleId, message) {
    const requesterSchedule = schedules.find(item => item.id === requesterScheduleId);
    const targetSchedule = schedules.find(item => item.id === targetScheduleId);
    if (!requesterSchedule || !targetSchedule) {
      setStatusError(market === 'de' ? 'Dienst nicht gefunden.' : 'Beosztás nem található.');
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
        requesterScheduleDate: requesterSchedule.date,
        requesterFrom: requesterSchedule.from || requesterSchedule.startTime || '',
        requesterTo: requesterSchedule.to || requesterSchedule.endTime || '',
        targetScheduleId: targetSchedule.id,
        targetUserId: targetSchedule.linkedUserId || null,
        targetName: targetSchedule.employeeName,
        targetEmail: targetSchedule.employeeEmail || '',
        targetScheduleDate: targetSchedule.date,
        targetFrom: targetSchedule.from || targetSchedule.startTime || '',
        targetTo: targetSchedule.to || targetSchedule.endTime || '',
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
          title: market === 'de' ? 'Diensttausch-Anfrage' : 'Beosztás csere igény',
          message: market === 'de'
            ? `${requesterSchedule.employeeName} moechte deinen Dienst tauschen (${requesterSchedule.date} ${requesterSchedule.startTime}-${requesterSchedule.endTime}).`
            : `${requesterSchedule.employeeName} cserét kér a ${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime} műszakodra.`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }

      await createNotificationWithPush({
        userId: requesterSchedule.pharmacyId,
        type: 'schedule_swap_request_for_pharmacy',
        title: market === 'de' ? 'Neue Diensttausch-Anfrage' : 'Új beosztás csere igény indult',
        message: market === 'de'
          ? `${requesterSchedule.employeeName} hat eine Tauschanfrage mit dem Dienst von ${targetSchedule.employeeName} eingereicht. Danach ist noch eine Apothekenfreigabe noetig.`
          : `${requesterSchedule.employeeName} csereigényt nyújtott be ${targetSchedule.employeeName} beosztásával. Az elfogadáshoz a kollégája döntése után még jóváhagyásra van szükség.`,
        data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
        url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        dedupeWindowSeconds: 60,
        dedupeByDataKeys: ['requesterScheduleId', 'targetScheduleId'],
      });

      setQuickSwapScheduleId(null);
      setQuickSwapMessage('');
      setStatusMessage(market === 'de' ? `Tauschanfrage an ${targetSchedule.employeeName} gesendet.` : `Csereigény elküldve ${targetSchedule.employeeName} felé.`);
      await loadData();
    } catch (error) {
      console.error('Quick swap request error:', error);
      setStatusError(market === 'de' ? 'Tauschanfrage konnte nicht gesendet werden.' : 'Nem sikerült elküldeni a csereigényt.');
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
            title: market === 'de' ? 'Tausch akzeptiert – Apothekenfreigabe erforderlich' : 'Csere elfogadva – gyógyszertár jóváhagyása szükséges',
            message: market === 'de'
              ? `${requestItem.targetName} hat die Tauschanfrage akzeptiert. Fuer die Umsetzung ist noch die Apothekenfreigabe erforderlich.`
              : `${requestItem.targetName} elfogadta a csereigényt. A csere végrehajtásához még a gyógyszertár jóváhagyása szükséges.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }

        // Notify pharmacy: both parties agreed, awaiting confirmation
        await createNotificationWithPush({
          userId: requestItem.pharmacyId,
          type: 'schedule_swap_awaiting_pharmacy',
          title: market === 'de' ? 'Tauschfreigabe erforderlich' : 'Csere jóváhagyása szükséges',
          message: market === 'de'
            ? `Der Diensttausch von ${requestItem.requesterName} und ${requestItem.targetName} wartet auf Freigabe. Bitte bestaetigen oder ablehnen.`
            : `${requestItem.requesterName} és ${requestItem.targetName} beosztáscseréje elfogadásra vár. Kérjük, erősítse meg vagy utasítsa el.`,
          data: { requestId },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['requestId'],
        });

        setStatusMessage(market === 'de' ? 'Tauschanfrage akzeptiert. Warte auf Apothekenfreigabe.' : 'Elfogadtad a csereigényt. Várakozás a gyógyszertár jóváhagyására.');
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
            title: market === 'de' ? 'Tauschanfrage abgelehnt' : 'Csereigény elutasítva',
            message: market === 'de' ? `${requestItem.targetName} hat die Tauschanfrage abgelehnt.` : `${requestItem.targetName} elutasította a csereigényt.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }

        await createNotificationWithPush({
          userId: requestItem.pharmacyId,
          type: 'schedule_swap_result_for_pharmacy',
          title: market === 'de' ? 'Tausch abgelehnt' : 'Csere elutasítva',
          message: market === 'de'
            ? `${requestItem.targetName} hat die Tauschanfrage nicht akzeptiert (${requestItem.requesterName} hat sie initiiert).`
            : `${requestItem.targetName} nem fogadta el a csereigényt (${requestItem.requesterName} kezdeményezte).`,
          data: { requestId },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });

        setStatusMessage(market === 'de' ? 'Tauschanfrage abgelehnt.' : 'A csereigényt elutasítottad.');
      }

      await loadData();
    } catch (error) {
      console.error('Respond to swap request error:', error);
      setStatusError(error.message || (market === 'de' ? 'Tauschanfrage konnte nicht abgeschlossen werden.' : 'Nem sikerült lezárni a csereigényt.'));
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
        let requesterSchedule = schedules.find(item => item.id === requestItem.requesterScheduleId);
        let targetSchedule = schedules.find(item => item.id === requestItem.targetScheduleId);

        // If not in memory (different month), fetch from Firestore directly
        if (!requesterSchedule && requestItem.requesterScheduleId) {
          const snap = await getDoc(doc(db, 'pharmacySchedules', requestItem.requesterScheduleId));
          if (snap.exists()) requesterSchedule = { id: snap.id, ...snap.data() };
        }
        if (!targetSchedule && requestItem.targetScheduleId) {
          const snap = await getDoc(doc(db, 'pharmacySchedules', requestItem.targetScheduleId));
          if (snap.exists()) targetSchedule = { id: snap.id, ...snap.data() };
        }

        if (!requesterSchedule || !targetSchedule) {
          // Schedules gone — cancel the swap request and reload
          await updateDoc(doc(db, 'scheduleSwapRequests', requestId), {
            status: 'cancelled_schedule_deleted',
            updatedAt: serverTimestamp(),
          });
          for (const linkedUserId of [requestItem.requesterUserId, requestItem.targetUserId].filter(Boolean)) {
            await createNotificationWithPush({
              userId: linkedUserId,
              type: 'schedule_swap_cancelled',
              title: market === 'de' ? 'Tauschanfrage abgebrochen' : 'Csereigény megszakítva',
              message: market === 'de'
                ? 'Die Tauschanfrage wurde abgebrochen, weil einer der betroffenen Dienste nicht mehr verfuegbar ist.'
                : 'A csereigény megszakadt, mert az egyik érintett beosztás már nem található.',
              data: { requestId, pharmacyId: requestItem.pharmacyId },
              url: '/pharmagister?tab=schedule-manager&subtab=swaps',
              dedupeWindowSeconds: 120,
              dedupeByDataKeys: ['requestId', 'type'],
            });
          }
          await loadData();
          setStatusError(market === 'de' ? 'Einer der Tausch-Dienste wurde nicht gefunden, die Anfrage wurde zurueckgezogen.' : 'A csere egyik beosztása már nem található, a csereigényt visszavontuk.');
          return;
        }

        const publishedAtIso = new Date().toISOString();

        // Execute actual swap (and re-publish both schedules automatically)
        await updateDoc(doc(db, 'pharmacySchedules', requesterSchedule.id), {
          employeeId: targetSchedule.employeeId,
          employeeName: targetSchedule.employeeName,
          employeeEmail: targetSchedule.employeeEmail || '',
          linkedUserId: targetSchedule.linkedUserId || null,
          role: targetSchedule.role,
          swappedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: publishedAtIso,
          publishedBy: user.uid,
        });

        await updateDoc(doc(db, 'pharmacySchedules', targetSchedule.id), {
          employeeId: requesterSchedule.employeeId,
          employeeName: requesterSchedule.employeeName,
          employeeEmail: requesterSchedule.employeeEmail || '',
          linkedUserId: requesterSchedule.linkedUserId || null,
          role: requesterSchedule.role,
          swappedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          publishedAt: publishedAtIso,
          publishedBy: user.uid,
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
            title: market === 'de' ? 'Tausch genehmigt – Dienstplan aktualisiert' : 'Csere jóváhagyva – beosztás frissítve',
            message: market === 'de'
              ? `Die Apotheke hat den Tausch mit ${requestItem.targetName} genehmigt. Der neue Dienstplan wurde automatisch veroeffentlicht.`
              : `A gyógyszertár jóváhagyta a cserét ${requestItem.targetName} dolgozóval. Az új beosztás automatikusan publikálva.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }
        if (requestItem.targetUserId) {
          await createNotificationWithPush({
            userId: requestItem.targetUserId,
            type: 'schedule_swap_result',
            title: market === 'de' ? 'Tausch genehmigt – Dienstplan aktualisiert' : 'Csere jóváhagyva – beosztás frissítve',
            message: market === 'de'
              ? `Die Apotheke hat den Tausch mit ${requestItem.requesterName} genehmigt. Der neue Dienstplan wurde automatisch veroeffentlicht.`
              : `A gyógyszertár jóváhagyta a cserét ${requestItem.requesterName} dolgozóval. Az új beosztás automatikusan publikálva.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }

        setStatusMessage(market === 'de' ? 'Tausch genehmigt, Dienstplaene wurden automatisch neu veroeffentlicht.' : 'Csere jóváhagyva, beosztások automatikusan újrapublikálva.');
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
            title: market === 'de' ? 'Tausch von Apotheke abgelehnt' : 'Csere elutasítva a gyógyszertár által',
            message: market === 'de' ? `Die Apotheke hat den Tausch mit ${requestItem.targetName} nicht genehmigt.` : `A gyógyszertár nem hagyta jóvá a cserét ${requestItem.targetName} dolgozóval.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }
        if (requestItem.targetUserId) {
          await createNotificationWithPush({
            userId: requestItem.targetUserId,
            type: 'schedule_swap_result',
            title: market === 'de' ? 'Tausch von Apotheke abgelehnt' : 'Csere elutasítva a gyógyszertár által',
            message: market === 'de' ? `Die Apotheke hat den Tausch mit ${requestItem.requesterName} nicht genehmigt.` : `A gyógyszertár nem hagyta jóvá a cserét ${requestItem.requesterName} dolgozóval.`,
            data: { requestId },
            url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          });
        }

        setStatusMessage(market === 'de' ? 'Tausch abgelehnt.' : 'A cserét elutasítottad.');
      }

      await loadData();
    } catch (error) {
      console.error('Pharmacy respond to swap error:', error);
      setStatusError(error.message || (market === 'de' ? 'Tauschanfrage konnte nicht abgeschlossen werden.' : 'Nem sikerült lezárni a csereigényt.'));
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
      setStatusError(market === 'de' ? 'Bitte gib den Urlaubszeitraum an.' : 'Add meg a szabadság időszakát.');
      return;
    }
    if (vacationForm.endDate < vacationForm.startDate) {
      setStatusError(market === 'de' ? 'Das Enddatum darf nicht vor dem Startdatum liegen.' : 'A záró dátum nem lehet korábbi a kezdő dátumnál.');
      return;
    }

    const employeeRecord = ownEmployeeRecords[0];
    if (!employeeRecord) {
      setStatusError(market === 'de' ? 'Zu diesem Konto ist kein Mitarbeiterdatensatz verknuepft.' : 'Ehhez a fiókhoz nincs kapcsolt dolgozói rekord.');
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
        title: market === 'de' ? 'Neuer Urlaubsantrag' : 'Új szabadságigény',
        message: market === 'de' ? `${employeeRecord.name} hat einen Urlaubsantrag eingereicht.` : `${employeeRecord.name} szabadságigényt küldött be.`,
        data: { employeeId: employeeRecord.id },
        url: '/pharmagister?tab=schedule-manager&subtab=schedule',
      });

      setVacationForm(prev => ({ ...prev, reason: '' }));
      setStatusMessage(market === 'de' ? 'Urlaubsantrag gesendet.' : 'Szabadságigény elküldve.');
      await loadData();
    } catch (error) {
      console.error('Create vacation request error:', error);
      setStatusError(market === 'de' ? 'Urlaubsantrag konnte nicht gesendet werden.' : 'Nem sikerült elküldeni a szabadságigényt.');
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
          title: decision === 'accepted'
            ? (market === 'de' ? 'Urlaub genehmigt' : 'Szabadság jóváhagyva')
            : (market === 'de' ? 'Urlaub abgelehnt' : 'Szabadság elutasítva'),
          message: decision === 'accepted'
            ? (market === 'de'
              ? `Dein Urlaubsantrag fuer ${requestItem.startDate} - ${requestItem.endDate} wurde genehmigt.`
              : `${requestItem.startDate} - ${requestItem.endDate} közötti szabadságigényed jóvá lett hagyva.`)
            : (market === 'de'
              ? `Dein Urlaubsantrag fuer ${requestItem.startDate} - ${requestItem.endDate} wurde abgelehnt.`
              : `${requestItem.startDate} - ${requestItem.endDate} közötti szabadságigényed el lett utasítva.`),
          data: { requestId, pharmacyId: requestItem.pharmacyId },
          url: '/pharmagister?tab=schedule-manager&subtab=vacations',
        });
      }

      if (decision === 'accepted') {
        await runAutoPlanner({
          action: 'replan',
          sickEmployeeId: requestItem.employeeId,
          affectedDates: getDateRangeKeys(requestItem.startDate, requestItem.endDate),
        });
        setStatusMessage(
          market === 'de'
            ? 'Urlaubsantrag genehmigt, fuer die betroffenen Tage wurde ein Neuplanungs-Vorschlag erstellt.'
            : 'A szabadságigény jóváhagyva, és újratervezési javaslat készült az érintett napokra.'
        );
      } else {
        setStatusMessage(market === 'de' ? 'Urlaubsantrag abgelehnt.' : 'A szabadságigény elutasítva.');
      }
      await loadData();
    } catch (error) {
      console.error('Respond to vacation request error:', error);
      setStatusError(error.message || (market === 'de' ? 'Urlaubsantrag konnte nicht aktualisiert werden.' : 'Nem sikerült frissíteni a szabadságigényt.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishSchedules() {
    if (!user || activeMonthSchedules.length === 0) {
      setStatusError(market === 'de' ? 'Kein veroeffentlichbarer Dienstplan im ausgewaehlten Monat.' : 'Nincs publikálható beosztás a kiválasztott hónapban.');
      return {
        success: false,
        blockingErrors: [{ message: market === 'de' ? 'In diesem Monat gibt es keinen ausgefuellten Dienstplan.' : 'Nincs kitöltött beosztás ebben a hónapban.' }],
      };
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
          schedulePreferences: schedulePreferences.filter(p => p.status !== 'deleted' && p.publishedAt),
          year,
          month,
          config: normalizePlanningConfig(plannerConfigForm),
          action: 'validate',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || (market === 'de' ? 'Dienstplanvalidierung fehlgeschlagen.' : 'Nem sikerült validálni a beosztást.'));
      }

      const blockingErrors = (result.conflicts || []).filter(item => item.severity === 'error');
      if (blockingErrors.length > 0) {
        setPlannerResult(result);
        setStatusError(
          market === 'de'
            ? `Veroeffentlichung blockiert: ${blockingErrors.length} kritische Fehler sind noch im Dienstplan.`
            : `A publikálás blokkolva: ${blockingErrors.length} kritikus hiba maradt a beosztásban.`
        );
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
          title: market === 'de' ? 'Neuer Dienstplan veroeffentlicht' : 'Uj beosztas publikalva',
          message: market === 'de'
            ? `Dein Dienstplan fuer ${monthNames[month - 1]} ${year} wurde veroeffentlicht.`
            : `${monthNames[month - 1]} ${year} havi beosztasod publikalva lett.`,
          data: { pharmacyId: user.uid, year, month },
          url: '/pharmagister?tab=schedule-manager&subtab=mine',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['pharmacyId', 'year', 'month'],
        });
      }

      const missingCount = missingLinkedUsers.size;
      if (missingCount > 0) {
        setStatusMessage(
          market === 'de'
            ? `Dienstplan ${monthNames[month - 1]} ${year} veroeffentlicht. Benachrichtigung an ${notifyTargets.size} Mitarbeitende gesendet, fuer ${missingCount} Mitarbeitende fehlt ein verknuepftes Konto.`
            : `A ${monthNames[month - 1]} ${year}. havi beosztas publikalva lett. Ertesites elkuldve ${notifyTargets.size} dolgozonak, ${missingCount} dolgozohoz nincs kapcsolt fiok.`
        );
      } else {
        setStatusMessage(
          market === 'de'
            ? `Dienstplan ${monthNames[month - 1]} ${year} veroeffentlicht. Benachrichtigung an alle betroffenen Mitarbeitenden gesendet.`
            : `A ${monthNames[month - 1]} ${year}. havi beosztas publikalva lett. Ertesites elkuldve minden erintett dolgozonak.`
        );
      }
      await loadData();
      return { success: true };
    } catch (error) {
      console.error('Publish schedules error:', error);
      const msg = error.message || (market === 'de' ? 'Dienstplaene konnten nicht veroeffentlicht werden.' : 'Nem sikerült publikálni a beosztásokat.');
      setStatusError(msg);
      return { success: false, blockingErrors: [{ message: msg }] };
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishSwapChanges() {
    if (!user?.uid) return;
    setSaving(true);
    setStatusError('');
    setStatusMessage('');
    try {
      const publishedAtIso = new Date().toISOString();
      // Mark all unpublished active schedules for this month as published
      const toPublish = schedules.filter(s =>
        s.year === year && s.month === month &&
        s.status !== 'deleted' &&
        !isPublishedSchedule(s)
      );
      await Promise.all(toPublish.map(s =>
        updateDoc(doc(db, 'pharmacySchedules', s.id), {
          publishedAt: publishedAtIso,
          publishedBy: user.uid,
          updatedAt: serverTimestamp(),
        })
      ));
      const changedLinkedUsers = [...new Set(toPublish.map(s => s.linkedUserId).filter(Boolean))];
      for (const userId of changedLinkedUsers) {
        await createNotificationWithPush({
          userId,
          type: 'schedule_updated',
          title: market === 'de' ? 'Dienstplan-Aenderung' : 'Beosztas valtozas',
          message: market === 'de'
            ? `Im Dienstplan ${monthNames[month - 1]} ${year} wurde ein Tausch vorgenommen.`
            : `${monthNames[month - 1]} ${year} havi beosztasban csere tortent.`,
          data: { pharmacyId: user.uid, year, month },
          url: '/pharmagister?tab=schedule-manager&subtab=mine',
          dedupeWindowSeconds: 60,
          dedupeByDataKeys: ['pharmacyId', 'year', 'month', 'type'],
        });
      }
      setStatusMessage(
        market === 'de'
          ? `Aenderungen veroeffentlicht. Benachrichtigung an ${changedLinkedUsers.length} betroffene Mitarbeitende gesendet.`
          : `Változtatások publikálva. Értesítés elküldve ${changedLinkedUsers.length} érintett dolgozónak.`
      );
      await loadData();
    } catch (err) {
      console.error('handlePublishSwapChanges error', err);
      setStatusError(market === 'de' ? 'Aenderungen konnten nicht veroeffentlicht werden.' : 'Nem sikerült publikálni a változtatásokat.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMonth() {
    if (!user?.uid) return;
    setSaving(true);
    setStatusError('');
    setStatusMessage('');
    try {
      const toDelete = schedules.filter(s =>
        s.year === year && s.month === month &&
        s.status !== 'deleted'
      );
      const deletedIds = new Set(toDelete.map(s => s.id));
      await Promise.all(toDelete.map(s =>
        updateDoc(doc(db, 'pharmacySchedules', s.id), { status: 'deleted', updatedAt: serverTimestamp() })
      ));
      // Cancel swap requests referencing any of the deleted schedules
      const relatedSwaps = swapRequests.filter(r =>
        (deletedIds.has(r.requesterScheduleId) || deletedIds.has(r.targetScheduleId)) &&
        !['accepted', 'rejected', 'rejected_by_pharmacy', 'cancelled', 'cancelled_schedule_deleted'].includes(r.status)
      );
      await Promise.all(relatedSwaps.map(r =>
        updateDoc(doc(db, 'scheduleSwapRequests', r.id), {
          status: 'cancelled_schedule_deleted',
          updatedAt: serverTimestamp(),
        })
      ));

      const publishedTargets = new Map();
      toDelete.forEach((schedule) => {
        if (schedule.linkedUserId && isPublishedSchedule(schedule)) {
          publishedTargets.set(schedule.linkedUserId, schedule.employeeName || 'Dolgozó');
        }
      });

      for (const [linkedUserId] of publishedTargets) {
        await createNotificationWithPush({
          userId: linkedUserId,
          type: 'schedule_month_deleted',
          title: market === 'de' ? 'Monatsdienstplan geloescht' : 'Havi beosztás törölve',
          message: market === 'de'
            ? `Dein Monatsdienstplan ${monthNames[month - 1]} ${year} wurde von der Apotheke geloescht.`
            : `${monthNames[month - 1]} ${year} havi beosztásodat a gyógyszertár törölte.`,
          data: { pharmacyId: user.uid, year, month },
          url: '/pharmagister?tab=schedule-manager&subtab=mine',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['pharmacyId', 'year', 'month', 'type'],
        });
      }

      const cancelledSwapTargets = new Map();
      relatedSwaps.forEach((swap) => {
        if (swap.requesterUserId) cancelledSwapTargets.set(swap.requesterUserId, swap.id);
        if (swap.targetUserId) cancelledSwapTargets.set(swap.targetUserId, swap.id);
      });

      for (const [linkedUserId, requestId] of cancelledSwapTargets) {
        await createNotificationWithPush({
          userId: linkedUserId,
          type: 'schedule_swap_cancelled',
          title: market === 'de' ? 'Tauschanfrage abgebrochen' : 'Csereigény megszakítva',
          message: market === 'de' ? 'Eine Tauschanfrage wurde abgebrochen, weil der betroffene Dienst geloescht wurde.' : 'Egy csereigény megszakadt, mert az érintett beosztást törölték.',
          data: { requestId, pharmacyId: user.uid, year, month },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
          dedupeWindowSeconds: 120,
          dedupeByDataKeys: ['requestId', 'type'],
        });
      }
      setStatusMessage(
        market === 'de'
          ? `${toDelete.length} Dienste geloescht (${monthNames[month - 1]} ${year}).`
          : `${toDelete.length} beosztás törölve (${monthNames[month - 1]} ${year}).`
      );
      await loadData();
    } catch (err) {
      console.error('handleDeleteMonth error', err);
      setStatusError(market === 'de' ? 'Monatsdienstplan konnte nicht geloescht werden.' : 'Nem sikerült törölni a havi beosztást.');
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
          const byType = shifts.find(s => normalizeShiftTypeKey(s.shiftType) === normalizeShiftTypeKey(pref.shiftType));
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
    const confirmed = window.confirm(
      market === 'de'
        ? `Soll ich die Dienstplaene aus ${monthNames[previousMonth - 1]} ${previousYear} in diesen Monat kopieren?`
        : `Átmásoljam a ${monthNames[previousMonth - 1]} ${previousYear}. havi beosztásokat erre a hónapra?`
    );
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
          notes: item.notes
            ? `${item.notes} | ${market === 'de' ? 'Aus Vormonat kopiert' : 'Másolva előző hónapból'}`
            : (market === 'de' ? 'Aus Vormonat kopiert' : 'Másolva előző hónapból'),
          status: 'active',
          createdBy: user.uid,
          planningSource: 'copied-previous-month',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        currentSet.add(dedupeKey);
        created += 1;
      }

      setStatusMessage(
        market === 'de'
          ? `${created} Dienste aus dem Vormonat kopiert.`
          : `${created} műszak átmásolva az előző hónapból.`
      );
      await loadData();
    } catch (error) {
      console.error('Copy previous month schedules error:', error);
      setStatusError(market === 'de' ? 'Vorheriger Monatsdienstplan konnte nicht kopiert werden.' : 'Nem sikerült átmásolni az előző havi beosztást.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportSchedules() {
    if (activeMonthSchedules.length === 0) {
      setStatusError(market === 'de' ? 'Kein exportierbarer Dienstplan im ausgewaehlten Monat.' : 'Nincs exportálható beosztás a kiválasztott hónapban.');
      return;
    }

    const header = ['Datum', 'Tol', 'Ig', 'Dolgozo', 'Email', 'Szerepkor', 'Publikalva', 'Forras', 'Megjegyzes'];
    const rows = activeMonthSchedules.map(item => ([
      item.date,
      item.startTime,
      item.endTime,
      item.employeeName,
      item.employeeEmail || '',
      prettyRole(item.role, market),
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
    setStatusMessage(market === 'de' ? 'CSV-Export fertig.' : 'CSV export elkészült.');
  }

  const pendingIncomingSwaps = swapRequests.filter(r => r.targetUserId === user?.uid && r.status === 'pending');

  const topTabs = isPharmacy
    ? [
        {
          key: 'schedule',
          label: market === 'de' ? 'Dienstplan' : 'Beosztás',
          fullLabel: market === 'de' ? 'Dienstplaene verwalten' : 'Beosztások kezelése',
        },
        {
          key: 'workers',
          label: market === 'de' ? 'Mitarbeitende' : 'Dolgozók',
          fullLabel: market === 'de' ? 'Mitarbeitende verwalten' : 'Dolgozók kezelése',
        },
      ]
    : [
        { key: 'mine', label: market === 'de' ? 'Mein Dienstplan' : 'Beosztásom' },
        { key: 'planner', label: market === 'de' ? 'Planer' : 'Tervező' },
        { key: 'swaps', label: market === 'de' ? 'Tausche' : 'Cserék', badge: pendingIncomingSwaps.length },
        { key: 'vacations', label: market === 'de' ? 'Urlaube' : 'Szabadságolások' },
        { key: 'preferences', label: market === 'de' ? 'Praeferenzen' : 'Preferenciák' },
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
      setStatusError(market === 'de' ? 'Zu diesem Konto ist kein Mitarbeiterdatensatz verknuepft.' : 'Ehhez a fiókhoz nincs kapcsolt dolgozói rekord.');
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
      setStatusMessage(
        market === 'de'
          ? 'Praeferenzen gespeichert. Sie werden bei der naechsten automatischen Planung beruecksichtigt.'
          : 'Preferenciák mentve. A kovetkezo automatikus tervezesnel figyelembe lesznek veve.'
      );
      await loadData();
    } catch (error) {
      console.error('Save preferences error:', error);
      setStatusError(market === 'de' ? 'Praeferenzen konnten nicht gespeichert werden.' : 'Nem sikerült menteni a preferenciákat.');
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
      setPlannerDraftSavedAt(new Date());
      setStatusMessage(market === 'de' ? 'Planungsregeln gespeichert.' : 'Tervezési szabályok mentve.');
      return true;
    } catch (error) {
      console.error('Save planner config error:', error);
      setStatusError(market === 'de' ? 'Planungsregeln konnten nicht gespeichert werden.' : 'Nem sikerült menteni a tervezési szabályokat.');
      return false;
    } finally {
      setPlannerConfigSaving(false);
    }
  }

  async function runAutoPlanner({ action = 'plan', sickEmployeeId = null, affectedDates = [] } = {}) {
    if (!user) return { success: false, error: market === 'de' ? 'Kein angemeldeter Benutzer.' : 'Nincs bejelentkezett felhasznalo.' };
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
          schedulePreferences: schedulePreferences.filter(p => p.status !== 'deleted' && p.publishedAt),
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
        throw new Error(result?.error || (market === 'de' ? 'Fehler bei der automatischen Planung.' : 'Automatikus tervezési hiba történt.'));
      }

      setPlannerResult(result);
      return { success: true, result };
    } catch (error) {
      console.error('Auto planner error:', error);
      setStatusError(error.message || (market === 'de' ? 'Automatische Planung konnte nicht ausgefuehrt werden.' : 'Nem sikerült lefuttatni az automatikus tervezést.'));
      return {
        success: false,
        error: error.message || (market === 'de' ? 'Automatische Planung konnte nicht ausgefuehrt werden.' : 'Nem sikerült lefuttatni az automatikus tervezést.'),
      };
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
    return dt.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' });
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
    const resolveTargetMonth = () => {
      const now = new Date();
      let targetYear = now.getFullYear();
      let targetMonth = now.getMonth() + 1;

      if (Number.isInteger(entities?.monthOffset)) {
        const dt = new Date(targetYear, targetMonth - 1 + Number(entities.monthOffset), 1);
        targetYear = dt.getFullYear();
        targetMonth = dt.getMonth() + 1;
      }

      if (Number.isInteger(entities?.monthNumber) && entities.monthNumber >= 1 && entities.monthNumber <= 12) {
        targetMonth = entities.monthNumber;
      }

      const monthLabel = MONTHS_HU[targetMonth - 1] || entities?.monthLabel || 'kivalasztott honap';
      return { targetYear, targetMonth, monthLabel };
    };

    const appendBettiMessage = (text) => {
      setBettiChatMessages((prev) => [...prev, { role: 'assistant', text }]);
    };

    if (action === 'write_schedule_plan') {
      if (!isPharmacy) {
        appendBettiMessage('A tervezes inditasa ebben a nezetben nem erheto el.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      await executeBettiUiCommand({
        type: 'local_schedule_wizard_start',
        monthNumber: targetMonth,
        monthLabel,
        monthOffset: null,
      }, {
        role: 'assistant',
        action: 'write_schedule_plan',
        entities: { monthNumber: targetMonth, monthLabel, monthOffset: null, year: targetYear },
      });
      return;
    }

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
      appendBettiMessage(text);
      return;
    }

    if (action === 'check_my_schedule_exists') {
      if (isPharmacy) {
        appendBettiMessage('Ebben a nezetben nem latom a sajat dolgozoi beosztasodat. Valtas dolgozoi nezetre a sajat muszakokhoz.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const ownMonthShifts = ownSchedules
        .filter((s) => s.year === targetYear && s.month === targetMonth && s.status !== 'deleted')
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

      if (ownMonthShifts.length === 0) {
        appendBettiMessage(`Nincs, a ${monthLabel} honapban jelenleg nincs publikalt vagy rogzitett muszakod.`);
        return;
      }

      const nextShift = ownMonthShifts[0];
      appendBettiMessage(`Igen, van. A ${monthLabel} honapban ${ownMonthShifts.length} muszakod van. A kovetkezo: ${formatHuDate(nextShift.date)} ${nextShift.startTime}-${nextShift.endTime}.`);
      return;
    }

    if (action === 'show_my_schedule') {
      if (isPharmacy) {
        appendBettiMessage('Ebben a nezetben nem latom a sajat dolgozoi beosztasodat. Valtas dolgozoi nezetre a sajat muszakokhoz.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const ownMonthShifts = ownSchedules
        .filter((s) => s.year === targetYear && s.month === targetMonth && s.status !== 'deleted')
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

      if (ownMonthShifts.length === 0) {
        appendBettiMessage(`A ${monthLabel} honapban nincs publikalt vagy rogzitett muszakod.`);
        return;
      }

      const lines = ownMonthShifts
        .slice(0, 20)
        .map((s) => `${formatHuDate(s.date)}: ${s.startTime}-${s.endTime}`);
      const suffix = ownMonthShifts.length > 20 ? `\n... es meg ${ownMonthShifts.length - 20} muszak` : '';
      appendBettiMessage(`A beosztasod (${monthLabel}):\n- ${lines.join('\n- ')}${suffix}`);
      return;
    }

    if (action === 'show_my_vacations') {
      if (isPharmacy) {
        appendBettiMessage('Ebben a nezetben nem latom a sajat szabadsagadataidat. Valtas dolgozoi nezetre a sajat adatokhoz.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const ownVacationDates = [...buildOwnVacationDateSet()]
        .filter((dateKey) => {
          const [yy, mm] = String(dateKey).split('-').map(Number);
          return yy === targetYear && mm === targetMonth;
        })
        .sort();

      if (ownVacationDates.length === 0) {
        appendBettiMessage(`A ${monthLabel} honapban nincs rogzitett szabadsag napod.`);
        return;
      }

      appendBettiMessage(`Szabadsag napjaid (${monthLabel}): ${ownVacationDates.map(formatHuDate).join(', ')}`);
      return;
    }

    if (action === 'show_my_free_days') {
      if (isPharmacy) {
        appendBettiMessage('Ebben a nezetben nem latom a sajat szabadnapjaidat. Valtas dolgozoi nezetre a sajat adatokhoz.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const ownMonthShifts = ownSchedules
        .filter((s) => s.year === targetYear && s.month === targetMonth && s.status !== 'deleted');
      const ownVacationDates = buildOwnVacationDateSet();
      const freeDays = [];
      const monthDays = getDaysInMonth(targetYear, targetMonth);
      const isCurrentMonth = targetYear === Number(today.slice(0, 4)) && targetMonth === Number(today.slice(5, 7));

      for (let d = 1; d <= monthDays; d += 1) {
        const dateKey = formatDateKey(targetYear, targetMonth, d);
        if (isCurrentMonth && dateKey < today) continue;
        const hasShift = ownMonthShifts.some((s) => s.date === dateKey);
        const onVacation = ownVacationDates.has(dateKey);
        if (!hasShift && !onVacation) freeDays.push(dateKey);
        if (freeDays.length >= 25) break;
      }

      if (freeDays.length === 0) {
        appendBettiMessage(`A ${monthLabel} honapban nem latok tiszta szabadnapot.`);
        return;
      }

      appendBettiMessage(`Szabadnapjaid (${monthLabel}): ${freeDays.map(formatHuDate).join(', ')}`);
      return;
    }

    if (action === 'optimize_fairness' || action === 'optimize_overtime' || action === 'minimal_change_replan') {
      await runAutoPlanner({ action: 'plan' });
      return;
    }

    // Pharmacy manager actions
    if (action === 'list_employees') {
      if (!isPharmacy) {
        appendBettiMessage(market === 'de' ? 'Diese Funktion ist nur in der Apothekenansicht verfuegbar.' : 'Ez a funkció csak a gyógyszertári nézet számára értelmes.');
        return;
      }

      const activeEmps = employees.filter((e) => e.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      if (activeEmps.length === 0) {
        appendBettiMessage(market === 'de' ? 'Derzeit gibt es keine aktiven Mitarbeitenden.' : 'Jelenleg nincsenek aktív alkalmazottaid.');
        return;
      }

      const empList = activeEmps.slice(0, 15).map((e) => `${e.name}${e.role ? ` (${e.role})` : ''}`).join('\n- ');
      const suffix = activeEmps.length > 15
        ? (market === 'de' ? `\n... und noch ${activeEmps.length - 15} weitere` : `\n... és még ${activeEmps.length - 15} alkalmazott`)
        : '';
      appendBettiMessage(market === 'de' ? `Deine Mitarbeitenden (${activeEmps.length}):\n- ${empList}${suffix}` : `Alkalmazottaid (${activeEmps.length} db):\n- ${empList}${suffix}`);
      return;
    }

    if (action === 'show_vacation_requests') {
      if (!isPharmacy) {
        appendBettiMessage(market === 'de' ? 'Diese Funktion ist nur in der Apothekenansicht verfuegbar.' : 'Ez a funkció csak a gyógyszertári nézet számára értelmes.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const monthVacationRequests = vacationRequests.filter(
        (v) => v.year === targetYear && v.month === targetMonth && v.status !== 'declined'
      );

      if (monthVacationRequests.length === 0) {
        appendBettiMessage(market === 'de' ? `Im Monat ${monthLabel} gibt es keine Urlaubsanfragen.` : `A ${monthLabel} hónapban nincsenek szabadságigények.`);
        return;
      }

      const vacList = monthVacationRequests.slice(0, 10)
        .map((v) => `${v.employeeName}: ${v.startDate} - ${v.endDate}${v.status === 'pending' ? ' ⏳' : ' ✅'}`)
        .join('\n- ');
      const suffix = monthVacationRequests.length > 10
        ? (market === 'de' ? `\n... und noch ${monthVacationRequests.length - 10} weitere` : `\n... és még ${monthVacationRequests.length - 10} igény`)
        : '';
      appendBettiMessage(market === 'de' ? `Urlaubsanfragen (${monthLabel}):\n- ${vacList}${suffix}` : `Szabadságigények (${monthLabel}):\n- ${vacList}${suffix}`);
      return;
    }

    if (action === 'missing_drafts') {
      if (!isPharmacy) {
        appendBettiMessage(market === 'de' ? 'Diese Funktion ist nur in der Apothekenansicht verfuegbar.' : 'Ez a funkció csak a gyógyszertári nézet számára értelmes.');
        return;
      }

      const { targetYear, targetMonth, monthLabel } = resolveTargetMonth();
      const activeEmps = employees.filter((e) => e.status !== 'inactive');
      const empsWithDrafts = schedulePreferences
        .filter((p) => p.year === targetYear && p.month === targetMonth && p.status === 'draft')
        .map((p) => p.employeeId || p.linkedUserId);
      const uniqueDraftEmps = new Set(empsWithDrafts.filter(Boolean));

      const missing = activeEmps.filter((e) => !uniqueDraftEmps.has(e.id) && !uniqueDraftEmps.has(e.linkedUserId));
      if (missing.length === 0) {
        appendBettiMessage(market === 'de' ? `Alle Mitarbeitenden haben den Entwurf fuer ${monthLabel} fertiggestellt!` : `Az összes alkalmazott elkészítette a ${monthLabel} tervezetet!`);
        return;
      }

      const missingList = missing.slice(0, 10).map((e) => e.name).join(', ');
      const suffix = missing.length > 10
        ? (market === 'de' ? ` und noch ${missing.length - 10} weitere` : `, és még ${missing.length - 10} ember`)
        : '';
      appendBettiMessage(
        market === 'de'
          ? `Folgende ${missing.length} Mitarbeitende haben den Entwurf fuer ${monthLabel} noch nicht eingereicht:\n${missingList}${suffix}`
          : `A következő ${missing.length} alkalmazott nem írta meg még a ${monthLabel} tervezetet:\n${missingList}${suffix}`
      );
      return;
    }

    if (action === 'add_employee') {
      if (!isPharmacy) {
        appendBettiMessage(market === 'de' ? 'Diese Funktion ist nur in der Apothekenansicht verfuegbar.' : 'Ez a funkció csak a gyógyszertári nézet számára értelmes.');
        return;
      }
      appendBettiMessage(market === 'de' ? 'Bitte gib die E-Mail-Adresse der neuen Person im Tab Mitarbeitende ein.' : 'Kérlek add meg az új alkalmazott email címét a "Dolgozók" fülön.');
      return;
    }

    if (action === 'remove_employee') {
      if (!isPharmacy) {
        appendBettiMessage(market === 'de' ? 'Diese Funktion ist nur in der Apothekenansicht verfuegbar.' : 'Ez a funkció csak a gyógyszertári nézet számára értelmes.');
        return;
      }
      appendBettiMessage(market === 'de' ? 'Waehle die zu entfernende Person im Tab Mitarbeitende aus.' : 'Válaszd ki az eltávolítandó dolgozót a "Dolgozók" fülön.');
      return;
    }
  }

  function startVoiceInput() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (bettiVoiceListening) {
      bettiRecognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setBettiVoiceListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      if (transcript.trim()) {
        sendBettiChatMessage(transcript.trim());
      }
      setBettiVoiceListening(false);
    };
    recognition.onerror = () => setBettiVoiceListening(false);
    recognition.onend = () => setBettiVoiceListening(false);
    bettiRecognitionRef.current = recognition;
    recognition.start();
  }

  function speakBettiText(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  function resolveDemandDraftDate(dateOffset = 1) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + Number(dateOffset || 0));
    return formatDateKey(base.getFullYear(), base.getMonth() + 1, base.getDate());
  }

  function buildDemandWizardCommands(draft) {
    const safeDraft = draft || { position: 'pharmacist', dateOffset: 1, workHours: '08:00-16:00' };
    return [
      {
        id: safeDraft.position === 'pharmacist' ? 'pos_assistant' : 'pos_pharmacist',
        type: 'local_demand_wizard_set_position',
        label: safeDraft.position === 'pharmacist' ? 'Szakasszisztens pozicio' : 'Gyogyszeresz pozicio',
        position: safeDraft.position === 'pharmacist' ? 'assistant' : 'pharmacist',
      },
      {
        id: 'date_next',
        type: 'local_demand_wizard_set_date_offset',
        label: 'Holnap',
        dateOffset: 1,
      },
      {
        id: 'date_plus2',
        type: 'local_demand_wizard_set_date_offset',
        label: '2 nap mulva',
        dateOffset: 2,
      },
      {
        id: safeDraft.workHours === '08:00-16:00' ? 'hours_12_20' : 'hours_8_16',
        type: 'local_demand_wizard_set_hours',
        label: safeDraft.workHours === '08:00-16:00' ? '12:00-20:00' : '08:00-16:00',
        workHours: safeDraft.workHours === '08:00-16:00' ? '12:00-20:00' : '08:00-16:00',
      },
      {
        id: 'demand_submit',
        type: 'local_demand_wizard_submit',
        label: market === 'de' ? 'Anfrage senden' : 'Igény feladása',
      },
    ];
  }

  async function auditAiCommand(eventType, details = {}) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch('/api/pharmagister/ai-command-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType,
          details,
          context: {
            mainTab,
            role: isPharmacy ? 'pharmacy' : 'employee',
            aiViewEnabled,
          },
        }),
      });
    } catch (err) {
      console.warn('AI audit log failed:', err);
    }
  }

  async function executeBettiUiCommand(command, messageContext = null) {
    const cmd = command || {};
    const cmdType = String(cmd.type || '').trim();
    const chatRole = isPharmacy ? 'pharmacy' : 'employee';

    if (cmdType === 'local_confirm_command') {
      if (cmd.originalCommand && typeof cmd.originalCommand === 'object') {
        await executeBettiUiCommand({ ...cmd.originalCommand, __confirmed: true }, messageContext);
      }
      return;
    }

    if (cmdType === 'local_cancel_command') {
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: 'Rendben, nem hajtottam vegre a muveletet.',
        intent: 'command_cancelled',
        ts: Date.now(),
      }]);
      await auditAiCommand('cancelled', { cmdType: String(cmd.originalType || '') });
      return;
    }

    const policy = AI_COMMAND_POLICY[cmdType] || null;
    if (!policy) {
      await auditAiCommand('blocked_unknown_command', { cmdType, command: cmd });
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: 'Ez a muvelet jelenleg nincs engedelyezve AI modban.',
        intent: 'command_blocked_unknown',
        ts: Date.now(),
      }]);
      return;
    }

    if (!policy.allowedRoles.includes(chatRole)) {
      await auditAiCommand('blocked_role', { cmdType, role: chatRole, policy });
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: 'Ehhez a muvelethez nincs jogosultsagod a szerepkorod alapjan.',
        intent: 'command_blocked_role',
        ts: Date.now(),
      }]);
      return;
    }

    if (policy.requiresConfirm && cmd.__confirmed !== true) {
      await auditAiCommand('confirm_required', { cmdType, riskLevel: policy.riskLevel });
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: 'Ez egy kritikus muvelet. Megerosited, hogy vegrehajtsam?',
        intent: 'command_confirm_required',
        ts: Date.now(),
        uiCommands: [
          {
            id: `confirm_${cmdType}_${Date.now()}`,
            type: 'local_confirm_command',
            label: market === 'de' ? 'Ja, ausfuehren' : 'Igen, vegrehajtom',
            originalType: cmdType,
            originalCommand: { ...cmd, __confirmed: true },
          },
          {
            id: `cancel_${cmdType}_${Date.now()}`,
            type: 'local_cancel_command',
            label: market === 'de' ? 'Abbrechen' : 'Megse',
            originalType: cmdType,
          },
        ],
      }]);
      return;
    }

    await auditAiCommand('execute', { cmdType, riskLevel: policy.riskLevel, confirmed: Boolean(cmd.__confirmed) });

    if (cmdType === 'navigate_url') {
      const url = String(cmd.url || '');
      if (url.startsWith('/pharmagister')) {
        window.location.href = url;
      }
      return;
    }

    if (cmdType === 'set_main_tab') {
      const allowedTabs = new Set(['schedule', 'workers', 'history', 'mine', 'planner', 'vacations', 'preferences']);
      const nextTab = String(cmd.tab || '');
      if (allowedTabs.has(nextTab)) {
        setMainTab(nextTab);
        // Pre-select month if provided
        if (cmd.monthNumber && cmd.monthNumber >= 1 && cmd.monthNumber <= 12) {
          const now = new Date();
          const targetYear = cmd.monthNumber < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
          setYear(targetYear);
          setMonth(cmd.monthNumber);
        } else if (typeof cmd.monthOffset === 'number') {
          const now = new Date();
          const targetDate = new Date(now.getFullYear(), now.getMonth() + cmd.monthOffset, 1);
          setYear(targetDate.getFullYear());
          setMonth(targetDate.getMonth() + 1);
        }
      }
      return;
    }

    if (cmdType === 'set_worker_tab') {
      const allowedWorkerTabs = new Set(['add', 'remove']);
      const nextWorkerTab = String(cmd.tab || '');
      if (allowedWorkerTabs.has(nextWorkerTab)) {
        setMainTab('workers');
        setWorkerTab(nextWorkerTab);
      }
      return;
    }

    if (cmdType === 'rerun_action') {
      const action = messageContext?.action;
      const entities = messageContext?.entities || {};
      if (action) {
        await handleBettiAction(action, entities);
      }
      return;
    }

    if (cmdType === 'local_list_open_demands') {
      if (!user) return;

      try {
        const snap = await getDocs(query(collection(db, 'pharmaDemands'), where('status', '==', 'open')));
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const userRole = String(userData?.pharmagisterRole || '').trim();

        const relevant = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => isDocInMarket(d, market))
          .filter((d) => d.date >= todayStr)
          .filter((d) => (userRole === 'pharmacist' || userRole === 'assistant' || userRole === 'pka') ? d.position === userRole : true)
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
          .slice(0, 5);

        if (relevant.length === 0) {
          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: 'Most nem latok nyitott helyettesitesi igenyt a szerepkorodhoz. Megnezzuk a kovetkezo napokat a naptarban?',
            intent: 'local_demands_empty',
            ts: Date.now(),
            uiCommands: [{ id: 'open_replacement_calendar', type: 'navigate_url', label: 'Naptar megnyitasa', url: '/pharmagister?tab=calendar' }],
          }]);
          return;
        }

        const lines = relevant.map((d) => {
          const posLabel = d.position === 'pharmacist' ? 'Gyogyszeresz' : 'Szakasszisztens';
          return `- ${formatHuDate(d.date)} · ${d.pharmacyName || 'Gyogyszertar'} · ${posLabel}`;
        }).join('\n');

        const commands = relevant.map((d) => ({
          id: `apply_${d.id}`,
          type: 'local_apply_demand',
          label: `Jelentkezem: ${formatHuDate(d.date)}`,
          demandId: d.id,
          pharmacyId: d.pharmacyId,
          pharmacyName: d.pharmacyName || 'Gyogyszertar',
          position: d.position,
          date: d.date,
        }));

        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `Talaltam nyitott helyettesitesi igenyeket:\n${lines}`,
          intent: 'local_demands_listed',
          ts: Date.now(),
          uiCommands: commands,
        }]);
      } catch (err) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Most nem sikerult lekerdezni a nyitott igenyeket. Probald ujra par masodperc mulva.',
          intent: 'local_demands_error',
          ts: Date.now(),
        }]);
      }
      return;
    }

    if (cmdType === 'local_list_my_demands') {
      if (!user) return;

      try {
        const snap = await getDocs(query(collection(db, 'pharmaDemands'), where('pharmacyId', '==', user.uid)));
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const relevant = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => isDocInMarket(d, market))
          .filter((d) => d.status !== 'deleted' && d.date >= todayStr)
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
          .slice(0, 5);

        if (relevant.length === 0) {
          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: market === 'de' ? 'Du hast keine aktive Vertretungsanfrage fuer den naechsten Zeitraum.' : 'Nincs aktív helyettesítési igényed a következő időszakra.',
            intent: 'local_my_demands_empty',
            ts: Date.now(),
            uiCommands: [{ id: 'open_replacement_calendar', type: 'navigate_url', label: market === 'de' ? 'Anfrage senden' : 'Igény feladása', url: '/pharmagister?tab=calendar' }],
          }]);
          return;
        }

        const lines = relevant.map((d) => {
          const posLabel = d.position === 'pharmacist'
            ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész')
            : (market === 'de' ? 'PTA/Assistent/in' : 'Szakasszisztens');
          const st = d.status === 'open' ? 'nyitott' : d.status === 'filled' ? 'betoltve' : d.status || 'ismeretlen';
          return `- ${formatHuDate(d.date)} · ${posLabel} · ${st}`;
        }).join('\n');

        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `A kovetkezo aktiv igenyeidet talaltam:\n${lines}`,
          intent: 'local_my_demands_listed',
          ts: Date.now(),
          uiCommands: [{ id: 'open_replacement_dashboard', type: 'navigate_url', label: 'Dashboard megnyitasa', url: '/pharmagister?tab=dashboard' }],
        }]);
      } catch (err) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Most nem sikerult lekerdezni a sajat igenyeidet. Probald ujra par masodperc mulva.',
          intent: 'local_my_demands_error',
          ts: Date.now(),
        }]);
      }
      return;
    }

    if (cmdType === 'local_apply_demand') {
      if (!user || !userData) return;

      const demandId = String(cmd.demandId || '').trim();
      const demandDate = String(cmd.date || '').trim();
      const demandPosition = String(cmd.position || '').trim();
      const pharmacyId = String(cmd.pharmacyId || '').trim();
      const pharmacyName = String(cmd.pharmacyName || 'Gyogyszertar').trim();

      if (!demandId || !demandDate || !pharmacyId || !demandPosition) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Ehhez a jelentkezeshez hianyzo igeny-adatot kaptam. Kerdezd le ujra a nyitott igenyeket.',
          intent: 'local_apply_invalid',
          ts: Date.now(),
        }]);
        return;
      }

      const userRole = String(userData?.pharmagisterRole || '').trim();
      if (!userData?.pharmaProfileComplete) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Jelentkezes elott toltsd ki a Pharmagister profilodat.',
          intent: 'local_apply_profile_missing',
          ts: Date.now(),
          uiCommands: [{ id: 'go_preferences', type: 'set_main_tab', label: 'Profil kitoltese', tab: 'preferences' }],
        }]);
        return;
      }

      if (userRole !== 'pharmacist' && userRole !== 'assistant') {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Csak gyogyszeresz vagy szakasszisztens szerepkorbol lehet helyettesitesi igenyre jelentkezni.',
          intent: 'local_apply_forbidden',
          ts: Date.now(),
        }]);
        return;
      }

      if (userRole !== demandPosition) {
        const userRoleLabel = userRole === 'pharmacist' ? 'gyogyszeresz' : 'szakasszisztens';
        const demandLabel = demandPosition === 'pharmacist' ? 'gyogyszeresz' : 'szakasszisztens';
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `Erre az igenyre csak ${demandLabel} szerepkorrel lehet jelentkezni. Te ${userRoleLabel} vagy.`,
          intent: 'local_apply_role_mismatch',
          ts: Date.now(),
        }]);
        return;
      }

      try {
        const existingQ = query(
          collection(db, 'pharmaApplications'),
          where('demandId', '==', demandId),
          where('applicantId', '==', user.uid)
        );
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: `Erre a napra mar jelentkeztel (${formatHuDate(demandDate)}).`,
            intent: 'local_apply_duplicate',
            ts: Date.now(),
          }]);
          return;
        }

        await addDoc(collection(db, 'pharmaApplications'), {
          demandId,
          applicantId: user.uid,
          applicantName: userData.displayName || user.displayName || user.email,
          applicantEmail: user.email,
          applicantRole: userRole,
          applicantExperience: userData.pharmaYearsOfExperience || '',
          applicantHourlyRate: userData.pharmaHourlyRate || '',
          pharmacyId,
          pharmacyName,
          position: demandPosition,
          date: demandDate,
          status: 'pending',
          createdAt: new Date().toISOString(),
          message: market === 'de' ? `Ich bewerbe mich fuer den ${demandDate}.` : `Jelentkezem a ${demandDate} napra.`,
        });

        try {
          await createNotificationWithPush({
            userId: pharmacyId,
            type: 'pharma_application',
            title: market === 'de' ? 'Neue Bewerbung! 📝' : 'Uj jelentkezo! 📝',
            message: market === 'de'
              ? `${userData.displayName || 'Jemand'} hat sich fuer die Vertretung am ${formatHuDate(demandDate)} beworben.`
              : `${userData.displayName || 'Valaki'} jelentkezett a ${formatHuDate(demandDate)} helyettesitesre.`,
            data: { demandId, applicantId: user.uid },
            url: `/pharmagister?tab=dashboard&expand=${demandId}`,
          });
        } catch (notifyErr) {
          console.warn('Betti local apply notify failed:', notifyErr);
        }

        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `Sikeresen jelentkeztel a ${formatHuDate(demandDate)} helyettesitesi igenyre.`,
          intent: 'local_apply_success',
          ts: Date.now(),
          uiCommands: [{ id: 'open_replacement_dashboard', type: 'navigate_url', label: 'Sajat jelentkezesek', url: '/pharmagister?tab=dashboard' }],
        }]);
      } catch (err) {
        console.error('Betti local_apply_demand error:', err);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Hiba tortent a jelentkezesnel. Probald ujra, vagy nyisd meg a naptar oldalt.',
          intent: 'local_apply_error',
          ts: Date.now(),
          uiCommands: [{ id: 'open_replacement_calendar', type: 'navigate_url', label: 'Naptar megnyitasa', url: '/pharmagister?tab=calendar' }],
        }]);
      }
      return;
    }

    if (cmdType === 'local_list_pending_applications') {
      if (!user || !isPharmacy) return;

      try {
        const pendingSnap = await getDocs(query(
          collection(db, 'pharmaApplications'),
          where('pharmacyId', '==', user.uid),
          where('status', '==', 'pending')
        ));

        const pending = pendingSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
          .slice(0, 6);

        if (pending.length === 0) {
          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: 'Jelenleg nincs fuggo jelentkezesed helyettesitesi igenyekre.',
            intent: 'local_pending_empty',
            ts: Date.now(),
          }]);
          return;
        }

        const lines = pending.map((a) => {
          const roleLabel = a.applicantRole === 'pharmacist' ? 'Gyogyszeresz' : 'Szakasszisztens';
          return `- ${formatHuDate(a.date)} · ${a.applicantName || 'Jelentkezo'} · ${roleLabel}`;
        }).join('\n');

        const commands = pending.flatMap((a) => ([
          {
            id: `app_accept_${a.id}`,
            type: 'local_decide_application',
            label: `Elfogad: ${a.applicantName || 'Jelentkezo'}`,
            applicationId: a.id,
            demandId: a.demandId,
            decision: 'accepted',
          },
          {
            id: `app_reject_${a.id}`,
            type: 'local_decide_application',
            label: `Elutasit: ${a.applicantName || 'Jelentkezo'}`,
            applicationId: a.id,
            demandId: a.demandId,
            decision: 'rejected',
            reason: 'Chatbol elutasitva',
          },
        ])).slice(0, 4);

        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `Fuggo jelentkezesek:\n${lines}`,
          intent: 'local_pending_listed',
          ts: Date.now(),
          uiCommands: commands,
        }]);
      } catch (err) {
        console.error('Betti local_list_pending_applications error:', err);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Most nem sikerult lekerdezni a fuggo jelentkezeseket. Probald ujra.',
          intent: 'local_pending_error',
          ts: Date.now(),
        }]);
      }
      return;
    }

    if (cmdType === 'local_decide_application') {
      if (!user || !isPharmacy) return;

      const applicationId = String(cmd.applicationId || '').trim();
      const demandId = String(cmd.demandId || '').trim();
      const decision = String(cmd.decision || '').trim();
      const rejectReason = String(cmd.reason || 'Chatbol elutasitva').trim();
      if (!applicationId || !demandId || !['accepted', 'rejected'].includes(decision)) return;

      try {
        const appRef = doc(db, 'pharmaApplications', applicationId);
        const appDoc = await getDoc(appRef);
        if (!appDoc.exists()) {
          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: 'A kivalsztott jelentkezes mar nem erheto el.',
            intent: 'local_decide_missing',
            ts: Date.now(),
          }]);
          return;
        }

        const appData = appDoc.data();
        if (decision === 'accepted') {
          await updateDoc(appRef, {
            status: 'accepted',
            acceptedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          await updateDoc(doc(db, 'pharmaDemands', demandId), {
            status: 'filled',
            updatedAt: new Date().toISOString(),
          });

          const feedPostsSnapshot = await getDocs(query(collection(db, 'serviceFeedPosts'), where('pharmaDemandId', '==', demandId)));
          for (const fd of feedPostsSnapshot.docs) {
            await updateDoc(doc(db, 'serviceFeedPosts', fd.id), { status: 'filled' });
          }

          await createNotificationWithPush({
            userId: appData.applicantId,
            type: 'approval_accepted',
            title: market === 'de' ? 'Bewerbung angenommen! ✅' : 'Jelentkezes elfogadva! ✅',
            message: market === 'de'
              ? `${userData?.pharmacyName || userData?.displayName || 'Apotheke'} hat deine Bewerbung angenommen.`
              : `${userData?.pharmacyName || userData?.displayName || 'Gyogyszertar'} elfogadta a jelentkezesedet.`,
            data: { demandId, pharmacyId: user.uid, demandDate: appData.date, position: appData.position },
            url: `/pharmagister/demand/${demandId}`,
          });

          setBettiChatMessages((prev) => [...prev, {
            role: 'assistant',
            text: `${appData.applicantName || 'A jelentkezo'} jelentkezeset elfogadtam ${formatHuDate(appData.date)} napra.`,
            intent: 'local_decide_accepted',
            ts: Date.now(),
            uiCommands: [{ id: 'list_pending_apps', type: 'local_list_pending_applications', label: 'Tovabbi fuggo jelentkezesek' }],
          }]);
          return;
        }

        await updateDoc(appRef, {
          status: 'rejected',
          rejectionReason: rejectReason,
          updatedAt: new Date().toISOString(),
        });

        await createNotificationWithPush({
          userId: appData.applicantId,
          type: 'approval_rejected',
          title: market === 'de' ? 'Bewerbung abgelehnt ❌' : 'Jelentkezes elutasitva ❌',
          message: market === 'de'
            ? `${userData?.pharmacyName || userData?.displayName || 'Apotheke'} hat deine Bewerbung abgelehnt. Grund: ${rejectReason}`
            : `${userData?.pharmacyName || userData?.displayName || 'Gyogyszertar'} elutasitotta a jelentkezesedet. Indok: ${rejectReason}`,
          data: { demandId, pharmacyId: user.uid },
          url: '/pharmagister?tab=dashboard',
        });

        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `${appData.applicantName || 'A jelentkezo'} jelentkezeset elutasitottam (${formatHuDate(appData.date)}).`,
          intent: 'local_decide_rejected',
          ts: Date.now(),
          uiCommands: [{ id: 'list_pending_apps', type: 'local_list_pending_applications', label: 'Tovabbi fuggo jelentkezesek' }],
        }]);
      } catch (err) {
        console.error('Betti local_decide_application error:', err);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Nem sikerult feldolgozni a dontest. Probald ujra.',
          intent: 'local_decide_error',
          ts: Date.now(),
        }]);
      }
      return;
    }

    if (cmdType === 'local_schedule_wizard_start') {
      if (!isPharmacy) return;

      // Resolve target month
      const now = new Date();
      let targetMonth = now.getMonth() + 1;
      let targetYear = now.getFullYear();
      if (cmd.monthNumber && cmd.monthNumber >= 1 && cmd.monthNumber <= 12) {
        targetMonth = cmd.monthNumber;
        if (targetMonth < now.getMonth() + 1) targetYear = now.getFullYear() + 1;
      } else if (typeof cmd.monthOffset === 'number') {
        const d = new Date(now.getFullYear(), now.getMonth() + cmd.monthOffset, 1);
        targetMonth = d.getMonth() + 1;
        targetYear = d.getFullYear();
      }
      const monthName = cmd.monthLabel || (market === 'de' ? MONTHS_DE[targetMonth - 1] : MONTHS_HU[targetMonth - 1]);
      const employeeNames = activeEmployees
        .map((emp) => String(emp?.name || '').trim())
        .filter(Boolean)
        .slice(0, 10);

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: market === 'de'
          ? `Alles klar, bitte waehle eine Option. Ich habe das Team fuer die Planung im ${monthName} vorbereitet.`
          : `Rendben, kérlek válassz. A ${monthName.toLowerCase()}i tervezéshez összeállítottam a csapatot.`,
        intent: 'local_schedule_wizard_started',
        ts: Date.now(),
        plannerCard: {
          monthName,
          monthNumber: targetMonth,
          year: targetYear,
          employeeNames,
          planCommand: {
            id: `planner_card_auto_${Date.now()}`,
            type: 'local_run_auto_planner',
            label: market === 'de' ? 'Ja, ich moechte einen Dienstplan-Entwurf' : 'Igen, beosztas-tervezetet kerek',
            monthNumber: targetMonth,
            monthOffset: null,
            monthLabel: monthName,
          },
          cancelCommand: {
            id: `planner_card_cancel_${Date.now()}`,
            type: 'local_cancel_command',
            label: market === 'de' ? 'Abbrechen' : 'Megse',
            originalType: 'local_schedule_wizard_start',
          },
        },
        uiCommands: [
          {
            id: 'sw_auto',
            type: 'local_run_auto_planner',
            label: market === 'de' ? `Automatische Planung - ${monthName}` : `Automatikus tervezés – ${monthName}`,
            monthNumber: targetMonth,
            monthOffset: null,
            monthLabel: monthName,
          },
          {
            id: 'sw_manual',
            type: 'set_main_tab',
            label: market === 'de' ? `Manuelle Bearbeitung - ${monthName}` : `Manuális szerkesztés – ${monthName}`,
            tab: 'schedule',
            monthNumber: targetMonth,
            monthOffset: null,
          },
          {
            id: 'sw_missing',
            type: 'send_message',
            label: market === 'de' ? 'Wer hat den Entwurf nicht gesendet?' : 'Ki nem küldte be a tervezetét?',
            utterance: market === 'de' ? `Wer hat den Entwurf fuer ${monthName} noch nicht gesendet?` : `Ki nem küldte be még a ${monthName.toLowerCase()}i tervezetét?`,
          },
        ],
      }]);
      return;
    }

    if (cmdType === 'local_schedule_control_panel') {
      if (!isPharmacy) return;

      const now = new Date();
      let targetMonth = now.getMonth() + 1;
      let targetYear = now.getFullYear();
      if (cmd.monthNumber && cmd.monthNumber >= 1 && cmd.monthNumber <= 12) {
        targetMonth = cmd.monthNumber;
        if (targetMonth < now.getMonth() + 1) targetYear = now.getFullYear() + 1;
      } else if (typeof cmd.monthOffset === 'number') {
        const d = new Date(now.getFullYear(), now.getMonth() + cmd.monthOffset, 1);
        targetMonth = d.getMonth() + 1;
        targetYear = d.getFullYear();
      }

      const monthName = cmd.monthLabel || (market === 'de' ? MONTHS_DE[targetMonth - 1] : MONTHS_HU[targetMonth - 1]) || (market === 'de' ? 'Monat' : 'honap');
      const lowerMonth = String(monthName).toLowerCase();
      const commands = [
        {
          id: `scp_plan_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Dienstplan erstellen' : 'Beosztas tervezes inditasa',
          utterance: market === 'de' ? `Erstelle den Dienstplan fuer ${monthName}` : `Ird meg a ${lowerMonth}i beosztast`,
        },
        {
          id: `scp_show_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Monatsplan anzeigen' : 'Havi beosztas mutatasa',
          utterance: market === 'de' ? `Zeig den Dienstplan fuer ${monthName}` : `Mutasd a ${lowerMonth}i beosztast`,
        },
        {
          id: `scp_vac_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Urlaube abfragen' : 'Szabadsagok lekerdezese',
          utterance: market === 'de' ? `Wer ist im ${monthName} im Urlaub?` : `Kik mennek szabira ${lowerMonth}ban?`,
        },
        {
          id: `scp_draft_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Fehlende Entwuerfe' : 'Hianyzo tervezetek',
          utterance: market === 'de' ? `Wer hat den Entwurf fuer ${monthName} noch nicht gesendet?` : `Ki nem kuldte be a ${lowerMonth}i tervezetet?`,
        },
        {
          id: `scp_replan_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Neu planen' : 'Ujratervezes',
          utterance: market === 'de' ? `Plane den Dienstplan fuer ${monthName} neu` : `Tervezd ujra a ${lowerMonth}i beosztast`,
        },
        {
          id: `scp_ot_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Ueberstunden reduzieren' : 'Tulora csokkentese',
          utterance: market === 'de' ? 'Reduziere die Ueberstunden' : 'Csokkentsd a tulorat',
        },
        {
          id: `scp_fair_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Faireren Plan erstellen' : 'Igazsagosabb beosztas',
          utterance: market === 'de' ? 'Mache den Dienstplan fairer' : 'Legyen igazsagosabb a beosztas',
        },
        {
          id: `scp_rep_${Date.now()}`,
          type: 'send_message',
          label: market === 'de' ? 'Vertretungsbedarfe' : 'Helyettesitesi igenyek',
          utterance: market === 'de' ? 'Zeig die offenen Vertretungsbedarfe' : 'Mutasd a nyitott helyettesitesi igenyeket',
        },
      ];

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: market === 'de' ? 'Waehle aus, wobei ich dir beim Dienstplan helfen soll.' : 'Válaszd ki, miben segítsek a beosztással kapcsolatban.',
        intent: 'local_schedule_control_panel',
        ts: Date.now(),
        scheduleControlCard: {
          title: market === 'de' ? 'Dienstplan-Steuerung' : 'Beosztás kezelő panel',
          monthName,
          year: targetYear,
          commands,
          cancelCommand: {
            id: `schedule_panel_cancel_${Date.now()}`,
            type: 'local_cancel_command',
            label: market === 'de' ? 'Abbrechen' : 'Megse',
            originalType: 'local_schedule_control_panel',
          },
        },
      }]);
      return;
    }

    if (cmdType === 'local_run_auto_planner') {
      if (!isPharmacy) return;

      const now = new Date();
      let targetMonth = now.getMonth() + 1;
      let targetYear = now.getFullYear();

      if (cmd.monthNumber && cmd.monthNumber >= 1 && cmd.monthNumber <= 12) {
        targetMonth = cmd.monthNumber;
        if (targetMonth < now.getMonth() + 1) targetYear = now.getFullYear() + 1;
      } else if (typeof cmd.monthOffset === 'number') {
        const d = new Date(now.getFullYear(), now.getMonth() + cmd.monthOffset, 1);
        targetMonth = d.getMonth() + 1;
        targetYear = d.getFullYear();
      }

      const monthName = cmd.monthLabel || (market === 'de' ? MONTHS_DE[targetMonth - 1] : MONTHS_HU[targetMonth - 1]);
      setMainTab('schedule');
      setYear(targetYear);
      setMonth(targetMonth);

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: market === 'de'
          ? `Ich habe die automatische Planung fuer ${monthName} gestartet.`
          : `Elindítottam az automatikus tervezést a ${monthName.toLowerCase()}i hónapra.`,
        intent: 'local_auto_plan_started',
        ts: Date.now(),
      }]);

      const plan = await runAutoPlanner({ action: 'plan' });
      if (plan?.success) {
        const shifts = Number(plan?.result?.proposedShifts?.length || 0);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: market === 'de'
            ? `Fertig: ${shifts} vorgeschlagene Schichten wurden erstellt. Das ist noch ein Entwurfsvorschlag, zum Speichern bitte auf "Als Entwurf speichern" klicken.`
            : `Készen vagyok: ${shifts} javasolt műszak készült. Ez még csak tervezet-javaslat, mentéshez nyomd meg a Mentés tervezetként gombot.`,
          intent: 'local_auto_plan_done',
          ts: Date.now(),
          uiCommands: [
            {
              id: `apply_planner_${Date.now()}`,
              type: 'local_apply_planner_result',
              label: market === 'de' ? 'Als Entwurf speichern' : 'Mentés tervezetként',
            },
            {
              id: `open_schedule_${Date.now()}`,
              type: 'set_main_tab',
              label: market === 'de' ? 'Dienstplan-Tab oeffnen' : 'Beosztás fül megnyitása',
              tab: 'schedule',
            },
          ],
        }]);
      } else {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: plan?.error || (market === 'de' ? 'Die automatische Planung konnte nicht gestartet werden.' : 'Nem sikerült lefuttatni az automatikus tervezést.'),
          intent: 'local_auto_plan_error',
          ts: Date.now(),
        }]);
      }
      return;
    }

    if (cmdType === 'local_apply_planner_result') {
      if (!isPharmacy) return;

      if (!plannerResult?.proposedShifts?.length) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: market === 'de' ? 'Es gibt keinen speicherbaren Entwurfsvorschlag. Starte zuerst die automatische Planung.' : 'Nincs menthető tervezet-javaslat. Előbb futtasd az automatikus tervezést.',
          intent: 'local_apply_planner_missing_result',
          ts: Date.now(),
        }]);
        return;
      }

      const beforeCount = Number(plannerResult?.proposedShifts?.length || 0);
      await handleApplyPlannerResult();
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: market === 'de'
          ? `Ich habe den Entwurf im Dienstplan gespeichert. Quelle: automatischer Vorschlag (${beforeCount} Elemente).`
          : `Elmentettem a tervezetet a beosztásba. Forrás: automatikus javaslat (${beforeCount} elem).`,
        intent: 'local_apply_planner_saved',
        ts: Date.now(),
        uiCommands: [
          {
            id: `open_schedule_after_apply_${Date.now()}`,
            type: 'set_main_tab',
            label: market === 'de' ? 'Dienstplan-Tab oeffnen' : 'Beosztás fül megnyitása',
            tab: 'schedule',
          },
        ],
      }]);
      return;
    }

    if (cmdType === 'local_create_demand_wizard_start') {
      if (!user || !isPharmacy) return;

      const draft = {
        position: 'pharmacist',
        dateOffset: 1,
        workHours: '08:00-16:00',
      };
      setBettiDemandDraft(draft);

      const dateKey = resolveDemandDraftDate(draft.dateOffset);
      const posLabel = draft.position === 'pharmacist' ? 'Gyogyszeresz' : 'Szakasszisztens';

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Indul az igeny-feladas wizard.\nPozicio: ${posLabel}\nNap: ${formatHuDate(dateKey)}\nMunkaido: ${draft.workHours}`,
        intent: 'local_demand_wizard_started',
        ts: Date.now(),
        uiCommands: buildDemandWizardCommands(draft),
      }]);
      return;
    }

    if (cmdType === 'local_demand_wizard_set_position' || cmdType === 'local_demand_wizard_set_date_offset' || cmdType === 'local_demand_wizard_set_hours') {
      if (!user || !isPharmacy) return;
      const curr = bettiDemandDraft || { position: 'pharmacist', dateOffset: 1, workHours: '08:00-16:00' };
      const next = { ...curr };

      if (cmdType === 'local_demand_wizard_set_position') {
        const p = String(cmd.position || '').trim();
        if (p === 'pharmacist' || p === 'assistant') next.position = p;
      }
      if (cmdType === 'local_demand_wizard_set_date_offset') {
        const off = Number(cmd.dateOffset);
        if (Number.isInteger(off) && off >= 0 && off <= 30) next.dateOffset = off;
      }
      if (cmdType === 'local_demand_wizard_set_hours') {
        const wh = String(cmd.workHours || '').trim();
        if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(wh)) next.workHours = wh;
      }

      setBettiDemandDraft(next);
      const dateKey = resolveDemandDraftDate(next.dateOffset);
      const posLabel = next.position === 'pharmacist'
        ? (market === 'de' ? 'Apotheker/in' : 'Gyógyszerész')
        : (market === 'de' ? 'PTA/Assistent/in' : 'Szakasszisztens');

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: market === 'de'
          ? `Ich habe den Entwurf aktualisiert.\nPosition: ${posLabel}\nTag: ${formatHuDate(dateKey)}\nArbeitszeit: ${next.workHours}`
          : `Frissítettem a tervezetet.\nPozíció: ${posLabel}\nNap: ${formatHuDate(dateKey)}\nMunkaidő: ${next.workHours}`,
        intent: 'local_demand_wizard_updated',
        ts: Date.now(),
        uiCommands: buildDemandWizardCommands(next),
      }]);
      return;
    }

    if (cmdType === 'local_demand_wizard_submit') {
      if (!user || !isPharmacy) return;
      const draft = bettiDemandDraft || { position: 'pharmacist', dateOffset: 1, workHours: '08:00-16:00' };

      if (!userData?.pharmaProfileComplete) {
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: market === 'de' ? 'Bitte vervollstaendige vor dem Absenden die Apothekenprofil-Daten.' : 'Igény feladása előtt kérlek töltsd ki a gyógyszertári profilodat.',
          intent: 'local_demand_wizard_profile_missing',
          ts: Date.now(),
          uiCommands: [{ id: 'go_preferences', type: 'set_main_tab', label: market === 'de' ? 'Profileinstellungen' : 'Profil beállítások', tab: 'preferences' }],
        }]);
        return;
      }

      try {
        const localDateString = resolveDemandDraftDate(draft.dateOffset);
        const fullAddress = `${userData.pharmacyZipCode || ''} ${userData.pharmacyCity || ''}, ${userData.pharmacyStreet || ''} ${userData.pharmacyHouseNumber || ''}`.trim();

        const demandData = {
          pharmacyId: user.uid,
          market,
          pharmacyName: userData.pharmacyName || 'Gyogyszertar',
          pharmacyCity: userData.pharmacyCity || '',
          pharmacyZipCode: userData.pharmacyZipCode || '',
          pharmacyStreet: userData.pharmacyStreet || '',
          pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
          pharmacyFullAddress: fullAddress,
          pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
          date: localDateString,
          position: draft.position,
          workHours: draft.workHours,
          minExperience: '',
          requiredSoftware: [],
          otherSoftware: '',
          maxHourlyRate: null,
          additionalRequirements: 'Betti chat wizardbol letrehozva',
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user.uid,
        };

        const demandRef = await addDoc(collection(db, 'pharmaDemands'), demandData);

        try {
          await setDoc(doc(db, 'firestoreStats', 'demands'), { totalEverCreated: increment(1) }, { merge: true });
        } catch (statsErr) {
          console.warn('Betti demand stats increment failed:', statsErr);
        }

        await addDoc(collection(db, 'serviceFeedPosts'), {
          postType: 'pharmaDemand',
          module: 'pharmagister',
          market,
          pharmaDemandId: demandRef.id,
          pharmacyId: user.uid,
          pharmacyName: userData.pharmacyName || 'Gyogyszertar',
          pharmacyCity: userData.pharmacyCity || '',
          pharmacyZipCode: userData.pharmacyZipCode || '',
          pharmacyStreet: userData.pharmacyStreet || '',
          pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
          pharmacyFullAddress: fullAddress,
          pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
          position: draft.position,
          positionLabel: getLocalizedDemandPositionLabel(draft.position, market),
          workHours: draft.workHours,
          minExperience: '',
          requiredSoftware: [],
          otherSoftware: '',
          maxHourlyRate: null,
          additionalRequirements: 'Betti chat wizardbol letrehozva',
          date: localDateString,
          createdAt: new Date(),
          userId: user.uid,
        });

        try {
          const idToken = await user.getIdToken();
          await fetch('/api/notify-new-demand', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              demandId: demandRef.id,
              pharmacyZipCode: userData.pharmacyZipCode || '',
              position: draft.position,
              pharmacyName: userData.pharmacyName || 'Gyogyszertar',
              date: localDateString,
            }),
          });
        } catch (notifyErr) {
          console.warn('Betti chat demand notify failed:', notifyErr);
        }

        setBettiDemandDraft(null);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: `Sikeresen feladtam az uj igenyt: ${formatHuDate(localDateString)} · ${draft.position === 'pharmacist' ? 'Gyogyszeresz' : 'Szakasszisztens'} · ${draft.workHours}.`,
          intent: 'local_demand_wizard_submitted',
          ts: Date.now(),
          uiCommands: [
            { id: 'open_replacement_dashboard', type: 'navigate_url', label: 'Jelentkezok a dashboardon', url: '/pharmagister?tab=dashboard' },
            { id: 'list_my_demands', type: 'local_list_my_demands', label: 'Sajat igenyeim listazasa' },
          ],
        }]);
      } catch (err) {
        console.error('Betti local_demand_wizard_submit error:', err);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: 'Nem sikerult feladni az igenyt chatbol. Probald ujra, vagy hasznald a naptar modalt.',
          intent: 'local_demand_wizard_submit_error',
          ts: Date.now(),
          uiCommands: [{ id: 'open_replacement_calendar', type: 'navigate_url', label: 'Naptar megnyitasa', url: '/pharmagister?tab=calendar' }],
        }]);
      }
      return;
    }

    if (cmdType === 'send_message') {
      const utterance = String(cmd.utterance || cmd.message || '').trim();
      if (utterance) {
        await sendBettiChatMessage(utterance);
      }
    }
  }

  async function sendBettiChatMessage(messageText, options = {}) {
    const text = String(messageText || '').trim();
    if (!text || !user) return;

    const recentConversation = bettiChatMessages
      .slice(-6)
      .map((msg) => ({
        role: msg.role,
        text: msg.text,
        intent: msg.intent || null,
        action: msg.action || null,
        suggestedAction: msg.suggestedAction || null,
        entities: msg.entities || null,
      }));

    // Check if this is a training input (starts with "xx ")
    const isTrainingInput = /^xx([\s:;,.\-]|$)/i.test(text);
    
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
    const previousMessageAction = previousMessage?.role === 'assistant'
      ? previousMessage?.action
      : undefined;
    const previousSuggestedAction = previousMessage?.role === 'assistant'
      ? previousMessage?.suggestedAction
      : undefined;

    setBettiChatMessages((prev) => [...prev, { role: 'user', text, ts: Date.now() }]);
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
          learningFeedback: options.learningFeedback || null,
          context: {
            stats: plannerResult?.stats || null,
            conflicts: plannerResult?.conflicts || [],
            assignmentReasons: plannerResult?.assignmentReasons || [],
            recentConversation,
            lastUserMessage: lastUserQuestion,
            lastAssistantMessage: previousMessage?.role === 'assistant' ? previousMessage?.text : '',
            lastAssistantAction: previousMessageAction,
            lastAssistantSuggestedAction: previousSuggestedAction,
            lastAssistantEntities: previousMessage?.role === 'assistant' ? previousMessage?.entities || null : null,
            chatRole: isPharmacy ? 'pharmacy' : 'employee',
            userName: userData?.name || userData?.pharmacyName || user?.displayName || user?.email || null,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || (market === 'de' ? 'Betti ist gerade nicht erreichbar.' : 'Betti most nem elerheto.'));
      }

      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: result.reply || 'Rendben, rajta vagyok.',
        intent: result.intent,
        action: result?.payload?.action || null,
        suggestedAction: result?.payload?.suggestedAction || null,
        entities: result?.payload?.entities || null,
        uiCommands: Array.isArray(result?.payload?.uiCommands) ? result.payload.uiCommands : [],
        debugRoute: result?.debug?.responseRoute || null,
        ts: Date.now(),
      }]);
      setBettiQuickActions(Array.isArray(result.quickActions) ? result.quickActions : []);

      if (bettiSpeakEnabled && result.reply) {
        speakBettiText(result.reply);
      }

      if (result.intent === 'unknown') {
        setBettiLastUnknownMessage(text);
      } else if (result.intent !== 'training_saved') {
        setBettiLastUnknownMessage('');
      }

      // write_schedule_plan: directly show the planner card (most reliable path)
      if ((result?.payload?.action === 'write_schedule_plan' || result?.action === 'write_schedule_plan') && isPharmacy) {
        const entities = result?.payload?.entities || {};
        const now = new Date();
        let targetMonth = now.getMonth() + 1;
        let targetYear = now.getFullYear();
        if (entities.monthNumber && entities.monthNumber >= 1 && entities.monthNumber <= 12) {
          targetMonth = entities.monthNumber;
          if (targetMonth < now.getMonth() + 1) targetYear = now.getFullYear() + 1;
        } else if (typeof entities.monthOffset === 'number') {
          const d = new Date(now.getFullYear(), now.getMonth() + entities.monthOffset, 1);
          targetMonth = d.getMonth() + 1;
          targetYear = d.getFullYear();
        }
        const monthName = (market === 'de' ? MONTHS_DE[targetMonth - 1] : MONTHS_HU[targetMonth - 1]) || (market === 'de' ? 'Monat' : 'hónap');
        const empNames = activeEmployees.map((e) => String(e?.name || '').trim()).filter(Boolean).slice(0, 10);
        setBettiChatMessages((prev) => [...prev, {
          role: 'assistant',
          text: market === 'de'
            ? `Alles klar, bitte waehle eine Option. Ich habe das Team fuer die Planung im ${monthName} vorbereitet.`
            : `Rendben, kérlek válassz. A ${monthName.toLowerCase()}i tervezéshez összeállítottam a csapatot.`,
          intent: 'local_schedule_wizard_started',
          ts: Date.now(),
          plannerCard: {
            monthName,
            monthNumber: targetMonth,
            year: targetYear,
            employeeNames: empNames,
            planCommand: {
              id: `planner_card_auto_${Date.now()}`,
              type: 'local_run_auto_planner',
              label: market === 'de' ? 'Ja, ich moechte einen Dienstplan-Entwurf' : 'Igen, beosztas-tervezetet kerek',
              monthNumber: targetMonth,
              monthOffset: null,
              monthLabel: monthName,
            },
            cancelCommand: {
              id: `planner_card_cancel_${Date.now()}`,
              type: 'local_cancel_command',
              label: market === 'de' ? 'Abbrechen' : 'Megse',
              originalType: 'local_schedule_wizard_start',
            },
          },
          uiCommands: [
            { id: 'sw_auto', type: 'local_run_auto_planner', label: market === 'de' ? `Automatische Planung - ${monthName}` : `Automatikus tervezés – ${monthName}`, monthNumber: targetMonth, monthOffset: null, monthLabel: monthName },
            { id: 'sw_manual', type: 'set_main_tab', label: market === 'de' ? `Manuelle Bearbeitung - ${monthName}` : `Manuális szerkesztés – ${monthName}`, tab: 'schedule', monthNumber: targetMonth, monthOffset: null },
            {
              id: 'sw_missing',
              type: 'send_message',
              label: market === 'de' ? 'Wer hat den Entwurf nicht gesendet?' : 'Ki nem küldte be a tervezetét?',
              utterance: market === 'de' ? `Wer hat den Entwurf fuer ${monthName} noch nicht gesendet?` : `Ki nem küldte be még a ${monthName.toLowerCase()}i tervezetét?`,
            },
          ],
        }]);
      } else if (result?.payload?.action) {
        await handleBettiAction(result.payload.action, result.payload.entities || {});
      }
    } catch (error) {
      setBettiChatMessages((prev) => [...prev, {
        role: 'assistant',
        text: error.message || (market === 'de' ? 'Betti: Die Anfrage konnte nicht interpretiert werden.' : 'Betti: Nem sikerült értelmezni a kérdést.'),
        intent: 'error'
      }]);
    } finally {
      setBettiChatLoading(false);
    }
  }

  function renderBettiMessageBanners(limit = 10) {
    if (!bettiChatHydrated) {
      return null;
    }

    const visibleMessages = bettiChatMessages.slice(-limit);

    const formatTime = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const emptyState = visibleMessages.length === 0 && !bettiChatLoading;

    return (
      <>
        {emptyState && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl shadow-lg ${darkMode ? 'bg-sky-800' : 'bg-sky-100'}`}>
              👩‍⚕️
            </div>
            <div>
              <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Hallo, ich bin Betti!' : 'Szia, Betti vagyok!'}</p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isPharmacy
                  ? (market === 'de' ? 'Frag mich gern zu Dienstplan, Ueberstunden oder Vertretung.' : 'Kérdezz bátran a beosztásról, túlórákról, helyettesítésről.')
                  : (market === 'de' ? 'Frag zu deinen Schichten, Urlauben oder freien Tagen.' : 'Kérdezz a műszakjaidról, szabadságodról vagy szabadnapjaidról.')}
              </p>
            </div>
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div key={`${msg.role}-${index}`} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-base shadow-sm mb-5 ${darkMode ? 'bg-sky-800' : 'bg-sky-100'}`}>
                  👩‍⚕️
                </div>
              )}
              <div className={`max-w-[82%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div
                  className={`whitespace-pre-line text-sm leading-relaxed px-4 py-3 shadow-sm ${
                    isUser
                      ? `rounded-2xl rounded-br-sm ${darkMode ? 'bg-sky-600 text-white' : 'bg-sky-500 text-white'}`
                      : `rounded-2xl rounded-bl-sm ${darkMode ? 'bg-gray-700 text-gray-100 border border-gray-600' : 'bg-white text-gray-800 border border-gray-200'}`
                  }`}
                >
                  {msg.text}
                </div>

                {!isUser && msg?.plannerCard && (
                  <div className={`w-full rounded-2xl border px-4 py-3 shadow-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-sky-50 border-sky-200 text-slate-800'
                  }`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                      {market === 'de' ? 'Dienstplanung' : 'Beosztástervezés'}
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {msg.plannerCard.monthName} {msg.plannerCard.year}
                    </p>
                    <p className={`mt-2 text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {market === 'de' ? 'Mitarbeitende' : 'Dolgozók'} ({Array.isArray(msg.plannerCard.employeeNames) ? msg.plannerCard.employeeNames.length : 0}):
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Array.isArray(msg.plannerCard.employeeNames) && msg.plannerCard.employeeNames.length > 0 ? (
                        msg.plannerCard.employeeNames.map((name) => (
                          <span
                            key={name}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              darkMode ? 'bg-slate-700 text-slate-100 border border-slate-600' : 'bg-white text-slate-700 border border-sky-200'
                            }`}
                          >
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{market === 'de' ? 'Keine aktive Person in der Liste.' : 'Nincs aktív dolgozó a listában.'}</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void executeBettiUiCommand(msg.plannerCard.planCommand, msg);
                          setBettiChatMessages((prev) => prev.map((m) => (
                            m?.ts === msg?.ts
                              ? { ...m, plannerCard: null }
                              : m
                          )));
                        }}
                        className={`w-full rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                          darkMode
                            ? 'bg-emerald-600 text-white active:bg-emerald-500'
                            : 'bg-emerald-500 text-white active:bg-emerald-600'
                        }`}
                      >
                        {msg?.plannerCard?.planCommand?.label || (market === 'de' ? 'Ja, ich moechte einen Dienstplan-Entwurf' : 'Igen, beosztas-tervezetet kerek')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cancelCmd = msg?.plannerCard?.cancelCommand || {
                            originalType: 'local_schedule_wizard_start',
                          };
                          void executeBettiUiCommand(cancelCmd, msg);
                          setBettiChatMessages((prev) => prev.map((m) => (
                            m?.ts === msg?.ts
                              ? { ...m, plannerCard: null, uiCommands: [] }
                              : m
                          )));
                        }}
                        className={`w-full rounded-xl px-3 py-2 text-sm font-semibold border transition-colors ${
                          darkMode
                            ? 'bg-slate-700 text-slate-200 border-slate-600 active:bg-slate-600'
                            : 'bg-white text-slate-700 border-slate-300 active:bg-slate-100'
                        }`}
                      >
                        {msg?.plannerCard?.cancelCommand?.label || (market === 'de' ? 'Abbrechen' : 'Megse')}
                      </button>
                    </div>
                  </div>
                )}

                {!isUser && msg?.scheduleControlCard && (
                  <div className={`w-full rounded-2xl border px-4 py-3 shadow-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-emerald-50 border-emerald-200 text-slate-800'
                  }`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      {msg?.scheduleControlCard?.title || (market === 'de' ? 'Dienstplan-Steuerung' : 'Beosztas kezelo panel')}
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {msg?.scheduleControlCard?.monthName || ''} {msg?.scheduleControlCard?.year || ''}
                    </p>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Array.isArray(msg?.scheduleControlCard?.commands) ? msg.scheduleControlCard.commands : []).slice(0, 8).map((cmd) => (
                        <button
                          key={`${cmd.id || cmd.label || cmd.type}`}
                          type="button"
                          onClick={() => { void executeBettiUiCommand(cmd, msg); }}
                          className={`w-full rounded-xl px-3 py-2 text-sm font-semibold border transition-colors text-left ${
                            darkMode
                              ? 'bg-slate-700 text-slate-100 border-slate-600 active:bg-slate-600'
                              : 'bg-white text-slate-700 border-emerald-200 active:bg-emerald-100'
                          }`}
                        >
                          {cmd.label || 'Muvelet'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const cancelCmd = msg?.scheduleControlCard?.cancelCommand || {
                          type: 'local_cancel_command',
                          label: market === 'de' ? 'Abbrechen' : 'Megse',
                          originalType: 'local_schedule_control_panel',
                        };
                        void executeBettiUiCommand(cancelCmd, msg);
                        setBettiChatMessages((prev) => prev.map((m) => (
                          m?.ts === msg?.ts
                            ? { ...m, scheduleControlCard: null, uiCommands: [] }
                            : m
                        )));
                      }}
                      className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold border transition-colors ${
                        darkMode
                          ? 'bg-slate-700 text-slate-200 border-slate-600 active:bg-slate-600'
                          : 'bg-white text-slate-700 border-slate-300 active:bg-slate-100'
                      }`}
                    >
                      {msg?.scheduleControlCard?.cancelCommand?.label || (market === 'de' ? 'Abbrechen' : 'Megse')}
                    </button>
                  </div>
                )}

                <p className={`text-[10px] px-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'} ${isUser ? 'text-right' : 'text-left'}`}>
                  {isUser ? 'Te' : 'Betti'}{msg.ts ? ` · ${formatTime(msg.ts)}` : ''}
                </p>

                {!isUser && Array.isArray(msg.uiCommands) && msg.uiCommands.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1 pt-1">
                    {msg.uiCommands.slice(0, 4).map((cmd) => (
                      <button
                        key={`${cmd.id || cmd.label || cmd.type}`}
                        type="button"
                        onClick={() => { void executeBettiUiCommand(cmd, msg); }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          darkMode
                            ? 'bg-emerald-900/40 border-emerald-700 text-emerald-200 active:bg-emerald-800/60'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700 active:bg-emerald-100'
                        }`}
                      >
                        {cmd.label || 'Muvelet'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {bettiChatLoading && (
          <div className="flex items-end gap-2 justify-start">
            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-base shadow-sm ${darkMode ? 'bg-sky-800' : 'bg-sky-100'}`}>
              👩‍⚕️
            </div>
            <div className={`rounded-2xl rounded-bl-sm px-4 py-3 border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
              <div className="flex gap-1.5 items-center h-4">
                <span className={`h-2 w-2 rounded-full animate-bounce ${darkMode ? 'bg-sky-400' : 'bg-sky-500'}`} style={{ animationDelay: '0ms' }} />
                <span className={`h-2 w-2 rounded-full animate-bounce ${darkMode ? 'bg-sky-400' : 'bg-sky-500'}`} style={{ animationDelay: '150ms' }} />
                <span className={`h-2 w-2 rounded-full animate-bounce ${darkMode ? 'bg-sky-400' : 'bg-sky-500'}`} style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderBettiChatPanel() {
    const aiOnlyMode = aiViewEnabled === true;
    if (!bettiChatOpen && !aiOnlyMode) return null;
    const hasSpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasSpeechSynthesis = typeof window !== 'undefined' && window.speechSynthesis;

    return (
      <div
        className={aiOnlyMode ? `fixed inset-0 z-[90] ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}` : 'fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm'}
        onClick={() => { if (!aiOnlyMode) setBettiChatOpen(false); }}
      >
        <div
          className={`absolute inset-x-0 top-0 bottom-0 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
          style={{ bottom: `${Math.max(0, bettiKeyboardInset)}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-white bg-white'} shadow-sm`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${darkMode ? 'bg-sky-800' : 'bg-sky-100'}`}>
              👩‍⚕️
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-base leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Betti</p>
              <p className={`text-xs ${bettiChatLoading ? 'text-sky-500' : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                {bettiChatLoading ? 'Gépel...' : 'Pharmagister asszisztens'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aiOnlyMode && (
                <button
                  type="button"
                  onClick={() => {
                    setAiViewEnabled(false);
                    setBettiChatOpen(false);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${darkMode ? 'bg-violet-900/40 text-violet-200 border border-violet-700' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}
                >
                  Klasszikus nezet
                </button>
              )}
              {hasSpeechSynthesis && (
                <button
                  type="button"
                  onClick={() => {
                    if (bettiSpeakEnabled) window.speechSynthesis?.cancel();
                    setBettiSpeakEnabled((v) => !v);
                  }}
                  title={bettiSpeakEnabled ? 'Hang kikapcsolása' : 'Hang bekapcsolása'}
                  className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
                    bettiSpeakEnabled
                      ? (darkMode ? 'bg-sky-700 text-sky-200' : 'bg-sky-100 text-sky-600')
                      : (darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')
                  }`}
                >
                  {bettiSpeakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (aiOnlyMode) {
                    setAiViewEnabled(false);
                  }
                  setBettiChatOpen(false);
                }}
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-xl font-bold ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={bettiChatScrollRef}
            className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
          >
            {aiOnlyMode && (
              <div className={`rounded-xl border px-3 py-2 text-xs ${darkMode ? 'border-violet-700 bg-violet-900/20 text-violet-200' : 'border-violet-200 bg-violet-50 text-violet-800'}`}>
                AI mod aktiv: a klasszikus felulet el van rejtve. Minden muveletet chaten keresztul tudsz inditani.
              </div>
            )}
            {renderBettiMessageBanners(40)}
          </div>

          {/* Bottom bar */}
          <div
            className={`border-t px-3 pt-2 pb-3 space-y-2 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
          >
            {/* Quick actions */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(bettiQuickActions.length > 0
                ? bettiQuickActions
                : getBettiPresetQuestions().map((q) => ({ label: q, utterance: q }))
              ).slice(0, 6).map((item) => (
                <button
                  key={`${item.key || item.label}-${item.utterance || item.label}`}
                  type="button"
                  onClick={() => {
                    const learningFeedback = item.learnFromPreviousUnknown && bettiLastUnknownMessage
                      ? { type: 'intent_selection', originalMessage: bettiLastUnknownMessage, selectedPrompt: item.utterance || item.label }
                      : null;
                    sendBettiChatMessage(item.utterance || item.label, { learningFeedback });
                  }}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    darkMode
                      ? 'bg-sky-900/50 border-sky-700 text-sky-200 active:bg-sky-800'
                      : 'bg-sky-50 border-sky-200 text-sky-700 active:bg-sky-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Voice listening indicator */}
            {bettiVoiceListening && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${darkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-50 text-red-600'}`}>
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Figyelek... (érintsd meg a mikrofont a leállításhoz)
              </div>
            )}

            {/* Input row */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (bettiChatLoading || !bettiChatInput.trim()) return;
                await sendBettiChatMessage(bettiChatInput);
              }}
              className="flex items-center gap-2"
            >
              {hasSpeechRecognition && (
                <button
                  type="button"
                  onClick={startVoiceInput}
                  title={bettiVoiceListening ? 'Megállítás' : 'Hangos üzenet'}
                  className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    bettiVoiceListening
                      ? 'bg-red-500 text-white shadow-lg scale-110'
                      : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                  }`}
                >
                  {bettiVoiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <input
                type="text"
                value={bettiChatInput}
                onChange={(e) => setBettiChatInput(e.target.value)}
                placeholder={bettiVoiceListening ? 'Figyelek...' : 'Írj Bettinek...'}
                disabled={bettiVoiceListening}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                  darkMode
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-sky-500'
                    : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400 focus:border-sky-400 focus:bg-white'
                }`}
              />
              <button
                type="submit"
                disabled={bettiChatLoading || !bettiChatInput.trim()}
                className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                  bettiChatLoading || !bettiChatInput.trim()
                    ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                    : 'bg-sky-500 text-white hover:bg-sky-600 shadow-md'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function getBettiPresetQuestions() {
    if (isPharmacy || showCriteriaPage) {
      if (market === 'de') {
        return [
          'Zeig mir die Ueberstunden',
          'Plane nur den Montag neu',
          'Wer koennte die morgige Spaetschicht uebernehmen?',
        ];
      }
      return [
        'Mutasd a tulorasokat',
        'Tervezd ujra csak a hetfot',
        'Ki tudna atvenni a holnapi estet?',
      ];
    }
    if (market === 'de') {
      return [
        'Wann arbeite ich?',
        'Wann bin ich im Urlaub?',
        'Wann habe ich frei?',
        'Ich moechte meinen Plan eintragen',
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
          schedulePreferences: schedulePreferences.filter(p => p.status !== 'deleted' && p.publishedAt),
          year,
          month,
          config: normalizePlanningConfig(plannerConfigForm),
          action: 'plan',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || (market === 'de' ? 'Fehler bei der automatischen Planung.' : 'Automatikus tervezési hiba történt.'));
      }

      const proposed = result.proposedShifts || [];
      if (proposed.length === 0) {
        setStatusMessage(
          market === 'de'
            ? 'Der automatische Planer hat keine neuen Dienste vorgeschlagen (moeglicherweise sind alle Tage bereits ausgefuellt).'
            : 'Az automatikus tervező nem javasolt új műszakot (lehet már minden nap ki van töltve).'
        );
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
        market === 'de'
          ? `Intelligenter Dienstplan erstellt: ${created} Dienste gespeichert${errorCount ? `, ${errorCount} kritische Warnungen` : ''}${warningCount ? `, ${warningCount} Hinweise` : ''}.`
          : `✅ Intelligens beosztás generálva: ${created} műszak mentve` +
            (errorCount ? `, ${errorCount} piros figyelmeztetés` : '') +
            (warningCount ? `, ${warningCount} narancs figyelmeztetés` : '') +
            '.'
      );
      setPlannerResult(result);
      await loadData();
    } catch (error) {
      console.error('generateAndApply error:', error);
      setStatusError(error.message || (market === 'de' ? 'Automatische Planung konnte nicht ausgefuehrt werden.' : 'Nem sikerült lefuttatni az automatikus tervezést.'));
    } finally {
      setPlannerLoading(false);
    }
  }

  async function handleApplyPlannerResult() {
    if (!plannerResult?.proposedShifts?.length) {
      setStatusError(market === 'de' ? 'Keine anwendbaren vorgeschlagenen Dienste.' : 'Nincs alkalmazható javasolt műszak.');
      return;
    }
    await applyProposedShifts(plannerResult.proposedShifts);
  }

  async function applyProposedShifts(proposedShifts) {
    if (!proposedShifts?.length) {
      setStatusError(market === 'de' ? 'Keine anwendbaren vorgeschlagenen Dienste.' : 'Nincs alkalmazható javasolt műszak.');
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
      for (const item of proposedShifts) {
        const dedupeKey = `${item.date}|${item.startTime}|${item.endTime}|${item.employeeId}`;
        if (existingSet.has(dedupeKey)) continue;

        const employee = employeeMap.get(item.employeeId);
        const [itemYear, itemMonth, itemDay] = item.date.split('-').map(Number);
        await addDoc(collection(db, 'pharmacySchedules'), {
          pharmacyId: user.uid,
          pharmacyName,
          date: item.date,
          year: itemYear,
          month: itemMonth,
          day: itemDay,
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

      setStatusMessage(
        market === 'de'
          ? `Automatischer Plan angewendet: ${created} neue Dienste gespeichert.`
          : `Automatikus terv alkalmazva: ${created} új műszak mentve.`
      );
      setPlannerResult(null);
      await loadData();
    } catch (error) {
      console.error('Apply planner result error:', error);
      setStatusError(market === 'de' ? 'Automatischer Plan konnte nicht angewendet werden.' : 'Nem sikerült alkalmazni az automatikus tervet.');
    } finally {
      setApplyingPlanner(false);
    }
  }

  async function handleAutoGenerateAndApply() {
    const { success, result } = await runAutoPlanner({ action: 'plan' });
    if (success && result?.proposedShifts?.length) {
      await applyProposedShifts(result.proposedShifts);
    }
  }

  async function handleLockPreference(pref) {
    if (!pref || !pref.date || !pref.employeeId) return;
    setLockingPrefId(pref.id);
    try {
      const employee = activeEmployees.find(e => e.id === pref.employeeId) || {};
      const pharmacyName = userData?.pharmacyName || userData?.name || user.email;
      const [ly, lm, ld] = pref.date.split('-').map(Number);
      await addDoc(collection(db, 'pharmacySchedules'), {
        pharmacyId: user.uid,
        pharmacyName,
        date: pref.date,
        year: ly, month: lm, day: ld,
        employeeId: pref.employeeId,
        employeeName: pref.employeeName || employee?.name || 'Ismeretlen dolgozó',
        employeeEmail: pref.employeeEmail || employee?.email || '',
        linkedUserId: pref.linkedUserId || employee?.linkedUserId || null,
        role: pref.role || employee?.role || 'other',
        startTime: pref.startTime,
        endTime: pref.endTime,
        shiftType: normalizeShiftTypeKey(pref.shiftType),
        onCall: false,
        notes: 'Dolgozói kérés alapján rögzítve',
        locked: true,
        status: 'active',
        createdBy: user.uid,
        planningSource: 'preference-lock',
        preferenceId: pref.id || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadData();
    } catch (err) {
      console.error('handleLockPreference error:', err);
      setStatusError(market === 'de' ? 'Anfrage konnte nicht gespeichert werden.' : 'Nem sikerült rögzíteni a kérést.');
    } finally {
      setLockingPrefId(null);
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
  const visibleWizardSteps = criteriaWizardSteps.filter((step) => {
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
  const weekdayOpenDays = weekdayDisplay.filter(({ day }) => plannerConfigForm.operations?.openingHoursByWeekday?.[day]?.isOpen !== false).length;
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
        {/* Vissza gomb */}
        <div className={`sticky top-0 z-10 px-4 py-3 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <button
            type="button"
            onClick={() => setShowCriteriaPage(false)}
            className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold text-lg ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm border border-gray-200'}`}
          >
            ‹
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* ── Betti wizard – nagy kártyás chat UI ───────────────────── */}
          <div className={`rounded-3xl overflow-hidden shadow-lg border ${darkMode ? 'border-violet-800 bg-gray-900' : 'border-violet-100 bg-white'}`}>

            {/* Progress bar + fejléc */}
            <div className={`px-5 pt-5 pb-4 ${darkMode ? 'bg-violet-900/30' : 'bg-violet-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0 ${darkMode ? 'bg-violet-800' : 'bg-violet-600'}`}>
                </div>
                <div>
                  <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Betti</p>
                  <p className={`text-xs ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>Beosztástervező asszisztens</p>
                </div>
                <div className="ml-auto text-right">
                  <p className={`text-xs font-semibold ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>{safeWizardStepIndex + 1} / {wizardTotal}</p>
                  <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>kérdés</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-violet-100'}`}>
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${((safeWizardStepIndex + 1) / wizardTotal) * 100}%` }}
                />
              </div>
            </div>

            {/* Betti üzenet buborék */}
            <div className="px-5 pt-4 pb-2 space-y-3">

              {/* Bemutatkozás csak első lépésnél */}
              {safeWizardStepIndex === 0 && (
                <div className={`rounded-2xl rounded-tl-sm px-5 py-4 ${darkMode ? 'bg-violet-900/50' : 'bg-violet-50'}`}>
                  <p className={`font-bold text-base mb-1 ${darkMode ? 'text-violet-100' : 'text-violet-900'}`}>Szia! Én vagyok Betti</p>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-violet-200/80' : 'text-violet-800/80'}`}>
                    A beosztástervező asszisztensed vagyok. Néhány kérdéssel beállítom a gyógyszertárad kritériumait, hogy az automatikus beosztás pontosan illeszkedjen hozzátok. Minden válasz azonnal mentődik!
                  </p>
                </div>
              )}

              {/* Aktuális kérdés kártya */}
              <div className={`rounded-2xl rounded-tl-sm border px-5 py-5 shadow-sm ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-violet-400' : 'text-violet-500'}`}>
                  {wizardStep.hint}
                </p>
                <p className={`text-xl font-bold leading-tight mb-5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{wizardStep.title}</p>

                {/* Válasz mezők – nagy tap targets */}
                {wizardStep.key === 'open_sunday' && (
                  <div className="space-y-3">
                    {[
                      { value: true, label: 'Igen, vasárnap is nyitva vagyunk', icon: '✅' },
                      { value: false, label: 'Nem, vasárnap zárva tartunk', icon: '🚫' },
                    ].map(opt => {
                      const current = plannerConfigForm.operations?.openingHoursByWeekday?.[0]?.isOpen !== false;
                      const selected = opt.value === current;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => updateOpeningHoursDay(0, { isOpen: opt.value })}
                          className={`w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                            selected
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/40 dark:border-violet-400'
                              : darkMode ? 'border-gray-700 bg-gray-900 hover:border-gray-600' : 'border-gray-200 bg-gray-50 hover:border-violet-200'
                          }`}
                        >
                          <span className="text-2xl">{opt.icon}</span>
                          <span className={`text-sm font-semibold ${selected ? (darkMode ? 'text-violet-200' : 'text-violet-900') : (darkMode ? 'text-gray-300' : 'text-gray-700')}`}>{opt.label}</span>
                          {selected && <span className="ml-auto text-violet-500 text-lg">●</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {wizardStep.key === 'on_call_enabled' && (
                  <div className="space-y-3">
                    {[
                      { value: true, label: 'Igen, van rendszeres ügyelet', icon: '🌙' },
                      { value: false, label: 'Nem, nincs ügyeleti szolgálat', icon: '☀️' },
                    ].map(opt => {
                      const current = plannerConfigForm.operations?.onCall?.enabled === true;
                      const selected = opt.value === current;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setPlannerConfigForm(prev => ({
                            ...prev,
                            operations: { ...(prev.operations || {}), onCall: { ...((prev.operations || {}).onCall || {}), enabled: opt.value } },
                          }))}
                          className={`w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                            selected
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/40 dark:border-violet-400'
                              : darkMode ? 'border-gray-700 bg-gray-900 hover:border-gray-600' : 'border-gray-200 bg-gray-50 hover:border-violet-200'
                          }`}
                        >
                          <span className="text-2xl">{opt.icon}</span>
                          <span className={`text-sm font-semibold ${selected ? (darkMode ? 'text-violet-200' : 'text-violet-900') : (darkMode ? 'text-gray-300' : 'text-gray-700')}`}>{opt.label}</span>
                          {selected && <span className="ml-auto text-violet-500 text-lg">●</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {wizardStep.key === 'on_call_days' && (
                  <div className="grid grid-cols-4 gap-2">
                    {weekdayDisplay.map(({ day, fullLabel }) => {
                      const active = onCallDaysSelected.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleOnCallDay(day)}
                          className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 transition-all ${
                            active
                              ? 'border-violet-500 bg-violet-500 text-white'
                              : darkMode ? 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-violet-200'
                          }`}
                        >
                          <span className="text-lg">{active ? '✓' : '○'}</span>
                          <span className="text-[11px] font-bold">{fullLabel.slice(0, 3)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {wizardStep.key === 'day_min_pharmacists' && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: Math.max(0, (prev.minPharmacistsPerShift || 0) - 1) }))}
                      className={`h-14 w-14 rounded-2xl text-2xl font-bold flex items-center justify-center border-2 ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                    >−</button>
                    <div className="flex-1 text-center">
                      <p className={`text-5xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{plannerConfigForm.minPharmacistsPerShift || 0}</p>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>gyógyszerész / műszak</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: (prev.minPharmacistsPerShift || 0) + 1 }))}
                      className={`h-14 w-14 rounded-2xl text-2xl font-bold flex items-center justify-center border-2 border-violet-400 ${darkMode ? 'bg-violet-900/50 text-violet-200 hover:bg-violet-900' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}
                    >+</button>
                  </div>
                )}

                {wizardStep.key === 'on_call_min_pharmacists' && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPlannerConfigForm(prev => ({ ...prev, operations: { ...(prev.operations || {}), onCall: { ...((prev.operations || {}).onCall || {}), requiredPharmacists: Math.max(0, ((prev.operations || {}).onCall?.requiredPharmacists ?? 1) - 1) } } }))}
                      className={`h-14 w-14 rounded-2xl text-2xl font-bold flex items-center justify-center border-2 ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                    >−</button>
                    <div className="flex-1 text-center">
                      <p className={`text-5xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{plannerConfigForm.operations?.onCall?.requiredPharmacists ?? 1}</p>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>gyógyszerész / ügyelet</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlannerConfigForm(prev => ({ ...prev, operations: { ...(prev.operations || {}), onCall: { ...((prev.operations || {}).onCall || {}), requiredPharmacists: ((prev.operations || {}).onCall?.requiredPharmacists ?? 1) + 1 } } }))}
                      className={`h-14 w-14 rounded-2xl text-2xl font-bold flex items-center justify-center border-2 border-violet-400 ${darkMode ? 'bg-violet-900/50 text-violet-200 hover:bg-violet-900' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}
                    >+</button>
                  </div>
                )}
              </div>

              {/* Betti záró üzenet – utolsó lépésnél */}
              {safeWizardStepIndex === wizardTotal - 1 && (
                <div className={`rounded-2xl rounded-tl-sm px-5 py-4 ${darkMode ? 'bg-emerald-900/40' : 'bg-emerald-50'}`}>
                  <p className={`font-bold text-base mb-1 ${darkMode ? 'text-emerald-100' : 'text-emerald-900'}`}>{market === 'de' ? 'Super, alles ist bereit!' : 'Szuper, minden megvan!'}</p>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-emerald-200/80' : 'text-emerald-800/80'}`}>
                    {market === 'de'
                      ? <>Pruefe die Zusammenfassung und klicke auf <strong>Ich genehmige</strong> - danach erstelle ich den Dienstplan auf dieser Basis.</>
                      : <>Nézd át az összefoglalót, és kattints a <strong>Jóváhagyom</strong> gombra – ezek alapján készítem a beosztást.</>}
                  </p>
                </div>
              )}

              {/* Contradiction warnings */}
              {contradictionWarnings.length > 0 && (
                <div className={`rounded-2xl px-5 py-4 space-y-2 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>{market === 'de' ? '⚠️ Bettis Hinweise' : '⚠️ Betti észrevételei'}</p>
                  {contradictionWarnings.map((w, i) => (
                    <p key={i} className={`text-sm ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>{w}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Navigáció + autosave */}
            <div className={`px-5 py-4 flex items-center justify-between gap-3 border-t ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50'}`}>
              <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {plannerDraftSaving
                  ? (market === 'de' ? '💾 Speichern...' : '💾 Mentés...')
                  : plannerDraftSavedAt
                    ? `${market === 'de' ? '✓ Gespeichert' : '✓ Mentve'} ${plannerDraftSavedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
                    : (market === 'de' ? 'Auto-Speichern' : 'Auto-mentés')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goWizardPrev}
                  disabled={safeWizardStepIndex === 0}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-30 ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {market === 'de' ? '← Zurueck' : '← Előző'}
                </button>
                {safeWizardStepIndex < wizardTotal - 1 ? (
                  <button
                    type="button"
                    onClick={goWizardNext}
                    className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    {market === 'de' ? 'Weiter →' : 'Következő →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => { const ok = await savePlannerConfig(); if (ok) setTimeout(() => setShowCriteriaPage(false), 800); }}
                    disabled={plannerConfigSaving}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-emerald-700 transition-colors"
                  >
                    {plannerConfigSaving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Ich genehmige ✓' : 'Jóváhagyom ✓')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Összefoglaló kártya */}
          <div className={`rounded-3xl border overflow-hidden shadow-sm ${darkMode ? 'border-emerald-800 bg-gray-900' : 'border-emerald-100 bg-white'}`}>
            <div className={`px-5 py-4 ${darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
              <p className={`font-bold text-base ${darkMode ? 'text-emerald-100' : 'text-emerald-900'}`}>{market === 'de' ? 'Betti Zusammenfassung' : 'Betti összefoglalója'}</p>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-emerald-300/70' : 'text-emerald-700/70'}`}>{market === 'de' ? 'Das wird fuer die Dienstplan-Generierung verwendet' : 'Ezt fogja használni a beosztás generálásnál'}</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              {aiSummaryLines.map((line, index) => (
                <div key={index} className={`flex items-start gap-3 rounded-xl px-4 py-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <span className="text-emerald-500 mt-0.5 text-sm">✓</span>
                  <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Napi létszám ────────────────────────────────────────── */}
          <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Napi létszám követelmények</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum létszám / műszak">
                <input
                  type="number" min="1"
                  value={plannerConfigForm.minStaffPerShift}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, minStaffPerShift: Number(e.target.value || 1) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Maximum létszám / műszak">
                <input
                  type="number" min="0"
                  value={(plannerConfigForm.maxStaffPerShift ?? 0) === 0 ? '' : plannerConfigForm.maxStaffPerShift}
                  placeholder="nincs maximum"
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, maxStaffPerShift: Number(e.target.value || 0) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 placeholder-gray-400'}`}
                />
              </Field>
              <Field label="Min. gyógyszerész / műszak">
                <input
                  type="number" min="0"
                  value={plannerConfigForm.minPharmacistsPerShift}
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, minPharmacistsPerShift: Number(e.target.value || 0) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </Field>
              <Field label="Max. gyógyszerész / műszak">
                <input
                  type="number" min="0"
                  value={(plannerConfigForm.maxPharmacistsPerShift ?? 0) === 0 ? '' : plannerConfigForm.maxPharmacistsPerShift}
                  placeholder="nincs maximum"
                  onChange={e => setPlannerConfigForm(prev => ({ ...prev, maxPharmacistsPerShift: Number(e.target.value || 0) }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 placeholder-gray-400'}`}
                />
              </Field>
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Az automatikus terv és az ellenőrzés ennek alapján figyeli a fedettséget. Ha a maximum mezőt üresen hagyod, nincs felső korlát.</p>
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
              {weekdayDisplay.map(({ day, fullLabel, label }) => {
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
                {weekdayDisplay.map(({ day, label }) => {
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
            <h3 className={`font-bold text-sm uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Was prueft das System?' : 'Mit ellenőriz a rendszer?'}</h3>
            {[
              { icon: '🔴', label: market === 'de' ? 'Taegliches Stundenlimit ueberschritten' : 'Napi óratúllépés', desc: market === 'de' ? `Max ${plannerConfigForm.laborLaw?.maxDailyHoursLegal || 12} Std/Tag pro Mitarbeitenden` : `Max ${plannerConfigForm.laborLaw?.maxDailyHoursLegal || 12} óra/nap dolgozónként` },
              { icon: '🔴', label: market === 'de' ? 'Woechentliches Stundenlimit ueberschritten' : 'Heti óratúllépés', desc: market === 'de' ? `Max ${plannerConfigForm.laborLaw?.maxWeeklyHoursLegal || 48} Std/Woche pro Mitarbeitenden` : `Max ${plannerConfigForm.laborLaw?.maxWeeklyHoursLegal || 48} óra/hét dolgozónként` },
              { icon: '🔴', label: market === 'de' ? 'Oeffnungszeiten verletzt' : 'Nyitvatartási idő sérülés', desc: market === 'de' ? 'Normale Schicht darf nicht ausserhalb der Oeffnungszeiten liegen' : 'Normál műszak nyitvatartáson kívül nem lehet' },
              { icon: '🔴', label: market === 'de' ? 'Ueberlappende Schichten' : 'Átfedő műszakok', desc: market === 'de' ? 'Dieselbe Person darf am selben Tag nicht doppelt eingeteilt sein' : 'Ugyanaz a dolgozó nem lehet kétszer ugyanazon a napon' },
              { icon: '🔴', label: market === 'de' ? 'Urlaub verletzt' : 'Szabadság sérülés', desc: market === 'de' ? 'Bei genehmigtem Urlaub darf keine Einteilung erfolgen' : 'Jóváhagyott szabadság alatt nem lehet beosztva' },
              { icon: '🟡', label: market === 'de' ? 'Schicht an geschlossenem Tag' : 'Zárvatartási napi műszak', desc: market === 'de' ? 'Nicht-Bereitschaftsschicht an geschlossenem Tag erzeugt Warnung' : 'Nem ügyeleti műszak zárt napon figyelmeztetést ad' },
              { icon: '🟡', label: market === 'de' ? 'Woechentlicher Ruhetag fehlt' : 'Heti pihenőnap hiány', desc: market === 'de' ? 'Pro Woche ist mindestens 1 Ruhetag erforderlich' : 'Hetenként legalább 1 pihenőnap szükséges' },
              { icon: '🟡', label: market === 'de' ? 'Monatliches Stundenkontingent ueberschritten' : 'Havi órakeret túllépés', desc: market === 'de' ? 'Monatliches Stundenkontingent je Mitarbeitenden wird geprueft' : 'Dolgozói havi órakeret figyelése' },
              { icon: '🔵', label: market === 'de' ? 'Praeferenz ignoriert' : 'Preferencia figyelmen kívül', desc: market === 'de' ? 'Gewuenschter Tag der Person ist nicht im Plan enthalten' : 'Dolgozó kért napja nem szerepel a beosztásban' },
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
            {plannerConfigSaving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Speichern und zurueck' : 'Mentés és visszatérés')}
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
            : (mainTab === 'mine'
              ? (market === 'de' ? 'Mein Dienstplan' : 'Beosztásom')
              : mainTab === 'swaps'
                ? (market === 'de' ? 'Tauschanfragen' : 'Csereigények')
                : mainTab === 'vacations'
                  ? (market === 'de' ? 'Urlaube' : 'Szabadságolások')
                  : mainTab === 'planner'
                    ? (market === 'de' ? 'Dienstplan-Entwurf' : 'Beosztás-tervező')
                    : (market === 'de' ? 'Praeferenzen' : 'Preferenciák'))}
        </h2>
        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
          {isPharmacy
            ? (mainTab === 'workers'
              ? (market === 'de' ? 'Mitarbeitende hinzufuegen, entfernen und ihre Praeferenzen ansehen.' : 'Dolgozók hozzáadása, eltávolítása és preferenciáik megtekintése.')
              : (market === 'de' ? 'Dienstplaene erstellen, veroeffentlichen und Tauschanfragen verwalten.' : 'Beosztások írása, publikálása és csereigények kezelése.'))
            : (market === 'de' ? 'Eigene Dienste, Tauschanfragen und Urlaubsanfragen an einem Ort.' : 'Saját beosztások, csereigények és szabadságigények egy helyen.')}
        </p>
      </div>

      <SegmentedTabs tabs={topTabs} active={mainTab} onChange={handleMainTabChange} />

      {statusMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {statusMessage}
        </div>
      ) : null}

      {/* Planner conflict explanations — shown below status message when errors exist */}
      {plannerResult && (plannerResult.conflicts || []).some(c => c.severity === 'error') ? (() => {
        const errors = (plannerResult.conflicts || []).filter(c => c.severity === 'error');
        const seen = new Set();
        const uniqueCodes = errors.filter(e => {
          const k = e.code || 'unknown';
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        return (
          <div className={`rounded-xl border p-4 space-y-3 ${darkMode ? 'border-rose-800 bg-rose-900/20' : 'border-rose-200 bg-rose-50'}`}>
            <div className="flex items-center justify-between">
              <p className={`font-semibold text-sm ${darkMode ? 'text-rose-300' : 'text-rose-800'}`}>🚫 {market === 'de' ? `${errors.length} rote Warnungen - Erklaerung und Vorschlaege` : `${errors.length} piros figyelmeztetés – magyarázat és javaslatok`}</p>
              <button type="button" onClick={() => setPlannerResult(null)} className={`text-xs underline ${darkMode ? 'text-rose-400' : 'text-rose-600'}`}>{market === 'de' ? 'schliessen' : 'bezár'}</button>
            </div>
            {uniqueCodes.map((err, i) => {
              const advice = getErrorAdvice(err.code, market);
              const group = errors.filter(e => (e.code || 'unknown') === (err.code || 'unknown'));
              return (
                <div key={i} className={`rounded-lg border p-3 ${darkMode ? 'border-rose-700 bg-rose-900/30' : 'border-rose-200 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${darkMode ? 'text-rose-200' : 'text-rose-800'}`}>{advice.title}</span>
                    {group.length > 1 && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${darkMode ? 'bg-rose-800 text-rose-200' : 'bg-rose-100 text-rose-700'}`}>{group.length}×</span>}
                  </div>
                  {advice.tip && <p className={`text-xs mb-2 ${darkMode ? 'text-rose-300' : 'text-rose-600'}`}>{advice.tip}</p>}
                  <div className={`rounded px-3 py-2 text-xs flex items-start gap-2 mb-2 ${darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                    <span className="flex-shrink-0">💡</span>
                    <span>{advice.suggestion}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.slice(0, 5).map((e2, j) => (
                      <p key={j} className={`text-xs pl-2 border-l-2 ${darkMode ? 'border-rose-700 text-rose-400' : 'border-rose-300 text-rose-600'}`}>{e2.message}</p>
                    ))}
                    {group.length > 5 && <p className={`text-xs pl-2 ${darkMode ? 'text-rose-500' : 'text-rose-400'}`}>+ {group.length - 5} {market === 'de' ? 'weitere Faelle' : 'további eset'}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })() : null}

      {statusError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statusError}
        </div>
      ) : null}

      {loading ? (
        <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'border-gray-700 bg-gray-900 text-gray-300' : 'border-[#E5E7EB] bg-white text-[#374151]'}`}>
          {market === 'de' ? 'Wird geladen...' : 'Betöltés...'}
        </div>
      ) : null}

      {!loading && !isPharmacy && awaitingPharmacyAssignment ? (
        <div className={`rounded-2xl border px-4 py-4 ${darkMode ? 'border-amber-700 bg-amber-900/20' : 'border-amber-300 bg-amber-50'}`}>
          <p className={`text-sm font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-900'}`}>
            {market === 'de' ? 'Dein Dienstplan ist noch nicht aktiv.' : 'A beosztásod még nem aktív.'}
          </p>
          <p className={`mt-1 text-sm ${darkMode ? 'text-amber-200/90' : 'text-amber-800'}`}>
            {market === 'de' ? 'Hier siehst du Daten, sobald dich eine Apotheke in die Mitarbeitenden-Liste aufnimmt.' : 'Akkor fogsz itt adatokat látni, ha egy gyógyszertár felvesz a dolgozói közé.'}
          </p>
        </div>
      ) : null}

      {!loading && isPharmacy && mainTab === 'workers' ? (
        <div className="space-y-6">
          <SegmentedTabs
            tabs={[
              { key: 'add', label: market === 'de' ? 'Mitarbeitende hinzufuegen' : 'Dolgozó hozzáadása' },
              { key: 'remove', label: market === 'de' ? 'Mitarbeitende entfernen' : 'Dolgozó eltávolítása' },
            ]}
            active={workerTab}
            onChange={setWorkerTab}
          />

          {/* ── Always-visible employee list ─────────────────────────── */}
          <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
            <p className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {market === 'de' ? `Aktive Mitarbeitende (${activeEmployees.length})` : `Aktív dolgozók (${activeEmployees.length})`}
            </p>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-gray-500">{market === 'de' ? 'Noch keine aktiven Mitarbeitenden.' : 'Még nincs aktív dolgozó.'}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeEmployees.map(employee => {
                  // Only show preferences the employee has published (not drafts)
                  const empPrefs = allPreferences.filter(p =>
                    p.publishedAt &&
                    (
                      p.employeeId === employee.id ||
                      (p.linkedUserId && p.linkedUserId === employee.linkedUserId) ||
                      (p.employeeEmail && employee.email && p.employeeEmail.toLowerCase() === employee.email.toLowerCase())
                    )
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
                          <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{employee.email} · {prettyRole(employee.role, market)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {empPrefs.length > 0 && (
                            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {empPrefs.length} {market === 'de' ? 'eingereichte Entwuerfe' : 'beküldött tervezet'}
                            </span>
                          )}
                          {workerTab === 'remove' && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleRemoveEmployee(employee.id); }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              {market === 'de' ? 'Entfernen' : 'Eltávolítás'}
                            </button>
                          )}
                          <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* Expanded: preferences grouped by month */}
                      {isExpanded && (() => {
                        const profile = workerProfiles[employee.linkedUserId] || {};
                        const ef = workerEditForms[employee.id] ?? {
                          phone: employee.phone || '',
                          address: employee.address || '',
                          notes: employee.notes || '',
                          contractHours: String(employee.contractHours || profile.contractHours || '8'),
                          birthDate: employee.birthDate || profile.birthDate || '',
                          childrenCount: String(employee.childrenCount ?? profile.childrenCount ?? '0'),
                          vacationTakenThisYear: String(employee.vacationTakenThisYear ?? profile.vacationTakenThisYear ?? '0'),
                          vacationCarriedOver: String(employee.vacationCarriedOver ?? profile.vacationCarriedOver ?? '0'),
                        };
                        const isSavingEf = !!workerEditSaving[employee.id];
                        const savedAtEf = workerEditSavedAt[employee.id];

                        // Calculate preview values
                        const hasVacData = !!ef.birthDate;
                        const totalVac = hasVacData ? calcAnnualVacationDays(ef.birthDate, ef.childrenCount, thisYear) : null;
                        const carryOver = Number(ef.vacationCarriedOver) || 0;
                        const taken = Number(ef.vacationTakenThisYear) || 0;
                        const remaining = totalVac !== null ? totalVac + carryOver - taken : null;
                        const reqHours = ef.contractHours ? calcMonthlyRequiredHours(ef.contractHours, year, month) : null;

                        return (
                        <div className={`px-4 pb-4 pt-1 border-t space-y-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                          {/* Basic data section */}
                          <div className={`rounded-xl p-3 space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                            <p className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Grunddaten' : 'Alapadatok'}</p>
                            <div className="grid grid-cols-2 gap-2">

                              {/* contractHours */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Munkaszerződés típusa</label>
                                <select
                                  value={ef.contractHours}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, contractHours: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                >
                                  <option value="4">4 h/nap (részmunkaidő 50%)</option>
                                  <option value="6">6 h/nap (részmunkaidő 75%)</option>
                                  <option value="8">8 h/nap (teljes munkaidő)</option>
                                  <option value="12">12 h/nap (műszakos)</option>
                                </select>
                              </div>

                              {/* birthDate */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Születési dátum</label>
                                <input
                                  type="date"
                                  value={ef.birthDate}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, birthDate: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                />
                              </div>

                              {/* childrenCount */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gyermekek száma</label>
                                <select
                                  value={ef.childrenCount}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, childrenCount: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                >
                                  {['0','1','2','3','4','5+'].map(v => <option key={v} value={v}>{v} gyermek</option>)}
                                </select>
                              </div>

                              {/* vacationTakenThisYear */}
                              <div className="flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Felvett szab. idén</label>
                                <select
                                  value={ef.vacationTakenThisYear}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, vacationTakenThisYear: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                >
                                  {Array.from({ length: 51 }, (_, i) => i).map(v => <option key={v} value={v}>{v} nap</option>)}
                                </select>
                              </div>

                              {/* vacationCarriedOver */}
                              <div className="flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Áthozott szab.</label>
                                <select
                                  value={ef.vacationCarriedOver}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, vacationCarriedOver: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                >
                                  {Array.from({ length: 31 }, (_, i) => i).map(v => <option key={v} value={v}>{v} nap</option>)}
                                </select>
                              </div>

                              {/* phone */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Telefonnummer' : 'Telefonszám'}</label>
                                <input
                                  type="text"
                                  value={ef.phone}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, phone: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                  placeholder={market === 'de' ? '+49 ...' : '+36 ...'}
                                />
                              </div>

                              {/* address */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Adresse' : 'Cím'}</label>
                                <input
                                  type="text"
                                  value={ef.address}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, address: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                  placeholder={market === 'de' ? 'Strasse, Stadt...' : 'Utca, város...'}
                                />
                              </div>

                              {/* notes */}
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className={`text-[11px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Notiz' : 'Megjegyzés'}</label>
                                <input
                                  type="text"
                                  value={ef.notes}
                                  onChange={e => setWorkerEditForms(prev => ({ ...prev, [employee.id]: { ...ef, notes: e.target.value } }))}
                                  className={`w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${darkMode ? 'border-gray-600 text-gray-100' : 'border-gray-300 text-gray-800'}`}
                                />
                              </div>
                            </div>

                            {/* Calculated preview */}
                            {(totalVac !== null || reqHours !== null) && (
                              <div className={`rounded-lg border px-3 py-2 space-y-1 ${darkMode ? 'border-emerald-800 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{market === 'de' ? `Berechnete Werte (${thisYear})` : `Kiszámított értékek (${thisYear})`}</p>
                                {totalVac !== null && (
                                  <>
                                    <p className={`text-xs ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{market === 'de' ? 'Urlaubsanspruch:' : 'Járó szabadság:'} <strong>{totalVac} {market === 'de' ? 'Tage' : 'nap'}</strong></p>
                                    <p className={`text-xs ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{market === 'de' ? 'Rest:' : 'Maradék:'} <strong>{remaining} {market === 'de' ? 'Tage' : 'nap'}</strong> ({totalVac}+{carryOver}−{taken})</p>
                                  </>
                                )}
                                {reqHours !== null && (
                                  <p className={`text-xs ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{(market === 'de' ? MONTHS_DE : MONTHS_HU)[month - 1]} {market === 'de' ? 'Sollstunden:' : 'kötelező munkaóra:'} <strong>{reqHours} h</strong></p>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-3">
                              {savedAtEf && (
                                <span className={`text-xs font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                  {market === 'de' ? 'Gespeichert' : 'Mentve'} {savedAtEf.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={isSavingEf}
                                onClick={() => handleSaveWorkerBasicData(employee.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                              >
                                {isSavingEf ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Speichern' : 'Mentés')}
                              </button>
                            </div>
                          </div>

                          {/* Preferences section */}
                          {monthKeys.length === 0 ? (
                            <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'Es wurde noch kein Entwurf eingereicht.' : 'Még nem küldött be tervezetet.'}</p>
                          ) : monthKeys.map(mk => {
                            const { year: y, month: m, entries } = byMonth[mk];
                            const label = `${(market === 'de' ? MONTHS_DE : MONTHS_HU)[m - 1]} ${y}`;
                            const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
                            return (
                              <div key={mk}>
                                <div className="flex items-center gap-2 mb-2">
                                  <p className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${darkMode ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>✓ {market === 'de' ? 'Eingereicht' : 'Beküldve'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {sorted.map(p => {
                                    const st = getShiftType(p.shiftType || 'N', market);
                                    const hrs = calcHours(p.startTime, p.endTime, market);
                                    const dow = new Date(p.year, p.month - 1, p.day || parseInt(p.date.split('-')[2])).getDay();
                                    const DOW_SHORT = market === 'de' ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['V','H','K','Sz','Cs','P','Szo'];
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
                        );
                      })()}
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
                <Field label={market === 'de' ? 'E-Mail-Adresse' : 'Email cím'} required hint={market === 'de' ? 'Es kann nur eine registrierte Pharmagister-E-Mail-Adresse hinzugefuegt werden. Die Rolle wird automatisch aus dem Profil uebernommen.' : 'Csak regisztrált Pharmagister email adható meg. A szerepkört automatikusan a profilból vesszük át.'}>
                  <input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(prev => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" placeholder={market === 'de' ? 'name@email.de' : 'nev@email.hu'} />
                </Field>
                <Field label={market === 'de' ? 'Telefonnummer' : 'Telefonszám'}>
                  <input type="text" value={employeeForm.phone} onChange={e => setEmployeeForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
                <Field label={market === 'de' ? 'Adresse' : 'Cím'}>
                  <input type="text" value={employeeForm.address} onChange={e => setEmployeeForm(prev => ({ ...prev, address: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
                <Field label={market === 'de' ? 'Notiz' : 'Megjegyzés'}>
                  <input type="text" value={employeeForm.notes} onChange={e => setEmployeeForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full rounded-xl border px-3 py-2 bg-transparent" />
                </Field>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 font-medium text-white disabled:opacity-60">
                  <UserPlus className="h-4 w-4" />
                  {market === 'de' ? 'Mitarbeitende hinzufuegen' : 'Dolgozó hozzáadása'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {!loading && ((isPharmacy && mainTab === 'schedule') || (!isPharmacy && !awaitingPharmacyAssignment)) ? (
        <div className="space-y-6">

          {/* ── Értesítési / figyelmeztető blokk ─────────────────────────── */}
          {((isPharmacy && mainTab === 'schedule') || (!isPharmacy && mainTab === 'mine')) && (() => {
            const alerts = [];

            if (isPharmacy) {
              // Jóváhagyásra váró cserék (employee_accepted)
              const swapsToApprove = swapRequests.filter(r => r.status === 'employee_accepted');
              if (swapsToApprove.length > 0) {
                alerts.push({
                  key: 'swap_approve',
                  icon: '🔄',
                  color: 'amber',
                  label: market === 'de' ? `${swapsToApprove.length} Tauschanfragen warten auf Freigabe` : `${swapsToApprove.length} csereigény jóváhagyásra vár`,
                  sub: swapsToApprove.map(r => `${r.requesterName?.split(' ').pop()} ↔ ${r.targetName?.split(' ').pop()}`).join(', '),
                  onClick: () => document.getElementById('pharmacy-swaps-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                });
              }
              // Folyamatban lévő cserék (pending)
              const pendingSwaps = swapRequests.filter(r => r.status === 'pending');
              if (pendingSwaps.length > 0) {
                alerts.push({
                  key: 'swap_pending',
                  icon: '⏳',
                  color: 'blue',
                  label: market === 'de' ? `${pendingSwaps.length} Tauschanfragen in Bearbeitung` : `${pendingSwaps.length} csereigény folyamatban`,
                  sub: market === 'de' ? 'Wartet auf die Antwort der anderen Person' : 'Várakozik a másik dolgozó válaszára',
                  onClick: () => document.getElementById('pharmacy-swaps-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                });
              }
              // Jóváhagyásra váró szabadságkérelmek
              const pendingVac = vacationRequests.filter(r => r.status === 'pending');
              if (pendingVac.length > 0) {
                alerts.push({
                  key: 'vacation',
                  icon: '🏖️',
                  color: 'sky',
                  label: market === 'de' ? `${pendingVac.length} Urlaubsanfragen warten auf Freigabe` : `${pendingVac.length} szabadságkérelem vár jóváhagyásra`,
                  sub: pendingVac.map(r => r.employeeName?.split(' ').pop()).filter(Boolean).join(', '),
                  onClick: () => setMainTab('vacations'),
                });
              }
              // Nem publikált beosztás
              if (publishedScheduleCount === 0 && activeMonthSchedules.filter(s => s.year === year && s.month === month).length > 0) {
                alerts.push({
                  key: 'unpublished',
                  icon: '🔒',
                  color: 'rose',
                  label: market === 'de' ? 'Der Monatsdienstplan ist noch nicht veroeffentlicht' : 'A hónap beosztása még nincs publikálva',
                  sub: `${(market === 'de' ? MONTHS_DE : MONTHS_HU)[month-1]} ${year}`,
                  onClick: () => setCalendarOpen(true),
                });
              }
            } else {
              // ALKALMAZOTTI nézet
              // Beérkező csereigények
              const incomingSwaps = swapRequests.filter(r => r.targetUserId === user?.uid && r.status === 'pending');
              if (incomingSwaps.length > 0) {
                alerts.push({
                  key: 'incoming_swap',
                  icon: '🔄',
                  color: 'amber',
                  label: market === 'de' ? `${incomingSwaps.length} eingehende Tauschanfragen warten auf Antwort` : `${incomingSwaps.length} beérkező csereigény vár válaszra`,
                  sub: incomingSwaps.map(r => market === 'de' ? `${r.requesterName?.split(' ').pop()} hat einen Tausch angefragt` : `${r.requesterName?.split(' ').pop()} kért cserét`).join(', '),
                  onClick: () => setMainTab('swaps'),
                });
              }
              // Elfogadott csere, amit a gyógyszertár még nem hagyott jóvá
              const awaitingPharmacy = swapRequests.filter(r => (r.requesterUserId === user?.uid || r.targetUserId === user?.uid) && r.status === 'employee_accepted');
              if (awaitingPharmacy.length > 0) {
                alerts.push({
                  key: 'awaiting_pharmacy',
                  icon: '⏳',
                  color: 'blue',
                  label: market === 'de' ? `${awaitingPharmacy.length} Tausche warten auf Apothekenfreigabe` : `${awaitingPharmacy.length} csere gyógyszertári jóváhagyásra vár`,
                  sub: market === 'de' ? 'Beide Seiten haben zugestimmt, in Bearbeitung' : 'Mindkét fél elfogadta, folyamatban',
                  onClick: () => setMainTab('swaps'),
                });
              }
              // Új beosztás publikálva az aktuális hónapra
              const myPublished = schedules.filter(s => s.status !== 'deleted' && Boolean(s.publishedAt) && s.year === year && s.month === month && (s.linkedUserId === user?.uid || s.userId === user?.uid));
              if (myPublished.length > 0) {
                alerts.push({
                  key: 'published',
                  icon: '✅',
                  color: 'emerald',
                  label: market === 'de' ? `Neuer Dienstplan ist verfuegbar — ${MONTHS_DE[month-1]} ${year}` : `Új beosztás elkészült — ${MONTHS_HU[month-1]} ${year}`,
                  sub: market === 'de' ? `${myPublished.length} Dienste veroeffentlicht` : `${myPublished.length} műszak publikálva`,
                  onClick: () => {},
                });
              }
              // Jóváhagyott / elutasított szabadságkérelem
              const respondedVac = vacationRequests.filter(r => r.userId === user?.uid && (r.status === 'accepted' || r.status === 'rejected'));
              if (respondedVac.length > 0) {
                const accepted = respondedVac.filter(r => r.status === 'accepted').length;
                const rejected = respondedVac.filter(r => r.status === 'rejected').length;
                alerts.push({
                  key: 'vacation_result',
                  icon: accepted > 0 ? '✅' : '❌',
                  color: accepted > 0 ? 'emerald' : 'rose',
                  label: accepted > 0
                    ? (market === 'de' ? `${accepted} Urlaubsanfragen genehmigt` : `${accepted} szabadságkérelem jóváhagyva`)
                    : (market === 'de' ? `${rejected} Urlaubsanfragen abgelehnt` : `${rejected} szabadságkérelem elutasítva`),
                  sub: '',
                  onClick: () => setMainTab('vacations'),
                });
              }
            }

            const colorMap = {
              amber:   { border: darkMode ? 'border-amber-800'   : 'border-amber-200',   bg: darkMode ? 'bg-amber-950/30'  : 'bg-amber-50',   dot: 'bg-amber-500',   text: darkMode ? 'text-amber-300' : 'text-amber-700',   sub: darkMode ? 'text-amber-400/80' : 'text-amber-600/80' },
              blue:    { border: darkMode ? 'border-blue-900'    : 'border-blue-200',    bg: darkMode ? 'bg-blue-950/20'   : 'bg-blue-50',    dot: 'bg-blue-400',    text: darkMode ? 'text-blue-300'  : 'text-blue-700',    sub: darkMode ? 'text-blue-400/80'  : 'text-blue-600/80' },
              sky:     { border: darkMode ? 'border-sky-800'     : 'border-sky-200',     bg: darkMode ? 'bg-sky-950/20'    : 'bg-sky-50',     dot: 'bg-sky-400',     text: darkMode ? 'text-sky-300'   : 'text-sky-700',     sub: darkMode ? 'text-sky-400/80'   : 'text-sky-600/80' },
              violet:  { border: darkMode ? 'border-violet-800'  : 'border-violet-200',  bg: darkMode ? 'bg-violet-950/20' : 'bg-violet-50',  dot: 'bg-violet-500',  text: darkMode ? 'text-violet-300': 'text-violet-700',  sub: darkMode ? 'text-violet-400/80': 'text-violet-600/80' },
              rose:    { border: darkMode ? 'border-rose-900'    : 'border-rose-200',    bg: darkMode ? 'bg-rose-950/20'   : 'bg-rose-50',    dot: 'bg-rose-500',    text: darkMode ? 'text-rose-300'  : 'text-rose-700',    sub: darkMode ? 'text-rose-400/80'  : 'text-rose-600/80' },
              emerald: { border: darkMode ? 'border-emerald-900' : 'border-emerald-200', bg: darkMode ? 'bg-emerald-950/20': 'bg-emerald-50', dot: 'bg-emerald-500', text: darkMode ? 'text-emerald-300': 'text-emerald-700', sub: darkMode ? 'text-emerald-400/80': 'text-emerald-600/80' },
            };

            return (
              <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-white'}`}>
                {alerts.length === 0 ? (
                  <div className="px-4 py-3 text-center">
                    <span className={`text-[11px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{market === 'de' ? 'Willkommen bei Pharmagister' : 'Üdvözöl a Pharmagister'}</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {alerts.map(alert => {
                      const c = colorMap[alert.color] || colorMap.blue;
                      return (
                        <button
                          key={alert.key}
                          type="button"
                          onClick={alert.onClick}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40 ${c.bg}`}
                        >
                          <span className={`flex-shrink-0 h-2 w-2 rounded-full ${c.dot}`} />
                          <span className="text-lg leading-none flex-shrink-0">{alert.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold leading-tight ${c.text}`}>{alert.label}</p>
                            {alert.sub && <p className={`text-xs mt-0.5 truncate ${c.sub}`}>{alert.sub}</p>}
                          </div>
                          <span className={`text-base flex-shrink-0 ${c.text}`}>›</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Full-screen pharmacy schedule calendar ─────────────────── */}
          {isPharmacy && mainTab === 'schedule' ? (
            <div className="space-y-4">

              {/* ── Dashboard: hónap navigáció + info egy kártyában ── */}
              {(() => {
                const totalDays = getDaysInMonth(year, month);
                const filledDays = new Set(activeMonthSchedules.filter(s => s.year === year && s.month === month).map(s => s.date)).size;
                const pendingPrefs = schedulePreferences.filter(p => p.year === year && p.month === month && p.status !== 'deleted' && p.publishedAt).length;
                const ignoredPrefs = schedulePreferences.filter(p => {
                  if (p.year !== year || p.month !== month || p.status === 'deleted' || !p.publishedAt) return false;
                  if (isOffShift(p.shiftType)) return false;
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
                      <span className={`font-bold text-base ${darkMode ? 'text-white' : 'text-violet-800'}`}>{(market === 'de' ? MONTHS_DE : MONTHS_HU)[month - 1]} {year}</span>
                      <button type="button" onClick={goNext} className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold text-xl ${darkMode ? 'bg-violet-800/60 text-violet-200 hover:bg-violet-700' : 'bg-white text-violet-600 hover:bg-violet-50 shadow-sm border border-violet-200'}`}>›</button>
                    </div>
                    {/* Info adatok */}
                    <div className="p-4 flex flex-wrap gap-x-5 gap-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👥</span>
                        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{activeEmployees.length} {market === 'de' ? 'Mitarbeitende' : 'dolgozó'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📅</span>
                        <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{filledDays}/{totalDays} {market === 'de' ? 'Tage ausgefuellt' : 'nap kitöltve'}</span>
                      </div>
                      {ignoredPrefs > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span className="text-sm font-semibold text-amber-600">{market === 'de' ? `${ignoredPrefs} Praeferenzen ignoriert` : `${ignoredPrefs} preferencia figyelmen kívül`}</span>
                        </div>
                      )}
                      {pendingPrefs > 0 && ignoredPrefs === 0 && (
                        <button
                          type="button"
                          onClick={() => setMainTab('workers')}
                          className="flex items-center gap-2 text-left"
                        >
                          <span className="text-lg">💬</span>
                          <span className={`text-sm font-semibold underline underline-offset-2 ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{market === 'de' ? `${pendingPrefs} Mitarbeitenden-Wuensche →` : `${pendingPrefs} dolgozói kérés →`}</span>
                        </button>
                      )}
                      {currentMonthDraftPublishSummary.missingCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span className="text-sm font-semibold text-amber-600">
                            {market === 'de'
                              ? `${currentMonthDraftPublishSummary.missingCount} Mitarbeitenden-Entwuerfe sind noch nicht veroeffentlicht`
                              : `${currentMonthDraftPublishSummary.missingCount} dolgozó tervezete még nincs publikálva`}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {isPublished
                          ? <><span className="text-lg">✅</span><span className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{market === 'de' ? `Veroeffentlicht (${publishedScheduleCount})` : `Publikálva (${publishedScheduleCount})`}</span></>
                          : <><span className="text-lg">🔒</span><span className="text-sm font-semibold text-rose-500">{market === 'de' ? 'Noch nicht veroeffentlicht' : 'Még nem publikált'}</span></>
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
                        <span>{market === 'de' ? '⚙️ Basiskriterien fuer den Dienstplan' : '⚙️ Beosztási alapkritériumok'}</span>
                        <span className="text-base">›</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Onboarding checklist (csak ha nincs dolgozó) ─────── */}
              {activeEmployees.length === 0 && (
                <div className={`rounded-2xl border-2 border-dashed p-5 space-y-3 ${darkMode ? 'border-violet-700 bg-violet-900/10' : 'border-violet-300 bg-violet-50'}`}>
                  <p className={`font-bold text-base ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>{market === 'de' ? '🚀 Starte mit deinem Dienstplan!' : '🚀 Kezdj el beosztást írni!'}</p>
                  <div className="space-y-2">
                    {[
                      { done: activeEmployees.length > 0, label: market === 'de' ? 'Fuege mindestens eine/n Mitarbeitende/n hinzu' : 'Adj hozzá legalább egy dolgozót' },
                      { done: activeMonthSchedules.length > 0, label: market === 'de' ? 'Erstelle einen Dienstplan (klicke auf einen Monat)' : 'Írj meg egy beosztást (kattints egy hónapra)' },
                      { done: publishedScheduleCount > 0, label: market === 'de' ? 'Veroeffentliche den Dienstplan (dann sehen ihn die Mitarbeitenden)' : 'Publikáld a beosztást (a dolgozók ekkor látják)' },
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
                const ignoredPrefsArray = schedulePreferences.filter(p => {
                  if (p.year !== year || p.month !== month || p.status === 'deleted' || !p.publishedAt) return false;
                  if (isOffShift(p.shiftType)) return false;
                  return !activeMonthSchedules.some(s => s.date === p.date && (s.employeeId === p.employeeId || s.linkedUserId === p.linkedUserId));
                });
                const ignoredPrefs = ignoredPrefsArray.length;
                if (activeEmployees.length > 0 && filledDays === 0)
                  hints.push(market === 'de' ? '💡 Klicke auf den Monatsnamen, um den Dienstplan zu starten' : '💡 Kattints a hónap nevére a beosztás elkezdéséhez');
                if (currentMonthDraftPublishSummary.missingCount > 0) {
                  const names = currentMonthDraftPublishSummary.missingEmployees
                    .slice(0, 3)
                    .map((item) => item.name)
                    .filter(Boolean)
                    .join(', ');
                  hints.push(
                    market === 'de'
                      ? `⚠️ Aktueller Monatsentwurf ist noch nicht veroeffentlicht: ${names || 'mehrere Mitarbeitende'}${currentMonthDraftPublishSummary.missingCount > 3 ? ' usw.' : ''}`
                      : `⚠️ Aktuális havi tervezet még nincs publikálva: ${names || 'tobb dolgozo'}${currentMonthDraftPublishSummary.missingCount > 3 ? ' stb.' : ''}`
                  );
                }
                if (year === thisYear && month === thisMonth && daysLeft < 5 && publishedScheduleCount === 0 && activeMonthSchedules.length > 0)
                  hints.push(market === 'de' ? '⏰ Der Monat endet bald - vergiss nicht, den Dienstplan zu veroeffentlichen!' : '⏰ Hamarosan véget ér a hónap — ne feledd publikálni a beosztást!');
                const hasHints = hints.length > 0 || ignoredPrefs > 0;
                if (!hasHints) return null;
                return (
                  <div className="space-y-2">
                    {hints.map((hint, i) => (
                      <div key={i} className={`rounded-xl px-4 py-2.5 text-sm ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{hint}</div>
                    ))}
                    {ignoredPrefs > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowIgnoredPrefsPanel(v => !v)}
                          className={`w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-all ${darkMode ? 'bg-amber-900/30 text-amber-300 hover:bg-amber-900/50' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                        >
                          <span>{market === 'de' ? `💬 ${ignoredPrefs} Mitarbeitenden-Wuensche hast du noch nicht beruecksichtigt` : `💬 ${ignoredPrefs} dolgozói kérés van, amit még nem vettél figyelembe`}</span>
                          <span className="ml-2 opacity-70 text-xs">{showIgnoredPrefsPanel ? (market === 'de' ? '▲ Schliessen' : '▲ Bezár') : (market === 'de' ? '▼ Anzeigen' : '▼ Mutat')}</span>
                        </button>
                        {showIgnoredPrefsPanel && (
                          <div className={`mt-1 rounded-xl border overflow-hidden ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                            {ignoredPrefsArray.map((p, i) => {
                              const empName = p.employeeName || activeEmployees.find(e => e.id === p.employeeId)?.name || 'Ismeretlen';
                              const dt = new Date(`${p.date}T00:00:00`);
                              const dateLabel = dt.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' });
                              const shiftLabel = p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : getShiftType(p.shiftType || 'N', market).title;
                              const isLocking = lockingPrefId === p.id;
                              return (
                                <div key={p.id || i} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? (darkMode ? 'border-t border-amber-800' : 'border-t border-amber-200') : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold truncate ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>{empName}</p>
                                    <p className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{dateLabel} · {shiftLabel}</p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isLocking}
                                    onClick={() => handleLockPreference(p)}
                                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${darkMode ? 'bg-amber-700 text-amber-100 hover:bg-amber-600 disabled:opacity-50' : 'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50'}`}
                                  >
                                    {isLocking ? '...' : (market === 'de' ? '📌 Fixieren' : '📌 Rögzítés')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Month picker ─────────────────────────────────────── */}
              {(() => {
                return (
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{thisYear}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(market === 'de' ? MONTHS_DE : MONTHS_HU).map((label, i) => {
                        const m = i + 1;
                        const isActive = year === thisYear && m === month;
                        const isCurrentMonth = m === thisMonth;
                        const isPast = m < thisMonth;
                        const monthScheds = allYearSchedules.filter(s => s.status !== 'deleted' && s.year === thisYear && s.month === m);
                        const hasPublished = monthScheds.some(s => isPublishedSchedule(s));

                        let bgClass, textClass, badgeClass;
                        if (hasPublished) {
                          bgClass = darkMode ? 'bg-emerald-900/50 border-emerald-700' : 'bg-emerald-100 border-emerald-300';
                          textClass = darkMode ? 'text-emerald-200' : 'text-emerald-800';
                          badgeClass = darkMode ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-200 text-emerald-700';
                        } else if (isPast) {
                          bgClass = darkMode ? 'bg-orange-900/40 border-orange-700' : 'bg-orange-100 border-orange-300';
                          textClass = darkMode ? 'text-orange-200' : 'text-orange-800';
                          badgeClass = darkMode ? 'bg-orange-800 text-orange-200' : 'bg-orange-200 text-orange-700';
                        } else {
                          bgClass = darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300';
                          textClass = darkMode ? 'text-gray-300' : 'text-gray-600';
                          badgeClass = darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600';
                        }

                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setYear(thisYear); setMonth(m); setCalendarOpen(true); }}
                            className={[
                              'flex flex-col items-center justify-center rounded-2xl px-2 transition-all',
                              'h-16',
                              isCurrentMonth ? 'border-[3px] border-blue-500 shadow-md shadow-blue-100' : 'border-2',
                              bgClass,
                              isActive && !isCurrentMonth ? 'ring-2 ring-offset-1 ring-violet-400' : '',
                            ].join(' ')}
                          >
                            <span className={`font-bold text-sm whitespace-nowrap ${textClass}`}>{label}</span>
                            {hasPublished && (
                              <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${badgeClass}`}>
                                {market === 'de' ? 'Veroeffentlicht' : 'Publikálva'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Pending vacation + swap panels */}
              {pendingVacationRequests.length > 0 ? (
                <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#6B46C1]" />
                    <h3 className="text-lg font-semibold">{market === 'de' ? 'Offene Urlaubsanfragen' : 'Függő szabadságigények'}</h3>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{pendingVacationRequests.length}</span>
                  </div>
                  {pendingVacationRequests.map(item => (
                    <div key={item.id} className="border-b py-2 last:border-b-0 border-gray-200 dark:border-gray-700">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-sm text-gray-500">{item.startDate} - {item.endDate}</p>
                      {item.reason ? <p className="mt-1 text-sm">{item.reason}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">
                          <CheckCircle2 className="h-4 w-4" />{market === 'de' ? 'Genehmigen' : 'Jóváhagyás'}
                        </button>
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white">
                          <XCircle className="h-4 w-4" />{market === 'de' ? 'Ablehnen' : 'Elutasítás'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {swapRequests.filter(r => r.status === 'pending').length > 0 && (
                <div id="pharmacy-swaps-panel" className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-blue-900 bg-blue-950/20' : 'border-blue-100 bg-blue-50'}`}>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-blue-500" />
                    <h3 className={`text-base font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{market === 'de' ? 'Laufende Tauschanfragen' : 'Folyamatban lévő csereigények'}</h3>
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'pending').length}</span>
                  </div>
                  <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>{market === 'de' ? 'Bei diesen Tauschanfragen wird noch auf die Antwort der anderen Person gewartet. Die Freigabeoption erscheint nach deren Annahme.' : 'Ezekre a cserékre még vár a másik dolgozó válasza. Jóváhagyási lehetőség az elfogadás után jelenik meg.'}</p>
                  <div className="space-y-2">
                    {swapRequests.filter(r => r.status === 'pending').map(item => {
                      const rd = item.requesterScheduleDate || item.date || '?';
                      const td = item.targetScheduleDate || item.targetDate || '?';
                      return (
                        <div key={item.id} className={`rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-gray-700 bg-gray-800/60 text-gray-300' : 'border-blue-100 bg-white text-gray-700'}`}>
                          {market === 'de'
                            ? <><span className="font-semibold">{item.requesterName}</span> hat einen Tausch mit <span className="font-semibold">{item.targetName}</span> angefragt — <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{rd}</span> ↔ <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{td}</span></>
                            : <><span className="font-semibold">{item.requesterName}</span> cseret kért <span className="font-semibold">{item.targetName}</span>-tól — <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{rd}</span> ↔ <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{td}</span></>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {swapRequests.filter(r => r.status === 'employee_accepted').length > 0 && (
                <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                    <h3 className="text-lg font-semibold">{market === 'de' ? 'Tauschanfragen - warten auf Freigabe' : 'Csereigények – jóváhagyásra várnak'}</h3>
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'employee_accepted').length}</span>
                  </div>
                  <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>{market === 'de' ? 'Beide Mitarbeitende haben zugestimmt - fuer die tatsaechliche Ausfuehrung ist jetzt Ihre Freigabe erforderlich.' : 'Mindkét dolgozó elfogadta — az Ön jóváhagyása szükséges a tényleges csere végrehajtásához.'}</p>
                  <div className="space-y-3">
                    {swapRequests.filter(r => r.status === 'employee_accepted').map(item => {
                      const rd = item.requesterScheduleDate || item.date || '?';
                      const td = item.targetScheduleDate || item.targetDate || '?';
                      return (
                        <div key={item.id} className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                          <p className="font-semibold text-sm mb-1">
                            {market === 'de'
                              ? <><span>{item.requesterName}</span> hat einen Tausch mit <span>{item.targetName}</span> angefragt</>
                              : <><span>{item.requesterName}</span> cseret kért <span>{item.targetName}</span>-tól</>}
                          </p>
                          <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.requesterName?.split(' ').pop()} {rd} ↔ {item.targetName?.split(' ').pop()} {td}
                          </p>
                          <div className="flex gap-2">
                            <button type="button" disabled={saving} onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'accepted')} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                              <CheckCircle2 className="h-4 w-4" />{market === 'de' ? 'Ich genehmige' : 'Jóváhagyom'}
                            </button>
                            <button type="button" disabled={saving} onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'rejected')} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                              <XCircle className="h-4 w-4" />{market === 'de' ? 'Ich lehne ab' : 'Elutasítom'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                  onDeleteMonth={handleDeleteMonth}
                  onPublishChanges={handlePublishSwapChanges}
                  swapLog={swapLog}
                  setSwapLog={setSwapLog}
                  showSwapLog={showSwapLog}
                  setShowSwapLog={setShowSwapLog}
                  activeMonthSchedules={activeMonthSchedules}
                  publishedScheduleCount={publishedScheduleCount}
                  config={normalizePlanningConfig(plannerConfigForm)}
                  onAutoGenerate={handleAutoGenerateAndApply}
                  plannerLoading={plannerLoading}
                  applyingPlanner={applyingPlanner}
                  market={market}
                />
              )}
            </div>
          ) : null}

          {/* ── Old month/day selectors + calendar (shown for history and employee views) ── */}
          {!(isPharmacy && mainTab === 'schedule') && !(!isPharmacy && (mainTab === 'mine' || mainTab === 'preferences' || mainTab === 'planner' || mainTab === 'swaps' || mainTab === 'vacations')) ? (
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
              market={market}
            />
          </div>
          ) : null}

          {false && isPharmacy && mainTab === 'schedule' ? (
            <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
              <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{market === 'de' ? `Dienstplan bearbeiten - ${selectedDate}` : `Beosztás írása - ${selectedDate}`}</h3>
                    <p className="text-sm text-gray-500">{market === 'de' ? 'Einfache, tagesbasierte Dienstplanverwaltung per Klick.' : 'Egyszerű, napra kattintós beosztáskezelés.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleCopyPreviousMonth} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                      <Copy className="h-4 w-4" />
                      {market === 'de' ? 'Vormonat kopieren' : 'Előző hónap másolása'}
                    </button>
                    <button type="button" onClick={handleExportSchedules} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                      <Download className="h-4 w-4" />
                      {market === 'de' ? 'CSV-Export' : 'CSV export'}
                    </button>
                    <button type="button" onClick={handlePublishSchedules} disabled={saving || activeMonthSchedules.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                      <Send className="h-4 w-4" />
                      {market === 'de' ? 'Veroeffentlichen' : 'Publikálás'}
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
                  {market === 'de'
                    ? `In diesem Monat gibt es ${activeMonthSchedules.length} aktive Dienste, davon ${publishedScheduleCount} veroeffentlicht.`
                    : `Ebben a hónapban ${activeMonthSchedules.length} aktív műszak van, ebből ${publishedScheduleCount} publikált.`}
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
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Wochenenden' : 'Hétvégék'}: <strong>{plannerResult.stats.summary.totalWeekendShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Sonntage' : 'Vasárnapok'}: <strong>{plannerResult.stats.summary.totalSundayShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Feiertage' : 'Munkaszüneti napok'}: <strong>{plannerResult.stats.summary.totalPublicHolidayShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Nachtschichten' : 'Éjszakák'}: <strong>{plannerResult.stats.summary.totalNightShifts || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Sonntagszuschlag-Stunden*' : 'Vasárnapi pótlék órák*'}: <strong>{Number(plannerResult.stats.summary.totalEstimatedSundayPremiumHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Feiertagszuschlag-Stunden*' : 'Ünnepnapi pótlék órák*'}: <strong>{Number(plannerResult.stats.summary.totalEstimatedHolidayPremiumHours || 0).toFixed(1)}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Urlaubstage' : 'Szabadságok'}: <strong>{plannerResult.stats.summary.totalVacationDays || 0}</strong></div>
                          <div className="rounded bg-white/80 px-2 py-1 dark:bg-gray-800">{market === 'de' ? 'Abwesenheiten' : 'Hiányzások'}: <strong>{plannerResult.stats.summary.totalAbsences || 0}</strong></div>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">{market === 'de' ? '* Hinweiswert zur Plausibilitaetspruefung der Abrechnung, keine automatische Lohnabrechnung.' : '* Tájékoztató mutató a bérszámfejtés ellenőrzéséhez, nem minősül automatikus bérszámításnak.'}</p>
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
                      value={selectedEmployee ? prettyRole(selectedEmployee.role, market) : '-'}
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
                      <p className="text-sm text-gray-500">{prettyRole(item.role, market)}</p>
                      {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
                    </div>
                    <button type="button" onClick={() => handleDeleteSchedule(item.id)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                      <Trash2 className="h-4 w-4" />
                      {isPublishedSchedule(item) ? 'Visszavonás' : 'Törlés'}
                    </button>
                  </div>
                ))}

                <div className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#6B46C1]" />
                    <h4 className="font-semibold">{market === 'de' ? 'Offene Urlaubsanfragen' : 'Függő szabadságigények'}</h4>
                  </div>
                  {pendingVacationRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">{market === 'de' ? 'Keine offenen Urlaubsanfragen.' : 'Nincs függő szabadságigény.'}</p>
                  ) : pendingVacationRequests.map(item => (
                    <div key={item.id} className="border-b py-2 last:border-b-0 border-gray-200 dark:border-gray-700">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-sm text-gray-500">{item.startDate} - {item.endDate}</p>
                      {item.reason ? <p className="mt-1 text-sm">{item.reason}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">
                          <CheckCircle2 className="h-4 w-4" />
                          {market === 'de' ? 'Genehmigen' : 'Jóváhagyás'}
                        </button>
                        <button type="button" onClick={() => handleRespondToVacationRequest(item.id, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white">
                          <XCircle className="h-4 w-4" />
                          {market === 'de' ? 'Ablehnen' : 'Elutasítás'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pharmacy swap panels */}
            {swapRequests.filter(r => r.status === 'pending').length > 0 && (
              <div className={`rounded-2xl border p-5 space-y-3 mt-6 ${darkMode ? 'border-blue-900 bg-blue-950/20' : 'border-blue-100 bg-blue-50'}`}>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-blue-500" />
                  <h3 className={`text-base font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{market === 'de' ? 'Laufende Tauschanfragen' : 'Folyamatban lévő csereigények'}</h3>
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'pending').length}</span>
                </div>
                <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>{market === 'de' ? 'Bei diesen Tauschanfragen wird noch auf die Antwort der anderen Person gewartet. Die Freigabeoption erscheint nach deren Annahme.' : 'Ezekre a cserékre még vár a másik dolgozó válasza. Jóváhagyási lehetőség az elfogadás után jelenik meg.'}</p>
                <div className="space-y-2">
                  {swapRequests.filter(r => r.status === 'pending').map(item => {
                    const rd = item.requesterScheduleDate || item.date || '?';
                    const td = item.targetScheduleDate || item.targetDate || '?';
                    return (
                      <div key={item.id} className={`rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-gray-700 bg-gray-800/60 text-gray-300' : 'border-blue-100 bg-white text-gray-700'}`}>
                        {market === 'de'
                          ? <><span className="font-semibold">{item.requesterName}</span> hat einen Tausch mit <span className="font-semibold">{item.targetName}</span> angefragt — <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{rd}</span> ↔ <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{td}</span></>
                          : <><span className="font-semibold">{item.requesterName}</span> cseret kért <span className="font-semibold">{item.targetName}</span>-tól — <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{rd}</span> ↔ <span className={darkMode ? 'text-blue-300' : 'text-blue-600'}>{td}</span></>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {swapRequests.filter(r => r.status === 'employee_accepted').length > 0 && (
              <div className={`rounded-2xl border p-5 space-y-4 mt-6 ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">{market === 'de' ? 'Tauschanfragen - warten auf Freigabe' : 'Csereigények – jóváhagyásra várnak'}</h3>
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{swapRequests.filter(r => r.status === 'employee_accepted').length}</span>
                </div>
                <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>{market === 'de' ? 'Beide Mitarbeitende haben zugestimmt - fuer die tatsaechliche Ausfuehrung ist jetzt Ihre Freigabe erforderlich.' : 'Mindkét dolgozó elfogadta — az Ön jóváhagyása szükséges a tényleges csere végrehajtásához.'}</p>
                <div className="space-y-3">
                  {swapRequests.filter(r => r.status === 'employee_accepted').map(item => {
                    const rd = item.requesterScheduleDate || item.date || '?';
                    const td = item.targetScheduleDate || item.targetDate || '?';
                    return (
                      <div key={item.id} className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                        <p className="font-semibold text-sm mb-1">
                          {market === 'de'
                            ? <><span>{item.requesterName}</span> hat einen Tausch mit <span>{item.targetName}</span> angefragt</>
                            : <><span>{item.requesterName}</span> cseret kért <span>{item.targetName}</span>-tól</>}
                        </p>
                        <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.requesterName?.split(' ').pop()} {rd} ↔ {item.targetName?.split(' ').pop()} {td}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'accepted')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {market === 'de' ? 'Ich genehmige' : 'Jóváhagyom'}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePharmacyRespondToSwapRequest(item.id, 'rejected')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" />
                            {market === 'de' ? 'Ich lehne ab' : 'Elutasítom'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  activeMonthSchedules={activeMonthSchedules}
                  publishedScheduleCount={publishedScheduleCount}
                  config={normalizePlanningConfig(plannerConfigForm)}
                  market={market}
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
                    <p className={`text-sm font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>{market === 'de' ? 'Deine Basisdaten fehlen' : 'Az alap adataid hiányoznak'}</p>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-amber-400/80' : 'text-amber-700/80'}`}>{market === 'de' ? 'Fuer die Berechnung der Urlaubstage und die volle Dienstplan-Funktion gib bitte deine Daten an.' : 'A szabadságnapok kiszámításához és a beosztás-tervező teljes funkcionalitásához add meg az adataidat.'}</p>
                  </div>
                  <button type="button" onClick={() => { setMainTab('preferences'); setShowProfileForm(true); }} className="flex-shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">{market === 'de' ? 'Jetzt angeben' : 'Megadom'}</button>
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

              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr,0.95fr] gap-4">
                <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Saját beosztás kiemelve</h3>
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{MONTHS_HU[month - 1]} {year}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`inline-flex rounded-xl border p-0.5 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}>
                        <button
                          type="button"
                          onClick={() => setEmployeeCalendarView('own')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${employeeCalendarView === 'own' ? 'bg-[#6B46C1] text-white' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-white'}`}
                        >Saját</button>
                        <button
                          type="button"
                          onClick={() => setEmployeeCalendarView('all')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${employeeCalendarView === 'all' ? 'bg-[#6B46C1] text-white' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-white'}`}
                        >Összes</button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalendarOpen(true)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >Teljes nézet</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = getPreviousMonth(year, month);
                        setYear(prev.year);
                        setMonth(prev.month);
                      }}
                      className={`h-9 w-9 rounded-xl text-lg font-bold ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >‹</button>
                    <div className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{MONTHS_HU[month - 1]} {year}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
                        setYear(next.year);
                        setMonth(next.month);
                      }}
                      className={`h-9 w-9 rounded-xl text-lg font-bold ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >›</button>
                  </div>
                  <MonthCalendar
                    year={year}
                    month={month}
                    selectedDate={selectedDate}
                    schedules={publishedEmployeeSchedules}
                    ownScheduleIds={ownScheduleIds}
                    onSelectDate={(dateKey) => {
                      const [, nextMonth, nextDay] = dateKey.split('-').map(Number);
                      setMonth(nextMonth);
                      setDay(nextDay);
                    }}
                    darkMode={darkMode}
                    filterOwn={employeeCalendarView === 'own'}
                    pendingSwapRequests={swapRequests.filter(r => r.targetUserId === user?.uid && r.status === 'pending')}
                    onOpenSwaps={() => setMainTab('swaps')}
                    market={market}
                  />
                </div>

                <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Kiválasztott nap</h3>
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{selectedDate}</span>
                  </div>
                  {selectedEmployeeDateSchedules.length === 0 ? (
                    <p className={`text-sm py-6 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Erre a napra nincs publikált beosztás.</p>
                  ) : selectedEmployeeDateSchedules.map(item => {
                    const isOwn = ownScheduleIds.has(item.id);
                    const isSwapOpen = quickSwapScheduleId === item.id;
                    const swapCandidates = isOwn && isSwapOpen ? getSwapCandidatesForSchedule(item.id) : [];
                    const hasOpenSwap = swapRequests.some(r =>
                      (r.requesterScheduleId === item.id || r.targetScheduleId === item.id) &&
                      (r.status === 'pending' || r.status === 'employee_accepted')
                    );
                    return (
                      <div key={item.id} className={`rounded-xl border p-4 space-y-3 ${isOwn ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : darkMode ? 'border-gray-700 bg-gray-800' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.employeeName}</p>
                            <p className="text-sm text-gray-500">{item.startTime} - {item.endTime}</p>
                            {item.notes ? <p className="text-sm text-gray-500 mt-0.5">{item.notes}</p> : null}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {isOwn ? <span className="rounded-full bg-green-600 px-2 py-1 text-xs font-semibold text-white">Saját</span> : null}
                            {isOwn && !hasOpenSwap && item.date >= today ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSwapOpen) { setQuickSwapScheduleId(null); setQuickSwapMessage(''); }
                                  else { setQuickSwapScheduleId(item.id); setQuickSwapMessage(''); }
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-[#6B46C1] px-2 py-1 text-xs font-semibold text-[#6B46C1] hover:bg-[#6B46C1]/10"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                {isSwapOpen ? (market === 'de' ? 'Abbrechen' : 'Mégse') : (market === 'de' ? 'Tausch anfragen' : 'Csere kérése')}
                              </button>
                            ) : null}
                            {isOwn && hasOpenSwap ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{market === 'de' ? 'Tausch in Bearbeitung' : 'Csere folyamatban'}</span>
                            ) : null}
                          </div>
                        </div>

                        {isOwn && isSwapOpen ? (
                          <div className={`rounded-xl border p-3 space-y-3 ${darkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                            <p className="text-sm font-semibold">Kivel cserélnél?</p>
                            {swapCandidates.length === 0 ? (
                              <p className="text-sm text-gray-500">Ezen a napon nincs más beosztott dolgozó, akivel cserét kezdeményezhetnél.</p>
                            ) : (
                              <div className="space-y-2">
                                {swapCandidates.map(candidate => (
                                  <div key={candidate.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
                                    <div>
                                      <p className="text-sm font-medium">{candidate.employeeName}</p>
                                      <p className="text-xs text-gray-500">{candidate.startTime}–{candidate.endTime}</p>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => handleQuickSwapRequest(item.id, candidate.id, quickSwapMessage)}
                                      className="rounded-xl bg-[#6B46C1] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      {market === 'de' ? 'Tausch anfragen' : 'Csere kérése'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-500">{market === 'de' ? 'Nachricht (optional)' : 'Üzenet (opcionális)'}</p>
                              <textarea
                                value={quickSwapMessage}
                                onChange={e => setQuickSwapMessage(e.target.value)}
                                rows={2}
                                className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                                placeholder="Pl. Nekem erre a napra egyéb kötelezettségem van."
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {availableYears.map(y => {
                const startM = 1;
                const endM = 12;
                const months = MONTHS_HU.slice(startM - 1, endM).map((label, i) => ({ label, m: startM + i }));
                const publishedMonths = months.filter(({ m }) =>
                  schedules.some(s => s.status !== 'deleted' && s.year === y && s.month === m && Boolean(s.publishedAt))
                );
                if (publishedMonths.length === 0) return null;
                return (
                  <div key={y}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {months.map(({ label, m }) => {
                        const isActive = y === year && m === month && calendarOpen;
                        const monthScheds = schedules.filter(s => s.status !== 'deleted' && s.year === y && s.month === m && Boolean(s.publishedAt));
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
                  schedules={schedules.filter(s => s.status !== 'deleted' && Boolean(s.publishedAt))}
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
                  activeMonthSchedules={schedules.filter(s => s.status !== 'deleted' && Boolean(s.publishedAt) && s.year === year && s.month === month).length}
                  publishedScheduleCount={0}
                  readOnly={true}
                  initialOwnView={employeeCalendarView === 'own'}
                  ownScheduleIds={ownScheduleIds}
                  pendingSwapRequests={swapRequests.filter(r => r.targetUserId === user?.uid && r.status === 'pending')}
                  onOpenSwaps={() => setMainTab('swaps')}
                  swapLog={[]}
                  setSwapLog={() => {}}
                  showSwapLog={false}
                  setShowSwapLog={() => {}}
                  onPublishChanges={() => {}}
                  onAutoFix={() => {}}
                  onDeleteMonth={() => {}}
                  market={market}
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
                      <span>📅</span> {market === 'de' ? 'Dienstplan-Entwurf' : 'Beosztás-tervezet'}
                    </h3>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-emerald-300/70' : 'text-emerald-700/80'}`}>
                      {market === 'de'
                        ? 'Gib an, wann du arbeiten moechtest. Der Entwurf ist fuer die Apotheke und Kolleg/innen sichtbar.'
                        : 'Add meg, hogy mikor szeretnél dolgozni. A tervezet látható lesz a gyógyszertár számára és a kollégáknak is.'}
                    </p>
                  </div>
                  <div className={`rounded-xl border px-3 py-3 ${darkMode ? 'border-emerald-800 bg-emerald-900/30' : 'border-emerald-200 bg-white/80'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>
                          {(market === 'de' ? MONTHS_DE[month - 1] : MONTHS_HU[month - 1])} {year} {market === 'de' ? '- Veroeffentlichung' : '- publikáció'}
                        </p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-emerald-300/80' : 'text-emerald-700/80'}`}>
                          {ownSelectedMonthDraftSummary.total === 0
                            ? (market === 'de' ? 'Es gibt noch keinen gespeicherten Entwurf fuer diesen Monat.' : 'Még nincs mentett tervezet erre a hónapra.')
                            : ownSelectedMonthDraftSummary.fullyPublished
                              ? (market === 'de'
                                ? `Veroeffentlicht (${ownSelectedMonthDraftSummary.published}/${ownSelectedMonthDraftSummary.total} Tage).`
                                : `Publikálva (${ownSelectedMonthDraftSummary.published}/${ownSelectedMonthDraftSummary.total} nap).`)
                              : (market === 'de'
                                ? `Noch nicht vollstaendig veroeffentlicht (${ownSelectedMonthDraftSummary.published}/${ownSelectedMonthDraftSummary.total} Tage).`
                                : `Még nincs teljesen publikálva (${ownSelectedMonthDraftSummary.published}/${ownSelectedMonthDraftSummary.total} nap).`)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={saving || ownSelectedMonthDraftSummary.total === 0}
                        onClick={() => { void handlePublishPreferenceDraftMonth(year, month); }}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          darkMode
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {saving ? (market === 'de' ? 'Veroeffentlichen...' : 'Publikálás...') : (market === 'de' ? 'Entwurf veroeffentlichen' : 'Tervezet publikálása')}
                      </button>
                    </div>
                  </div>
                  {[thisYear, thisYear + 1].map(y => {
                    const startM = y === thisYear ? thisMonth : 1;
                    const monthLabels = market === 'de' ? MONTHS_DE : MONTHS_HU;
                    const months = monthLabels.slice(startM - 1).map((label, i) => ({ label, m: startM + i }));
                    return (
                      <div key={y}>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{y}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {months.map(({ label, m }) => {
                            const isActive = y === year && m === month && preferenceCalendarOpen;
                            const myPrefs = schedulePreferences.filter(p =>
                              p.status !== 'deleted' && p.year === y && p.month === m &&
                              ownPreferenceMatcher(p)
                            );
                            const myPublishedPrefs = myPrefs.filter((p) => Boolean(p.publishedAt)).length;
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
                                    {myPrefs.length} {market === 'de' ? 'geplante Tage' : 'tervezett nap'}
                                  </span>
                                )}
                                {myPrefs.length > 0 && (
                                  <span className={`mt-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                                    myPublishedPrefs === myPrefs.length
                                      ? (isActive ? 'bg-white/25 text-white' : darkMode ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-700')
                                      : (isActive ? 'bg-white/20 text-white' : darkMode ? 'bg-amber-900/50 text-amber-200' : 'bg-amber-100 text-amber-700')
                                  }`}>
                                    {myPublishedPrefs}/{myPrefs.length} {market === 'de' ? 'veroeffentlicht' : 'publikalva'}
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
                      onPublish={() => handlePublishPreferenceDraftMonth(year, month)}
                      market={market}
                    />
                  )}
                </div>
              ) : (
                <p className={`text-sm text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Nincs hozzárendelt dolgozói profil.</p>
              )}
            </div>
          ) : null}

          {/* ── Cserék panel (alkalmazott) ── */}
          {!isPharmacy && mainTab === 'swaps' ? (() => {
            const incoming = swapRequests.filter(r => r.targetUserId === user?.uid && r.status === 'pending');
            const outgoing = swapRequests.filter(r => r.requesterUserId === user?.uid);
            const awaitingPharmacy = swapRequests.filter(r =>
              (r.requesterUserId === user?.uid || r.targetUserId === user?.uid) && r.status === 'employee_accepted'
            );
            const done = swapRequests.filter(r =>
              (r.requesterUserId === user?.uid || r.targetUserId === user?.uid) &&
              (r.status === 'accepted' || r.status === 'rejected' || r.status === 'rejected_by_pharmacy')
            );

            const statusLabel = (s) => {
              if (s === 'pending') return { text: market === 'de' ? 'Wartet' : 'Várakozik', color: 'text-amber-600' };
              if (s === 'employee_accepted') return { text: market === 'de' ? 'Apothekenfreigabe erforderlich' : 'Gyógyszertár jóváhagyása szükséges', color: 'text-blue-600' };
              if (s === 'accepted') return { text: market === 'de' ? 'Angenommen ✓' : 'Elfogadva ✓', color: 'text-green-600' };
              if (s === 'rejected') return { text: market === 'de' ? 'Abgelehnt' : 'Elutasítva', color: 'text-rose-600' };
              if (s === 'rejected_by_pharmacy') return { text: market === 'de' ? 'Von Apotheke abgelehnt' : 'Gyógyszertár elutasította', color: 'text-rose-600' };
              return { text: s, color: 'text-gray-500' };
            };

            const SwapCard = ({ item, actions }) => (
              <div className={`rounded-xl border p-4 space-y-2 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {item.requesterName} ↔ {item.targetName}
                    </p>
                    {/* Dátum blokk */}
                    <div className={`rounded-lg px-3 py-2 space-y-1 text-xs ${darkMode ? 'bg-gray-700/60' : 'bg-gray-50'}`}>
                      {(() => {
                        const rd = item.requesterScheduleDate || item.date;
                        const td = item.targetScheduleDate || item.targetDate;
                        const rf = item.requesterFrom || '';
                        const rt = item.requesterTo || '';
                        const tf = item.targetFrom || '';
                        const tt = item.targetTo || '';
                        return (<>
                          {rd && (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold min-w-[70px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.requesterName?.split(' ').pop()}:</span>
                              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                                {rd}{rf && rt ? ` ${rf}–${rt}` : ''}
                              </span>
                            </div>
                          )}
                          <div className="text-center text-base leading-none select-none">⇅</div>
                          {td && (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold min-w-[70px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item.targetName?.split(' ').pop()}:</span>
                              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                                {td}{tf && tt ? ` ${tf}–${tt}` : ''}
                              </span>
                            </div>
                          )}
                        </>);
                      })()}
                    </div>
                    {item.message ? (
                      <p className={`text-xs italic ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>„{item.message}"</p>
                    ) : null}
                    <p className={`text-xs font-medium ${statusLabel(item.status).color}`}>{statusLabel(item.status).text}</p>
                  </div>
                </div>
                {actions && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleRespondToSwapRequest(item.id, 'accepted')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />Elfogadom
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleRespondToSwapRequest(item.id, 'rejected')}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <XCircle className="h-4 w-4" />Most inkább nem
                    </button>
                  </div>
                )}
              </div>
            );

            return (
              <div className="space-y-5">
                {/* Beérkező csereigények */}
                <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-violet-600" />
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Eingehende Tauschanfragen' : 'Beérkező csereigények'}</h3>
                    {incoming.length > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">{incoming.length}</span>
                    )}
                  </div>
                  {incoming.length === 0 ? (
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'Keine eingehenden Tauschanfragen.' : 'Nincs beérkező csereigény.'}</p>
                  ) : (
                    <div className="space-y-3">
                      {incoming.map(item => <SwapCard key={item.id} item={item} actions={true} />)}
                    </div>
                  )}
                </div>

                {/* Gyógyszertár jóváhagyására váró */}
                {awaitingPharmacy.length > 0 && (
                  <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                      <h3 className={`font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>{market === 'de' ? 'Wartet auf Apothekenfreigabe' : 'Gyógyszertár jóváhagyására vár'}</h3>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{awaitingPharmacy.length}</span>
                    </div>
                    <div className="space-y-3">
                      {awaitingPharmacy.map(item => <SwapCard key={item.id} item={item} actions={false} />)}
                    </div>
                  </div>
                )}

                {/* Küldött csereigények */}
                <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-gray-500" />
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{market === 'de' ? 'Von mir gesendete Tauschanfragen' : 'Általam küldött csereigények'}</h3>
                  </div>
                  {outgoing.length === 0 ? (
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'Du hast noch keine Tauschanfrage gesendet.' : 'Még nem küldtél csereigényt.'}</p>
                  ) : (
                    <div className="space-y-3">
                      {outgoing.map(item => <SwapCard key={item.id} item={item} actions={false} />)}
                    </div>
                  )}
                </div>

                {/* Lezárt cserék */}
                {done.length > 0 && (
                  <div className={`rounded-2xl border p-5 space-y-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-gray-400" />
                      <h3 className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Lezárt cserék</h3>
                    </div>
                    <div className="space-y-3">
                      {done.map(item => <SwapCard key={item.id} item={item} actions={false} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : null}

          {!isPharmacy && mainTab === 'vacations' ? (() => {
            // Collect all own Sz (vacation) preferences across all months
            const ownSzPrefs = schedulePreferences.filter(p =>
              p.status !== 'deleted' &&
              normalizeShiftTypeKey(p.shiftType) === 'Sz' &&
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
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>{market === 'de' ? `Anspruch (${thisYear})` : `Jár (${thisYear})`}</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-orange-200' : 'text-orange-700'}`}>{annualVacDaysV + carryOverV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-orange-400/60' : 'text-orange-500/70'}`}>{carryOverV > 0 ? (market === 'de' ? `+${carryOverV} uebertragen` : `+${carryOverV} áthozva`) : (market === 'de' ? 'Tage' : 'nap')}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>{market === 'de' ? 'Genommen' : 'Kivett'}</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{takenV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'erfasst' : 'rögzítve'}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>{market === 'de' ? 'Geplant' : 'Tervezett'}</p>
                        <p className={`text-xl font-black ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>{usedInPlannerV}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-amber-500/70' : 'text-amber-500/80'}`}>{market === 'de' ? 'Tage im Entwurf' : 'nap a tervben'}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[11px] font-medium ${darkMode ? 'text-orange-400/80' : 'text-orange-600/80'}`}>{market === 'de' ? 'Uebrig' : 'Marad'}</p>
                        <p className={`text-xl font-black ${totalRemV - usedInPlannerV <= 3 ? 'text-rose-500' : darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{Math.max(0, totalRemV - usedInPlannerV)}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{market === 'de' ? 'Tage' : 'nap'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upcoming vacations */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Geplante Urlaube' : 'Tervezett szabadságok'}</p>
                  {futureSz.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {market === 'de' ? 'Kein geplanter Urlaub. Fuege ihn im Dienstplan-Entwurf hinzu.' : 'Nincs tervezett szabadság. Adj hozzá a Beosztás-tervezőben.'}
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
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{market === 'de' ? 'Vergangene Urlaube' : 'Letelt szabadságok'}</p>
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
                  <h3 className="text-base font-bold">👤 {market === 'de' ? 'Meine Basisdaten' : 'Alap adataim'}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{market === 'de' ? 'Erforderliche Angaben zur Berechnung der Urlaubstage' : 'Szabadságnapok kiszámításához szükséges adatok'}</p>
                </div>
                {!showProfileForm && (
                  <button type="button" onClick={() => setShowProfileForm(true)} className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {employeeProfile?.birthDate ? (market === 'de' ? 'Bearbeiten' : 'Szerkesztés') : (market === 'de' ? '+ Angeben' : '+ Megadás')}
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
                      { label: market === 'de' ? 'Geburtsdatum' : 'Születési dátum', val: employeeProfile.birthDate },
                      { label: market === 'de' ? 'Anzahl Kinder' : 'Gyermekek száma', val: market === 'de' ? `${employeeProfile.childrenCount || 0} Kind(er)` : `${employeeProfile.childrenCount || 0} gyermek` },
                      { label: market === 'de' ? 'Vertragstyp' : 'Szerződés típus', val: market === 'de' ? `${employeeProfile.contractHours || 8} Std/Tag` : `${employeeProfile.contractHours || 8} h/nap` },
                      { label: market === 'de' ? `Urlaub ${thisYear}` : `${thisYear}. évi szabadság`, val: market === 'de' ? `${totalVac} Tage (nach HU-Recht)` : `${totalVac} nap (Mt. alapján)` },
                      { label: market === 'de' ? 'Uebertragener Urlaub' : 'Áthozott szabadság', val: market === 'de' ? `${carryOver} Tage` : `${carryOver} nap` },
                      { label: market === 'de' ? 'Dieses Jahr genommen' : 'Felvett idén', val: market === 'de' ? `${taken} Tage genommen` : `${taken} nap felvett` },
                      { label: market === 'de' ? 'Resturlaub' : 'Maradék szabadság', val: market === 'de' ? `${remaining} Tage` : `${remaining} nap`, highlight: remaining <= 5 ? 'rose' : 'emerald' },
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
                <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{market === 'de' ? '⚠️ Diese Angaben sind fuer die Berechnung der Urlaubstage erforderlich.' : '⚠️ Az adatok megadása szükséges a szabadságnapok kiszámításához.'}</p>
              )}

              {/* Form */}
              {showProfileForm && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{market === 'de' ? 'Geburtsdatum' : 'Születési dátum'}</label>
                    <input
                      type="date"
                      value={profileForm.birthDate}
                      onChange={e => setProfileForm(p => ({ ...p, birthDate: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{market === 'de' ? 'Anzahl Kinder' : 'Gyermekek száma'}</label>
                    <select
                      value={profileForm.childrenCount}
                      onChange={e => setProfileForm(p => ({ ...p, childrenCount: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {['0','1','2','3','4','5+'].map(v => <option key={v} value={v}>{market === 'de' ? `${v} Kind(er)` : `${v} gyermek`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{market === 'de' ? 'Arbeitsvertrags-Typ' : 'Munkaszerződés típusa'}</label>
                    <select
                      value={profileForm.contractHours}
                      onChange={e => setProfileForm(p => ({ ...p, contractHours: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      <option value="4">{market === 'de' ? '4 Std/Tag (Teilzeit 50%)' : '4 h/nap (részmunkaidő 50%)'}</option>
                      <option value="6">{market === 'de' ? '6 Std/Tag (Teilzeit 75%)' : '6 h/nap (részmunkaidő 75%)'}</option>
                      <option value="8">{market === 'de' ? '8 Std/Tag (Vollzeit)' : '8 h/nap (teljes munkaidő)'}</option>
                      <option value="12">{market === 'de' ? '12 Std/Tag (Schichtdienst)' : '12 h/nap (műszakos)'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{market === 'de' ? 'Bisher genommener Urlaub dieses Jahr' : 'Eddig felvett szabadság idén'}</label>
                    <select
                      value={profileForm.vacationTakenThisYear}
                      onChange={e => setProfileForm(p => ({ ...p, vacationTakenThisYear: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {Array.from({ length: 51 }, (_, i) => i).map(v => <option key={v} value={v}>{market === 'de' ? `${v} Tage` : `${v} nap`}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">{market === 'de' ? 'Wenn du unterjaehrig registriert hast, gib bitte die bisher genommenen Urlaubstage an.' : 'Ha évközben regisztráltál, add meg az eddig felvett szabadságnapok számát.'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{market === 'de' ? 'Aus dem Vorjahr uebertragener Urlaub' : 'Előző évről áthozott szabadság'}</label>
                    <select
                      value={profileForm.vacationCarriedOver}
                      onChange={e => setProfileForm(p => ({ ...p, vacationCarriedOver: e.target.value }))}
                      className={`w-full rounded-xl border px-3 py-2 text-sm bg-transparent ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    >
                      {Array.from({ length: 31 }, (_, i) => i).map(v => <option key={v} value={v}>{market === 'de' ? `${v} Tage` : `${v} nap`}</option>)}
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
                        <p className={`text-xs font-bold uppercase tracking-wide ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{market === 'de' ? `Berechnete Werte (${thisYear})` : `Kiszámított értékek (${thisYear})`}</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{market === 'de' ? 'Alter' : 'Életkor'}: <strong>{age} {market === 'de' ? 'Jahre' : 'év'}</strong></p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{market === 'de' ? 'Urlaubsanspruch' : 'Járó szabadság'}: <strong>{totalVac} {market === 'de' ? 'Tage' : 'nap'}</strong> {market === 'de' ? '(Basis 20 + Alter + Kinder)' : '(alap 20 + kor + gyermek)'}</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{market === 'de' ? 'Rest dieses Jahr' : 'Maradék idén'}: <strong>{remaining} {market === 'de' ? 'Tage' : 'nap'}</strong> ({totalVac}+{carryOver}-{taken})</p>
                        <p className={`text-sm ${darkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>{(market === 'de' ? MONTHS_DE : MONTHS_HU)[month-1]} {market === 'de' ? 'Soll-Arbeitszeit' : 'kötelező munkaóra'}: <strong>{reqHours} {market === 'de' ? 'Stunden' : 'óra'}</strong> ({countWorkdaysInMonth(year, month)} {market === 'de' ? 'Arbeitstage' : 'munkanap'} × {profileForm.contractHours} {market === 'de' ? 'Std' : 'h'})</p>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowProfileForm(false)} className={`rounded-xl border px-4 py-2 text-sm font-medium ${darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}>{market === 'de' ? 'Abbrechen' : 'Mégse'}</button>
                    <button type="button" onClick={handleSaveEmployeeProfile} disabled={profileSaving || !profileForm.birthDate} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {profileSaving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Speichern' : 'Mentés')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 space-y-6 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-[#E5E7EB] bg-white'}`}>
              <div>
                <h3 className="text-lg font-semibold">{market === 'de' ? 'Individuelle Dienstplan-Praeferenzen' : 'Egyéni beosztási preferenciák'}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {market === 'de'
                    ? 'Die hier gesetzten Einstellungen werden vom automatischen Planer beruecksichtigt, koennen aber bei Bedarf von der Apotheke manuell ueberschrieben werden.'
                    : 'Az itt megadott beállításokat az automatikus tervező figyelembe veszi, de a gyógyszertár kézzel felülírhatja, ha arra szükség van.'}
                </p>
              </div>

              {/* Weekday preferences */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">{market === 'de' ? 'Praeferenzen fuer Wochentage' : 'Heti napok preferenciái'}</p>
                <p className="text-xs text-gray-500">
                  {market === 'de'
                    ? <>Klick-Reihenfolge: neutral → <span className="text-green-600 font-medium">bevorzugt</span> → <span className="text-red-600 font-medium">vermeiden</span> → neutral</>
                    : <>Kattintás: semleges → <span className="text-green-600 font-medium">előnyben részesítve</span> → <span className="text-red-600 font-medium">kerülendő</span> → semleges</>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {weekdayDisplay.map(({ label, fullLabel, day }) => {
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
                        title={market === 'de'
                          ? `${fullLabel}: ${state === 'avoid' ? 'vermeiden' : state === 'prefer' ? 'bevorzugt' : 'neutral'} — klicken zum Wechseln`
                          : `${fullLabel}: ${state === 'avoid' ? 'kerülendő' : state === 'prefer' ? 'előnyben részesítve' : 'semleges'} — kattints a váltáshoz`}
                        onClick={() => toggleWeekdayPreference(day)}
                        className={`min-w-[52px] rounded-xl border-2 px-2 py-3 text-center text-sm font-bold transition-colors ${cls}`}
                      >
                        <div>{label}</div>
                        <div className="mt-1 text-[10px] font-normal leading-tight">
                          {state === 'avoid' ? (market === 'de' ? 'meiden' : 'kerülöm') : state === 'prefer' ? (market === 'de' ? 'gern' : 'szívesen') : 'ok'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift type preference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={market === 'de' ? 'Bevorzugter Schichttyp' : 'Preferált műszaktípus'}>
                  <select
                    value={preferencesForm.preferredShiftType}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredShiftType: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="any">{market === 'de' ? 'Beliebig (keine Praeferenz)' : 'Bármelyik (nincs preferencia)'}</option>
                    <option value="day">{market === 'de' ? 'Tagdienst (morgens–nachmittags)' : 'Nappali (reggel–délután)'}</option>
                    <option value="evening">{market === 'de' ? 'Spaet / Abend' : 'Délutáni / esti'}</option>
                    <option value="night">{market === 'de' ? 'Nachtschicht' : 'Éjszakai'}</option>
                  </select>
                </Field>

                <Field label={market === 'de' ? 'Ziel-Arbeitsstunden pro Woche' : 'Célzott heti munkaórák'}>
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
                <Field label={market === 'de' ? 'Praeferenz fuer Wochenenddienste' : 'Hétvégi műszak preferencia'}>
                  <select
                    value={preferencesForm.preferredWeekend}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredWeekend: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="prefer">{market === 'de' ? 'Ich arbeite gern am Wochenende' : 'Szívesen dolgozom hétvégén'}</option>
                    <option value="neutral">{market === 'de' ? 'Neutral' : 'Semleges'}</option>
                    <option value="avoid">{market === 'de' ? 'Moeglichst vermeiden' : 'Lehetőleg kerülöm'}</option>
                  </select>
                </Field>
                <Field label={market === 'de' ? 'Praeferenz fuer Nachtdienste' : 'Éjszakai műszak preferencia'}>
                  <select
                    value={preferencesForm.preferredNight}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, preferredNight: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 bg-transparent"
                  >
                    <option value="prefer">{market === 'de' ? 'Ich arbeite gern nachts' : 'Szívesen dolgozom éjszaka'}</option>
                    <option value="neutral">{market === 'de' ? 'Neutral' : 'Semleges'}</option>
                    <option value="avoid">{market === 'de' ? 'Moeglichst vermeiden' : 'Lehetőleg kerülöm'}</option>
                  </select>
                </Field>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 select-none">
                  <input
                    type="checkbox"
                    checked={preferencesForm.canWorkWeekends}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, canWorkWeekends: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{market === 'de' ? 'Ich uebernehme Wochenenddienste' : 'Vállalok hétvégi műszakot'}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 select-none">
                  <input
                    type="checkbox"
                    checked={preferencesForm.canWorkNight}
                    onChange={(e) => setPreferencesForm((prev) => ({ ...prev, canWorkNight: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{market === 'de' ? 'Ich uebernehme Nachtdienste' : 'Vállalok éjszakai műszakot'}</span>
                </label>
              </div>

              {/* Notes for pharmacy manager */}
              <Field
                label={market === 'de' ? 'Notiz fuer die Apotheke' : 'Megjegyzés a gyógyszertárnak'}
                hint={market === 'de' ? 'z. B. regelmaessige Arztkontrolle montags, Studium usw.' : 'Pl. rendszeres orvosi ellenőrzés hétfőnként, tanulmányok stb.'}
              >
                <textarea
                  value={preferencesForm.schedulingNotes}
                  onChange={(e) => setPreferencesForm((prev) => ({ ...prev, schedulingNotes: e.target.value }))}
                  className="min-h-[90px] w-full rounded-xl border px-3 py-2 bg-transparent"
                  placeholder={market === 'de' ? 'z. B. dienstags bin ich nach 16:00 nicht verfuegbar, abends lerne ich' : 'Pl. minden kedden 16:00 után nem érek rá, este tanulok'}
                />
              </Field>

              <div className={`rounded-xl border px-4 py-3 text-xs ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {market === 'de'
                  ? 'Diese Einstellungen sind weiche Praeferenzen: der automatische Planer beruecksichtigt sie, die Apotheke kann sie bei Bedarf manuell ueberschreiben.'
                  : 'Ezek a beállítások lágy preferenciák: az automatikus tervező figyelembe veszi őket, de a gyógyszertár szükség esetén kézzel felülírhatja.'}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={preferencesSaving || ownEmployeeRecords.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-5 py-2.5 font-medium text-white disabled:opacity-60"
                >
                  {preferencesSaving ? (market === 'de' ? 'Speichern...' : 'Mentés...') : (market === 'de' ? 'Praeferenzen speichern' : 'Preferenciák mentése')}
                </button>
              </div>
            </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {renderBettiChatPanel()}
    </div>
  );
}
