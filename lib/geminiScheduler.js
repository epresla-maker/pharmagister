/**
 * Betti – Gemini-alapú intelligens beosztástervező
 * Gemini 1.5 Flash modellt használ, majd a constraint engine validálja az eredményt.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  detectScheduleConflicts,
  generateAutoSchedulePlan,
} from './scheduleEngine.js';

const WEEKDAY_HU = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildPrompt({ employees, config, vacationRequests, year, month }) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthName = new Date(year, month - 1, 1).toLocaleString('hu-HU', { month: 'long' });

  // Opening hours summary
  const openingLines = [];
  const openingByWeekday = config?.operations?.openingHoursByWeekday || {};
  for (let d = 0; d <= 6; d++) {
    const o = openingByWeekday[d];
    if (o && o.isOpen !== false) {
      openingLines.push(`  ${WEEKDAY_HU[d]}: ${o.openTime || '08:00'} – ${o.closeTime || '20:00'}`);
    } else {
      openingLines.push(`  ${WEEKDAY_HU[d]}: ZÁRVA`);
    }
  }

  const onCall = config?.operations?.onCall;
  const onCallLines = onCall?.enabled
    ? [
        `Ügyelet AKTÍV: ${(onCall.days || []).map((d) => WEEKDAY_HU[d]).join(', ')} napokon`,
        `Ügyeleti időablak: ${onCall.startTime || '20:00'} – ${onCall.endTime || '08:00'}`,
        `Minimum gyógyszerész ügyeleten: ${onCall.requiredPharmacists ?? 1} fő`,
      ]
    : ['Ügyelet: nincs'];

  // Employee summary
  const employeeLines = employees.map((e) => {
    const timeOff = (vacationRequests || [])
      .filter((v) => v.employeeId === e.id && (v.status === 'accepted' || v.status === 'pending'))
      .map((v) => `${v.startDate} – ${v.endDate}`)
      .join(', ');

    return [
      `- ID: ${e.id} | Név: ${e.name} | Szerepkör: ${e.role === 'pharmacist' ? 'gyógyszerész' : 'asszisztens'}`,
      `  Heti célóra: ${e.preferences?.targetWeeklyHours || 40}h`,
      `  Hétvégén dolgozhat: ${e.preferences?.canWorkWeekends !== false ? 'igen' : 'nem'}`,
      `  Éjszakán dolgozhat: ${e.preferences?.canWorkNight !== false ? 'igen' : 'nem'}`,
      timeOff ? `  Szabadság/betegség: ${timeOff}` : null,
      e.preferences?.schedulingNotes ? `  Megjegyzés: ${e.preferences.schedulingNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  // Shift templates summary
  const shiftLines = (config.shiftTemplates || []).map(
    (t) =>
      `  Műszak "${t.key}": ${t.startTime}–${t.endTime}, min. ${t.requiredStaff || 1} dolgozó, min. ${t.requiredPharmacists || 0} gyógyszerész${t.onCall ? ' [ÜGYELET]' : ''}`
  );

  return `
Te egy tapasztalt gyógyszertári beosztástervező asszisztens vagy, neve: Betti.
A feladatod egy teljes havi munkabeosztás elkészítése ${year}. ${monthName} hónapra (${daysInMonth} nap).

=== NYITVATARTÁS ===
${openingLines.join('\n')}

=== ÜGYELET ===
${onCallLines.join('\n')}

=== MŰSZAKSABLONOK ===
${shiftLines.join('\n')}

=== DOLGOZÓK (${employees.length} fő) ===
${employeeLines.join('\n\n')}

=== KÖVETELMÉNYEK ===
- Minimum ${config.minPharmacistsPerShift || 1} gyógyszerész minden normál nyitott műszakban
- Minimum ${config.minStaffPerShift || 2} dolgozó minden nyitott műszakban
- Magyar munkajog: max 8–12 óra/nap, max 48 óra/hét, min 11 óra pihenőidő műszakok között
- Ne tervezz szabadnapos/beteg dolgozóra műszakot
- Igazságos elosztás: közel egyenlő terhelés minden dolgozónak
- Vedd figyelembe a személyes preferenciákat (hétvége, éjszaka, megjegyzések)
- Zárt napokon (ZÁRVA) ne legyen normál műszak, csak esetleg ügyelet ha az aktív

=== FELADAT ===
Generálj egy teljes havi beosztást a fenti feltételek alapján.
Minden napra és minden aktív műszakra add meg, hogy melyik dolgozó (ID alapján) mikor dolgozik.
Törekedj arra, hogy a havi végén minden dolgozó kb. ${Math.round(((config.minStaffPerShift || 2) * 22 * 8) / Math.max(1, employees.length))} órát dolgozzon.

Válaszolj kizárólag JSON formátumban, az alábbi struktúrával:
{
  "shifts": [
    { "employeeId": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "onCall": false },
    ...
  ],
  "reasoning": "Rövid indoklás magyarul, max 3 mondat."
}
`.trim();
}

/**
 * Gemini-alapú beosztásgenerálás.
 * Ha sikeres, a constraint engine validálja az eredményt.
 * Ha Gemini nem elérhető vagy hibázik, fallback a szabályalapú motorra.
 */
export async function generateGeminiSchedulePlan({
  employees,
  schedules,
  vacationRequests = [],
  year,
  month,
  config,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Betti] GEMINI_API_KEY nincs beállítva – szabályalapú motor fut');
    return generateAutoSchedulePlan({ employees, schedules, vacationRequests, year, month, config });
  }

  let geminiShifts = [];
  let reasoning = '';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const prompt = buildPrompt({ employees, config, vacationRequests, year, month });
    console.log('[Betti] Gemini kérés küldése...');

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Nem sikerült JSON-t értelmezni a Gemini válaszából');
    }

    geminiShifts = Array.isArray(parsed.shifts) ? parsed.shifts : [];
    reasoning = parsed.reasoning || '';
    console.log(`[Betti] Gemini ${geminiShifts.length} műszakot javasolt. Indoklás: ${reasoning}`);
  } catch (err) {
    console.error('[Betti] Gemini hiba, fallback a szabályalapú motorra:', err.message);
    return generateAutoSchedulePlan({ employees, schedules, vacationRequests, year, month, config });
  }

  // Build employee + pharmacy name map for saving
  const employeeMap = new Map((employees || []).map((e) => [e.id, e]));

  // Normalize Gemini output to match our shift format
  const existingActive = (schedules || []).filter((s) => s.status !== 'deleted');
  const existingSet = new Set(
    existingActive.map((s) => `${s.date}|${s.startTime}|${s.endTime}|${s.employeeId}`)
  );

  const proposedShifts = [];
  const generationConflicts = [];

  for (const shift of geminiShifts) {
    const { employeeId, date, startTime, endTime, onCall = false } = shift;

    // Basic validation
    if (!employeeId || !date || !startTime || !endTime) {
      generationConflicts.push({
        severity: 'warning',
        code: 'gemini_incomplete_shift',
        message: `Gemini hiányos műszakot javasolt: ${JSON.stringify(shift)}`,
        date,
        employeeId,
      });
      continue;
    }

    const employee = employeeMap.get(employeeId);
    if (!employee) {
      generationConflicts.push({
        severity: 'warning',
        code: 'gemini_unknown_employee',
        message: `Gemini ismeretlen dolgozó ID-t javasolt: ${employeeId}`,
        date,
        employeeId,
      });
      continue;
    }

    const dedupeKey = `${date}|${startTime}|${endTime}|${employeeId}`;
    if (existingSet.has(dedupeKey)) continue;

    proposedShifts.push({
      employeeId,
      employeeName: employee.name || '',
      employeeEmail: employee.email || '',
      linkedUserId: employee.linkedUserId || null,
      role: employee.role || 'other',
      date,
      startTime,
      endTime,
      onCall: Boolean(onCall),
    });

    existingSet.add(dedupeKey);
  }

  // Merge with existing for conflict detection
  const mergedSchedules = [
    ...existingActive,
    ...proposedShifts.map((s) => ({ ...s, status: 'active' })),
  ];

  // Run constraint engine conflict detection on Gemini's output
  const conflicts = [
    ...detectScheduleConflicts({
      employees,
      schedules: mergedSchedules,
      vacationRequests,
      year,
      month,
      config,
    }),
    ...generationConflicts,
  ];

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;

  // If too many hard errors, fall back to rule-based engine
  if (errorCount > proposedShifts.length * 0.3 && proposedShifts.length > 0) {
    console.warn(`[Betti] Gemini tervében ${errorCount} komoly hiba – szabályalapú motor aktiválva`);
    const fallback = generateAutoSchedulePlan({ employees, schedules, vacationRequests, year, month, config });
    return {
      ...fallback,
      model: {
        name: 'GeminiHybrid (fallback)',
        provider: 'google',
        geminiShifts: proposedShifts.length,
        fallbackReason: `${errorCount} komoly szabálysértés Gemini tervében`,
      },
      assignmentReasons: [
        { reason: `Betti (Gemini) terve ${errorCount} komoly hibát tartalmazott. A szabályalapú motor véglegesítette a beosztást.` },
      ],
    };
  }

  return {
    proposedShifts,
    generationConflicts,
    mergedSchedules,
    assignmentReasons: [
      {
        reason: `Betti (Gemini 1.5 Flash) generálta a beosztást. ${reasoning}`,
      },
    ],
    model: {
      name: 'Betti (Gemini 1.5 Flash)',
      provider: 'google',
      geminiShifts: proposedShifts.length,
      reasoning,
    },
  };
}
