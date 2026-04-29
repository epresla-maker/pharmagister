function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function minutesFromTime(time) {
  const [hour, minute] = String(time || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
}

function shiftDurationHours(startTime, endTime) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (end <= start) return (24 * 60 - start + end) / 60;
  return (end - start) / 60;
}

function classifyShiftType(startTime, endTime) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);

  if (start >= 20 * 60 || end <= 6 * 60 || end <= start) return 'night';
  if (start >= 14 * 60) return 'evening';
  return 'day';
}

function isWeekend(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isSunday(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return false;
  return date.getDay() === 0;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function getHungarianPublicHolidays(year) {
  const easterSunday = computeEasterSunday(year);
  const goodFriday = addDays(easterSunday, -2);
  const easterMonday = addDays(easterSunday, 1);
  const pentecostMonday = addDays(easterSunday, 50);

  return new Set([
    toDateKey(year, 1, 1),
    toDateKey(year, 3, 15),
    toDateKey(goodFriday.getFullYear(), goodFriday.getMonth() + 1, goodFriday.getDate()),
    toDateKey(easterMonday.getFullYear(), easterMonday.getMonth() + 1, easterMonday.getDate()),
    toDateKey(year, 5, 1),
    toDateKey(pentecostMonday.getFullYear(), pentecostMonday.getMonth() + 1, pentecostMonday.getDate()),
    toDateKey(year, 8, 20),
    toDateKey(year, 10, 23),
    toDateKey(year, 11, 1),
    toDateKey(year, 12, 25),
    toDateKey(year, 12, 26),
  ]);
}

function isPublicHoliday(dateKey, holidaySet) {
  return holidaySet.has(dateKey);
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'pharmacist' || value === 'gyogyszeresz' || value === 'gyógyszerész') return 'pharmacist';
  if (value === 'assistant' || value === 'szakasszisztens') return 'assistant';
  if (value === 'pharmacy' || value === 'gyogyszertar' || value === 'gyógyszertár') return 'pharmacy';
  return 'other';
}

function normalizeEmployee(employee) {
  return {
    ...employee,
    role: normalizeRole(employee.role),
    weeklyHoursLimit: Number(employee.weeklyHoursLimit || employee.maxWeeklyHours || 40),
    monthlyHoursLimit: Number(employee.monthlyHoursLimit || employee.maxMonthlyHours || 174),
    maxDailyHours: Number(employee.maxDailyHours || 12),
    minRestHours: Number(employee.minRestHours || 11),
    maxConsecutiveDays: Number(employee.maxConsecutiveDays || 6),
    allowedShiftTypes: Array.isArray(employee.allowedShiftTypes) && employee.allowedShiftTypes.length > 0
      ? employee.allowedShiftTypes
      : ['day', 'evening', 'night'],
    allowedSites: Array.isArray(employee.allowedSites) && employee.allowedSites.length > 0
      ? employee.allowedSites
      : [employee.pharmacyId].filter(Boolean),
    canWorkWeekends: employee.canWorkWeekends !== false,
    canWorkNight: employee.canWorkNight !== false,
    preferredWeekend: employee.preferredWeekend || 'neutral',
    preferredNight: employee.preferredNight || 'neutral',
    vacations: Array.isArray(employee.vacations) ? employee.vacations : [],
    sickDays: Array.isArray(employee.sickDays) ? employee.sickDays : [],
    preferredShiftTypes: Array.isArray(employee.preferredShiftTypes) ? employee.preferredShiftTypes : [],
    // Per-weekday soft preferences (JS day numbers: 0=Sun,1=Mon,...,6=Sat)
    avoidWeekdays: Array.isArray(employee.avoidWeekdays)
      ? employee.avoidWeekdays.map(Number).filter((n) => n >= 0 && n <= 6)
      : [],
    preferWeekdays: Array.isArray(employee.preferWeekdays)
      ? employee.preferWeekdays.map(Number).filter((n) => n >= 0 && n <= 6)
      : [],
    targetWeeklyHours: Number(employee.targetWeeklyHours || employee.weeklyHoursLimit || employee.maxWeeklyHours || 40),
    schedulingNotes: employee.schedulingNotes || '',
  };
}

function buildTimeOffMap(employees, vacationRequests) {
  const map = new Map();

  const addDate = (employeeId, dateKey, reason) => {
    if (!employeeId || !dateKey) return;
    if (!map.has(employeeId)) map.set(employeeId, new Map());
    map.get(employeeId).set(dateKey, reason || 'time_off');
  };

  const addRange = (employeeId, startDate, endDate, reason) => {
    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate || startDate);
    if (!employeeId || !start || !end) return;
    const current = new Date(start.getTime());
    while (current <= end) {
      const key = toDateKey(current.getFullYear(), current.getMonth() + 1, current.getDate());
      addDate(employeeId, key, reason);
      current.setDate(current.getDate() + 1);
    }
  };

  employees.forEach((employee) => {
    employee.vacations.forEach((vac) => {
      if (typeof vac === 'string') addDate(employee.id, vac, 'vacation');
      else addRange(employee.id, vac.startDate, vac.endDate, 'vacation');
    });
    employee.sickDays.forEach((sick) => {
      if (typeof sick === 'string') addDate(employee.id, sick, 'sick');
      else addRange(employee.id, sick.startDate, sick.endDate, 'sick');
    });
  });

  (vacationRequests || [])
    .filter((item) => item.status === 'accepted' || item.status === 'pending')
    .forEach((item) => addRange(item.employeeId, item.startDate, item.endDate, 'vacation_request'));

  return map;
}

function defaultConfig() {
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
    optimization: {
      scenarioCount: 8,
      randomness: 0.35,
      weights: {
        hardConflict: 10000,
        warningConflict: 400,
        infoConflict: 80,
        overtimeHour: 16,
        fairnessStdDev: 50,
      },
    },
    prioritizeCritical: true,
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

function normalizeConfig(config) {
  const merged = { ...defaultConfig(), ...(config || {}) };
  const templates = Array.isArray(merged.shiftTemplates) && merged.shiftTemplates.length > 0
    ? merged.shiftTemplates
    : defaultConfig().shiftTemplates;

  merged.shiftTemplates = templates.map((item) => ({
    key: item.key || classifyShiftType(item.startTime, item.endTime),
    startTime: item.startTime || '08:00',
    endTime: item.endTime || '16:00',
    requiredStaff: Number(item.requiredStaff || merged.minStaffPerShift || 1),
    requiredPharmacists: Number(item.requiredPharmacists || merged.minPharmacistsPerShift || 0),
    onCall: Boolean(item.onCall),
    siteId: item.siteId || null,
  }));

  merged.operations = {
    ...defaultConfig().operations,
    ...(merged.operations || {}),
    openingHoursByWeekday: {
      ...defaultConfig().operations.openingHoursByWeekday,
      ...((merged.operations || {}).openingHoursByWeekday || {}),
    },
    onCall: {
      ...defaultConfig().operations.onCall,
      ...((merged.operations || {}).onCall || {}),
      days: Array.isArray((merged.operations || {}).onCall?.days)
        ? (merged.operations || {}).onCall.days.map(Number).filter((d) => d >= 0 && d <= 6)
        : defaultConfig().operations.onCall.days,
      requiredStaff: Math.max(0, Number((merged.operations || {}).onCall?.requiredStaff ?? defaultConfig().operations.onCall.requiredStaff)),
      requiredPharmacists: Math.max(0, Number((merged.operations || {}).onCall?.requiredPharmacists ?? defaultConfig().operations.onCall.requiredPharmacists)),
    },
  };

  merged.laborLaw = {
    ...defaultConfig().laborLaw,
    ...(merged.laborLaw || {}),
    maxDailyHoursLegal: Number((merged.laborLaw || {}).maxDailyHoursLegal || defaultConfig().laborLaw.maxDailyHoursLegal),
    maxWeeklyHoursLegal: Number((merged.laborLaw || {}).maxWeeklyHoursLegal || defaultConfig().laborLaw.maxWeeklyHoursLegal),
    minDailyRestHoursLegal: Number((merged.laborLaw || {}).minDailyRestHoursLegal || defaultConfig().laborLaw.minDailyRestHoursLegal),
    maxNightShiftHoursLegal: Number((merged.laborLaw || {}).maxNightShiftHoursLegal || defaultConfig().laborLaw.maxNightShiftHoursLegal),
    requireBreakAfterHours: Number((merged.laborLaw || {}).requireBreakAfterHours || defaultConfig().laborLaw.requireBreakAfterHours),
  };

  merged.optimization = {
    ...defaultConfig().optimization,
    ...(merged.optimization || {}),
    scenarioCount: Math.max(1, Number((merged.optimization || {}).scenarioCount || defaultConfig().optimization.scenarioCount)),
    randomness: Math.max(0, Math.min(1, Number((merged.optimization || {}).randomness ?? defaultConfig().optimization.randomness))),
    weights: {
      ...defaultConfig().optimization.weights,
      ...((merged.optimization || {}).weights || {}),
    },
  };

  return merged;
}

function makeSeededRandom(seed) {
  let value = seed >>> 0;
  return function rand() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function randomSeedFromInput({ year, month, employees }) {
  const base = Number(year) * 100 + Number(month);
  const emp = (employees || []).reduce((sum, e) => sum + String(e.id || '').length * 31, 0);
  return (base * 2654435761 + emp) >>> 0;
}

function stdDev(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + ((v - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function evaluatePlanQuality({ employees, mergedSchedules, conflicts, config }) {
  const weights = config?.optimization?.weights || defaultConfig().optimization.weights;
  const hard = conflicts.filter((c) => c.severity === 'error').length;
  const warning = conflicts.filter((c) => c.severity === 'warning').length;
  const info = conflicts.filter((c) => c.severity === 'info').length;

  const employeeStats = buildEmployeeStats(employees, (mergedSchedules || []).filter((s) => s.status !== 'deleted'));
  const workedHours = (employees || []).map((e) => employeeStats.get(e.id)?.totalHours || 0);
  const fairness = stdDev(workedHours);

  const overtime = (employees || []).reduce((sum, e) => {
    const total = employeeStats.get(e.id)?.totalHours || 0;
    const limit = Number(e.monthlyHoursLimit || 0);
    return sum + Math.max(0, total - limit);
  }, 0);

  const objective = (
    hard * Number(weights.hardConflict || 10000)
    + warning * Number(weights.warningConflict || 400)
    + info * Number(weights.infoConflict || 80)
    + overtime * Number(weights.overtimeHour || 16)
    + fairness * Number(weights.fairnessStdDev || 50)
  );

  return {
    objective: Number(objective.toFixed(3)),
    penalties: {
      hardConflicts: hard,
      warningConflicts: warning,
      infoConflicts: info,
      overtimeHours: Number(overtime.toFixed(2)),
      fairnessStdDev: Number(fairness.toFixed(3)),
    },
  };
}

function isOnTimeOff(employeeId, dateKey, timeOffMap) {
  return timeOffMap.get(employeeId)?.has(dateKey) || false;
}

function splitToDailySegments(startTime, endTime) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (end <= start) {
    return [
      [start, 24 * 60],
      [0, end],
    ];
  }
  return [[start, end]];
}

function isRangeWithinWindow(startTime, endTime, openTime, closeTime) {
  const shiftSegments = splitToDailySegments(startTime, endTime);
  const windowSegments = splitToDailySegments(openTime, closeTime);

  return shiftSegments.every(([s1, e1]) =>
    windowSegments.some(([s2, e2]) => s1 >= s2 && e1 <= e2)
  );
}

function getOpeningForDate(dateKey, config) {
  const date = parseDateKey(dateKey);
  const dow = date ? date.getDay() : 1;
  const fallback = { isOpen: true, openTime: '08:00', closeTime: '20:00' };
  return config?.operations?.openingHoursByWeekday?.[dow] || fallback;
}

function isOnCallDay(dateKey, config) {
  if (!config?.operations?.onCall?.enabled) return false;
  const date = parseDateKey(dateKey);
  if (!date) return false;
  const dow = date.getDay();
  const days = Array.isArray(config.operations.onCall.days) ? config.operations.onCall.days : [];
  return days.includes(dow);
}

function buildExpectedTemplatesForDate(config, dateKey) {
  const opening = getOpeningForDate(dateKey, config);
  const onCallDay = isOnCallDay(dateKey, config);
  const allowOnCallOutsideOpening = config?.operations?.allowOnCallOutsideOpening !== false;

  const base = (config.shiftTemplates || []).filter((template) => {
    if (template.onCall) {
      return onCallDay;
    }
    return opening.isOpen;
  });

  if (onCallDay && config?.operations?.onCall?.useAutoTemplate !== false) {
    const onCallCfg = config.operations.onCall;
    const duplicate = base.some((template) =>
      Boolean(template.onCall)
      && template.startTime === onCallCfg.startTime
      && template.endTime === onCallCfg.endTime
      && Number(template.requiredStaff) === Number(onCallCfg.requiredStaff)
      && Number(template.requiredPharmacists) === Number(onCallCfg.requiredPharmacists)
    );

    if (!duplicate) {
      base.push({
        key: 'on_call_auto',
        startTime: onCallCfg.startTime,
        endTime: onCallCfg.endTime,
        requiredStaff: Number(onCallCfg.requiredStaff || 0),
        requiredPharmacists: Number(onCallCfg.requiredPharmacists || 0),
        onCall: allowOnCallOutsideOpening,
      });
    }
  }

  return base;
}

function timeOffReason(employeeId, dateKey, timeOffMap) {
  return timeOffMap.get(employeeId)?.get(dateKey) || null;
}

function scheduleOverlaps(a, b) {
  if (!a || !b) return false;
  if (a.date !== b.date) return false;
  const aStart = minutesFromTime(a.startTime);
  const aEnd = minutesFromTime(a.endTime);
  const bStart = minutesFromTime(b.startTime);
  const bEnd = minutesFromTime(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

function buildEmployeeStats(employees, schedules) {
  const stats = new Map();

  employees.forEach((employee) => {
    stats.set(employee.id, {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      totalHours: 0,
      overtimeHours: 0,
      weekendShifts: 0,
      sundayShifts: 0,
      publicHolidayShifts: 0,
      nightShifts: 0,
      estimatedSundayPremiumHours: 0,
      estimatedHolidayPremiumHours: 0,
      workedDates: new Set(),
      shifts: [],
    });
  });

  const yearsInSchedule = new Set(
    schedules
      .map((shift) => parseDateKey(shift.date))
      .filter(Boolean)
      .map((date) => date.getFullYear())
  );
  const holidaySetsByYear = new Map();
  yearsInSchedule.forEach((year) => {
    holidaySetsByYear.set(year, getHungarianPublicHolidays(year));
  });

  schedules.forEach((shift) => {
    const employeeStats = stats.get(shift.employeeId);
    if (!employeeStats) return;
    const duration = shiftDurationHours(shift.startTime, shift.endTime);
    employeeStats.totalHours += duration;
    employeeStats.shifts.push(shift);
    employeeStats.workedDates.add(shift.date);
    if (isWeekend(shift.date)) employeeStats.weekendShifts += 1;
    if (isSunday(shift.date)) {
      employeeStats.sundayShifts += 1;
      employeeStats.estimatedSundayPremiumHours += duration;
    }
    const shiftDate = parseDateKey(shift.date);
    const holidaySet = shiftDate ? holidaySetsByYear.get(shiftDate.getFullYear()) : null;
    if (holidaySet && isPublicHoliday(shift.date, holidaySet)) {
      employeeStats.publicHolidayShifts += 1;
      employeeStats.estimatedHolidayPremiumHours += duration;
    }
    if (classifyShiftType(shift.startTime, shift.endTime) === 'night') employeeStats.nightShifts += 1;
  });

  stats.forEach((item, employeeId) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    item.overtimeHours = Math.max(0, item.totalHours - employee.monthlyHoursLimit);
    item.shifts.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  });

  return stats;
}

function getWeekKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return 'unknown';
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - firstJan) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + firstJan.getDay()) / 7);
  return `${date.getFullYear()}-W${week}`;
}

export function detectScheduleConflicts({ employees, schedules, vacationRequests = [], year, month, config }) {
  const normalizedEmployees = (employees || []).map(normalizeEmployee);
  const activeSchedules = (schedules || []).filter((item) => item.status !== 'deleted');
  const normalizedConfig = normalizeConfig(config);
  const timeOffMap = buildTimeOffMap(normalizedEmployees, vacationRequests);
  const employeeStats = buildEmployeeStats(normalizedEmployees, activeSchedules);
  const holidaySet = getHungarianPublicHolidays(year);

  const conflicts = [];

  const pushConflict = (severity, code, message, payload = {}) => {
    conflicts.push({ severity, code, message, ...payload });
  };

  normalizedEmployees.forEach((employee) => {
    const stats = employeeStats.get(employee.id);
    if (!stats) return;

    const dayMap = new Map();
    stats.shifts.forEach((shift) => {
      if (!dayMap.has(shift.date)) dayMap.set(shift.date, []);
      dayMap.get(shift.date).push(shift);
    });

    dayMap.forEach((dayShifts, dateKey) => {
      const dailyHours = dayShifts.reduce((sum, shift) => sum + shiftDurationHours(shift.startTime, shift.endTime), 0);
      if (dailyHours > employee.maxDailyHours) {
        pushConflict('error', 'max_daily_hours', `${employee.name}: ${dateKey} napi óraszám túllépés (${dailyHours.toFixed(1)} óra).`, {
          employeeId: employee.id,
          date: dateKey,
        });
      }

      if (normalizedConfig.laborLaw.enforceHungarianLaborLaw && dailyHours > normalizedConfig.laborLaw.maxDailyHoursLegal) {
        pushConflict('error', 'legal_max_daily_hours', `${employee.name}: jogszabályi napi maximum túllépés (${dateKey}, ${dailyHours.toFixed(1)} óra).`, {
          employeeId: employee.id,
          date: dateKey,
        });
      }

      if (dayShifts.length > 1) {
        for (let i = 0; i < dayShifts.length; i += 1) {
          for (let j = i + 1; j < dayShifts.length; j += 1) {
            if (scheduleOverlaps(dayShifts[i], dayShifts[j])) {
              pushConflict('error', 'double_shift', `${employee.name}: átfedő műszakok ${dateKey} napon.`, {
                employeeId: employee.id,
                date: dateKey,
              });
            }
          }
        }
      }

      if (isOnTimeOff(employee.id, dateKey, timeOffMap)) {
        pushConflict('error', 'time_off_violation', `${employee.name}: időszakos távollétre lett beosztva (${dateKey}).`, {
          employeeId: employee.id,
          date: dateKey,
          reason: timeOffReason(employee.id, dateKey, timeOffMap),
        });
      }
    });

    const weekHours = new Map();
    stats.shifts.forEach((shift) => {
      const weekKey = getWeekKey(shift.date);
      const next = (weekHours.get(weekKey) || 0) + shiftDurationHours(shift.startTime, shift.endTime);
      weekHours.set(weekKey, next);
    });

    weekHours.forEach((hours, weekKey) => {
      if (hours > employee.weeklyHoursLimit) {
        pushConflict('warning', 'weekly_hours_limit', `${employee.name}: heti órakeret túllépés (${weekKey}, ${hours.toFixed(1)} óra).`, {
          employeeId: employee.id,
          week: weekKey,
        });
      }

      if (normalizedConfig.laborLaw.enforceHungarianLaborLaw && hours > normalizedConfig.laborLaw.maxWeeklyHoursLegal) {
        pushConflict('error', 'legal_weekly_hours_limit', `${employee.name}: jogszabályi heti maximum túllépés (${weekKey}, ${hours.toFixed(1)} óra).`, {
          employeeId: employee.id,
          week: weekKey,
        });
      }
    });

    const weekDayWorkMap = new Map();
    [...stats.workedDates].forEach((dateKey) => {
      const weekKey = getWeekKey(dateKey);
      if (!weekDayWorkMap.has(weekKey)) weekDayWorkMap.set(weekKey, new Set());
      weekDayWorkMap.get(weekKey).add(dateKey);
    });
    weekDayWorkMap.forEach((daysWorked, weekKey) => {
      if (normalizedConfig.laborLaw.enforceHungarianLaborLaw && daysWorked.size >= 7) {
        pushConflict('warning', 'weekly_rest_day_missing', `${employee.name}: nincs heti pihenőnap (${weekKey}).`, {
          employeeId: employee.id,
          week: weekKey,
        });
      }
    });

    if (stats.totalHours > employee.monthlyHoursLimit) {
      pushConflict('warning', 'monthly_hours_limit', `${employee.name}: havi órakeret túllépés (${stats.totalHours.toFixed(1)} óra).`, {
        employeeId: employee.id,
      });
    }

    const sorted = [...stats.shifts].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const next = sorted[i];
      const prevDate = parseDateKey(prev.date);
      const nextDate = parseDateKey(next.date);
      if (!prevDate || !nextDate) continue;
      const dayDiff = Math.round((nextDate - prevDate) / 86400000);
      const prevEnd = minutesFromTime(prev.endTime);
      const nextStart = minutesFromTime(next.startTime);
      // Night shifts end on the next calendar day — adjust rest calculation
      const prevIsNight = minutesFromTime(prev.endTime) < minutesFromTime(prev.startTime);
      const effectiveDayDiff = prevIsNight ? dayDiff - 1 : dayDiff;
      const restHours = effectiveDayDiff > 0
        ? ((effectiveDayDiff - 1) * 24) + ((24 * 60 - prevEnd + nextStart) / 60)
        : ((nextStart - prevEnd) / 60);

      if (restHours < employee.minRestHours) {
        pushConflict('error', 'rest_time', `${employee.name}: túl kevés pihenőidő (${restHours.toFixed(1)} óra).`, {
          employeeId: employee.id,
          date: next.date,
        });
      }

      if (normalizedConfig.laborLaw.enforceHungarianLaborLaw && restHours < normalizedConfig.laborLaw.minDailyRestHoursLegal) {
        pushConflict('error', 'legal_rest_time', `${employee.name}: jogszabályi napi pihenőidő sérül (${Math.max(restHours, 0).toFixed(1)} óra).`, {
          employeeId: employee.id,
          date: next.date,
        });
      }
    }

    const workedDays = [...stats.workedDates].sort();
    let streak = 1;
    for (let i = 1; i < workedDays.length; i += 1) {
      const prev = parseDateKey(workedDays[i - 1]);
      const curr = parseDateKey(workedDays[i]);
      if (!prev || !curr) continue;
      const diff = Math.round((curr - prev) / 86400000);
      if (diff === 1) streak += 1;
      else streak = 1;

      if (streak > employee.maxConsecutiveDays) {
        pushConflict('warning', 'consecutive_days', `${employee.name}: túl sok egymást követő munkanap (${streak}).`, {
          employeeId: employee.id,
          date: workedDays[i],
        });
      }
    }

    const weekendTarget = Math.max(1, Math.ceil((stats.shifts.length || 1) / 10));
    if (stats.weekendShifts > weekendTarget + 1) {
      pushConflict('info', 'weekend_distribution', `${employee.name}: a hétvégi terhelés magas (${stats.weekendShifts} műszak).`, {
        employeeId: employee.id,
      });
    }
  });

  const monthDays = getDaysInMonth(year, month);
  for (let day = 1; day <= monthDays; day += 1) {
    const date = toDateKey(year, month, day);
    const dayShifts = activeSchedules.filter((item) => item.date === date);
    const opening = getOpeningForDate(date, normalizedConfig);
    const expectedTemplates = buildExpectedTemplatesForDate(normalizedConfig, date);

    // Do not force staffing requirements on completely empty days.
    // Publishing should validate entered schedules, not require full-month prefill.
    if (dayShifts.length === 0) {
      continue;
    }

    if (!opening.isOpen) {
      dayShifts
        .filter((shift) => !shift.onCall)
        .forEach((shift) => {
          pushConflict('warning', 'closed_day_shift', `${date}: zárvatartási napon nem ügyeleti műszak szerepel (${shift.startTime}-${shift.endTime}).`, {
            employeeId: shift.employeeId,
            date,
          });
        });
    }

    expectedTemplates.forEach((template) => {
      const shiftsInTemplate = dayShifts.filter((item) => item.startTime === template.startTime && item.endTime === template.endTime);
      const pharmacists = shiftsInTemplate.filter((item) => normalizeRole(item.role) === 'pharmacist').length;

      if (shiftsInTemplate.length < template.requiredStaff) {
        pushConflict('error', 'min_staff', `${date}: létszámhiány (${template.startTime}-${template.endTime}, ${shiftsInTemplate.length}/${template.requiredStaff}).`, {
          date,
          shiftType: template.key,
        });
      }

      if (template.requiredPharmacists > 0 && pharmacists < template.requiredPharmacists) {
        pushConflict('error', 'missing_pharmacist', `${date}: nincs elég gyógyszerész (${template.startTime}-${template.endTime}).`, {
          date,
          shiftType: template.key,
        });
      }
    });

    dayShifts.forEach((shift) => {
      const employee = normalizedEmployees.find((item) => item.id === shift.employeeId);
      if (!employee) return;
      const shiftType = classifyShiftType(shift.startTime, shift.endTime);

      if (
        normalizedConfig.operations?.enforceOpeningHours !== false
        && !shift.onCall
        && opening.isOpen
        && !isRangeWithinWindow(shift.startTime, shift.endTime, opening.openTime, opening.closeTime)
      ) {
        pushConflict('error', 'outside_opening_hours', `${date}: műszak nyitvatartási időn kívül (${shift.startTime}-${shift.endTime}, nyitva: ${opening.openTime}-${opening.closeTime}).`, {
          employeeId: shift.employeeId,
          date,
        });
      }

      if (!employee.allowedShiftTypes.includes(shiftType)) {
        pushConflict('error', 'shift_type_permission', `${employee.name}: jogosulatlan műszaktípus (${shiftType}).`, {
          employeeId: employee.id,
          date,
          shiftType,
        });
      }

      if (shift.role && normalizeRole(shift.role) !== employee.role) {
        pushConflict('warning', 'role_mismatch', `${employee.name}: szerepkör eltérés a beosztásban.`, {
          employeeId: employee.id,
          date,
        });
      }

      if (employee.allowedSites.length > 0 && shift.pharmacyId && !employee.allowedSites.includes(shift.pharmacyId)) {
        pushConflict('error', 'site_permission', `${employee.name}: telephely jogosultság hiány (${date}).`, {
          employeeId: employee.id,
          date,
        });
      }

      if (isWeekend(date) && !employee.canWorkWeekends) {
        pushConflict('warning', 'weekend_preference', `${employee.name}: hétvégi vállalás tiltott, mégis beosztva.`, {
          employeeId: employee.id,
          date,
        });
      }

      if (classifyShiftType(shift.startTime, shift.endTime) === 'night' && !employee.canWorkNight) {
        pushConflict('warning', 'night_preference', `${employee.name}: éjszakai vállalás tiltott, mégis beosztva.`, {
          employeeId: employee.id,
          date,
        });
      }

      const duration = shiftDurationHours(shift.startTime, shift.endTime);
      if (duration > normalizedConfig.laborLaw.requireBreakAfterHours) {
        pushConflict('info', 'break_planning_required', `${employee.name}: ${date} napon ${duration.toFixed(1)} órás műszak, kötelező szünet tervezése szükséges.`, {
          employeeId: employee.id,
          date,
        });
      }

      if (
        normalizedConfig.laborLaw.enforceHungarianLaborLaw
        && shiftType === 'night'
        && duration > normalizedConfig.laborLaw.maxNightShiftHoursLegal
      ) {
        pushConflict('warning', 'night_hours_limit', `${employee.name}: hosszú éjszakai műszak (${duration.toFixed(1)} óra).`, {
          employeeId: employee.id,
          date,
        });
      }

      if (normalizedConfig.laborLaw.enforceHungarianLaborLaw && isPublicHoliday(date, holidaySet)) {
        pushConflict('info', 'holiday_premium_required', `${date}: munkaszüneti napi műszak, 100% bérpótlék ellenőrzése szükséges.`, {
          employeeId: employee.id,
          date,
        });
      }

      // Soft preference override: inform when employee is scheduled on a personally avoided weekday
      const shiftDate = parseDateKey(date);
      const shiftDayOfWeek = shiftDate ? shiftDate.getDay() : -1;
      if (
        shiftDayOfWeek >= 0
        && Array.isArray(employee.avoidWeekdays)
        && employee.avoidWeekdays.includes(shiftDayOfWeek)
      ) {
        pushConflict('info', 'preference_weekday_override', `${employee.name}: ${date} preferált pihenőnap, mégis be van osztva (kézi felülírás).`, {
          employeeId: employee.id,
          date,
        });
      }
    });
  }

  return conflicts;
}

function canAssign({ employee, date, shiftTemplate, assignedShifts, timeOffMap, employeeStats, config }) {
  const shiftType = classifyShiftType(shiftTemplate.startTime, shiftTemplate.endTime);
  const opening = getOpeningForDate(date, config);
  const onCallDay = isOnCallDay(date, config);

  if (isOnTimeOff(employee.id, date, timeOffMap)) return false;
  if (!opening.isOpen && !shiftTemplate.onCall) return false;
  if (shiftTemplate.onCall && !onCallDay) return false;
  if (
    config?.operations?.enforceOpeningHours !== false
    && !shiftTemplate.onCall
    && opening.isOpen
    && !isRangeWithinWindow(shiftTemplate.startTime, shiftTemplate.endTime, opening.openTime, opening.closeTime)
  ) return false;
  if (!employee.allowedShiftTypes.includes(shiftType)) return false;
  if (isWeekend(date) && !employee.canWorkWeekends) return false;
  if (shiftType === 'night' && !employee.canWorkNight) return false;

  const employeeAssigned = assignedShifts.filter((item) => item.employeeId === employee.id);
  const sameDay = employeeAssigned.filter((item) => item.date === date);
  if (sameDay.some((item) => scheduleOverlaps(item, { date, startTime: shiftTemplate.startTime, endTime: shiftTemplate.endTime }))) {
    return false;
  }

  const plannedHours = shiftDurationHours(shiftTemplate.startTime, shiftTemplate.endTime);
  const dailyHours = sameDay.reduce((sum, item) => sum + shiftDurationHours(item.startTime, item.endTime), 0) + plannedHours;
  if (dailyHours > employee.maxDailyHours) return false;

  const stats = employeeStats.get(employee.id);
  const currentTotal = stats ? stats.totalHours : 0;
  if (currentTotal + plannedHours > employee.monthlyHoursLimit + 16) return false;

  // Weekly hours check — prevents > weeklyHoursLimit / legal max per calendar week
  const weekKey = getWeekKey(date);
  const weeklyHoursUsed = employeeAssigned
    .filter((s) => getWeekKey(s.date) === weekKey)
    .reduce((sum, s) => sum + shiftDurationHours(s.startTime, s.endTime), 0);
  const weeklyLimit = Math.min(
    employee.weeklyHoursLimit,
    config && config.laborLaw ? (config.laborLaw.maxWeeklyHoursLegal || 48) : 48
  );
  if (weeklyHoursUsed + plannedHours > weeklyLimit) return false;

  const sorted = [...employeeAssigned, { date, startTime: shiftTemplate.startTime, endTime: shiftTemplate.endTime }]
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const prevDate = parseDateKey(prev.date);
    const nextDate = parseDateKey(next.date);
    if (!prevDate || !nextDate) continue;
    const dayDiff = Math.round((nextDate - prevDate) / 86400000);
    const prevEnd = minutesFromTime(prev.endTime);
    const nextStart = minutesFromTime(next.startTime);
    // Night shifts (endTime < startTime) actually end on the NEXT calendar day.
    // Adjust effective dayDiff accordingly so rest is computed correctly.
    const prevIsNight = minutesFromTime(prev.endTime) < minutesFromTime(prev.startTime);
    const effectiveDayDiff = prevIsNight ? dayDiff - 1 : dayDiff;
    const restHours = effectiveDayDiff > 0
      ? ((effectiveDayDiff - 1) * 24) + ((24 * 60 - prevEnd + nextStart) / 60)
      : ((nextStart - prevEnd) / 60);

    if (restHours < employee.minRestHours) return false;
  }

  let streak = 1;
  const workedDates = new Set((stats && stats.workedDates) ? [...stats.workedDates] : []);
  workedDates.add(date);
  const sortedDates = [...workedDates].sort();
  for (let i = 1; i < sortedDates.length; i += 1) {
    const prev = parseDateKey(sortedDates[i - 1]);
    const curr = parseDateKey(sortedDates[i]);
    if (!prev || !curr) continue;
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) streak += 1;
    else streak = 1;
    if (streak > employee.maxConsecutiveDays) return false;
  }

  return true;
}

function scoreCandidate({ employee, date, shiftTemplate, employeeStats }) {
  const stats = employeeStats.get(employee.id);
  const monthlyLimit = Math.max(1, employee.monthlyHoursLimit);
  const loadRatio = (stats ? stats.totalHours : 0) / monthlyLimit;
  const weekendPenalty = isWeekend(date) ? ((stats ? stats.weekendShifts : 0) * 1.4) : 0;
  const nightPenalty = classifyShiftType(shiftTemplate.startTime, shiftTemplate.endTime) === 'night'
    ? (stats ? stats.nightShifts : 0) * 1.2
    : 0;

  let preferencePenalty = 0;
  if (isWeekend(date) && employee.preferredWeekend === 'avoid') preferencePenalty += 2;
  if (isWeekend(date) && employee.preferredWeekend === 'prefer') preferencePenalty -= 0.4;
  if (classifyShiftType(shiftTemplate.startTime, shiftTemplate.endTime) === 'night' && employee.preferredNight === 'avoid') preferencePenalty += 2.5;
  if (classifyShiftType(shiftTemplate.startTime, shiftTemplate.endTime) === 'night' && employee.preferredNight === 'prefer') preferencePenalty -= 0.5;

  const preferredShiftBonus = employee.preferredShiftTypes.includes(shiftTemplate.key) ? -0.3 : 0;

  const parsedDate = parseDateKey(date);
  const dayOfWeek = parsedDate ? parsedDate.getDay() : -1;
  let weekdayPreferencePenalty = 0;
  if (dayOfWeek >= 0) {
    if (Array.isArray(employee.avoidWeekdays) && employee.avoidWeekdays.includes(dayOfWeek)) {
      weekdayPreferencePenalty += 3.5;
    }
    if (Array.isArray(employee.preferWeekdays) && employee.preferWeekdays.includes(dayOfWeek)) {
      weekdayPreferencePenalty -= 0.8;
    }
  }

  return loadRatio * 10 + weekendPenalty + nightPenalty + preferencePenalty + preferredShiftBonus + weekdayPreferencePenalty;
}

function scoreCandidateWithNoise({ employee, date, shiftTemplate, employeeStats, rand, randomness = 0 }) {
  const baseScore = scoreCandidate({ employee, date, shiftTemplate, employeeStats });
  if (!rand || !randomness) return baseScore;
  const jitter = (rand() - 0.5) * 2 * randomness;
  return baseScore + jitter;
}

function generatePlanOnce({
  normalizedEmployees,
  normalizedConfig,
  baseSchedules,
  timeOffMap,
  year,
  month,
  dateFilter,
  rand,
  randomness,
}) {
  const plannedSchedules = [...baseSchedules];
  const proposedShifts = [];
  const generationConflicts = [];
  const assignmentReasons = [];

  const employeeStats = buildEmployeeStats(normalizedEmployees, plannedSchedules);

  const days = [];
  const monthDays = getDaysInMonth(year, month);
  for (let day = 1; day <= monthDays; day += 1) {
    const key = toDateKey(year, month, day);
    if (Array.isArray(dateFilter) && dateFilter.length > 0 && !dateFilter.includes(key)) continue;
    days.push(key);
  }

  days.forEach((date) => {
    const expectedTemplates = buildExpectedTemplatesForDate(normalizedConfig, date);
    expectedTemplates.forEach((template) => {
      if (Number(template.requiredStaff || 0) <= 0) return;
      const existingForTemplate = plannedSchedules.filter(
        (item) => item.date === date && item.startTime === template.startTime && item.endTime === template.endTime
      );
      const existingPharmacists = existingForTemplate.filter((item) => normalizeRole(item.role) === 'pharmacist').length;
      const missingStaff = Math.max(0, template.requiredStaff - existingForTemplate.length);
      let missingPharmacists = Math.max(0, template.requiredPharmacists - existingPharmacists);

      for (let i = 0; i < missingStaff; i += 1) {
        const candidates = normalizedEmployees
          .filter((employee) => {
            if (missingPharmacists > 0 && employee.role !== 'pharmacist') return false;
            return canAssign({
              employee,
              date,
              shiftTemplate: template,
              assignedShifts: plannedSchedules,
              timeOffMap,
              employeeStats,
              config: normalizedConfig,
            });
          })
          .map((employee) => ({
            employee,
            score: scoreCandidateWithNoise({ employee, date, shiftTemplate: template, employeeStats, rand, randomness }),
          }))
          .sort((a, b) => a.score - b.score);

        if (candidates.length === 0) {
          generationConflicts.push({
            severity: missingPharmacists > 0 ? 'error' : 'warning',
            code: missingPharmacists > 0 ? 'missing_pharmacist' : 'min_staff',
            message: `${date}: nem találtunk megfelelő dolgozót (${template.startTime}-${template.endTime}).`,
            date,
            shiftType: template.key,
          });
          continue;
        }

        const chosen = candidates[0].employee;
        const proposed = {
          id: `proposed-${date}-${template.startTime}-${template.endTime}-${chosen.id}-${i}`,
          date,
          year,
          month,
          day: Number(date.split('-')[2]),
          employeeId: chosen.id,
          employeeName: chosen.name,
          employeeEmail: chosen.email || '',
          linkedUserId: chosen.linkedUserId || null,
          role: chosen.role,
          startTime: template.startTime,
          endTime: template.endTime,
          shiftType: template.key,
          onCall: Boolean(template.onCall),
          status: 'proposed',
          source: 'auto-planner',
        };

        proposedShifts.push(proposed);
        plannedSchedules.push(proposed);

        const stats = employeeStats.get(chosen.id);
        if (stats) {
          const duration = shiftDurationHours(template.startTime, template.endTime);
          stats.totalHours += duration;
          stats.shifts.push(proposed);
          stats.workedDates.add(date);
          if (isWeekend(date)) stats.weekendShifts += 1;
          if (template.key === 'night') stats.nightShifts += 1;
        }

        assignmentReasons.push({
          employeeId: chosen.id,
          employeeName: chosen.name,
          date,
          shift: `${template.startTime}-${template.endTime}`,
          reason: missingPharmacists > 0
            ? 'Kötelező gyógyszerész-kritérium miatt választva.'
            : 'A jelöltek közül a legalacsonyabb terhelés/pref. büntetésű választás.',
        });

        if (chosen.role === 'pharmacist' && missingPharmacists > 0) {
          missingPharmacists -= 1;
        }
      }
    });
  });

  return {
    proposedShifts,
    generationConflicts,
    mergedSchedules: plannedSchedules,
    assignmentReasons,
  };
}

export function generateAutoSchedulePlan({
  employees,
  schedules,
  vacationRequests = [],
  year,
  month,
  config,
  dateFilter = null,
}) {
  const normalizedEmployees = (employees || []).map(normalizeEmployee);
  const normalizedConfig = normalizeConfig(config);
  const baseSchedules = (schedules || []).filter((item) => item.status !== 'deleted');
  const timeOffMap = buildTimeOffMap(normalizedEmployees, vacationRequests);
  const baseSeed = randomSeedFromInput({ year, month, employees: normalizedEmployees });
  const scenarioCount = Math.max(1, Number(normalizedConfig.optimization?.scenarioCount || 1));
  const randomness = Number(normalizedConfig.optimization?.randomness || 0);

  const scenarios = [];
  for (let i = 0; i < scenarioCount; i += 1) {
    const rand = makeSeededRandom(baseSeed + i * 7919);
    const plan = generatePlanOnce({
      normalizedEmployees,
      normalizedConfig,
      baseSchedules,
      timeOffMap,
      year,
      month,
      dateFilter,
      rand,
      randomness,
    });

    const mergedConflicts = [
      ...detectScheduleConflicts({
        employees: normalizedEmployees,
        schedules: plan.mergedSchedules,
        vacationRequests,
        year,
        month,
        config: normalizedConfig,
      }),
      ...(plan.generationConflicts || []),
    ];

    const quality = evaluatePlanQuality({
      employees: normalizedEmployees,
      mergedSchedules: plan.mergedSchedules,
      conflicts: mergedConflicts,
      config: normalizedConfig,
    });

    scenarios.push({
      index: i,
      proposedShifts: plan.proposedShifts,
      generationConflicts: plan.generationConflicts,
      mergedSchedules: plan.mergedSchedules,
      assignmentReasons: plan.assignmentReasons,
      quality,
      conflictsCount: {
        error: mergedConflicts.filter((c) => c.severity === 'error').length,
        warning: mergedConflicts.filter((c) => c.severity === 'warning').length,
        info: mergedConflicts.filter((c) => c.severity === 'info').length,
      },
    });
  }

  scenarios.sort((a, b) => a.quality.objective - b.quality.objective);
  const best = scenarios[0];

  return {
    proposedShifts: best.proposedShifts,
    generationConflicts: best.generationConflicts,
    mergedSchedules: best.mergedSchedules,
    assignmentReasons: best.assignmentReasons,
    planQuality: best.quality,
    alternatives: scenarios.slice(0, 3).map((s) => ({
      scenario: s.index,
      objective: s.quality.objective,
      conflicts: s.conflictsCount,
      proposedShifts: s.proposedShifts.length,
    })),
    model: {
      name: 'HybridConstraintMultiScenario',
      scenarioCount,
      randomness,
    },
  };
}

export function buildPlannerSuggestions(conflicts) {
  const list = [];
  const hasCode = (code) => conflicts.some((item) => item.code === code);

  if (hasCode('missing_pharmacist')) {
    list.push({
      priority: 'critical',
      text: 'Kritikus: legalább egy gyógyszerészt rendelj minden érintett műszakba.',
      type: 'replace_with_pharmacist',
    });
  }

  if (hasCode('min_staff')) {
    list.push({
      priority: 'high',
      text: 'Létszámhiány: töltsd fel a hiányzó műszakokat szabad dolgozókkal.',
      type: 'fill_missing_staff',
    });
  }

  if (hasCode('monthly_hours_limit') || hasCode('weekly_hours_limit')) {
    list.push({
      priority: 'medium',
      text: 'Túlóra csökkentés: cseréld a túlterhelt dolgozók műszakait alacsonyabb terhelésű kollégákra.',
      type: 'reduce_overtime',
    });
  }

  if (hasCode('weekend_distribution') || hasCode('night_preference')) {
    list.push({
      priority: 'medium',
      text: 'Igazságos elosztás: oszd újra a hétvégi és éjszakai műszakokat egyenletesebben.',
      type: 'balance_weekend_night',
    });
  }

  if (hasCode('holiday_premium_required')) {
    list.push({
      priority: 'high',
      text: 'Munkaszüneti napi pótlék: ellenőrizd a 100% pótlék jogosultságot és bérszámfejtést.',
      type: 'verify_holiday_premium',
    });
  }

  if (hasCode('break_planning_required')) {
    list.push({
      priority: 'medium',
      text: 'Szünettervezés: 6+ órás műszakokra jelöld ki a munkaközi szüneteket.',
      type: 'plan_breaks',
    });
  }

  if (hasCode('legal_max_daily_hours') || hasCode('legal_weekly_hours_limit') || hasCode('legal_rest_time')) {
    list.push({
      priority: 'critical',
      text: 'Jogi megfelelőség: a piros jogszabályi hibákat javítani kell publikálás előtt.',
      type: 'legal_compliance_blocker',
    });
  }

  if (list.length === 0) {
    list.push({
      priority: 'info',
      text: 'A jelenlegi terv konfliktusmentes. A rendszer rendben találta a beosztást.',
      type: 'no_action_needed',
    });
  }

  return list;
}

export function computePlannerStats({ employees, schedules, vacationRequests = [], conflicts = [] }) {
  const normalizedEmployees = (employees || []).map(normalizeEmployee);
  const activeSchedules = (schedules || []).filter((item) => item.status !== 'deleted');
  const employeeStats = buildEmployeeStats(normalizedEmployees, activeSchedules);

  const employeeRows = normalizedEmployees.map((employee) => {
    const stats = employeeStats.get(employee.id) || {
      totalHours: 0,
      overtimeHours: 0,
      weekendShifts: 0,
      nightShifts: 0,
    };

    const vacationDays = (vacationRequests || [])
      .filter((item) => item.employeeId === employee.id)
      .reduce((sum, item) => {
        const start = parseDateKey(item.startDate);
        const end = parseDateKey(item.endDate || item.startDate);
        if (!start || !end) return sum;
        return sum + Math.floor((end - start) / 86400000) + 1;
      }, 0);

    return {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      monthlyHours: Number(stats.totalHours.toFixed(1)),
      overtimeHours: Number(Math.max(0, stats.totalHours - employee.monthlyHoursLimit).toFixed(1)),
      weekendShifts: stats.weekendShifts,
      sundayShifts: stats.sundayShifts,
      publicHolidayShifts: stats.publicHolidayShifts,
      nightShifts: stats.nightShifts,
      estimatedSundayPremiumHours: Number(stats.estimatedSundayPremiumHours.toFixed(1)),
      estimatedHolidayPremiumHours: Number(stats.estimatedHolidayPremiumHours.toFixed(1)),
      vacationDays,
      absences: employee.sickDays.length,
    };
  });

  const severityCount = conflicts.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    employees: employeeRows,
    summary: {
      totalMonthlyHours: employeeRows.reduce((sum, item) => sum + item.monthlyHours, 0),
      totalOvertimeHours: employeeRows.reduce((sum, item) => sum + item.overtimeHours, 0),
      totalWeekendShifts: employeeRows.reduce((sum, item) => sum + item.weekendShifts, 0),
      totalSundayShifts: employeeRows.reduce((sum, item) => sum + item.sundayShifts, 0),
      totalPublicHolidayShifts: employeeRows.reduce((sum, item) => sum + item.publicHolidayShifts, 0),
      totalNightShifts: employeeRows.reduce((sum, item) => sum + item.nightShifts, 0),
      totalEstimatedSundayPremiumHours: Number(employeeRows.reduce((sum, item) => sum + item.estimatedSundayPremiumHours, 0).toFixed(1)),
      totalEstimatedHolidayPremiumHours: Number(employeeRows.reduce((sum, item) => sum + item.estimatedHolidayPremiumHours, 0).toFixed(1)),
      totalVacationDays: employeeRows.reduce((sum, item) => sum + item.vacationDays, 0),
      totalAbsences: employeeRows.reduce((sum, item) => sum + item.absences, 0),
      conflictCritical: severityCount.error || 0,
      conflictWarning: severityCount.warning || 0,
      conflictInfo: severityCount.info || 0,
    },
  };
}

export function quickReplanForAbsence({
  employees,
  schedules,
  vacationRequests = [],
  year,
  month,
  config,
  sickEmployeeId,
  affectedDates,
}) {
  const dates = Array.isArray(affectedDates) ? affectedDates : [];
  const cleanedSchedules = (schedules || []).filter((item) => {
    if (item.status === 'deleted') return false;
    if (item.employeeId !== sickEmployeeId) return true;
    return !dates.includes(item.date);
  });

  return generateAutoSchedulePlan({
    employees,
    schedules: cleanedSchedules,
    vacationRequests,
    year,
    month,
    config,
    dateFilter: dates,
  });
}
