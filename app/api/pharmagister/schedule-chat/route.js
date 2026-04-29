import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { isAffirmativeText, isHesitationText, isNegativeText, parseBettiIntent } from '@/lib/intentParser';
import { normalizeHungarianChatInput } from '@/lib/huDictionary';
import { explainAssignmentDecision } from '@/lib/explanationEngine';
import { buildProactiveWarnings } from '@/lib/suggestionEngine';
import {
  detectTrainingInput,
  loadTrainingPatterns,
  recordTrainingPatternUsage,
  saveTrainingPattern,
  buildTrainingPattern,
} from '@/lib/bettiTraining';

const UNKNOWN_SUGGESTIONS = [
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
  { key: 'my_schedule', label: 'Mi a beosztasom?', utterance: 'Mi a beosztasom?' },
  { key: 'my_vacation', label: 'Mikor vagyok szabin?', utterance: 'Mikor vagyok szabin?' },
  { key: 'replan_day', label: 'Tervezd ujra csak a hetfot', utterance: 'Tervezd ujra csak a hetfot' },
  { key: 'find_replacement', label: 'Ki tudna atvenni a holnapi estet?', utterance: 'Ki tudna atvenni a holnapi estet?' },
  { key: 'replan_all', label: 'Ujratervezes', utterance: 'Ujratervezes' },
];

const PHARMACY_UNKNOWN_SUGGESTIONS = [
  { key: 'list_employees', label: 'Listazd a dolgozoimat', utterance: 'Listazd a dolgozoimat' },
  { key: 'show_vacation_requests', label: 'Kik mennek szabira?', utterance: 'Kik mennek szabira?' },
  { key: 'missing_drafts', label: 'Ki nem irta meg a tervezetet?', utterance: 'Ki nem irta meg a tervezetet?' },
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
  { key: 'replan_day', label: 'Tervezd ujra csak a hetfot', utterance: 'Tervezd ujra csak a hetfot' },
  { key: 'find_replacement', label: 'Ki tudna atvenni a holnapi estet?', utterance: 'Ki tudna atvenni a holnapi estet?' },
  { key: 'replan_all', label: 'Ujratervezes', utterance: 'Ujratervezes' },
  { key: 'optimize_overtime', label: 'Kevesebb tulora', utterance: 'Csokkentsd a tulorat' },
  { key: 'optimize_fairness', label: 'Igazsagosabb verzio', utterance: 'Legyen igazsagosabb a beosztas' },
];

const EMPLOYEE_UNKNOWN_SUGGESTIONS = [
  { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?' },
  { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
  { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
  { key: 'write_schedule_plan', label: 'Beosztast szeretnek irni', utterance: 'Beosztast szeretnek irni' },
  { key: 'show_overtime', label: 'Mutasd a tulorasokat', utterance: 'Mutasd a tulorasokat' },
  { key: 'find_replacement', label: 'Ki tudna atvenni a holnapi estet?', utterance: 'Ki tudna atvenni a holnapi estet?' },
];

const LOW_CONFIDENCE_THRESHOLD = 0.82;

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

const AMBIGUOUS_SHOW_RE = /^(mutasd|muti|mutass|mutas(d)?|mutasdmar|mutasd\s+mar|mutad|mutas|megmutatod|megmutatnad|megmutatna(d)?|megneznem|megneznen|nezzuk|nezd|nezd|nezz|nezuk|mutatnad|mutatna|kerlek\s+mutasd|pls\s+mutasd|show|show\s+me|nezzuk\s+meg|kene|kene\s+latni|kellene|jo\s+lenne|adnad|add\s+ide|dobd\s+fel|valamit\s+mutass|valamit\s+keresek)\b/;

function isAmbiguousShowRequest(norm) {
  if (!norm) return false;
  if (AMBIGUOUS_SHOW_RE.test(norm)) return true;

  // Very short, generic prompts should trigger clarification suggestions too.
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length <= 3) {
    if (words.some((w) => ['mutasd', 'muti', 'mutass', 'nezd', 'nezzuk', 'kene', 'kellene', 'show'].includes(w))) {
      return true;
    }
  }
  return false;
}

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

function normalizeChatRole(role) {
  const norm = normalizeText(role);
  if (norm.includes('pharmacy') || norm.includes('patika') || norm.includes('manager')) return 'pharmacy';
  if (norm.includes('employee') || norm.includes('dolgozo')) return 'employee';
  return 'default';
}

function getSuggestionPool(chatRole) {
  if (chatRole === 'pharmacy') return PHARMACY_UNKNOWN_SUGGESTIONS;
  if (chatRole === 'employee') return EMPLOYEE_UNKNOWN_SUGGESTIONS;
  return UNKNOWN_SUGGESTIONS;
}

function findSuggestionForParsed(parsed, chatRole) {
  const pool = getSuggestionPool(chatRole);
  if (!parsed?.action) return null;

  const actionToKey = {
    show_my_schedule: 'my_schedule',
    show_my_vacations: 'my_vacation',
    show_my_free_days: 'my_free_days',
    list_employees: 'list_employees',
    show_vacation_requests: 'show_vacation_requests',
    missing_drafts: 'missing_drafts',
    add_employee: 'add_employee',
    remove_employee: 'remove_employee',
    write_schedule_plan: 'write_schedule_plan',
    show_overtime: 'show_overtime',
    replan_specific_day: 'replan_day',
    find_replacement: 'find_replacement',
    replan_all: 'replan_all',
    optimize_overtime: 'optimize_overtime',
    optimize_fairness: 'optimize_fairness',
  };

  const targetKey = actionToKey[parsed.action] || parsed.intent;
  return pool.find((item) => item.key === targetKey) || null;
}

function buildUnknownSuggestions(message, chatRole = 'default') {
  const norm = normalizeText(message);
  const suggestionPool = getSuggestionPool(chatRole);
  if (!norm) return suggestionPool.slice(0, 3).map((item) => ({ ...item, learnFromPreviousUnknown: true }));

  if (isAmbiguousShowRequest(norm)) {
    if (chatRole === 'pharmacy') {
      return [
        { key: 'show_overtime', label: 'A tulorasokat', utterance: 'Mutasd a tulorasokat', learnFromPreviousUnknown: true },
        { key: 'replan_day', label: 'A heti ujratervezest', utterance: 'Tervezd ujra csak a hetfot', learnFromPreviousUnknown: true },
        { key: 'find_replacement', label: 'A helyettesitesi opciokat', utterance: 'Ki tudna atvenni a holnapi estet?', learnFromPreviousUnknown: true },
      ];
    }

    return [
      { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?', learnFromPreviousUnknown: true },
      { key: 'show_overtime', label: 'A tulorasokat', utterance: 'Mutasd a tulorasokat', learnFromPreviousUnknown: true },
      { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?', learnFromPreviousUnknown: true },
    ];
  }

  const ranked = suggestionPool.map((item) => {
    let score = 0;
    const utter = normalizeText(item.utterance);

    if (isAmbiguousShowRequest(norm) && utter.includes('mutasd')) score += 3;
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
    .map(({ score, ...rest }) => ({
      ...rest,
      learnFromPreviousUnknown: true,
    }));

  return ranked;
}

function isScheduleOrFreeDaysPrompt(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  return (
    (norm.includes('megmutatom') || norm.includes('mutatom'))
    && (norm.includes('muszak') || norm.includes('beosztas'))
    && (norm.includes('szabadnap') || norm.includes('szabadsag'))
  );
}

function detectMonthReference(text) {
  const norm = normalizeText(text);
  if (!norm) return null;

  const monthNameToNumber = {
    januar: 1,
    februar: 2,
    marcius: 3,
    aprilis: 4,
    majus: 5,
    junius: 6,
    julius: 7,
    augusztus: 8,
    szeptember: 9,
    oktober: 10,
    november: 11,
    december: 12,
  };

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
    const monthName = monthMatch[1];
    const monthNumber = monthNameToNumber[monthName];
    if (monthNumber) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      return {
        monthOffset: monthNumber - currentMonth,
        monthNumber,
        label: monthName,
      };
    }
  }

  return null;
}

function buildMonthQuickActions(topic = 'beosztas') {
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

function getRememberedMonthEntities(entities) {
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

function resolveRequestedOrRememberedMonth({ message, lastAssistantEntities, allowRememberedMonth = false }) {
  const explicitMonth = detectMonthReference(message);
  if (explicitMonth) return explicitMonth;
  if (!allowRememberedMonth) return null;

  const rememberedMonth = getRememberedMonthEntities(lastAssistantEntities);
  if (!rememberedMonth) return null;
  return rememberedMonth;
}

function collectHistoryTopics(recentConversation = []) {
  const topics = [];
  const monthEntities = [];

  recentConversation.forEach((item) => {
    if (!item) return;
    const action = item.action || null;
    const entities = item.entities || null;
    if (action) topics.push(action);
    if (hasMonthEntities(entities)) monthEntities.push(getRememberedMonthEntities(entities));

    const norm = normalizeText(item.text || '');
    if (!norm) return;
    if (containsAny(norm, ['szabi', 'szabadsag'])) topics.push('show_vacation_requests');
    if (containsAny(norm, ['szabadnap'])) topics.push('show_my_free_days');
    if (containsAny(norm, ['beoszt', 'muszak'])) topics.push('show_my_schedule');
    if (containsAny(norm, ['tervezet', 'draft', 'nem irta', 'nem irt'])) topics.push('missing_drafts');
    if (containsAny(norm, ['dolgozo', 'alkalmazott', 'csapat'])) topics.push('list_employees');
  });

  return { topics, monthEntities };
}

function inferHistoryState(recentConversation = [], chatRole = 'default') {
  const { topics, monthEntities } = collectHistoryTopics(recentConversation);
  const lastTopic = [...topics].reverse().find(Boolean) || null;
  const dominantTopic = lastTopic || (chatRole === 'pharmacy' ? 'list_employees' : 'show_my_schedule');
  const rememberedMonth = monthEntities.length > 0 ? monthEntities[monthEntities.length - 1] : null;
  return { dominantTopic, rememberedMonth };
}

function buildSuccessQuickActions({ action, chatRole, entities }) {
  const hasMonth = Number.isInteger(entities?.monthOffset) || Number.isInteger(entities?.monthNumber);

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

function pickReplyVariant(seed, variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const source = String(seed || 'betti');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index];
}

function buildClarifyReply({ chatRole, message }) {
  const variants = chatRole === 'pharmacy'
    ? [
        'Segits egy kicsit pontositani: a dolgozokra, a szabadsagokra, a hianyzo tervezetekre vagy a tulorakra gondolsz?',
        'Pontositsunk egy lepest: a dolgozok, a szabadsagok, a hianyzo tervezetek vagy a tulorak erdekelnek?',
        'Rendben, csak finomitsuk: a dolgozokat, a szabadsagokat, a tervezeteket vagy a tulorakat nezzem?',
      ]
    : [
        'Pontositsunk egy kicsit: a beosztasodat, a szabadsag napjaidat vagy a szabadnapjaidat szeretned latni?',
        'Segits pontositani: a sajat beosztasod, a szabadsagok vagy a szabadnapok erdekelnek?',
        'Rendben, melyikre gondolsz pontosan: beosztas, szabadsag vagy szabadnap?',
      ];
  return pickReplyVariant(message, variants);
}

function buildLowConfidenceReply({ message, guess }) {
  if (guess) {
    return pickReplyVariant(message, [
      `Nem akarok melleloni: arra gondoltal, hogy ${guess.label}? Valassz lent egy opciot.`,
      `Valoszinuleg erre gondoltal: ${guess.label}. Ha igen, valaszd ki lent.`,
      `Majdnem biztos vagyok benne, de inkabb visszakerdezek: ${guess.label}?`,
    ]);
  }

  return pickReplyVariant(message, [
    'Tobb irany is belefer ebbe a kerdesbe. Valassz lent egy opciot, es megyek tovabb azon a szalon.',
    'Nem teljesen egyertelmu nekem a kerdes. Mutatok nehany jo kovetkezo lepest lent.',
    'Ebbol tobb mindent is kerhettel. Valassz lent egy konkret opciot, es azonnal folytatom.',
  ]);
}

function buildUnknownReply({ message, quickActions }) {
  const top = quickActions.slice(0, 3).map((item) => item.label).join(', ');
  return pickReplyVariant(message, [
    `Ezt most nem raktam ossze teljesen. Ezek kozul valamelyikre gondoltal: ${top}?`,
    `Nem vagyok benne biztos, hogy pontosan mire gondoltal. Probaljuk innen: ${top}.`,
    `Most meg elbizonytalanodtam. Valassz egyet ezek kozul: ${top}, vagy tanits meg egy jobb valaszra az xx formatummal.`,
  ]);
}

function buildReplyBridge({ action, chatRole, entities, seed }) {
  const hasMonth = Number.isInteger(entities?.monthOffset) || Number.isInteger(entities?.monthNumber);

  if (chatRole === 'pharmacy') {
    if (action === 'list_employees') {
      return pickReplyVariant(seed, [
        'Ha szeretned, innen rogton megnezhetem azt is, kik mennek szabira vagy kik nem kuldtek meg be tervezetet.',
        'A kovetkezo lepeskent megmutathatom a szabadsagokat vagy a hianyzo tervezeteket is.',
        'Innen konnyen tovabb tudunk menni a szabadsagigenyekre vagy a hianyzo tervezetekre.',
      ]);
    }

    if (action === 'show_vacation_requests' && hasMonth) {
      return pickReplyVariant(seed, [
        'Ha utana szeretned, egybol megnezem azt is, kik nem kuldtek meg a tervezetuket erre az idoszakra.',
        'Ha kell, ugyanebben a honapban rogton ellenorizhetem a hianyzo tervezeteket is.',
        'A kovetkezo lepesben megmutathatom ugyanennek a honapnak a hianyzo tervezeteit is.',
      ]);
    }

    if (action === 'missing_drafts' && hasMonth) {
      return pickReplyVariant(seed, [
        'Ha kell, a kovetkezo lepesben megmutatom az ugyanebben a honapban erintett szabadsagigenyeket is.',
        'Ha szeretned, ugyanebben az idoszakban a szabadsagigenyeket is megnezem.',
        'Innen tovabb tudok menni ugyanennek a honapnak a szabadsagigenyeire is.',
      ]);
    }
  }

  if (action === 'show_my_schedule') {
    return pickReplyVariant(seed, [
      'Ha szeretned, egybol at tudunk ugrani a szabadsagokra vagy a szabadnapokra is.',
      'Innen rogton megnezhetem a szabadsag napjaidat vagy a szabadnapjaidat is.',
      'Ha mar itt tartunk, mutathatom ugyanebbol az idoszakbol a szabadsagokat vagy a szabadnapokat is.',
    ]);
  }

  if (action === 'show_my_vacations' || action === 'show_my_free_days') {
    return pickReplyVariant(seed, [
      'Ha szeretned, a sajat beosztasodat is megmutatom ugyanebbol az idoszakbol.',
      'Ha kell, ugyanennek a honapnak a beosztasat is azonnal megmutatom.',
      'A kovetkezo lepesben at tudok ugrani a sajat beosztasodra is.',
    ]);
  }

  return '';
}

function polishBettiReply({ reply, action, chatRole, entities, seed }) {
  if (!reply) return reply;
  const bridge = buildReplyBridge({ action, chatRole, entities, seed });
  return bridge ? `${reply} ${bridge}` : reply;
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

function mapActionToIntent(action) {
  const actionToIntent = {
    show_my_schedule: 'my_schedule',
    show_my_vacations: 'my_vacation',
    show_my_free_days: 'my_free_days',
    follow_up_decline: 'negative',
    follow_up_hesitate: 'hesitation',
    list_employees: 'list_employees',
    show_vacation_requests: 'show_vacation_requests',
    missing_drafts: 'missing_drafts',
    show_overtime: 'report_overtime',
    replan_specific_day: 'replan_day',
    find_replacement: 'fill_missing_shift',
    replan_all: 'full_replan',
  };
  return actionToIntent[action] || 'unknown';
}

function buildFollowUpParsed(action, entities = {}, confidence = 0.9) {
  const baseReply = {
    show_my_schedule: 'Rendben, megmutatom a sajat muszakjaidat. Ha dolgozoi nezetben vagy, pontos listat is kapsz.',
    show_my_vacations: 'Rendben, megnezem a szabadsag napjaidat.',
    show_my_free_days: 'Rendben, kilistazom a kovetkezo szabadnapjaidat.',
    follow_up_decline: 'Rendben, akkor ezt most elengedem.',
    follow_up_hesitate: 'Rendben, nem siettetlek. Mondhatod kesobb is, vagy valthatunk masik temara.',
    list_employees: 'Rendben, listazom az alkalmazottaidat.',
    show_vacation_requests: 'Rendben, megmutatom a szabadsagigenyeket.',
    missing_drafts: 'Rendben, ellenorizem kik nem kuldtek meg a tervezetuket.',
    show_overtime: 'Rendben, megmutatom kik vannak tulora kozeleben vagy tuloraban.',
    replan_specific_day: 'Rendben, csak az erintett nap(oka)t tervezem ujra.',
    find_replacement: 'Keresek megfelelo helyettesitot a muszakra.',
    replan_all: 'Rendben, keszitek egy uj teljes havi tervet.',
  };

  return {
    intent: mapActionToIntent(action),
    action,
    confidence,
    entities,
    reply: baseReply[action] || 'Rendben, megyek tovabb ezen a vonalon.',
    inferredFromContext: true,
  };
}

function resolveContextualFollowUp({
  message,
  chatRole,
  recentConversation,
  previousMessageIntent,
  lastAssistantAction,
  lastAssistantSuggestedAction,
  lastAssistantMessage,
  lastAssistantEntities,
}) {
  const norm = normalizeText(message);
  if (!norm) return null;

  const words = norm.split(/\s+/).filter(Boolean);
  const isShort = words.length <= 4;
  const isYesLike = isAffirmativeText(norm) || containsAny(norm, ['szeretnem', 'akarom', 'legyen']);
  const isNoLike = isNegativeText(norm);
  const isMaybeLike = isHesitationText(norm);
  const isPointer = containsAny(norm, ['azt', 'azokat', 'ezt', 'ezeket', 'az']);
  const isReplanNudge = containsAny(norm, ['inkabb holnap', 'holnap inkabb', 'inkabb a', 'csak holnap']);
  const requestedMonth = detectMonthReference(norm);
  const historyState = inferHistoryState(recentConversation, chatRole);
  const rememberedMonth = getRememberedMonthEntities(lastAssistantEntities) || historyState.rememberedMonth;
  const continuation = isContinuationPrompt(norm);

  if (requestedMonth && (lastAssistantAction === 'clarify_with_options' || containsAny(normalizeText(lastAssistantMessage), ['melyik honapra', 'melyik honap']))) {
    const askedNorm = normalizeText(lastAssistantMessage);
    let targetAction = 'show_my_schedule';

    if (lastAssistantSuggestedAction) {
      targetAction = lastAssistantSuggestedAction;
    } else if (containsAny(askedNorm, ['szabadsag'])) {
      targetAction = 'show_my_vacations';
    } else if (containsAny(askedNorm, ['szabadnap'])) {
      targetAction = 'show_my_free_days';
    }

    return buildFollowUpParsed(targetAction, { monthOffset: requestedMonth.monthOffset, monthLabel: requestedMonth.label });
  }

  if (continuation) {
    if (chatRole === 'pharmacy') {
      if (containsAny(norm, ['szabadsag', 'szabi', 'ki megy'])) {
        return buildFollowUpParsed('show_vacation_requests', rememberedMonth || {});
      }
      if (containsAny(norm, ['nem irta', 'nem irt', 'tervezet', 'draft', 'hianyzik'])) {
        return buildFollowUpParsed('missing_drafts', rememberedMonth || {});
      }
      if (containsAny(norm, ['dolgozo', 'alkalmazott', 'csapat'])) {
        return buildFollowUpParsed('list_employees', rememberedMonth || {});
      }
    } else {
      if (containsAny(norm, ['beoszt', 'muszak'])) {
        return buildFollowUpParsed('show_my_schedule', rememberedMonth || {});
      }
      if (containsAny(norm, ['szabadnap'])) {
        return buildFollowUpParsed('show_my_free_days', rememberedMonth || {});
      }
      if (containsAny(norm, ['szabi', 'szabadsag'])) {
        return buildFollowUpParsed('show_my_vacations', rememberedMonth || {});
      }
    }
  }

  if (containsAny(norm, ['beoszt', 'muszak'])) {
    return buildFollowUpParsed('show_my_schedule', rememberedMonth || {});
  }
  if (containsAny(norm, ['szabadnap'])) {
    return buildFollowUpParsed('show_my_free_days', rememberedMonth || {});
  }
  if (containsAny(norm, ['szabi', 'szabadsag'])) {
    return buildFollowUpParsed(chatRole === 'pharmacy' ? 'show_vacation_requests' : 'show_my_vacations', rememberedMonth || {});
  }
  if (chatRole === 'pharmacy' && containsAny(norm, ['tervezet', 'draft', 'nem irta', 'nem irt'])) {
    return buildFollowUpParsed('missing_drafts', rememberedMonth || {});
  }
  if (chatRole === 'pharmacy' && containsAny(norm, ['dolgozo', 'alkalmazott', 'csapat'])) {
    return buildFollowUpParsed('list_employees', rememberedMonth || {});
  }
  if (containsAny(norm, ['tulora', 'tuloras'])) {
    return buildFollowUpParsed('show_overtime');
  }

  if (containsAny(norm, ['hetfo', 'kedd', 'szerda', 'csutortok', 'pentek', 'szombat', 'vasarnap', 'holnap']) && (lastAssistantAction === 'replan_all' || lastAssistantAction === 'replan_specific_day')) {
    return buildFollowUpParsed('replan_specific_day', lastAssistantEntities || {});
  }

  if (!(isShort || isYesLike || isNoLike || isMaybeLike || isPointer || isReplanNudge)) return null;

  if (isNoLike) {
    return buildFollowUpParsed('follow_up_decline', rememberedMonth || {});
  }

  if (isMaybeLike) {
    return buildFollowUpParsed('follow_up_hesitate', rememberedMonth || {});
  }

  if (isReplanNudge && (lastAssistantAction === 'replan_all' || lastAssistantAction === 'replan_specific_day')) {
    return buildFollowUpParsed('replan_specific_day', lastAssistantEntities || {});
  }

  const schedulePrompted = previousMessageIntent === 'thanks'
    || previousMessageIntent === 'ack'
    || isScheduleOrFreeDaysPrompt(lastAssistantMessage);

  if (schedulePrompted) {
    return buildFollowUpParsed(chatRole === 'pharmacy' ? (historyState.dominantTopic || 'list_employees') : 'show_my_schedule', rememberedMonth || {});
  }

  if (lastAssistantAction && lastAssistantAction !== 'clarify_with_options') {
    return buildFollowUpParsed(lastAssistantAction, lastAssistantEntities || {});
  }

  if (historyState.dominantTopic) {
    return buildFollowUpParsed(historyState.dominantTopic, rememberedMonth || {});
  }

  return null;
}

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag' }, { status: 401 });
    }

    const body = await request.json();
    const originalMessage = body?.message || '';
    const message = await normalizeHungarianChatInput(originalMessage);
    const context = body?.context || {};
    const chatRole = normalizeChatRole(context?.chatRole);
    const recentConversation = Array.isArray(context?.recentConversation) ? context.recentConversation.slice(-6) : [];
    const uid = authUser.uid;
    const previousMessageIntent = body?.previousMessageIntent;
    const lastAssistantMessage = context?.lastAssistantMessage || '';
    const lastAssistantAction = context?.lastAssistantAction || '';
    const lastAssistantSuggestedAction = context?.lastAssistantSuggestedAction || '';
    const lastAssistantEntities = context?.lastAssistantEntities || null;
    const learningFeedback = body?.learningFeedback || null;

    // Check if this is a training input (starts with "xx ")
    const training = detectTrainingInput(originalMessage);

    if (training.isTraining) {
      if (!training.trainingResponse) {
        return NextResponse.json({
          success: false,
          error: 'Az xx utan add meg, mit valaszoljak. Pelda: "xx Mutasd a tulorasokat"',
        }, { status: 400 });
      }

      const originalQuestion = context.lastUserMessage && context.lastUserMessage !== originalMessage
        ? context.lastUserMessage
        : (body?.previousUserMessage || 'unknown');

      const intentForTraining = previousMessageIntent || 'unknown';

      // This is a training message - save the pattern
      console.log('[Betti Training]', {
        message,
        previousMessageIntent,
        intentForTraining,
        originalQuestion,
      });
      
      const pattern = buildTrainingPattern(
        intentForTraining,
        originalQuestion,
        training.trainingResponse
      );

      if (!pattern.pattern) {
        return NextResponse.json({
          success: false,
          error: 'Nem talaltam tanithato kerdesmintat. Elobb kerdezz valamit, aztan ird: "xx ..."',
        }, { status: 400 });
      }
      
      console.log('[Betti Training] Pattern to save:', pattern);
      const saveResult = await saveTrainingPattern(uid, pattern);
      console.log('[Betti Training] Save result:', saveResult);
      
      if (saveResult.success) {
        // Force reload patterns after saving (small delay for Firestore consistency)
        setTimeout(() => {
          console.log('[Betti Training] Pattern saved, will reload next request');
        }, 500);
        
        return NextResponse.json({
          success: true,
          isTraining: true,
          intent: 'training_saved',
          reply: `✓ Megtanultam! Legkozelebb ha azt kerdezed: "${originalQuestion}" erre valaszolok: "${training.trainingResponse}"`,
          payload: {
            action: 'training_saved',
            pattern,
          },
          quickActions: [],
        });
      } else {
        // Training save failed - return error
        console.error('[Betti Training] Save failed:', saveResult.error);
        return NextResponse.json({
          success: false,
          error: `Tanítás sikertelen: ${saveResult.error || 'Ismeretlen hiba'}`,
          details: saveResult.error,
        }, { status: 500 });
      }
    }

    // Load learned patterns ONLY for normal (non-training) messages
    const learnedPatterns = await loadTrainingPatterns(uid);
    if (learnedPatterns.length > 0) {
      console.log(`[Betti] Loaded ${learnedPatterns.length} learned patterns for user ${uid}`);
    }

    // Active learning: user selected one of Betti's suggested intents
    if (
      learningFeedback?.type === 'intent_selection'
      && learningFeedback?.originalMessage
      && learningFeedback?.selectedPrompt
    ) {
      const selectedParsed = parseBettiIntent(learningFeedback.selectedPrompt, learnedPatterns);
      if (selectedParsed.intent !== 'unknown') {
        const autoPattern = buildTrainingPattern(
          selectedParsed.intent,
          learningFeedback.originalMessage,
          selectedParsed.reply
        );
        autoPattern.action = selectedParsed.action;
        autoPattern.source = 'quick_action_selection';
        await saveTrainingPattern(uid, autoPattern);
      }
    }

    // Normal message processing with learned patterns
    let parsed = parseBettiIntent(message, learnedPatterns);

    if (parsed.isLearned && (parsed.learnedPatternId || parsed.learnedPatternFingerprint)) {
      await recordTrainingPatternUsage(uid, parsed.learnedPatternId || parsed.learnedPatternFingerprint);
    }

    if (parsed.intent === 'unknown' || parsed.intent === 'affirmative') {
      const contextual = resolveContextualFollowUp({
        message,
        chatRole,
        recentConversation,
        previousMessageIntent,
        lastAssistantAction,
        lastAssistantSuggestedAction,
        lastAssistantMessage,
        lastAssistantEntities,
      });

      if (contextual) {
        parsed = {
          ...parsed,
          ...contextual,
          entities: {
            ...(parsed.entities || {}),
            ...(contextual.entities || {}),
          },
        };
      }
    }
    const proactiveWarnings = buildProactiveWarnings({
      stats: context.stats || null,
      conflicts: Array.isArray(context.conflicts) ? context.conflicts : [],
    });

    let reply = parsed.reply;
    let payload = {
      action: parsed.action,
      entities: parsed.entities,
      confidence: parsed.confidence,
      topCandidates: parsed.topCandidates || [],
      reasoning: parsed.reasoning || null,
    };
    let forceClarify = false;
    let quickActionsOverride = null;

    if (parsed.intent === 'explain_assignment') {
      const explained = explainAssignmentDecision({
        assignmentReasons: context.assignmentReasons || [],
        employeeName: parsed.entities?.person || undefined,
      });
      reply = `${explained.title}\n- ${explained.bullets.join('\n- ')}`;
      payload = {
        ...payload,
        explanation: explained,
      };
    }

    if (parsed.intent === 'report_overtime') {
      const rows = context?.stats?.employees || [];
      const overtimeRows = rows
        .filter((item) => Number(item.overtimeHours || 0) > 0)
        .sort((a, b) => Number(b.overtimeHours || 0) - Number(a.overtimeHours || 0))
        .slice(0, 5);

      if (overtimeRows.length === 0) {
        reply = 'Jelenleg nincs olyan dolgozo, aki tuloraban lenne.';
      } else {
        reply = `Tulorasok: ${overtimeRows.map((item) => `${item.name} (${item.overtimeHours}h)`).join(', ')}`;
      }

      payload = {
        ...payload,
        overtimeRows,
      };
    }

    if (parsed.intent === 'my_schedule') {
      const requestedMonth = resolveRequestedOrRememberedMonth({
        message,
        lastAssistantEntities: lastAssistantEntities || inferHistoryState(recentConversation, chatRole).rememberedMonth,
        allowRememberedMonth: isContinuationPrompt(message),
      });
      if (!requestedMonth) {
        reply = 'Rendben, melyik honapra mutassam a beosztasodat?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'show_my_schedule',
          entities: {
            ...(payload.entities || {}),
          },
        };
        quickActionsOverride = buildMonthQuickActions('beosztas');
      } else {
        reply = `Rendben, megmutatom a beosztasodat a ${requestedMonth.label} idoszakra.`;
        payload = {
          ...payload,
          action: 'show_my_schedule',
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'my_vacation') {
      const requestedMonth = resolveRequestedOrRememberedMonth({
        message,
        lastAssistantEntities: lastAssistantEntities || inferHistoryState(recentConversation, chatRole).rememberedMonth,
        allowRememberedMonth: isContinuationPrompt(message),
      });
      if (!requestedMonth) {
        reply = 'Rendben, melyik honapra nezzem a szabadsag napjaidat?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'show_my_vacations',
        };
        quickActionsOverride = buildMonthQuickActions('szabadsag');
      } else {
        reply = `Rendben, megnezem a szabadsag napjaidat a ${requestedMonth.label} idoszakra.`;
        payload = {
          ...payload,
          action: 'show_my_vacations',
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'my_free_days') {
      const requestedMonth = resolveRequestedOrRememberedMonth({
        message,
        lastAssistantEntities: lastAssistantEntities || inferHistoryState(recentConversation, chatRole).rememberedMonth,
        allowRememberedMonth: isContinuationPrompt(message),
      });
      if (!requestedMonth) {
        reply = 'Rendben, melyik honapra nezzem a szabadnapjaidat?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'show_my_free_days',
        };
        quickActionsOverride = buildMonthQuickActions('szabadnap');
      } else {
        reply = `Rendben, kilistazom a szabadnapjaidat a ${requestedMonth.label} idoszakra.`;
        payload = {
          action: 'show_my_free_days',
          ...payload,
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'list_employees') {
      reply = 'Rendben, listazom az alkalmazottaidat.';
      payload = {
        ...payload,
        action: 'list_employees',
      };
    }

    if (parsed.intent === 'show_vacation_requests') {
      const requestedMonth = resolveRequestedOrRememberedMonth({
        message,
        lastAssistantEntities: lastAssistantEntities || inferHistoryState(recentConversation, chatRole).rememberedMonth,
        allowRememberedMonth: isContinuationPrompt(message),
      });
      if (!requestedMonth) {
        reply = 'Rendben, melyik honapra szeretned latni az igenyelt szabadsagokat?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'show_vacation_requests',
        };
        quickActionsOverride = buildMonthQuickActions('szabadsag');
      } else {
        reply = `Rendben, megmutatom a szabadsag igeenyeket a ${requestedMonth.label} idoszakra.`;
        payload = {
          ...payload,
          action: 'show_vacation_requests',
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'missing_drafts') {
      const requestedMonth = resolveRequestedOrRememberedMonth({
        message,
        lastAssistantEntities: lastAssistantEntities || inferHistoryState(recentConversation, chatRole).rememberedMonth,
        allowRememberedMonth: isContinuationPrompt(message),
      });
      if (!requestedMonth) {
        reply = 'Rendben, melyik honapra ellenorizzem az elkeszult tervezeteket?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'missing_drafts',
        };
        quickActionsOverride = buildMonthQuickActions('tervezet');
      } else {
        reply = `Rendben, ellenorizzem ki nem irta meg meg a ${requestedMonth.label} tervezetet.`;
        payload = {
          ...payload,
          action: 'missing_drafts',
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'add_employee') {
      reply = 'Rendben, felvethetel egy uj dolgozot. Kerem add meg az email cimet.';
      payload = {
        ...payload,
        action: 'add_employee',
      };
    }

    if (parsed.intent === 'remove_employee') {
      reply = 'Melyik dolgozot szeretned eltavolitani?';
      payload = {
        ...payload,
        action: 'remove_employee',
      };
    }

    if (parsed.intent === 'capabilities' || parsed.intent === 'help') {
      reply = 'Ebben tudok segiteni:\n- Sajat beosztas es kovetkezo muszakok\n- Szabadsagok es szabadnapok\n- Tulora attekintes\n- Muszakhelyettesites\n- Ujratervezes (teljes vagy napi)\n\nIrd peldaul: "Mi a beosztasom?" vagy "Mutasd a tulorasokat".';
    }

    if (parsed.intent === 'write_schedule_plan') {
      reply = 'Rendben, segitek beosztas-tervezetet irni. Nyisd meg a Beosztas-tervezo reszt, vagy mondd: "Beosztast szeretnek irni".';
    }

    if (parsed.intent === 'greeting') {
      reply = 'Szia! Betti vagyok, a Pharmagister AI asszisztense 👋 Kerdezhetsz ilyet is: "Mi a beosztasom?", "Mikor vagyok szabin?", vagy "Mutasd a tulorasokat".';
    }

    if (parsed.intent === 'identity') {
      reply = 'Betti vagyok, a Pharmagister AI asszisztense. Epres Laszlo fejlesztett.';
    }

    if (parsed.intent === 'thanks' || parsed.intent === 'ack') {
      reply = 'Szivesen! Ha szeretned, mar most megmutatom a kovetkezo muszakjaidat vagy szabadnapjaidat.';
    }

    if (parsed.intent === 'affirmative') {
      const followupPrompted = previousMessageIntent === 'thanks'
        || previousMessageIntent === 'ack'
        || isScheduleOrFreeDaysPrompt(lastAssistantMessage);

      if (followupPrompted) {
        reply = 'Szuper. Mit mutassak most: a sajat beosztasodat vagy a szabadnapjaidat?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
          suggestedAction: 'show_my_schedule',
        };
        quickActionsOverride = [
          { key: 'my_schedule', label: 'A sajat beosztasom', utterance: 'Mi a beosztasom?' },
          { key: 'my_free_days', label: 'A szabadnapjaim', utterance: 'Mikor vagyok szabadnapos?' },
          { key: 'my_vacation', label: 'A szabadsag napjaim', utterance: 'Mikor vagyok szabin?' },
        ];
      } else {
        reply = 'Szuper, pontositsunk egy lepest: mit szeretnel latni?';
        payload = {
          ...payload,
          action: 'clarify_with_options',
        };
        quickActionsOverride = buildUnknownSuggestions(message, chatRole);
      }
    }

    if (parsed.intent === 'negative') {
      reply = isScheduleOrFreeDaysPrompt(lastAssistantMessage)
        ? 'Rendben, akkor ezt most nem nyitom meg. Mondj egy masik iranyt, es megyek azon tovabb.'
        : 'Rendben, ezt most elengedem. Ha szeretned, mutatok inkabb mas lehetosegeket.';
      payload = {
        ...payload,
        action: 'clarify_with_options',
      };
      quickActionsOverride = buildUnknownSuggestions(message, chatRole);
    }

    if (parsed.intent === 'hesitation') {
      reply = isScheduleOrFreeDaysPrompt(lastAssistantMessage)
        ? 'Semmi gond, nem kell most dontened. Szolj, ha inkabb megnezzuk ezt kesobb, vagy mondj egy masik kerdest.'
        : 'Rendben, raerunk ezzel kesobb is. Ha szeretned, addig atmehetunk egy masik temara.';
      payload = {
        ...payload,
        action: 'clarify_with_options',
      };
      quickActionsOverride = buildUnknownSuggestions(message, chatRole);
    }

    const shouldClarifyLowConfidence = (
      parsed.intent !== 'unknown'
      && parsed.action !== 'clarify_with_options'
      && Number(parsed.confidence || 0) < LOW_CONFIDENCE_THRESHOLD
      && !parsed.isLearned
    );

    if (shouldClarifyLowConfidence) {
      forceClarify = true;
      const bestAlternate = (parsed.topCandidates || []).find((candidate) => candidate.intent !== parsed.intent || candidate.action !== parsed.action);
      const guess = findSuggestionForParsed(bestAlternate ? { ...parsed, action: bestAlternate.action, intent: bestAlternate.intent } : parsed, chatRole)
        || findSuggestionForParsed(parsed, chatRole);
      reply = buildLowConfidenceReply({ message, guess });
      payload = {
        ...payload,
        action: 'clarify_with_options',
        suggestedAction: parsed.action,
      };
    }

    if (parsed.action === 'clarify_with_options') {
      reply = buildClarifyReply({ chatRole, message });
    }

    reply = polishBettiReply({
      reply,
      action: payload?.action || parsed.action,
      chatRole,
      entities: payload?.entities || parsed.entities,
      seed: `${message}:${payload?.action || parsed.action}`,
    });

    const quickActions = quickActionsOverride || ((parsed.intent === 'unknown' || parsed.action === 'clarify_with_options' || forceClarify)
      ? (() => {
          const suggestions = buildUnknownSuggestions(message, chatRole);
          if (!forceClarify) return suggestions;

          const guess = findSuggestionForParsed(parsed, chatRole);
          if (!guess) return suggestions;

          const promoted = {
            ...guess,
            label: `Igen, erre gondoltam: ${guess.label}`,
            learnFromPreviousUnknown: true,
          };

          const rest = suggestions.filter((item) => item.key !== guess.key).slice(0, 2);
          return [promoted, ...rest];
        })()
      : buildSuccessQuickActions({
          action: payload?.action || parsed.action,
          chatRole,
          entities: payload?.entities || parsed.entities,
        }));

    if (parsed.intent === 'unknown' && quickActions.length > 0) {
      reply = buildUnknownReply({ message, quickActions });
      payload = {
        ...payload,
        action: 'clarify_with_options',
      };
    }

    return NextResponse.json({
      success: true,
      intent: parsed.intent,
      reply,
      payload,
      proactiveWarnings,
      quickActions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Betti most nem tudta ertelmezni a kerest. Probald meg ujra rovidebben.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
