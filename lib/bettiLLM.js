/**
 * BETTI LLM FALLBACK
 *
 * Google Gemini 2.0 Flash alapú fallback, amikor az intent parser
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
- Rövid, lényegre törő válaszokat adsz (max 3-4 mondat)
- Magyar nyelven kommunikálsz

SZAKTERÜLETED (csak ezekben segítesz):
- Műszak-beosztás, munkarend, naptár
- Szabadság, szabadnapok, ünnepnapok
- Túlóra, pótlék, helyettesítés
- Gyógyszerész / asszisztens dolgozói kérdések
- Beosztás tervezés, átszervezés

HA VALAMI NEM IDE TARTOZIK:
Röviden jelezd, hogy csak beosztással kapcsolatban tudsz segíteni, és ajánlj egy releváns kérdést.

FONTOS:
- Soha ne adj ki személyes adatokat
- Ne hozz létre, ne módosíts beosztást (az a rendszer dolga) – csak tájékoztass
- Ha nem tudod a választ, mondd el őszintén`;

/**
 * Összeállítja a kontextust a Gemini-nek:
 * - chatRole (pharmacy / employee)
 * - utolsó néhány üzenetváltás
 * - beosztás statisztikák (ha van)
 */
function buildContextSummary({ chatRole, recentConversation, stats, chatRoleLabel }) {
  const parts = [];

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
 * Gemini 2.0 Flash hívás.
 * Visszaad: { reply: string, usedLLM: true }
 * Hiba esetén: { reply: null, usedLLM: false, error: string }
 */
export async function callBettiLLM({ message, chatRole, recentConversation = [], stats = null }) {
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
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    });

    const contextSummary = buildContextSummary({ chatRole, recentConversation, stats });

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
