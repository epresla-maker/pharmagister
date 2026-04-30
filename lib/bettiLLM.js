/**
 * BETTI LLM FALLBACK
 *
 * Google Gemini 2.5 Flash alapú fallback, amikor az intent parser
 * nem ismeri fel a felhasználó üzenetét (intent === 'unknown').
 *
 * Betti személyisége:
 *  – Magyar gyógyszerész asszisztens
 *  – Csak gyógyszertári beosztás, műszak, szabadság, túlóra témákban segít
 *  – Rövid, barátságos válaszok
 *  – Ha nem tud segíteni, őszintén megmondja
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const BETTI_SYSTEM_PROMPT = `Te Betti vagy, a Pharmagister gyógyszerész-beosztástervező asszisztens.

SZEMÉLYISÉGED:
- Barátságos, szakmai, empatikus
- Rövid, lényegre törő válaszokat adsz (2-3 TELJES mondat, soha ne hagyd félbe)
- Magyar nyelven kommunikálsz
- Minden mondatot fejezz be! Soha ne kezdj el felsorolást, amit nem tudsz befejezni.

SZAKTERÜLETED (csak ezekben segítesz):
- Műszak-beosztás, munkarend, naptár
- Szabadság, szabadnapok, ünnepnapok
- Túlóra, pótlék, helyettesítés
- Gyógyszerész / asszisztens dolgozói kérdések
- Beosztás tervezés, átszervezés

SZEREPKÖR SZABÁLY:
- Mindig vedd figyelembe, hogy a felhasználó gyógyszertár-vezető vagy alkalmazott.
- Ha alkalmazott ír be olyat, hogy "beosztás", akkor alapértelmezetten a SAJÁT beosztására vagy beosztás-tervezetére gondol, nem publikálásra.
- Ha gyógyszertár-vezető ír be olyat, hogy "beosztás", akkor vezetői nézőpontból segíts.
- Ha megvan a keresztneve, természetesen, ritkán megszólíthatod a nevén.

HA VALAMI NEM IDE TARTOZIK:
Egy mondatban jelezd, hogy csak beosztással kapcsolatban tudsz segíteni. NE válaszolj a kérdésre, NE adj általános tippeket, NE menj bele a témába. Ajánlj egy konkrét beosztással kapcsolatos kérdést helyette.

FONTOS:
- Soha ne adj ki személyes adatokat
- Ne hozz létre, ne módosíts beosztást (az a rendszer dolga) – csak tájékoztass
- Ha nem tudod a választ, mondd el őszintén
- TILOS félbehagyott mondattal végezni a választ`;

/**
 * Összeállítja a kontextust a Gemini-nek:
 * - chatRole (pharmacy / employee)
 * - utolsó néhány üzenetváltás
 * - beosztás statisztikák (ha van)
 */
function buildContextSummary({ chatRole, recentConversation, stats, chatRoleLabel, userName }) {
  const parts = [];

  if (userName) {
    parts.push(`Felhasználó keresztneve: ${userName}`);
  }

  parts.push(`Felhasználó szerepköre: ${chatRoleLabel || (chatRole === 'pharmacy' ? 'Gyógyszertár-vezető' : 'Gyógyszerész/asszisztens')}`);

  if (stats) {
    const { totalShifts, totalOvertimeHours, conflictCount } = stats;
    if (totalShifts != null) parts.push(`Jelenlegi hónapban rögzített műszakok: ${totalShifts}`);
    if (totalOvertimeHours != null) parts.push(`Túlórák: ${totalOvertimeHours} óra`);
    if (conflictCount != null && conflictCount > 0) parts.push(`Ütközések száma: ${conflictCount}`);
  }

  if (Array.isArray(recentConversation) && recentConversation.length > 0) {
    const history = recentConversation.slice(-4).map((m) => {
      const role = m.role === 'user' ? 'Felhasználó' : 'Betti';
      return `${role}: ${m.text || m.content || ''}`;
    }).join('\n');
    parts.push(`\nElőző üzenetváltás:\n${history}`);
  }

  return parts.join('\n');
}

/**
 * Gemini 2.5 Flash hívás.
 * Visszaad: { reply: string, usedLLM: true }
 * Hiba esetén: { reply: null, usedLLM: false, error: string }
 */
export async function callBettiLLM({ message, chatRole, userName = null, recentConversation = [], stats = null }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: null, usedLLM: false, error: 'GEMINI_API_KEY nincs beállítva' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: BETTI_SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
      },
    });

    const contextSummary = buildContextSummary({ chatRole, userName, recentConversation, stats });

    const userPrompt = contextSummary
      ? `[Kontextus]\n${contextSummary}\n\n[Felhasználó kérdése]\n${message}`
      : message;

    const result = await model.generateContent(userPrompt);
    const reply = result.response.text()?.trim();

    if (!reply) {
      return { reply: null, usedLLM: false, error: 'Üres válasz' };
    }

    return { reply, usedLLM: true };
  } catch (err) {
    return { reply: null, usedLLM: false, error: err.message || 'Gemini hiba' };
  }
}
