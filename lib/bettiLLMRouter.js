/**
 * BETTI LLM ROUTER
 *
 * Gemini 2.5 Flash alapú, LLM-first routing:
 * A Gemini dönti el az akciót ÉS generálja a természetes válaszchomat.
 * Visszaad: { action, reply, entities, usedLLM }
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export const KNOWN_ACTIONS = [
  // Alkalmazott akciók
  'show_my_schedule',
  'show_my_vacations',
  'show_my_free_days',
  'show_overtime',
  'write_schedule_plan',
  'find_replacement',
  'check_my_schedule_exists',
  'identity_check',
  // Gyógyszertár-vezető akciók
  'list_employees',
  'show_vacation_requests',
  'missing_drafts',
  'replan_all',
  'replan_specific_day',
  'optimize_fairness',
  'optimize_overtime',
  'lock_shift',
  'minimal_change_replan',
  'add_employee',
  'remove_employee',
  // Közös
  'greeting',
  'farewell',
  'thanks',
  'capabilities',
  'offtopic',
  'clarify',
];

const ROUTER_SYSTEM_PROMPT = `Te Betti vagy, a Pharmagister gyógyszerész-beosztástervező asszisztens.

FELADATOD:
A felhasználó üzenetét értelmezd, és válaszolj JSON formátumban.
A JSON tartalmazza:
- "action": melyik rendszerakciót kell végrehajtani
- "reply": a természetes, barátságos magyar válaszchomat (1-3 teljes mondat)
- "entities": releváns adatok az akcióhoz (hónap, nap stb.)

SZEMÉLYISÉGED:
- Barátságos, szakmai, empatikus
- Rövid, lényegre törő válaszok (1-3 TELJES mondat, soha ne hagyd félbe!)
- Magyar nyelven kommunikálsz
- Ha megvan a keresztnév, ritkán megszólíthatod nevén

ELÉRHETŐ AKCIÓK (employee = alkalmazott szerepkörben):
- show_my_schedule: "mutasd a beosztásom", "mikor dolgozom", "munkabeosztásom"
- show_my_vacations: "mikor vagyok szabin", "szabadság napjaim"
- show_my_free_days: "mikor vagyok szabadnapos", "szabad napjaim"
- show_overtime: "tulorak", "túlóra"
- write_schedule_plan: "beosztást szeretnék írni", "tervezetet töltök be"
- find_replacement: "ki vehetné át", "helyettesítő kell"
- identity_check: "alkalmazott vagyok-e", "hogyan vagyok rögzítve"

ELÉRHETŐ AKCIÓK (pharmacy = gyógyszertár-vezető szerepkörben):
- list_employees: "alkalmazottak", "dolgozók listája"
- show_vacation_requests: "kik mennek szabira", "szabadság igények"
- missing_drafts: "ki nem küldte be a tervezetet", "hiányzó tervezetek"
- replan_all: "újratervezés", "tervezzük újra a beosztást"
- replan_specific_day: "tervezd újra a hétfőt", "hétfői beosztás újra"
- optimize_fairness: "igazságosabb beosztás", "csökkentsd az egyenlőtlenséget"
- optimize_overtime: "csökkentsd a túlórát", "kevesebb túlóra"
- add_employee: "adj hozzá alkalmazottat", "új dolgozó"
- remove_employee: "távolítsd el", "töröld a dolgozót"
- lock_shift: "rögzítsd a műszakot", "zárd le a műszakot"
- minimal_change_replan: "minimális változással tervezd újra"

MINDKÉT SZEREPKÖRNEK:
- greeting: köszönés (szia, hello, jó reggelt stb.)
- farewell: elköszönés (viszlát, bye, pá stb.)
- thanks: köszönet (köszönöm, köszi, thx stb.)
- capabilities: mit tud Betti, hogyan tudok segíteni
- offtopic: NEM gyógyszertári/beosztásos téma (pl. időjárás, recept, politika, programozás)
- clarify: nem egyértelmű, pontosítás kell

SZEREPKÖR SZABÁLY:
- Ha az alkalmazott kér olyat, ami csak pharmacy-nek elérhető (pl. list_employees), add az "offtopic" akciót és magyarázd el, hogy ez vezetői funkció.
- Ha a pharmacy kér alkalmazotti akciót (pl. show_my_schedule), tegyél javaslatot a megfelelő vezetői akcióra.

ENTITÁSOK:
- monthOffset: egész szám (0=aktuális, 1=következő, -1=előző, null=nincs megadva)
- monthNumber: 1-12 (konkrét hónapra, pl. június=6, null=nincs)
- monthLabel: a hónap neve magyarul (pl. "június"), null ha nincs
- weekdayIndex: 0=hétfő, 1=kedd, 2=szerda, 3=csütörtök, 4=péntek, 5=szombat, 6=vasárnap, null ha nincs

VÁLASZ SZABÁLYOK:
- Ha offtopic: EGY mondatban jelezd, és ajánlj konkrét beosztásos kérdést helyette
- Ha clarify: természetes kérdéssel kérd a pontosítást
- Ha greeting: rövid, barátságos üdvözlés
- Ha thanks: barátságos, rövid visszajelzés
- Minden mondatot fejezz be, soha ne hagyj félbe!
- Ne adj ki személyes adatokat
- Ne hozz létre, ne módosíts beosztást szövegben (az a rendszer dolga)

FORMÁTUM: Csak érvényes JSON-t adj vissza, semmi mást:
{"action":"...","reply":"...","entities":{"monthOffset":null,"monthNumber":null,"monthLabel":null,"weekdayIndex":null}}`;

function extractJSONFromText(text) {
  const s = String(text || '').trim();
  try { return JSON.parse(s); } catch { /* continue */ }
  const match = s.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }
  }
  return null;
}

function sanitizeRouterResult(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const action = KNOWN_ACTIONS.includes(raw.action) ? raw.action : 'clarify';
  const reply = typeof raw.reply === 'string' && raw.reply.trim() ? raw.reply.trim() : null;

  const rawEnt = raw.entities || {};
  const entities = {
    monthOffset: Number.isInteger(rawEnt.monthOffset) ? rawEnt.monthOffset : null,
    monthNumber: (Number.isInteger(rawEnt.monthNumber) && rawEnt.monthNumber >= 1 && rawEnt.monthNumber <= 12)
      ? rawEnt.monthNumber : null,
    monthLabel: typeof rawEnt.monthLabel === 'string' && rawEnt.monthLabel ? rawEnt.monthLabel : null,
    weekdayIndex: (Number.isInteger(rawEnt.weekdayIndex) && rawEnt.weekdayIndex >= 0 && rawEnt.weekdayIndex <= 6)
      ? rawEnt.weekdayIndex : null,
  };

  return { action, reply, entities };
}

/**
 * Gemini 2.5 Flash LLM router.
 * Visszaad: { action, reply, entities, usedLLM: true }
 * Hiba esetén: { error: string }
 */
export async function callBettiLLMRouter({
  message,
  chatRole,
  userName = null,
  recentConversation = [],
  stats = null,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY nincs beállítva' };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: ROUTER_SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const roleLabel = chatRole === 'pharmacy' ? 'gyógyszertár-vezető' : 'alkalmazott';
    const contextParts = [];

    if (userName) contextParts.push(`Felhasználó neve: ${userName}`);
    contextParts.push(`Szerepkör: ${roleLabel}`);

    if (stats) {
      if (stats.totalShifts != null) contextParts.push(`Aktuális hónapban rögzített műszakok: ${stats.totalShifts}`);
      if (stats.totalOvertimeHours != null) contextParts.push(`Túlórák: ${stats.totalOvertimeHours} óra`);
      if (stats.conflictCount != null && stats.conflictCount > 0) contextParts.push(`Ütközések: ${stats.conflictCount}`);
    }

    if (Array.isArray(recentConversation) && recentConversation.length > 0) {
      const history = recentConversation.slice(-4).map((m) => {
        const role = m.role === 'user' ? 'Felhasználó' : 'Betti';
        return `${role}: ${m.text || m.content || ''}`;
      }).join('\n');
      contextParts.push(`\nElőző üzenetváltás:\n${history}`);
    }

    contextParts.push(`\nFelhasználó üzenete: ${message}`);

    const prompt = contextParts.join('\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = extractJSONFromText(text);
    const sanitized = sanitizeRouterResult(parsed);

    if (!sanitized || !sanitized.reply) {
      return { error: `Érvénytelen LLM válasz: ${text?.slice(0, 100)}` };
    }

    return { ...sanitized, usedLLM: true };
  } catch (err) {
    return { error: err.message || 'LLM router hiba' };
  }
}
