import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { parseBettiIntent } from '@/lib/intentParser';
import { normalizeHungarianChatInput } from '@/lib/huDictionary';
import { explainAssignmentDecision } from '@/lib/explanationEngine';
import { buildProactiveWarnings } from '@/lib/suggestionEngine';
import {
  detectTrainingInput,
  loadTrainingPatterns,
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

  if (containsAny(norm, ['kovetkezo honap', 'jovo honap', 'jov honap', 'jovohonap'])) {
    return { monthOffset: 1, label: 'kovetkezo honap' };
  }
  if (containsAny(norm, ['elozo honap', 'mult honap'])) {
    return { monthOffset: -1, label: 'elozo honap' };
  }
  if (containsAny(norm, ['aktualis honap', 'erre a honapra', 'ebben a honapban', 'mostani honap', 'e havi'])) {
    return { monthOffset: 0, label: 'aktualis honap' };
  }

  return null;
}

function buildScheduleMonthQuickActions() {
  return [
    { key: 'schedule_current_month', label: 'Aktualis honap', utterance: 'A beosztasom erre a honapra' },
    { key: 'schedule_next_month', label: 'Kovetkezo honap', utterance: 'A beosztasom a kovetkezo honapra' },
    { key: 'schedule_prev_month', label: 'Elozo honap', utterance: 'A beosztasom az elozo honapra' },
  ];
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

function mapActionToIntent(action) {
  const actionToIntent = {
    show_my_schedule: 'my_schedule',
    show_my_vacations: 'my_vacation',
    show_my_free_days: 'my_free_days',
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
  previousMessageIntent,
  lastAssistantAction,
  lastAssistantMessage,
  lastAssistantEntities,
}) {
  const norm = normalizeText(message);
  if (!norm) return null;

  const words = norm.split(/\s+/).filter(Boolean);
  const isShort = words.length <= 4;
  const isYesLike = containsAny(norm, ['igen', 'ja', 'persze', 'oke', 'ok', 'szeretnem', 'mehet', 'legyen']);
  const isPointer = containsAny(norm, ['azt', 'azokat', 'ezt', 'ezeket', 'az']);
  const isReplanNudge = containsAny(norm, ['inkabb holnap', 'holnap inkabb', 'inkabb a', 'csak holnap']);
  const requestedMonth = detectMonthReference(norm);

  if (requestedMonth && (lastAssistantAction === 'clarify_with_options' || containsAny(normalizeText(lastAssistantMessage), ['melyik honapra', 'melyik honap']))) {
    return buildFollowUpParsed('show_my_schedule', { monthOffset: requestedMonth.monthOffset, monthLabel: requestedMonth.label });
  }

  if (containsAny(norm, ['beoszt', 'muszak'])) {
    return buildFollowUpParsed('show_my_schedule');
  }
  if (containsAny(norm, ['szabadnap'])) {
    return buildFollowUpParsed('show_my_free_days');
  }
  if (containsAny(norm, ['szabi', 'szabadsag'])) {
    return buildFollowUpParsed('show_my_vacations');
  }
  if (containsAny(norm, ['tulora', 'tuloras'])) {
    return buildFollowUpParsed('show_overtime');
  }

  if (containsAny(norm, ['hetfo', 'kedd', 'szerda', 'csutortok', 'pentek', 'szombat', 'vasarnap', 'holnap']) && (lastAssistantAction === 'replan_all' || lastAssistantAction === 'replan_specific_day')) {
    return buildFollowUpParsed('replan_specific_day', lastAssistantEntities || {});
  }

  if (!(isShort || isYesLike || isPointer || isReplanNudge)) return null;

  if (isReplanNudge && (lastAssistantAction === 'replan_all' || lastAssistantAction === 'replan_specific_day')) {
    return buildFollowUpParsed('replan_specific_day', lastAssistantEntities || {});
  }

  const schedulePrompted = previousMessageIntent === 'thanks'
    || previousMessageIntent === 'ack'
    || isScheduleOrFreeDaysPrompt(lastAssistantMessage);

  if (schedulePrompted) {
    return buildFollowUpParsed('show_my_schedule');
  }

  if (lastAssistantAction && lastAssistantAction !== 'clarify_with_options') {
    return buildFollowUpParsed(lastAssistantAction, lastAssistantEntities || {});
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
    const uid = authUser.uid;
    const previousMessageIntent = body?.previousMessageIntent;
    const lastAssistantMessage = context?.lastAssistantMessage || '';
    const lastAssistantAction = context?.lastAssistantAction || '';
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

    if (parsed.intent === 'unknown' || parsed.intent === 'affirmative') {
      const contextual = resolveContextualFollowUp({
        message,
        previousMessageIntent,
        lastAssistantAction,
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
      const requestedMonth = detectMonthReference(message);
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
        quickActionsOverride = buildScheduleMonthQuickActions();
      } else {
        reply = `Rendben, megmutatom a beosztasodat a ${requestedMonth.label} idoszakra.`;
        payload = {
          ...payload,
          entities: {
            ...(payload.entities || {}),
            monthOffset: requestedMonth.monthOffset,
            monthLabel: requestedMonth.label,
          },
        };
      }
    }

    if (parsed.intent === 'my_vacation') {
      reply = 'Rendben, megnezem a szabadsag napjaidat.';
    }

    if (parsed.intent === 'my_free_days') {
      reply = 'Rendben, kilistazom a kovetkezo szabadnapjaidat.';
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

    const shouldClarifyLowConfidence = (
      parsed.intent !== 'unknown'
      && parsed.action !== 'clarify_with_options'
      && Number(parsed.confidence || 0) < LOW_CONFIDENCE_THRESHOLD
      && !parsed.isLearned
    );

    if (shouldClarifyLowConfidence) {
      forceClarify = true;
      const guess = findSuggestionForParsed(parsed, chatRole);
      if (guess) {
        reply = `Nem vagyok teljesen biztos benne. Arra gondoltal, hogy: ${guess.label}? Valassz lent egy opciot.`;
      } else {
        reply = 'Nem vagyok teljesen biztos benne. Valassz egy opciot, hogy pontosan arra menjunk.';
      }
      payload = {
        ...payload,
        action: 'clarify_with_options',
        suggestedAction: parsed.action,
      };
    }

    if (parsed.action === 'clarify_with_options') {
      reply = chatRole === 'pharmacy'
        ? 'Rendben. Pontosan mit mutassak: a tulorasokat, az ujratervezest, vagy a helyettesitesi opciokat?'
        : 'Rendben. Pontosan mit mutassak: a sajat beosztasodat, a tulorasokat, vagy a szabadsag napjaidat?';
    }

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
      : [
          { key: 'replan_all', label: 'Ujratervezes', utterance: 'Ujratervezes' },
          { key: 'optimize_fairness', label: 'Igazsagosabb verzio', utterance: 'Legyen igazsagosabb a beosztas' },
          { key: 'optimize_overtime', label: 'Kevesebb tulora', utterance: 'Csokkentsd a tulorat' },
          { key: 'replan_specific_day', label: 'Csak egy nap ujratervezese', utterance: 'Tervezd ujra csak a hetfot' },
          { key: 'minimal_change_replan', label: 'Legkisebb valtoztatas', utterance: 'Minel kevesebbet valtoztass' },
        ]);

    if (parsed.intent === 'unknown' && quickActions.length > 0) {
      const top = quickActions.slice(0, 3).map((item) => item.label).join(', ');
      reply = `Ezt most nem ertettem teljesen. Lehetseges opciok: ${top}. Valassz lent egyet, vagy tanits "xx" kezdetu valasszal.`;
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
