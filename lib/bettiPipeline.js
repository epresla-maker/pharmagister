/**
 * BETTI CENTRAL DECISION PIPELINE
 *
 * Egyetlen belépési pont minden üzenethez:
 *
 *   INPUT
 *     → CONFIDENCE GATE   (< 0.85 → clarify, témán maradva)
 *     → TOPIC CONTINUITY  (igen/nem/hesitation → nem reset)
 *     → DISAMBIGUATION    (kétértelmű → visszakérdez)
 *     → DISPATCH          (action handler tábla)
 *     → OPEN LOOP DEDUP   (nem ismétli ugyanazt a kérdést)
 *     → STATE UPDATE
 *
 * SZABÁLYOK:
 *   ✔ confidence < 0.85  → clarify (témán maradva ha van aktív téma)
 *   ✔ negative/hesitation → ugyanazon témán marad
 *   ✔ nincs DB-hívás bizonytalan inputra
 *   ✔ nem ismétli az open loop kérdést
 *   ✔ nem reset "nem értem"-re
 */

// ─── SYNONYM MAP (same as intentParserV6 / route) ────────────────────────────
const SYNONYM_REPLACEMENTS = [
  [/\b(szabi|szabin|szabira|szabadsagra)\b/g, 'szabadsag'],
  [/\b(piheno|pihenonap|pihi|pihinap)\b/g, 'szabadnap'],
  [/\b(pluszora|extraora|extra ora|overtime)\b/g, 'tulora'],
  [/\b(muszakrend|muszakterv|roster|schedule)\b/g, 'beosztas'],
  [/\b(mutasd|muti|mutass|megmutatod|megmutatnad|megnezed|nezzuk)\b/g, 'mutasd'],
  [/\b(segicc|segics|help)\b/g, 'segits'],
  [/\b(kiir|listaz|sorold)\b/g, 'mutasd'],
  [/\b(atszervez|atszervezes|ujraszamol)\b/g, 'ujratervezes'],
  [/\b(hianyzik|potolni|potlas)\b/g, 'helyettesites'],
];

const MONTH_NAME_TO_NUMBER = {
  januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6,
  julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12,
};

// ─── TEXT UTILITIES ───────────────────────────────────────────────────────────

function normalizeText(text) {
  const base = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  let canonical = ` ${base} `;
  for (const [re, replacement] of SYNONYM_REPLACEMENTS) {
    canonical = canonical.replace(re, replacement);
  }
  return canonical.replace(/\s+/g, ' ').trim();
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

export function normalizeChatRole(role) {
  const norm = normalizeText(role);
  if (norm.includes('pharmacy') || norm.includes('patika') || norm.includes('manager')) return 'pharmacy';
  if (norm.includes('employee') || norm.includes('dolgozo')) return 'employee';
  return 'default';
}

// ─── MONTH RESOLUTION ────────────────────────────────────────────────────────

export function detectMonthReference(text) {
  const norm = normalizeText(text);
  if (!norm) return null;

  if (containsAny(norm, ['kovetkezo honap', 'jovo honap', 'jov honap', 'jovohonap'])) {
    return { monthOffset: 1, label: 'kovetkezo honap' };
  }
  if (containsAny(norm, ['elozo honap', 'mult honap'])) {
    return { monthOffset: -1, label: 'elozo honap' };
  }
  if (containsAny(norm, ['aktualis honap', 'erre a honapra', 'ebben a honapban', 'mostani honap', 'e havi'])) {
    return { monthOffset: 0, label: 'aktualis honap' };
  }
  const monthMatch = norm.match(/\b(januar|februar|marcius|aprilis|majus|junius|julius|augusztus|szeptember|oktober|november|december)(ban|ben|ra|re|t|i)?\b/);
  if (monthMatch?.[1]) {
    const monthNumber = MONTH_NAME_TO_NUMBER[monthMatch[1]];
    if (monthNumber) {
      const currentMonth = new Date().getMonth() + 1;
      return { monthOffset: monthNumber - currentMonth, monthNumber, label: monthMatch[1] };
    }
  }
  return null;
}

export function buildMonthQuickActions(topic = 'beosztas') {
  const utteranceByTopic = {
    beosztas: {
      current: 'A beosztasom erre a honapra',
      next: 'A beosztasom a kovetkezo honapra',
      prev: 'A beosztasom az elozo honapra',
    },
    szabadsag: {
      current: 'A szabadsagaim erre a honapra',
      next: 'A szabadsagaim a kovetkezo honapra',
      prev: 'A szabadsagaim az elozo honapra',
    },
    szabadnap: {
      current: 'A szabadnapjaim erre a honapra',
      next: 'A szabadnapjaim a kovetkezo honapra',
      prev: 'A szabadnapjaim az elozo honapra',
    },
    tervezet: {
      current: 'Erre a honapra ellenorizzem a tervezeteket',
      next: 'A kovetkezo honapra ellenorizzem a tervezeteket',
      prev: 'Az elozo honapra ellenorizzem a tervezeteket',
    },
  };
  const byTopic = utteranceByTopic[topic] || utteranceByTopic.beosztas;
  return [
    { key: `${topic}_current_month`, label: 'Aktualis honap', utterance: byTopic.current },
    { key: `${topic}_next_month`, label: 'Kovetkezo honap', utterance: byTopic.next },
    { key: `${topic}_prev_month`, label: 'Elozo honap', utterance: byTopic.prev },
  ];
}

function hasMonthEntities(entities) {
  return Number.isInteger(entities?.monthOffset) || Number.isInteger(entities?.monthNumber);
}

function getRememberedMonth(entities) {
  if (!hasMonthEntities(entities)) return null;
  return {
    ...(Number.isInteger(entities?.monthOffset) ? { monthOffset: entities.monthOffset } : {}),
    ...(Number.isInteger(entities?.monthNumber) ? { monthNumber: entities.monthNumber } : {}),
    ...(entities?.monthLabel ? { monthLabel: entities.monthLabel } : {}),
  };
}

function isContinuationPrompt(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  const words = norm.split(/\s+/).filter(Boolean);
  return (
    words.length <= 5
    || containsAny(norm, ['es ', 'es a ', 'ugyanerre', 'ugyanarra', 'ugyanebben', 'erre is', 'arra is', 'az is', 'ezt is'])
  );
}

function resolveMonth({ message, lastAssistantEntities, allowRemembered = false }) {
  const explicit = detectMonthReference(message);
  if (explicit) return explicit;
  if (!allowRemembered) return null;
  return getRememberedMonth(lastAssistantEntities);
}

// ─── SUGGESTION POOLS ────────────────────────────────────────────────────────

const UNKNOWN_SUGGESTIONS = [
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
  { key: 'my_schedule', label: 'Mi a beosztasom?', utterance: 'Mi a beosztasom?' },
  { key: 'my_vacation', label: 'Mikor vagyok szabin?', utterance: 'Mikor vagyok szabin?' },
  { key: 'replan_day', label: 'Tervezd ujra csak a hetfot', utterance: 'Tervezd ujra csak a hetfot' },
  { key: 'find_replacement', label: 'Ki tudna atvenni a holnapi estet?', utterance: 'Ki tudna atvenni a holnapi estet?' },
];

const PHARMACY_UNKNOWN_SUGGESTIONS = [
  { key: 'list_employees', label: 'Listazd a dolgozoimat', utterance: 'Listazd a dolgozoimat' },
  { key: 'show_vacation_requests', label: 'Kik mennek szabira?', utterance: 'Kik mennek szabira?' },
  { key: 'missing_drafts', label: 'Ki nem irta meg a tervezetet?', utterance: 'Ki nem irta meg a tervezetet?' },
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
  { key: 'replan_day', label: 'Tervezd ujra csak a hetfot', utterance: 'Tervezd ujra csak a hetfot' },
  { key: 'find_replacement', label: 'Ki tudna atvenni a holnapi estet?', utterance: 'Ki tudna atvenni a holnapi estet?' },
  { key: 'optimize_overtime', label: 'Kevesebb tulora', utterance: 'Csokkentsd a tulorat' },
  { key: 'optimize_fairness', label: 'Igazsagosabb verzio', utterance: 'Legyen igazsagosabb a beosztas' },
];

const EMPLOYEE_UNKNOWN_SUGGESTIONS = [
  { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?' },
  { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
  { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
  { key: 'write_schedule_plan', label: 'Beosztast szeretnek irni', utterance: 'Beosztast szeretnek irni' },
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
];

function getSuggestionPool(chatRole) {
  if (chatRole === 'pharmacy') return PHARMACY_UNKNOWN_SUGGESTIONS;
  if (chatRole === 'employee') return EMPLOYEE_UNKNOWN_SUGGESTIONS;
  return UNKNOWN_SUGGESTIONS;
}

export function buildUnknownSuggestions(message, chatRole = 'default') {
  const norm = normalizeText(message);
  const pool = getSuggestionPool(chatRole);
  if (!norm) return pool.slice(0, 3).map((item) => ({ ...item, learnFromPreviousUnknown: true }));

  const ranked = pool.map((item) => {
    let score = 0;
    const utter = normalizeText(item.utterance);
    if (norm.includes('beoszt') && utter.includes('beoszt')) score += 3;
    if (norm.includes('szabi') && utter.includes('szabin')) score += 3;
    if ((norm.includes('tulora') || norm.includes('tuloras')) && utter.includes('tulora')) score += 4;
    if (norm.includes('tervezd') && utter.includes('tervezd')) score += 3;
    if (norm.includes('atvenni') && utter.includes('atvenni')) score += 4;
    const overlap = utter.split(' ').filter((w) => w.length > 3 && norm.includes(w)).length;
    score += overlap;
    return { ...item, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...rest }) => ({ ...rest, learnFromPreviousUnknown: true }));

  return ranked;
}

function buildSuccessQuickActions({ action, chatRole, entities }) {
  const hasMonth = hasMonthEntities(entities);
  if (chatRole === 'pharmacy') {
    if (action === 'list_employees') {
      return [
        { key: 'show_vacation_requests', label: 'Kik mennek szabira?', utterance: 'Kik mennek szabira?' },
        { key: 'missing_drafts', label: 'Ki nem irta meg a tervezetet?', utterance: 'Ki nem irta meg a tervezetet?' },
        { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
      ];
    }
    if (action === 'show_vacation_requests') {
      return [
        { key: 'missing_drafts', label: 'Ki nem irta meg a tervezetet?', utterance: hasMonth ? `Ki nem irta meg a ${entities?.monthLabel || 'kivalasztott'} tervezetet?` : 'Ki nem irta meg a tervezetet?' },
        { key: 'list_employees', label: 'Listazd a dolgozoimat', utterance: 'Listazd a dolgozoimat' },
        { key: 'replan_all', label: 'Ujratervezes', utterance: 'Ujratervezes' },
      ];
    }
    if (action === 'missing_drafts') {
      return [
        { key: 'show_vacation_requests', label: 'Kik mennek szabira?', utterance: hasMonth ? `Kik mennek szabira ${entities?.monthLabel || 'ebben a honapban'}?` : 'Kik mennek szabira?' },
        { key: 'list_employees', label: 'Listazd a dolgozoimat', utterance: 'Listazd a dolgozoimat' },
        { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
      ];
    }
    return [
      { key: 'list_employees', label: 'Listazd a dolgozoimat', utterance: 'Listazd a dolgozoimat' },
      { key: 'show_vacation_requests', label: 'Kik mennek szabira?', utterance: 'Kik mennek szabira?' },
      { key: 'missing_drafts', label: 'Ki nem irta meg a tervezetet?', utterance: 'Ki nem irta meg a tervezetet?' },
    ];
  }
  if (action === 'show_my_schedule') {
    return [
      { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
      { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
      { key: 'write_schedule_plan', label: 'Beosztast szeretnek irni', utterance: 'Beosztast szeretnek irni' },
    ];
  }
  if (action === 'show_my_vacations' || action === 'show_my_free_days') {
    return [
      { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?' },
      { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
      { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
    ];
  }
  return [
    { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?' },
    { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
    { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
  ];
}

// ─── REPLY VARIANTS ──────────────────────────────────────────────────────────

function pickVariant(seed, variants) {
  const src = String(seed || 'betti');
  let h = 0;
  for (let i = 0; i < src.length; i++) { h = ((h << 5) - h) + src.charCodeAt(i); h |= 0; }
  return variants[Math.abs(h) % variants.length];
}

function clarifyReply(chatRole, message) {
  const variants = chatRole === 'pharmacy'
    ? [
        'Segits pontositani: a dolgozokra, a szabadsagokra, a hianyzo tervezetekre vagy a tulorakra gondolsz?',
        'Pontositsunk egy lepest: a dolgozok, a szabadsagok, a hianyzo tervezetek vagy a tulorak erdekelnek?',
        'Melyikre gondolsz pontosan: dolgozok, szabadsagok, tervezetek vagy tulorak?',
      ]
    : [
        'Pontositsunk egy kicsit: a beosztasodat, a szabadsag napjaidat vagy a szabadnapjaidat szeretned latni?',
        'Segits pontositani: a sajat beosztasod, a szabadsagok vagy a szabadnapok erdekelnek?',
        'Melyikre gondolsz: beosztas, szabadsag vagy szabadnap?',
      ];
  return pickVariant(message, variants);
}

function topicClarifyReply(activeTopic, message) {
  const topicLabels = {
    show_my_schedule: 'beosztasod',
    show_my_vacations: 'szabadsag napjaid',
    show_my_free_days: 'szabadnapjaid',
    list_employees: 'alkalmazotti lista',
    show_vacation_requests: 'szabadsag igenyek',
    missing_drafts: 'hianyzo tervezetek',
    show_overtime: 'tulora attekintes',
    replan_specific_day: 'napi ujratervezes',
    replan_all: 'teljes ujratervezes',
    find_replacement: 'helyettesito kereses',
  };
  const topicLabel = topicLabels[activeTopic] || 'elozo tema';
  return pickVariant(message, [
    `Nem ertettem egeszen. Folytassuk a ${topicLabel} temaval?`,
    `Pontositsunk: a ${topicLabel} temaval folytatjuk?`,
    `Nem vilagos. Maradjunk a ${topicLabel} temajaban, vagy valtsunk?`,
  ]);
}

function simplifyResponse(text, action) {
  const str = String(text || '').trim();
  if (!str) return str;
  const first = str.split(/[.!?]\s+/).filter(Boolean)[0] || str;
  return action === 'clarify_with_options' ? `${first}. Valassz egy opciot.` : `${first}.`;
}

// ─── MOOD ─────────────────────────────────────────────────────────────────────

export function detectConversationalMood({ message, recentConversation = [] }) {
  const norm = normalizeText(message || '');
  if (!norm) return { label: 'neutral', confidence: 0.5 };

  const tiredCues = ['faradt', 'kimerult', 'hulla', 'almos', 'nincs energiam', 'nincs ero', 'kifaradt'];
  const frustratedCues = ['elegem van', 'ideges', 'bosszant', 'kiborultam', 'frusztralt', 'felhuzott'];
  const sadCues = ['rossz nap', 'nem sikerult', 'csalodott', 'elkeseredett', 'szomoru'];
  const positiveCues = ['szuper', 'koszi', 'koszonom', 'orulok', 'jo volt', 'sikerult', 'nagyon jo'];

  if (containsAny(norm, tiredCues)) return { label: 'tired', confidence: 0.86 };
  if (containsAny(norm, frustratedCues)) return { label: 'frustrated', confidence: 0.84 };
  if (containsAny(norm, sadCues)) return { label: 'sad', confidence: 0.8 };
  if (containsAny(norm, positiveCues)) return { label: 'positive', confidence: 0.78 };
  return { label: 'neutral', confidence: 0.62 };
}

function applyMoodTone({ reply, mood, action }) {
  if (!reply || !mood?.label) return reply;
  const strictActions = ['show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'list_employees', 'show_vacation_requests', 'missing_drafts'];
  if (strictActions.includes(action)) return reply;
  if (mood.label === 'tired') return `Ertem, hogy faradt vagy. ${reply}`;
  if (mood.label === 'frustrated' || mood.label === 'sad') return `Sajnalom, hogy ez most nehez. ${reply}`;
  return reply;
}

// ─── OPEN LOOP TRACKING ──────────────────────────────────────────────────────
// Prevents asking the same clarification question twice

function isLoopAlreadyOpen(openLoops, question) {
  if (!Array.isArray(openLoops) || !question) return false;
  const normQ = normalizeText(question);
  return openLoops.some((loop) => loop?.status === 'open' && normalizeText(loop?.question || '') === normQ);
}

function openLoop(openLoops, question, awaitingAction) {
  if (isLoopAlreadyOpen(openLoops, question)) return openLoops;
  return [
    ...openLoops.filter((l) => l?.status === 'open').slice(-4),
    { question, awaitingAction, status: 'open', createdAt: new Date().toISOString() },
  ];
}

function closeLoopsForAction(openLoops, action) {
  return openLoops.map((loop) =>
    loop?.awaitingAction === action ? { ...loop, status: 'answered' } : loop
  );
}

// ─── CONVERSATION STATE ──────────────────────────────────────────────────────

export function buildDefaultConversationState() {
  return {
    activeTopic: { name: null, intent: null, status: 'idle' },
    lastIntent: null,
    openLoops: [],
    lastGoal: null,
  };
}

function updateConversationState({ state, parsed, result }) {
  const isSignal = ['affirmative', 'negative', 'hesitation', 'challenge_previous_response', 'clarify_last_answer'].includes(parsed.intent);
  const isClarify = result.action === 'clarify_with_options';

  const nextTopic = !isSignal && !isClarify
    ? { name: result.action || parsed.action, intent: parsed.intent, status: 'active' }
    : state.activeTopic;

  const loopsAfterAnswer = result.action && result.action !== 'clarify_with_options'
    ? closeLoopsForAction(state.openLoops, result.action)
    : state.openLoops;

  const nextLoops = result._openLoopQuestion
    ? openLoop(loopsAfterAnswer, result._openLoopQuestion, result._openLoopAwaitingAction || result.action)
    : loopsAfterAnswer;

  return {
    activeTopic: nextTopic,
    lastIntent: parsed.intent,
    openLoops: nextLoops.slice(-6),
    lastGoal: state.lastGoal || parsed.intent || null,
  };
}

// ─── ACTION HANDLERS ─────────────────────────────────────────────────────────

function handleMySchedule({ parsed, chatRole, message, lastAssistantEntities }) {
  if (chatRole === 'pharmacy') {
    return {
      action: 'clarify_with_options',
      reply: 'Gyogyszertari nezetben nem latom a sajat dolgozoi beosztasodat. Inkabb listazzam az alkalmazottakat vagy mutassam a szabadsagigenyeket?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: isContinuationPrompt(message) });
  if (!month) {
    return {
      action: 'clarify_with_options',
      reply: 'Rendben, melyik honapra mutassam a beosztasodat?',
      quickActions: buildMonthQuickActions('beosztas'),
      entities: parsed.entities,
      _openLoopQuestion: 'Melyik honapra mutassam a beosztasodat?',
      _openLoopAwaitingAction: 'show_my_schedule',
    };
  }
  return {
    action: 'show_my_schedule',
    reply: `Rendben, megmutatom a beosztasodat a ${month.label} idoszakra.`,
    quickActions: buildSuccessQuickActions({ action: 'show_my_schedule', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleMyVacation({ parsed, chatRole, message, lastAssistantEntities }) {
  if (chatRole === 'pharmacy') {
    return {
      action: 'clarify_with_options',
      reply: 'Gyogyszertari nezetben nem latom a sajat dolgozoi szabadsagadataidat. Inkabb mutassam, kik mennek szabira?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: isContinuationPrompt(message) });
  if (!month) {
    return {
      action: 'clarify_with_options',
      reply: 'Rendben, melyik honapra nezzem a szabadsag napjaidat?',
      quickActions: buildMonthQuickActions('szabadsag'),
      entities: parsed.entities,
      _openLoopQuestion: 'Melyik honapra nezzem a szabadsag napjaidat?',
      _openLoopAwaitingAction: 'show_my_vacations',
    };
  }
  return {
    action: 'show_my_vacations',
    reply: `Rendben, megnezem a szabadsag napjaidat a ${month.label} idoszakra.`,
    quickActions: buildSuccessQuickActions({ action: 'show_my_vacations', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleMyFreeDays({ parsed, chatRole, message, lastAssistantEntities }) {
  if (chatRole === 'pharmacy') {
    return {
      action: 'clarify_with_options',
      reply: 'Gyogyszertari nezetben nem latom a sajat dolgozoi szabadnapjaidat.',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: isContinuationPrompt(message) });
  if (!month) {
    return {
      action: 'clarify_with_options',
      reply: 'Rendben, melyik honapra nezzem a szabadnapjaidat?',
      quickActions: buildMonthQuickActions('szabadnap'),
      entities: parsed.entities,
      _openLoopQuestion: 'Melyik honapra nezzem a szabadnapjaidat?',
      _openLoopAwaitingAction: 'show_my_free_days',
    };
  }
  return {
    action: 'show_my_free_days',
    reply: `Rendben, kilistazom a szabadnapjaidat a ${month.label} idoszakra.`,
    quickActions: buildSuccessQuickActions({ action: 'show_my_free_days', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleMySchedulePresence({ parsed, chatRole, message, lastAssistantEntities }) {
  if (chatRole === 'pharmacy') {
    return {
      action: 'clarify_with_options',
      reply: 'Gyogyszertari nezetben nincs sajat dolgozoi profil. Mutassam az alkalmazottakat vagy a hianyzo tervezeteket?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: true }) || { monthOffset: 0, label: 'aktualis honap' };
  return {
    action: 'check_my_schedule_exists',
    reply: month.monthOffset === 0
      ? 'Megnezem, van-e beosztasod az aktualis honapban.'
      : `Megnezem, van-e beosztasod a ${month.label} idoszakban.`,
    quickActions: buildSuccessQuickActions({ action: 'show_my_schedule', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleShowVacationRequests({ parsed, chatRole, message, lastAssistantEntities }) {
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: isContinuationPrompt(message) });
  if (!month) {
    return {
      action: 'clarify_with_options',
      reply: 'Rendben, melyik honapra szeretned latni az igenyelt szabadsagokat?',
      quickActions: buildMonthQuickActions('szabadsag'),
      entities: parsed.entities,
      _openLoopQuestion: 'Melyik honapra szeretned latni az igenyelt szabadsagokat?',
      _openLoopAwaitingAction: 'show_vacation_requests',
    };
  }
  return {
    action: 'show_vacation_requests',
    reply: `Rendben, megmutatom a szabadsag igenyeket a ${month.label} idoszakra.`,
    quickActions: buildSuccessQuickActions({ action: 'show_vacation_requests', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleMissingDrafts({ parsed, chatRole, message, lastAssistantEntities }) {
  const month = resolveMonth({ message, lastAssistantEntities, allowRemembered: isContinuationPrompt(message) });
  if (!month) {
    return {
      action: 'clarify_with_options',
      reply: 'Rendben, melyik honapra ellenorizzem az elkeszult tervezeteket?',
      quickActions: buildMonthQuickActions('tervezet'),
      entities: parsed.entities,
      _openLoopQuestion: 'Melyik honapra ellenorizzem a tervezeteket?',
      _openLoopAwaitingAction: 'missing_drafts',
    };
  }
  return {
    action: 'missing_drafts',
    reply: `Rendben, ellenorizzem ki nem irta meg meg a ${month.label} tervezetet.`,
    quickActions: buildSuccessQuickActions({ action: 'missing_drafts', chatRole, entities: { ...parsed.entities, ...month } }),
    entities: { ...parsed.entities, monthOffset: month.monthOffset, monthLabel: month.label },
  };
}

function handleIdentityCheck({ parsed, chatRole, message }) {
  return {
    action: 'clarify_with_options',
    reply: 'Arra gondolsz, hogy alkalmazottkent vagy-e rogzitve a rendszerben, vagy az alkalmazotti listat szeretned latni?',
    quickActions: [
      { key: 'identity_registered', label: 'Alkalmazottkent vagyok-e rogzitve?', utterance: 'Arra gondolok, hogy alkalmazottkent vagyok-e rogzitve' },
      { key: 'list_employees', label: 'Az alkalmazotti listat szeretnem latni', utterance: 'Mutasd az alkalmazottakat' },
    ],
    entities: parsed.entities,
  };
}

function handleListEmployees({ parsed, chatRole, message }) {
  const confirmed = parsed?.confirmed === true || parsed?.action === 'list_employees';
  if (!confirmed) {
    return {
      action: 'clarify_with_options',
      reply: 'Arra gondolsz, hogy az alkalmazotti listat szeretned latni?',
      quickActions: [
        { key: 'confirm_list_employees', label: 'Igen, az alkalmazotti listat szeretnem', utterance: 'Mutasd az alkalmazottakat' },
        { key: 'identity_check', label: 'Nem, azt szeretnem tudni, hogy alkalmazott vagyok-e', utterance: 'Alkalmazott vagyok?' },
      ],
      entities: parsed.entities,
    };
  }
  return {
    action: 'list_employees',
    reply: 'Rendben, listazom az alkalmazottaidat.',
    quickActions: buildSuccessQuickActions({ action: 'list_employees', chatRole, entities: parsed.entities }),
    entities: parsed.entities,
  };
}

function handleAddEmployee({ parsed }) {
  return {
    action: 'add_employee',
    reply: 'Rendben, felvehetsz egy uj dolgozot. Kerem add meg az email cimet.',
    quickActions: [],
    entities: parsed.entities,
    _openLoopQuestion: 'Mi az uj dolgozo email cime?',
    _openLoopAwaitingAction: 'add_employee',
  };
}

function handleRemoveEmployee({ parsed }) {
  return {
    action: 'remove_employee',
    reply: 'Melyik dolgozot szeretned eltavolitani?',
    quickActions: [],
    entities: parsed.entities,
    _openLoopQuestion: 'Melyik dolgozot szeretned eltavolitani?',
    _openLoopAwaitingAction: 'remove_employee',
  };
}

function handleReportOvertime({ parsed, context }) {
  const rows = context?.stats?.employees || [];
  const topRows = rows
    .filter((item) => Number(item.overtimeHours || 0) > 0)
    .sort((a, b) => Number(b.overtimeHours || 0) - Number(a.overtimeHours || 0))
    .slice(0, 5);
  const reply = topRows.length === 0
    ? 'Jelenleg nincs olyan dolgozo, aki tuloraban lenne.'
    : `Tulorasok: ${topRows.map((item) => `${item.name} (${item.overtimeHours}h)`).join(', ')}`;
  return {
    action: 'show_overtime',
    reply,
    quickActions: [],
    entities: parsed.entities,
    overtimeRows: topRows,
  };
}

function handleScheduleOps({ parsed, chatRole }) {
  const actionMap = {
    replan_specific_day: { action: 'replan_specific_day', reply: 'Rendben, ujratervezem a kivalasztott napot.' },
    replan_all: { action: 'replan_all', reply: 'Rendben, elkezdem a teljes ujratervezest.' },
    find_replacement: { action: 'find_replacement', reply: 'Megnezem ki tudna atvenni a muszakot.' },
  };
  const mapped = actionMap[parsed.action] || { action: parsed.action, reply: 'Rendben, elkezdem a muveletet.' };
  return {
    ...mapped,
    quickActions: buildSuccessQuickActions({ action: mapped.action, chatRole, entities: parsed.entities }),
    entities: parsed.entities,
  };
}

function handleModification({ parsed, chatRole }) {
  const actionMap = {
    optimize_fairness: { action: 'optimize_fairness', reply: 'Rendben, megprobalok igazsagosabb beosztast kesziteni.' },
    optimize_overtime: { action: 'optimize_overtime', reply: 'Rendben, megprobalok kevesebb tulorat eredmenyezo beosztast kesziteni.' },
    make_schedule_fairer: { action: 'optimize_fairness', reply: 'Rendben, az igazsagossabb beosztason dolgozom.' },
  };
  const mapped = actionMap[parsed.action] || { action: parsed.action, reply: 'Rendben, megprobalok optimalizalni.' };
  return {
    ...mapped,
    quickActions: buildSuccessQuickActions({ action: mapped.action, chatRole, entities: parsed.entities }),
    entities: parsed.entities,
  };
}

function handleExplainAssignment({ parsed, context }) {
  const { explainAssignmentDecision } = context._handlers || {};
  if (explainAssignmentDecision) {
    const explained = explainAssignmentDecision({
      assignmentReasons: context.assignmentReasons || [],
      employeeName: parsed.entities?.person,
    });
    return {
      action: 'explain_assignment',
      reply: `${explained.title}\n- ${explained.bullets.join('\n- ')}`,
      quickActions: [],
      entities: parsed.entities,
    };
  }
  return {
    action: 'explain_assignment',
    reply: 'Sajnos nincs elerheto magyarazat ehhez a beosztasi dontzeshez.',
    quickActions: [],
    entities: parsed.entities,
  };
}

function handleCapabilities({ parsed }) {
  return {
    action: 'show_capabilities',
    reply: 'Ebben tudok segiteni:\n- Sajat beosztas es kovetkezo muszakok\n- Szabadsagok es szabadnapok\n- Tulora attekintes\n- Muszakhelyettesites\n- Ujratervezes (teljes vagy napi)\n\nIrd peldaul: "Mi a beosztasom?" vagy "Mutasd a tulorasokat".',
    quickActions: [],
    entities: parsed.entities,
  };
}

function handleWriteSchedulePlan({ parsed }) {
  return {
    action: 'write_schedule_plan',
    reply: 'Rendben, segitek beosztas-tervezetet irni. Nyisd meg a Beosztas-tervezo reszt, vagy mondd: "Beosztast szeretnek irni".',
    quickActions: [],
    entities: parsed.entities,
  };
}

function handleGreeting({ parsed, chatRole }) {
  return {
    action: 'greeting',
    reply: 'Szia! Betti vagyok, a Pharmagister AI asszisztense. Kerdezhetsz ilyet is: "Mi a beosztasom?", "Mikor vagyok szabin?", vagy "Mutasd a tulorasokat".',
    quickActions: buildUnknownSuggestions('', chatRole),
    entities: parsed.entities,
  };
}

function handleIdentity({ parsed }) {
  return {
    action: 'identity',
    reply: 'Betti vagyok, a Pharmagister AI asszisztense. Epres Laszlo fejlesztett.',
    quickActions: [],
    entities: parsed.entities,
  };
}

function handleThanks({ parsed, chatRole }) {
  return {
    action: 'ack',
    reply: 'Szivesen! Ha szeretned, mar most megmutatom a kovetkezo muszakjaidat vagy szabadnapjaidat.',
    quickActions: buildUnknownSuggestions('', chatRole),
    entities: parsed.entities,
  };
}

// ─── CONTINUITY SIGNAL HANDLERS ──────────────────────────────────────────────
// Handles affirmative/negative/hesitation/challenge WITHOUT resetting topic

function handleContinuitySignal({ parsed, conversationState, chatRole, lastAssistantMessage, lastAssistantAction, message }) {
  const activeTopic = conversationState?.activeTopic?.name || lastAssistantAction || null;
  const activeIntent = conversationState?.activeTopic?.intent || null;
  const openLoop = Array.isArray(conversationState?.openLoops)
    ? conversationState.openLoops.find((l) => l?.status === 'open')
    : null;

  // ── affirmative ─────────────────────────────────────────────
  if (parsed.intent === 'affirmative') {
    if (activeTopic && activeTopic !== 'general' && activeTopic !== 'clarify_with_options') {
      // User confirmed → continue with active topic
      return {
        action: activeTopic,
        reply: 'Rendben, folytatom.',
        quickActions: buildSuccessQuickActions({ action: activeTopic, chatRole, entities: parsed.entities }),
        entities: { ...(parsed.entities || {}), confirmedFromContext: true },
        _inferredFromContext: true,
      };
    }
    return {
      action: 'clarify_with_options',
      reply: 'Szuper, pontositsunk egy lepest: mit szeretnel latni?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }

  // ── negative ────────────────────────────────────────────────
  // RULE: nem "elengedem" – ugyanazon témán marad, kérdezi mit változtassunk
  if (parsed.intent === 'negative') {
    if (activeTopic) {
      const topicLabels = {
        show_my_schedule: 'beosztasodrol',
        show_my_vacations: 'szabadsag napjaidrol',
        show_my_free_days: 'szabadnapjaidrol',
        list_employees: 'alkalmazotti listarol',
        show_vacation_requests: 'szabadsag igenyekrol',
        missing_drafts: 'hianyzo tervezetekrol',
      };
      const topicLabel = topicLabels[activeTopic] || 'elozo temarol';
      return {
        action: 'clarify_with_options',
        reply: `Rendben. Meg mindig a ${topicLabel} beszelunk. Melyik reszt pontositsam?`,
        quickActions: buildUnknownSuggestions(message, chatRole),
        entities: parsed.entities,
        _keepTopic: true,
      };
    }
    return {
      action: 'clarify_with_options',
      reply: 'Rendben. Melyik reszt pontositsam, vagy mit szeretnel inkabb?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }

  // ── hesitation ──────────────────────────────────────────────
  // RULE: nem "raerunk" – témán marad
  if (parsed.intent === 'hesitation') {
    if (activeTopic) {
      return {
        action: 'clarify_with_options',
        reply: 'Semmi gond. Ugyanazon a teman maradunk. Szolj, ha valami nem vilagos, vagy irany egy masik reszlet.',
        quickActions: buildUnknownSuggestions(message, chatRole),
        entities: parsed.entities,
        _keepTopic: true,
      };
    }
    return {
      action: 'clarify_with_options',
      reply: 'Semmi gond. Mondj egy konkret kerdest, es azonnal segitesek.',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }

  // ── challenge_previous_response ─────────────────────────────
  if (parsed.intent === 'challenge_previous_response') {
    if (openLoop?.question) {
      return {
        action: activeTopic || 'clarify_with_options',
        reply: `Az elozo kerdest nem kezdem ujra: ${openLoop.question}`,
        quickActions: buildUnknownSuggestions(message, chatRole),
        entities: parsed.entities,
        _keepTopic: true,
      };
    }
    if (activeTopic && activeIntent) {
      return {
        action: activeTopic,
        reply: `Az elozo temara visszakotnek (${activeIntent}) – ezt folytassuk, vagy valts mas temarol?`,
        quickActions: buildUnknownSuggestions(message, chatRole),
        entities: parsed.entities,
        _keepTopic: true,
      };
    }
    return {
      action: 'clarify_with_options',
      reply: 'Pontositsuk: melyik reszt magyarazzam el mashogy?',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
    };
  }

  // ── clarify_last_answer ─────────────────────────────────────
  if (parsed.intent === 'clarify_last_answer') {
    const simplified = simplifyResponse(lastAssistantMessage || '', activeTopic || 'clarify_with_options');
    return {
      action: activeTopic || 'clarify_with_options',
      reply: simplified || 'Egyszeru verzio: kerlek mondd el reszletesebben mit nem ertettel.',
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
      _keepTopic: true,
    };
  }

  return null;
}

// ─── DISPATCH TABLE ──────────────────────────────────────────────────────────

const INTENT_DISPATCH = {
  my_schedule: handleMySchedule,
  my_vacation: handleMyVacation,
  my_free_days: handleMyFreeDays,
  my_schedule_presence: handleMySchedulePresence,
  show_vacation_requests: handleShowVacationRequests,
  missing_drafts: handleMissingDrafts,
  identity_check: handleIdentityCheck,
  list_employees: handleListEmployees,
  add_employee: handleAddEmployee,
  remove_employee: handleRemoveEmployee,
  report_overtime: handleReportOvertime,
  explain_assignment: handleExplainAssignment,
  replan_specific_day: handleScheduleOps,
  replan_all: handleScheduleOps,
  find_replacement: handleScheduleOps,
  schedule_ops: handleScheduleOps,
  modification_request: handleModification,
  optimize_fairness: handleModification,
  optimize_overtime: handleModification,
  make_schedule_fairer: handleModification,
  capabilities: handleCapabilities,
  help: handleCapabilities,
  write_schedule_plan: handleWriteSchedulePlan,
  greeting: handleGreeting,
  identity: handleIdentity,
  thanks: handleThanks,
  ack: handleThanks,
};

function dispatchAction({ parsed, chatRole, context, message, conversationState, lastAssistantEntities, lastAssistantMessage }) {
  const handler = INTENT_DISPATCH[parsed.intent];
  if (handler) {
    return handler({ parsed, chatRole, context, message, conversationState, lastAssistantEntities, lastAssistantMessage });
  }
  // unknown intent → clarify
  return {
    action: 'clarify_with_options',
    reply: `Ezt nem ertettem teljesen. Probald igy: "Mi a beosztasom?", "Mutasd a tulorasokat", vagy "Tervezd ujra csak a hetfot".`,
    quickActions: buildUnknownSuggestions(message, chatRole),
    entities: parsed.entities,
  };
}

// ─── CONFIDENCE GATE WITH TOPIC CONTINUITY ───────────────────────────────────

function clarifyWithTopicContinuity({ parsed, conversationState, chatRole, message }) {
  const activeTopic = conversationState?.activeTopic?.name;
  const openLoop = Array.isArray(conversationState?.openLoops)
    ? conversationState.openLoops.find((l) => l?.status === 'open')
    : null;

  // If there's an active topic, stay on it and ask for clarification within that topic
  if (activeTopic && activeTopic !== 'general' && activeTopic !== 'clarify_with_options') {
    // If there's an open loop question already, restate it (not repeat verbatim, but refer to it)
    if (openLoop?.question) {
      const reply = `Nem ertettem egeszen. Meg mindig erre varok: ${openLoop.question}`;
      return {
        action: 'clarify_with_options',
        reply,
        quickActions: buildUnknownSuggestions(message, chatRole),
        entities: parsed.entities,
        _keepTopic: true,
      };
    }
    return {
      action: 'clarify_with_options',
      reply: topicClarifyReply(activeTopic, message),
      quickActions: buildUnknownSuggestions(message, chatRole),
      entities: parsed.entities,
      _keepTopic: true,
    };
  }

  // No active topic – general clarify
  return {
    action: 'clarify_with_options',
    reply: clarifyReply(chatRole, message),
    quickActions: buildUnknownSuggestions(message, chatRole),
    entities: parsed.entities,
  };
}

// ─── MAIN PIPELINE ───────────────────────────────────────────────────────────

/**
 * runBettiPipeline – the single decision function for every user message.
 *
 * @param {Object} params
 *   message              - normalized input text
 *   parsed               - result of parseBettiIntent(message, learnedPatterns)
 *   conversationState    - {activeTopic, lastIntent, openLoops}
 *   chatRole             - 'pharmacy' | 'employee' | 'default'
 *   context              - request context (stats, conflicts, assignmentReasons, _handlers)
 *   mood                 - result of detectConversationalMood
 *   lastAssistantAction  - last action returned by Betti
 *   lastAssistantEntities
 *   lastAssistantMessage
 *   previousMessageIntent
 *
 * @returns {Object} { action, reply, payload, quickActions, nextConversationState }
 */
export function runBettiPipeline({
  message,
  parsed,
  conversationState,
  chatRole,
  context = {},
  mood = { label: 'neutral' },
  lastAssistantAction,
  lastAssistantEntities,
  lastAssistantMessage,
  previousMessageIntent,
}) {
  const state = conversationState || buildDefaultConversationState();
  const confidence = Number(parsed?.confidence || 0);

  // ── STEP 1: CONFIDENCE GATE ───────────────────────────────────────────────
  // confidence < 0.85 → clarify, but STAY ON active topic
  if (confidence < 0.85) {
    const result = clarifyWithTopicContinuity({ parsed, conversationState: state, chatRole, message });
    const nextState = updateConversationState({ state, parsed, result });
    return {
      ...result,
      payload: { action: result.action, entities: result.entities, confidence },
      nextConversationState: nextState,
    };
  }

  // ── STEP 2: CONTINUITY SIGNALS ────────────────────────────────────────────
  // affirmative / negative / hesitation / challenge / clarify_last_answer
  // → NEVER reset, always stay on topic or simplify
  const CONTINUITY_INTENTS = ['affirmative', 'negative', 'hesitation', 'challenge_previous_response', 'clarify_last_answer'];
  if (CONTINUITY_INTENTS.includes(parsed.intent)) {
    const result = handleContinuitySignal({
      parsed,
      conversationState: state,
      chatRole,
      lastAssistantMessage,
      lastAssistantAction: lastAssistantAction || state.activeTopic?.name,
      message,
    });
    if (result) {
      const nextState = updateConversationState({ state, parsed, result });
      return {
        ...result,
        payload: { action: result.action, entities: result.entities, confidence },
        nextConversationState: nextState,
      };
    }
  }

  // ── STEP 3: UNKNOWN INTENT ────────────────────────────────────────────────
  // If unknown AND there's an active topic → stay on topic
  if (parsed.intent === 'unknown') {
    const activeTopic = state.activeTopic?.name;
    if (activeTopic && activeTopic !== 'general' && activeTopic !== 'clarify_with_options') {
      const result = clarifyWithTopicContinuity({ parsed, conversationState: state, chatRole, message });
      const nextState = updateConversationState({ state, parsed, result });
      return {
        ...result,
        payload: { action: result.action, entities: result.entities, confidence },
        nextConversationState: nextState,
      };
    }
  }

  // ── STEP 4: DISPATCH ──────────────────────────────────────────────────────
  const result = dispatchAction({
    parsed,
    chatRole,
    context,
    message,
    conversationState: state,
    lastAssistantEntities,
    lastAssistantMessage,
  });

  // ── STEP 5: MOOD TONE ─────────────────────────────────────────────────────
  result.reply = applyMoodTone({ reply: result.reply, mood, action: result.action });

  // ── STEP 6: STATE UPDATE ──────────────────────────────────────────────────
  const nextState = updateConversationState({ state, parsed, result });

  return {
    ...result,
    payload: {
      action: result.action,
      entities: result.entities || parsed.entities,
      confidence,
      ...(result.overtimeRows ? { overtimeRows: result.overtimeRows } : {}),
    },
    nextConversationState: nextState,
  };
}
