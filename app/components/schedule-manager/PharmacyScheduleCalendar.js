"use client";

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationWithPush } from '@/lib/notifications';
import { CheckCircle2, ChevronRight, Copy, Download, Info, Send, Trash2 } from 'lucide-react';

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
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

function isPharmacistRole(role) {
  const r = (role || '').toLowerCase();
  return r.includes('pharmacist') || r.includes('gyógyszerész') || r.includes('gyogyszeresz');
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

function getErrorAdvice(code) {
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

export default function PharmacyScheduleCalendar({
  year, month, onChangeMonth, onClose,
  schedules, employees,
  preferences,
  user, userData, darkMode,
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
          title: 'Beosztás csere igény',
          message: `${requesterSchedule.employeeName} csereigényt küldött a beosztásodra (${requesterSchedule.date} ${requesterSchedule.startTime}–${requesterSchedule.endTime}).`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }
      if (requesterSchedule.pharmacyId) {
        await createNotificationWithPush({
          userId: requesterSchedule.pharmacyId,
          type: 'schedule_swap_request_for_pharmacy',
          title: 'Új beosztás csere igény',
          message: `${requesterSchedule.employeeName} cserét kért ${targetSchedule.employeeName} beosztásával.`,
          data: { requesterScheduleId: requesterSchedule.id, targetScheduleId: targetSchedule.id },
          url: '/pharmagister?tab=schedule-manager&subtab=swaps',
        });
      }
      setReadOnlySwapDone(`Csereigény elküldve ${targetSchedule.employeeName} felé!`);
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
                    const advice = getErrorAdvice(err.code);
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
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Javítsd a hibákat, majd próbáld újra a publikálást.</p>
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
            title="Havi összefoglaló"
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
              >Saját</button>
              <button
                type="button"
                onClick={() => setOwnView(false)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  !ownView ? 'bg-white text-violet-700' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >Összes</button>
            </div>
          )}
          {/* Actions — hidden in readOnly mode */}
          {!readOnly && (
            <>
              <button type="button" onClick={onCopyPrev} disabled={saving} title="Előző hónap másolása" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white disabled:opacity-50">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={onExport} title="CSV export" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white">
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setDeleteMonthConfirm(1)} disabled={saving} title="Havi beosztás törlése" className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/70 hover:bg-rose-500/90 text-white disabled:opacity-50">
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
          ? 'Nem publikálható – Nincs kitöltött beosztás'
          : alreadyPublished
            ? 'Már publikálva – Újra publikálható'
            : 'Kész a publikálásra';
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
                {saving ? 'Publikálás...' : alreadyPublished ? 'Újrapublikálás' : canPublish ? 'Beosztás publikálása' : 'Nincs mit publikálni'}
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
            <span>{plannerLoading ? 'AI tervezés folyamatban...' : 'AI Beosztás-generálás'}</span>
            <span className={`text-[11px] font-normal ${darkMode ? 'text-violet-300/70' : 'text-violet-500/80'}`}>
              {plannerLoading ? 'Ez eltarthat néhány másodpercig' : 'Automatikus havi beosztás tervezése és azonnali mentése'}
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
          <span>{swapLog.length} csere nincs publikálva – Változtatások megtekintése</span>
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
            <span className="text-white font-bold text-base flex-1">Rögzített változtatások</span>
            <span className="text-white/70 text-xs">{swapLog.length} csere</span>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {swapLog.map((entry, idx) => {
              const [ayear, amonth, aday] = entry.dateA.split('-').map(Number);
              const [byear, bmonth, bday] = entry.dateB.split('-').map(Number);
              const dowA = new Date(ayear, amonth - 1, aday).getDay();
              const dowB = new Date(byear, bmonth - 1, bday).getDay();
              const labelA = `${MONTHS_HU[amonth-1]} ${aday}. (${DOW_LABELS[dowA]})`;
              const labelB = `${MONTHS_HU[bmonth-1]} ${bday}. (${DOW_LABELS[dowB]})`;
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
            >Bezárás</button>
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
              {publishChangesLoading ? 'Publikálás...' : 'Változtatások publikálása'}
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
                  {isApplying ? 'Műszakok mentése...' : 'AI tervezés folyamatban...'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {isApplying ? 'A javasolt beosztás rögzítése történik' : 'Preferenciák és szabályok alapján tervezünk'}
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
                  {readOnly && ownView ? 'Nincs műszakod' : 'Nincs beosztás'}
                </p>
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

      {/* ── Delete month confirmation modal ──────────────────────────────── */}
      {deleteMonthConfirm > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{backdropFilter:'blur(6px)', background:'rgba(0,0,0,0.6)'}}>
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border border-rose-800' : 'bg-white border border-rose-200'}`}>
            <div className="bg-gradient-to-br from-rose-600 to-red-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🗑️</span>
                <div>
                  <p className="text-rose-100 text-xs font-semibold uppercase tracking-widest">Figyelem</p>
                  <h3 className="text-white font-black text-lg">
                    {deleteMonthConfirm === 1 ? 'Törlöd a havi beosztást?' : 'Biztosan törlöd?'}
                  </h3>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {deleteMonthConfirm === 1 ? (
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Ez törli <strong>{monthLabel} {year}</strong> összes beosztás-bejegyzését, beleértve a már publikált műszakokat is.
                </p>
              ) : (
                <div className={`rounded-xl border px-4 py-3 ${darkMode ? 'border-rose-800 bg-rose-900/30 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <p className="text-sm font-bold">Ez a művelet nem vonható vissza!</p>
                  <p className="text-xs mt-1">Az összes műszak (publikált is) véglegesen törlődik {monthLabel} {year} hónapból.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteMonthConfirm(0)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Mégse
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
                  {deleteMonthConfirm === 1 ? 'Folytatás →' : '🗑️ Végleges törlés'}
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
              <span className="text-white font-bold text-base tracking-tight">{monthLabel} {year} – összefoglaló</span>
            </div>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-3">
            {summaryProfilesLoading ? (
              <div className={`text-center text-sm py-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>Betöltés…</div>
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
                const szScheds   = empScheds.filter(s => s.shiftType === 'Sz');
                const pScheds    = empScheds.filter(s => s.shiftType === 'P');

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
                const prefSzDates = new Set(empPrefs.filter(p => p.shiftType === 'Sz').map(p => p.date));
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
                        <p className={`text-xs font-medium ${roleColor}`}>{isPharmacist ? 'Gyógyszerész' : 'Asszisztens'}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${roleBg} ${roleColor}`}>
                        {workScheds.length} műszak
                      </span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Scheduled hours */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Beosztott órák</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {scheduledHours % 1 === 0 ? scheduledHours : scheduledHours.toFixed(1)}<span className="text-sm font-semibold ml-0.5">ó</span>
                        </p>
                        {monthlyRequired > 0 && (
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Keret: {monthlyRequired}ó</p>
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
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Szabadság</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                          {szDays}<span className="text-sm font-semibold ml-0.5">nap</span>
                        </p>
                        {totalVac !== null && (
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Éves keret: {totalVac} nap</p>
                        )}
                        {vacAfter !== null && (
                          <p className={`text-xs font-semibold mt-0.5 ${
                            vacAfter >= 0
                              ? (darkMode ? 'text-sky-400' : 'text-sky-600')
                              : (darkMode ? 'text-rose-400' : 'text-rose-600')
                          }`}>
                            Maradék: {Math.max(0, vacAfter)} nap
                          </p>
                        )}
                      </div>

                      {/* Working days */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Munkanapok</p>
                        <p className={`text-xl font-black tabular-nums ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {workScheds.length}<span className={`text-xs font-medium ml-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>/ {daysInMonth}</span>
                        </p>
                      </div>

                      {/* Off days */}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Távollétek</p>
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
                    <span className={`flex-1 font-semibold text-sm min-w-[120px] ${row.isPublished ? 'opacity-60' : ''} ${
                      readOnly
                        ? ownScheduleIds?.has(row.existingId)
                          ? (darkMode ? 'text-sky-300' : 'text-sky-700')
                          : (darkMode ? 'text-gray-500' : 'text-gray-400')
                        : (darkMode ? 'text-gray-100' : 'text-gray-800')
                    }`}>
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
                        title="Csere: helyettesítő kiválasztása"
                      >
                        ⇄ Csere
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
                        title="Csere kérése egy kollégával"
                      >
                        ⇄ Csere kérése
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
                                {swapTarget ? '✅ Csere megerősítése' : `⇄ ${row.name} – melyik műszakkal cseréljük?`}
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
                                  Létszámkényszer – bármely beosztottal
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
                                >← Vissza</button>
                                {readOnly ? (
                                  <button
                                    type="button"
                                    disabled={readOnlySwapSaving}
                                    onClick={() => executeReadOnlySwapRequest(idx)}
                                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                                  >{readOnlySwapSaving ? 'Küldés…' : '⇄ Csereigény küldése'}</button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={swapSaving}
                                    onClick={() => executeSwap(idx)}
                                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                                  >{swapSaving ? 'Mentés…' : '⇄ Csere elvégzése'}</button>
                                )}
                              </div>
                            </div>
                          ) : (
                            // ── Employee + shift picker ─────────────────────────
                            candidateEmps.length === 0 ? (
                              <p className={`text-xs px-3 py-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {swapIgnoreRole
                                  ? 'Nincs beosztott dolgozó ebben a hónapban.'
                                  : `Nincs csereképes ${rowIsPharmacist ? 'gyógyszerész' : 'szakasszisztens'} ebben a hónapban.`}
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
                    Létszámhiány – javaslat a pótláshoz
                  </span>
                </div>
                {staffingWarnings.map((w, wi) => (
                  <div key={wi} className={`rounded-xl border px-4 py-3 space-y-2 ${darkMode ? 'border-amber-700/50 bg-amber-900/20' : 'border-amber-200 bg-white'}`}>
                    <div className={`text-xs font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      {w.template.startTime}–{w.template.endTime} műszak:{' '}
                      <span className="font-black">{w.workers}/{w.required} fő</span>
                      {w.pharmacistShortage > 0 && (
                        <span className={`ml-2 ${darkMode ? 'text-rose-300' : 'text-rose-600'}`}>
                          • {w.pharmacists}/{w.requiredPharmacists} gyógyszerész
                        </span>
                      )}
                    </div>
                    {w.suggestions.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className={`text-[11px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Elérhető dolgozók:</p>
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
                                  {isPharm ? 'Gy' : 'A'}
                                </span>
                                {s.name}
                                <span className="text-[10px] opacity-60">+ hozzáad</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Nincs szabad dolgozó erre a napra.</p>
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
                <span>{swapLog.length} rögzített csere – Változtatások megtekintése</span>
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
