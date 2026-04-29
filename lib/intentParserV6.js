/**
 * BETTI V6: Unified Intent Classifier
 * 
 * Central Decision Pipeline:
 * INPUT → normalizeHungarianChatInput → intentClassifier → confidence
 * 
 * CORE RULE: confidence < 0.85 → clarify (NO EXCEPTIONS)
 * 
 * 5 Intent Categories:
 * - identity_check: Who are you? Are you an employee?
 * - data_query: Show me schedule, vacation, employees, etc.
 * - schedule_ops: Replan, find replacement, lock shifts
 * - modification_request: Make it fairer, reduce OT, explain
 * - clarification: Yes/no/maybe, challenge, unclear, help
 */

// ============================================================================
// NORMALIZATION & TOKENIZATION
// ============================================================================

const WEEKDAY_MAP = {
  vasarnap: 0,
  hetfo: 1,
  kedd: 2,
  szerda: 3,
  csutortok: 4,
  pentek: 5,
  szombat: 6,
};

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

export const AFFIRMATIVE_PHRASES = [
  'igen', 'persze', 'ja', 'aha', 'oke', 'ok', 'rendben', 'nana',
  'termeszetesen', 'ugy van', 'bizony', 'abszolut', 'siman', 'biztosan',
  'valoban', 'pontosan', 'franko', 'kiraly', 'mehet', 'johet', 'adom',
  'benne vagyok', 'stimmel', 'helyes', 'ertem', 'ja-ja', 'yup', 'yep', 'yes',
];

export const NEGATIVE_PHRASES = [
  'nem', 'dehogy', 'egyaltalan nem', 'kizart', 'semmikepp', 'semmi esetre sem',
  'nee', 'ne', 'a', 'ah', 'ugyan mar', 'nemigen', 'aligha', 'biztos nem',
  'nana hogy nem', 'szo sincs rola', 'felejtsd el', 'eselytelen', 'nincs ra mod',
  'tiltva', 'negativ', 'nope', 'no', 'nem-ja', 'dehogyis', 'francokat', 'kizarva',
];

export const HESITATION_PHRASES = [
  'talan', 'hat talan', 'esetleg', 'meg meglatom', 'majd meglatom', 'kesobb',
  'majd kesobb', 'most nem tudom', 'nem tudom', 'passz', 'ki tudja', 'meglatjuk',
  'nem biztos', 'nem vagyok biztos benne', 'talan kesobb', 'egyelore nem tudom',
  'majd', 'raerek kesobb', 'kesobb megnezzuk',
];

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

function tokenizeAndStem(text) {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function isAffirmativeText(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  return AFFIRMATIVE_PHRASES.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    return norm === normalizedPhrase || norm.startsWith(`${normalizedPhrase} `);
  });
}

export function isNegativeText(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  return NEGATIVE_PHRASES.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    return norm === normalizedPhrase || norm.startsWith(`${normalizedPhrase} `);
  });
}

export function isHesitationText(text) {
  const norm = normalizeText(text);
  if (!norm) return false;
  return HESITATION_PHRASES.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    return norm === normalizedPhrase || norm.startsWith(`${normalizedPhrase} `);
  });
}

function extractWeekday(text) {
  const norm = normalizeText(text);
  const found = Object.keys(WEEKDAY_MAP).find((day) => norm.includes(day));
  if (!found) return null;
  return { weekday: found, weekdayIndex: WEEKDAY_MAP[found] };
}

// ============================================================================
// PATTERN MATCHERS (SIMPLE, DIRECT)
// ============================================================================

const IDENTITY_CHECK_PATTERNS = [
  /^(szia|sziasztok|hello|hali|jo napot|jo reggelt|jo estet)\b/,
  /(ki vagy|ki vagy te|micsoda vagy|ki keszitett|ki fejlesztett|ki hozott letre)/,
  /(alkalmazott\s+vagyok\??|vagyok\s+alkalmazott\??|en\s+alkalmazott\??)/,
];

const DATA_QUERY_PATTERNS = [
  /(mi a beosztasom|mutasd a beosztasom|beosztasom|muszakjaim|mikor dolgozom)/,
  /(mikor vagyok szabin|mikor leszek szabadsagon|szabadsagom|szabi napjaim)/,
  /(mikor vagyok szabadnapos|szabadnapjaim|mikor vagyok szabad)/,
  /(ki megy szabira|kik mennek szabira|szabadsag igenyek)/,
  /(ki nem irta meg.*(tervezet|draft)|hianyzik.*(tervezet|draft))/,
  /(tulora|tuloras|mutasd.*tulora|ki van tuloraban)/,
  /(listazd?|sorold|mutasd).*(dolgozoim|alkalmazottaim|alkalmazottak|munkatarsak|csapatom)/,
  /(mit tudsz|mire vagy kepes|mihez ertesz|miben tudsz segiteni)/,
  /(miert|miert.*kapta|mi alapjan kapta)/,
];

const SCHEDULE_OPS_PATTERNS = [
  /(tervezd ujra.*csak|csak.*tervezd ujra|holnapi.*ujra|csak a hetfot|csak a keddet|csak a szerdat)/,
  /(szabadsagon|beteg|kiesik|nem jon)/,
  /(ki tudna atvenni|atvenni.*muszak|helyettesitis|helyettesites)/,
  /(fix beosztas|lock|ne valtoztasd|rogzitett muszak)/,
  /(legkisebb valtoztatas|minimalis valtoztatas|minel kevesebbet valtoztass)/,
  /(ujratervezes|tervezd ujra|uj terv|generalj uj beosztast|keszits uj beosztast)/,
];

const MODIFICATION_PATTERNS = [
  /(igazsagosabb|egyenletesebb|fair)/,
  /(kevesebb tulora|csokkentsd a tulorat|tulora csokkentes)/,
  /(beosztast szeretnek irni|beosztast akarok irni|tervezetet szeretnek)/,
];

const CLARIFICATION_PATTERNS = [
  /^(nem$|nem\b|dehogy\b|egyaltalan\s+nem\b)/,
  /^(igen|persze|ja|aha|oke|ok\b|rendben|termeszetesen)/,
  /^(talan|esetleg|meg\s+meglatom|majd\s+meglatom|kesobb|nem\s+tudom)/,
  /^(nem ertem\b|ezt nem ertem\b|elmagyaraznad\b|egyszerubben\b)/,
  /^(miert\b|hogyhogy\b|nem tudsz\b|mi a gond\b)/,
  /^(mutasd|muti|mutass|mutas|nezzuk|show|kene|kellene|jo\s+lenne)\b/,
  /^(segits|segitseg|help|kerlek segits)\b/,
  /^(koszi+|koszonom|szuper|thx)\b/,
];

// ============================================================================
// UNIFIED INTENT CLASSIFIER
// ============================================================================

/**
 * Main intent classification function
 * Returns: {
 *   category,        // identity_check, data_query, schedule_ops, modification_request, clarification
 *   confidence,      // 0.0 - 1.0
 *   action,          // Primary action name
 *   reply,           // Standard reply (may be overridden by route)
 *   needsDisambiguation, // true if multiple interpretations possible
 *   alternatives,    // [{ category, confidence, action }, ...]
 *   entities,        // { weekday, person, etc. }
 * }
 * 
 * HARD RULE: If confidence < 0.85, category = 'clarification' (no exceptions)
 */
export function classifyIntent(message, context = {}) {
  const raw = String(message || '').trim();
  const text = normalizeText(raw);
  const weekday = extractWeekday(text);
  const tokens = tokenizeAndStem(text);
  
  // Quick exit: empty input
  if (!text || text.length === 0) {
    return {
      category: 'clarification',
      confidence: 0.3,
      action: 'clarify',
      reply: 'Valami nem toltodott be. Probald ujra, legyszives.',
      needsDisambiguation: false,
      alternatives: [],
      entities: { weekday },
    };
  }

  // CHECK YES/NO/MAYBE FIRST (highest priority clarifications)
  if (isAffirmativeText(text)) {
    return {
      category: 'clarification',
      confidence: 0.95,
      action: 'follow_up_confirm',
      reply: 'Szuper, menjunk tovabb.',
      needsDisambiguation: false,
      alternatives: [],
      entities: { weekday },
    };
  }

  if (isNegativeText(text)) {
    return {
      category: 'clarification',
      confidence: 0.93,
      action: 'follow_up_decline',
      reply: 'Rendben. Pontosits, mire van szukseged.',
      needsDisambiguation: false,
      alternatives: [],
      entities: { weekday },
    };
  }

  if (isHesitationText(text)) {
    return {
      category: 'clarification',
      confidence: 0.88,
      action: 'follow_up_hesitate',
      reply: 'Rendben, nem siettetlek.',
      needsDisambiguation: false,
      alternatives: [],
      entities: { weekday },
    };
  }

  // SPECIAL CASES: identity check
  if (IDENTITY_CHECK_PATTERNS.some((p) => p.test(text))) {
    const isManyAmbiguous = /(alkalmazott\s+vagyok\??|en\s+alkalmazott\??)/.test(text);
    return {
      category: 'identity_check',
      confidence: isManyAmbiguous ? 0.82 : 0.93,
      action: isManyAmbiguous ? 'clarify' : 'identity_check',
      reply: isManyAmbiguous
        ? 'Arra gondolsz, hogy alkalmazottkent vagy-e rogzitve a rendszerben, vagy az alkalmazotti listat szeretned latni?'
        : 'Betti vagyok, a Pharmagister AI asszisztense.',
      needsDisambiguation: isManyAmbiguous,
      alternatives: [],
      entities: { weekday },
    };
  }

  // BUILD CANDIDATE SCORES FOR EACH CATEGORY
  const scores = {
    identity_check: scoreCategory(text, IDENTITY_CHECK_PATTERNS, 0.85),
    data_query: scoreCategory(text, DATA_QUERY_PATTERNS, 0.78),
    schedule_ops: scoreCategory(text, SCHEDULE_OPS_PATTERNS, 0.82),
    modification_request: scoreCategory(text, MODIFICATION_PATTERNS, 0.80),
    clarification: scoreCategory(text, CLARIFICATION_PATTERNS, 0.75),
  };

  // FIND BEST CATEGORY
  const entries = Object.entries(scores).map(([cat, score]) => ({ category: cat, confidence: score }));
  const sorted = entries.sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];

  // HARD RULE: confidence < 0.85 → force clarification
  if (best.confidence < 0.85) {
    return {
      category: 'clarification',
      confidence: 0.4,
      action: 'clarify',
      reply: 'Ezt nem ertettem teljesen. Probald igy: "Mi a beosztasom?", "Mutasd a tulorasokat", vagy "Tervezd ujra csak a hetfot".',
      needsDisambiguation: false,
      alternatives: sorted.slice(0, 2),
      entities: { weekday },
    };
  }

  // Check for disambiguation need
  const secondBest = sorted[1];
  const needsDisambiguation = 
    secondBest && 
    best.confidence - secondBest.confidence < 0.15;

  // RETURN BEST MATCH
  return {
    category: best.category,
    confidence: best.confidence,
    action: getActionForCategory(best.category, text),
    reply: getReplyForCategory(best.category, text),
    needsDisambiguation,
    alternatives: sorted.slice(1, 3),
    entities: { weekday },
  };
}

/**
 * Score a category by counting pattern matches
 */
function scoreCategory(text, patterns, baseScore) {
  const matches = patterns.filter((p) => p.test(text)).length;
  if (matches === 0) return 0;
  const matchCount = Math.min(matches, patterns.length);
  const coverage = matchCount / patterns.length;
  return baseScore + (coverage * 0.1);
}

/**
 * Determine action for a given category
 */
function getActionForCategory(category, text) {
  const textLower = normalizeText(text);

  switch (category) {
    case 'identity_check':
      if (textLower.includes('ki vagy')) return 'identity';
      if (textLower.includes('alkalmazott')) return 'identity_check';
      return 'greeting';

    case 'data_query':
      if (textLower.includes('beosztas') || textLower.includes('muszak')) return 'show_my_schedule';
      if (textLower.includes('szabad')) return 'show_my_vacations';
      if (textLower.includes('szabadnap')) return 'show_my_free_days';
      if (textLower.includes('alkalmazott') || textLower.includes('dolgoz')) return 'list_employees';
      if (textLower.includes('tulora')) return 'show_overtime';
      if (textLower.includes('tervezet') || textLower.includes('draft')) return 'missing_drafts';
      if (textLower.includes('miert') || textLower.includes('mi alapjan')) return 'explain_assignment';
      return 'show_capabilities';

    case 'schedule_ops':
      if (textLower.includes('ujratervez') && textLower.includes('csak')) return 'replan_specific_day';
      if (textLower.includes('helyettes') || textLower.includes('atven')) return 'find_replacement';
      if (textLower.includes('lock') || textLower.includes('fix')) return 'lock_shift';
      if (textLower.includes('minimalis') || textLower.includes('legkisebb')) return 'minimal_change_replan';
      if (textLower.includes('ujratervez') || textLower.includes('uj terv')) return 'replan_all';
      return 'replan_all';

    case 'modification_request':
      if (textLower.includes('igazsagos') || textLower.includes('fair')) return 'optimize_fairness';
      if (textLower.includes('kevesebb') && textLower.includes('tulora')) return 'optimize_overtime';
      return 'write_schedule_plan';

    case 'clarification':
    default:
      if (isAffirmativeText(text)) return 'follow_up_confirm';
      if (isNegativeText(text)) return 'follow_up_decline';
      if (isHesitationText(text)) return 'follow_up_hesitate';
      return 'clarify';
  }
}

/**
 * Get standard reply for a given category
 */
function getReplyForCategory(category, text) {
  const textLower = normalizeText(text);

  switch (category) {
    case 'identity_check':
      return 'Betti vagyok, a Pharmagister AI asszisztense.';

    case 'data_query':
      if (textLower.includes('beosztas') || textLower.includes('muszak')) {
        return 'Megnezem a sajat beosztasodat.';
      }
      if (textLower.includes('szabad')) return 'Megnezem a szabadsag napjaidat.';
      if (textLower.includes('szabadnap')) return 'Megnezem a szabadnapjaidat.';
      if (textLower.includes('alkalmazott') || textLower.includes('dolgoz')) {
        return 'Rendben, listazom az alkalmazottaidat.';
      }
      if (textLower.includes('tulora')) return 'Rendben, megmutatom a tulorasokat.';
      if (textLower.includes('tervezet') || textLower.includes('draft')) {
        return 'Ellenorizzem ki nem irta meg a tervezetet.';
      }
      return 'Segitek beosztas, szabi, tulora temakban.';

    case 'schedule_ops':
      return 'Rendben, tervezek ujra.';

    case 'modification_request':
      return 'Rendben, modositok.';

    case 'clarification':
    default:
      return 'Erre gondolsz?';
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY: `parseBettiIntent` FOR ROUTE.JS
// ============================================================================

/**
 * Legacy wrapper for backward compatibility with route.js
 * Maps new classifier to old format
 */
export function parseBettiIntent(message, learnedPatterns = []) {
  const result = classifyIntent(message);
  
  // Legacy action mapping
  const actionMap = {
    identity_check: 'identity_check',
    greeting: 'greeting',
    identity: 'identity',
    show_my_schedule: 'show_my_schedule',
    show_my_vacations: 'show_my_vacations',
    show_my_free_days: 'show_my_free_days',
    list_employees: 'list_employees',
    show_overtime: 'show_overtime',
    missing_drafts: 'missing_drafts',
    explain_assignment: 'explain_assignment',
    show_capabilities: 'show_capabilities',
    replan_all: 'replan_all',
    replan_specific_day: 'replan_specific_day',
    find_replacement: 'find_replacement',
    optimize_fairness: 'optimize_fairness',
    optimize_overtime: 'optimize_overtime',
    write_schedule_plan: 'write_schedule_plan',
    lock_shift: 'lock_shift',
    minimal_change_replan: 'minimal_change_replan',
    follow_up_confirm: 'follow_up_confirm',
    follow_up_decline: 'follow_up_decline',
    follow_up_hesitate: 'follow_up_hesitate',
    clarify: 'clarify',
  };

  const action = actionMap[result.action] || result.action || 'clarify';

  return {
    intent: mapCategoryToLegacyIntent(result.category, action),
    confidence: result.confidence,
    action,
    entities: result.entities,
    reply: result.reply,
    topCandidates: result.alternatives.map((alt) => ({
      intent: mapCategoryToLegacyIntent(alt.category, ''),
      action: '',
      confidence: alt.confidence,
      matchType: 'alternative',
      score: alt.confidence,
    })),
    reasoning: {
      source: 'unified_classifier',
      category: result.category,
      needsDisambiguation: result.needsDisambiguation,
    },
  };
}

/**
 * Map category to legacy intent names
 */
function mapCategoryToLegacyIntent(category, action) {
  switch (category) {
    case 'identity_check':
      if (action === 'identity') return 'identity';
      if (action === 'identity_check') return 'identity_check';
      return 'greeting';

    case 'data_query':
      switch (action) {
        case 'show_my_schedule': return 'my_schedule';
        case 'show_my_vacations': return 'my_vacation';
        case 'show_my_free_days': return 'my_free_days';
        case 'list_employees': return 'list_employees';
        case 'show_overtime': return 'report_overtime';
        case 'missing_drafts': return 'missing_drafts';
        case 'explain_assignment': return 'explain_assignment';
        default: return 'generic_show';
      }

    case 'schedule_ops':
      switch (action) {
        case 'replan_all': return 'full_replan';
        case 'replan_specific_day': return 'replan_day';
        case 'find_replacement': return 'fill_missing_shift';
        case 'lock_shift': return 'lock_shift';
        case 'minimal_change_replan': return 'minimal_change';
        default: return 'replan_day';
      }

    case 'modification_request':
      switch (action) {
        case 'optimize_fairness': return 'make_fairer';
        case 'optimize_overtime': return 'reduce_overtime';
        case 'write_schedule_plan': return 'write_schedule_plan';
        default: return 'modification_request';
      }

    case 'clarification':
      switch (action) {
        case 'follow_up_confirm': return 'affirmative';
        case 'follow_up_decline': return 'negative';
        case 'follow_up_hesitate': return 'hesitation';
        default: return 'unknown';
      }

    default:
      return 'unknown';
  }
}
