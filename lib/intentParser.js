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

  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length > 5 && !NEGATIVE_PHRASES.some((phrase) => normalizeText(phrase).includes(' '))) {
    return false;
  }

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
  return {
    weekday: found,
    weekdayIndex: WEEKDAY_MAP[found],
  };
}

function extractPersonName(text) {
  const raw = String(text || '');
  const matches = [...raw.matchAll(/\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)\b/gu)].map((item) => item[1]);
  if (matches.length === 0) return null;

  const blocked = new Set(['mutasd', 'miert', 'tervezd', 'csinalj', 'ki', 'betti', 'szeretnem', 'igen', 'persze']);
  const found = matches.find((candidate) => !blocked.has(normalizeText(candidate)));
  return found || null;
}

function getBudapestTimeHungarianText() {
  const hhmm = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [hour = '00', minute = '00'] = hhmm.split(':');
  return `${hour} ora ${minute} perc van`;
}

const STEM_SUFFIXES = [
  'aitokat', 'eiteket', 'aitok', 'eitek', 'ainkat', 'einket', 'aink', 'eink',
  'atok', 'etek', 'otok', 'otok', 'unk', 'unkat', 'unket',
  'akat', 'eket', 'okat', 'okat', 'ot', 'et', 'at', 't',
  'ban', 'ben', 'bol', 'bol', 'rol', 'rol', 'tol', 'tol',
  'hoz', 'hez', 'hoz', 'nal', 'nel', 'ra', 're', 'ba', 'be',
  'on', 'en', 'an', 'va', 've', 'ig', 'ul', 'ul',
  'om', 'em', 'am', 'od', 'ed', 'ad', 'ja', 'je', 'juk', 'juk', 'jukat',
  'im', 'aim', 'eim', 'ok', 'ek', 'ak', 'k',
];

function stemHungarianToken(token) {
  let stem = normalizeText(token);
  if (stem.length <= 4) return stem;

  for (const suffix of STEM_SUFFIXES) {
    if (stem.endsWith(suffix) && stem.length - suffix.length >= 4) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }

  if (stem.endsWith('as') || stem.endsWith('es')) {
    if (stem.length > 5) stem = stem.slice(0, -1);
  }

  return stem;
}

function tokenizeAndStem(text) {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ token: t, stem: stemHungarianToken(t) }));
}

const SEMANTIC_INTENTS = [
  {
    key: 'my_schedule',
    action: 'show_my_schedule',
    confidence: 0.9,
    reply: 'Megnezem a sajat beosztasodat es osszefoglalom a kovetkezo muszakokat.',
    stems: ['beoszt', 'muszak', 'dolgoz'],
    boostStems: ['sajat', 'enyem', 'beosztasom'],
  },
  {
    key: 'my_vacation',
    action: 'show_my_vacations',
    confidence: 0.9,
    reply: 'Megnezem a szabadsag napjaidat.',
    stems: ['szabad', 'szabadsag', 'szabi'],
    boostStems: ['nap', 'mikor'],
  },
  {
    key: 'my_free_days',
    action: 'show_my_free_days',
    confidence: 0.88,
    reply: 'Megnezem a kovetkezo szabadnapjaidat.',
    stems: ['szabadnap', 'piheno', 'szabad'],
    boostStems: ['nap', 'mikor'],
  },
  {
    key: 'report_overtime',
    action: 'show_overtime',
    confidence: 0.9,
    reply: 'Rendben, megmutatom kik vannak tulora kozeleben vagy tuloraban.',
    stems: ['tulora', 'overtime'],
    boostStems: ['mutasd', 'ki'],
  },
  {
    key: 'replan_day',
    action: 'replan_specific_day',
    confidence: 0.86,
    reply: 'Rendben, csak az erintett nap(oka)t tervezem ujra.',
    stems: ['ujratervez', 'tervez', 'atir'],
    boostStems: ['hetfo', 'kedd', 'szerda', 'csutortok', 'pentek', 'szombat', 'vasarnap', 'holnap'],
  },
  {
    key: 'fill_missing_shift',
    action: 'find_replacement',
    confidence: 0.85,
    reply: 'Keresek megfelelo helyettesitot a muszakra.',
    stems: ['helyettes', 'atven', 'potl'],
    boostStems: ['muszak', 'ki'],
  },
  {
    key: 'full_replan',
    action: 'replan_all',
    confidence: 0.82,
    reply: 'Rendben, keszitek egy uj teljes havi tervet.',
    stems: ['ujratervez', 'uj', 'beoszt'],
    boostStems: ['teljes', 'havi'],
  },
  // Pharmacy manager intents
  {
    key: 'list_employees',
    action: 'list_employees',
    confidence: 0.9,
    reply: 'Rendben, listazom a dolgozoidat.',
    stems: ['dolgoz', 'listaz', 'mutasd', 'kiir'],
    boostStems: ['alkalmazott', 'team', 'csapat', 'staff'],
  },
  {
    key: 'show_vacation_requests',
    action: 'show_vacation_requests',
    confidence: 0.88,
    reply: 'Melyik honapra szeretned latni az igenyelt szabadsagokat?',
    stems: ['szabad', 'szabadsag', 'szabi', 'igeny'],
    boostStems: ['ki', 'megy', 'mikor', 'honap'],
  },
  {
    key: 'missing_drafts',
    action: 'missing_drafts',
    confidence: 0.87,
    reply: 'Melyik honapra ellenorizzem, ki nem irta meg meg a tervezetet?',
    stems: ['tervezet', 'draft', 'beosztas', 'nincs'],
    boostStems: ['ki', 'nem', 'meg', 'irta', 'honap'],
  },
  {
    key: 'add_employee',
    action: 'add_employee',
    confidence: 0.85,
    reply: 'Rendben, felvehetel egy uj dolgozot. Adj meg egy email cimet.',
    stems: ['felvenni', 'hozzaad', 'uj', 'dolgoz'],
    boostStems: ['alkalmazott', 'munkatars', 'email'],
  },
  {
    key: 'remove_employee',
    action: 'remove_employee',
    confidence: 0.85,
    reply: 'Ki szeretned eltavolitani a dolgozok listajatol?',
    stems: ['tavolitani', 'eltavolitani', 'kiir', 'letilt'],
    boostStems: ['dolgoz', 'alkalmazott', 'ki', 'nem'],
  },
];

function semanticIntentCandidates(text) {
  const tokens = tokenizeAndStem(text);
  if (tokens.length === 0) return [];

  const stemsInText = new Set(tokens.map((t) => t.stem));
  const tokenSet = new Set(tokens.map((t) => t.token));
  const candidates = [];

  const hasStemMatch = (stemCandidate) => {
    const target = stemHungarianToken(stemCandidate);
    if (stemsInText.has(target) || tokenSet.has(normalizeText(stemCandidate))) return true;

    for (const s of stemsInText) {
      if (s.startsWith(target) || target.startsWith(s)) return true;
    }
    return false;
  };

  for (const intent of SEMANTIC_INTENTS) {
    const baseHits = intent.stems.reduce((acc, stem) => {
      return acc + (hasStemMatch(stem) ? 1 : 0);
    }, 0);

    if (baseHits === 0) continue;

    const boostHits = (intent.boostStems || []).reduce((acc, stem) => {
      return acc + (hasStemMatch(stem) ? 1 : 0);
    }, 0);

    const normalizedHit = baseHits / intent.stems.length;
    const score = normalizedHit + (boostHits * 0.15);
    candidates.push({ intent, score, baseHits, boostHits, tokens });
  }

  return candidates
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const oneWordDomain = item.tokens.length === 1 && ['beoszt', 'muszak', 'szabad', 'szabadnap', 'tulora'].includes(item.tokens[0].stem);
      const confidence = Math.min(0.93, item.intent.confidence + (item.score - 0.45) * 0.25 + (oneWordDomain ? 0.03 : 0));
      return {
        intent: item.intent.key,
        action: item.intent.action,
        reply: item.intent.reply,
        confidence,
        matchType: 'semantic',
        score: Number(item.score.toFixed(3)),
        baseHits: item.baseHits,
        boostHits: item.boostHits,
      };
    });
}

function semanticIntentFallback(text) {
  const candidates = semanticIntentCandidates(text);
  if (candidates.length === 0) return null;
  const best = candidates[0];

  return {
    intent: best.intent,
    confidence: best.confidence,
    action: best.action,
    reply: best.reply,
    topCandidates: candidates.slice(0, 3),
    reasoning: {
      source: 'semantic',
      score: best.score,
      baseHits: best.baseHits,
      boostHits: best.boostHits,
    },
  };
}

function buildReasoning(source, chosen, extra = {}) {
  return {
    source,
    chosenIntent: chosen?.intent || chosen?.key || 'unknown',
    chosenAction: chosen?.action || 'clarify',
    chosenConfidence: Number(chosen?.confidence || 0),
    ...extra,
  };
}

/**
 * Parse user message to detect intent
 * Checks learned patterns first, then hardcoded intents
 * 
 * @param {string} message - User message
 * @param {Array} learnedPatterns - Patterns learned via training (optional)
 * @returns {Object} {intent, confidence, action, reply, entities}
 */
export function parseBettiIntent(message, learnedPatterns = []) {
  const raw = String(message || '').trim();
  const text = normalizeText(raw);
  const textWords = text.split(/\s+/).filter(Boolean);
  const day = extractWeekday(text);
  const person = extractPersonName(raw);

  // CHECK LEARNED PATTERNS FIRST
  if (Array.isArray(learnedPatterns) && learnedPatterns.length > 0) {
    for (const pattern of learnedPatterns) {
      if (!pattern.pattern) continue;
      
      // Simple word matching against learned patterns
      const patternWords = pattern.pattern.split('|').filter(Boolean);
      if (patternWords.length === 0) continue;

      const matches = patternWords.filter((word) => text.includes(word));
      const normalizedOriginalQuestion = normalizeText(pattern.originalQuestion || '');
      const exactOriginalMatch = normalizedOriginalQuestion && normalizedOriginalQuestion === text;

      // Prevent one-word training from hijacking longer sentences.
      if (patternWords.length === 1) {
        const single = patternWords[0];
        const isExactSingle = text === single;
        const isCloseSingle = textWords.length <= 2 && text.startsWith(single);
        if (!(exactOriginalMatch || isExactSingle || isCloseSingle)) {
          continue;
        }
      } else {
        const minMatchWords = Number(pattern.minMatchWords || Math.min(2, patternWords.length));
        if (matches.length < minMatchWords && !exactOriginalMatch) {
          continue;
        }
      }
      
      if (matches.length > 0 || exactOriginalMatch) {
        // Dynamic time injection for time-aware patterns
        let response = pattern.response || '';
        if (pattern.isTimeAware) {
          const currentTime = getBudapestTimeHungarianText();
          
          // Replace time patterns in the response
          response = response
            .replace(/\[ido\]/gi, currentTime)
            .replace(/\[current_time\]/gi, currentTime)
            .replace(/\[time\]/gi, currentTime);
          
          // If response contains "most" or "jelenleg", inject dynamic time
          if (/most|jelenleg|mennyi.*ido|milyen.*ido/.test(response)) {
            // Replace "11:29" or "11:29 van" style text with Hungarian spoken time
            response = response.replace(/\d{1,2}:\d{2}(\s*perc\s*van|\s*van)?/gi, currentTime);
          }
        }
        
        return {
          intent: pattern.intent || 'learned',
          confidence: 0.95, // High confidence for learned patterns
          action: pattern.action || 'clarify',
          entities: { weekday: day, person },
          reply: response,
          isLearned: true,
          learnedPatternId: pattern.id || null,
          learnedPatternFingerprint: pattern.fingerprint || null,
          topCandidates: [{
            intent: pattern.intent || 'learned',
            action: pattern.action || 'clarify',
            confidence: 0.95,
            matchType: 'learned',
            score: 1,
          }],
          reasoning: buildReasoning('learned_pattern', pattern, {
            matchedWords: matches,
            exactOriginalMatch,
          }),
        };
      }
    }
  }

  // Prioritize pharmacy-manager style "who has not submitted" queries
  // before generic schedule matching that would otherwise catch "beosztas".
  if (/(ki\s+nem\s+ir(t|ta|ta\s+meg).*beoszt|ki\s+nem\s+irta\s+meg.*(tervezet|draft)|hianyzik.*(tervezet|draft|beoszt)|nem\s+kuldte\s+be.*(tervezet|draft|beoszt))/i.test(text)) {
    return {
      intent: 'missing_drafts',
      confidence: 0.95,
      action: 'missing_drafts',
      entities: { weekday: day, person },
      reply: 'Rendben, ellenorizem ki nem irta meg a tervezetet.',
      topCandidates: [{ intent: 'missing_drafts', action: 'missing_drafts', confidence: 0.95, matchType: 'priority_rule', score: 1 }],
      reasoning: buildReasoning('priority_rule', { intent: 'missing_drafts', action: 'missing_drafts', confidence: 0.95 }, {
        rule: 'missing_drafts_priority',
      }),
    };
  }

  if (isHesitationText(text)) {
    return {
      intent: 'hesitation',
      confidence: 0.88,
      action: 'follow_up_hesitate',
      entities: { weekday: day, person },
      reply: 'Rendben, nem siettetlek. Maradhatunk itt, vagy terelhetjuk masik iranyba is.',
      topCandidates: [{ intent: 'hesitation', action: 'follow_up_hesitate', confidence: 0.88, matchType: 'hesitation_dictionary', score: 1 }],
      reasoning: buildReasoning('hesitation_dictionary', { intent: 'hesitation', action: 'follow_up_hesitate', confidence: 0.88 }),
    };
  }

  if (isNegativeText(text)) {
    return {
      intent: 'negative',
      confidence: 0.92,
      action: 'follow_up_decline',
      entities: { weekday: day, person },
      reply: 'Rendben, akkor ezt most elengedem.',
      topCandidates: [{ intent: 'negative', action: 'follow_up_decline', confidence: 0.92, matchType: 'negative_dictionary', score: 1 }],
      reasoning: buildReasoning('negative_dictionary', { intent: 'negative', action: 'follow_up_decline', confidence: 0.92 }),
    };
  }

  const intents = [
    {
      key: 'greeting',
      confidence: 0.98,
      pattern: /^(szia|sziasztok|hello|hali|jo napot|jo reggelt|jo estet)\b/,
      action: 'greeting',
      reply: 'Szia! Betti vagyok, a Pharmagister AI asszisztense. Segitek beosztassal, szabadsaggal, tuloraval es ujratervezessel kapcsolatban.',
    },
    {
      key: 'identity',
      pattern: /(ki vagy|ki vagy te|micsoda vagy|ki keszitett|ki fejlesztett|ki csinalt|ki hozott letre|ki az alkoto|ki a fejleszto)/,
      action: 'identity',
      reply: 'Betti vagyok, a Pharmagister AI asszisztense. Epres Laszlo fejlesztett.',
    },
    {
      key: 'capabilities',
      confidence: 0.96,
      pattern: /(mit tudsz|mire vagy kepes|mihez ertesz|miben tudsz segiteni|miben segitesz|mit csinalsz|hogyan tudsz segiteni)/,
      action: 'show_capabilities',
      reply: 'Segitek beosztas, szabadsag, szabadnapok, tulora, helyettesites es ujratervezes temakban.',
    },
    {
      key: 'help',
      confidence: 0.94,
      pattern: /^(segits|segitseg|help|kerlek segits|pls segits|tudnal segiteni)\b/,
      action: 'show_capabilities',
      reply: 'Persze, segitek! Mondd el roviden, miben kell segitseg: beosztas, szabi, tulora, helyettesites vagy ujratervezes.',
    },
    {
      key: 'thanks',
      confidence: 0.95,
      pattern: /(\bkoszi+\b|\bkoszonom\b|\bkossz\b|\bszuper\b|\bthx\b)/,
      action: 'ack',
      reply: 'Nagyon szivesen! Ha szeretned, maris mutatom a kovetkezo muszakjaidat vagy szabadnapjaidat.',
    },
    {
      key: 'affirmative',
      confidence: 0.9,
      pattern: /^(igen|persze|ja|aha|oke|ok\b|rendben|nana|termeszetesen|ugy\s+van|bizony|abszolut|siman|biztosan|valoban|pontosan|franko|kiraly|mehet|johet|adom|benne\s+vagyok|stimmel|helyes|ertem|ja-ja|yup|yep|yes|szeretnem|akarom|legyen)\b/,
      action: 'follow_up_confirm',
      reply: 'Szuper, menjunk tovabb.',
    },
    {
      key: 'negative',
      confidence: 0.92,
      pattern: /^(nem$|nem\b|dehogy\b|egyaltalan\s+nem\b|kizart\b|semmikepp\b|semmi\s+esetre\s+sem\b|nee\b|ne\b|a\b|ah\b|ugyan\s+mar\b|nemigen\b|aligha\b|biztos\s+nem\b|nana\s+hogy\s+nem\b|szo\s+sincs\s+rola\b|felejtsd\s+el\b|eselytelen\b|nincs\s+ra\s+mod\b|tiltva\b|negativ\b|nope\b|no\b|nem-ja\b|dehogyis\b|francokat\b|kizarva\b)/,
      action: 'follow_up_decline',
      reply: 'Rendben, akkor ezt most elengedem.',
    },
    {
      key: 'hesitation',
      confidence: 0.88,
      pattern: /^(talan|hat\s+talan|esetleg|meg\s+meglatom|majd\s+meglatom|kesobb|majd\s+kesobb|most\s+nem\s+tudom|nem\s+tudom|passz|ki\s+tudja|meglatjuk|nem\s+biztos|nem\s+vagyok\s+biztos\s+benne|talan\s+kesobb|egyelore\s+nem\s+tudom|majd\b|raerek\s+kesobb|kesobb\s+megnezzuk)\b/,
      action: 'follow_up_hesitate',
      reply: 'Rendben, nem siettetlek. Maradhatunk itt, vagy terelhetjuk masik iranyba is.',
    },
    {
      key: 'my_schedule',
      confidence: 0.96,
      pattern: /(mi a beosztasom|mutasd a beosztasom|beosztasom|beosztasokat|beosztast|muszakjaim|muszakom|mikor dolgozom|mikor dolgozok|mikor vagyok muszakban|be vagyok osztva|sajat muszakjaim|sajat beosztas)/,
      action: 'show_my_schedule',
      reply: 'Megnezem a sajat beosztasodat es osszefoglalom a kovetkezo muszakokat.',
    },
    {
      key: 'my_vacation',
      confidence: 0.96,
      pattern: /(mikor vagyok szabin|mikor leszek szabadsagon|szabadsagom|szabi napjaim|szabin leszek)/,
      action: 'show_my_vacations',
      reply: 'Megnezem a szabadsag napjaidat.',
    },
    {
      key: 'my_free_days',
      confidence: 0.94,
      pattern: /(mikor vagyok szabadnapos|szabadnapjaim|mikor vagyok szabad|szabadnapot keresek)/,
      action: 'show_my_free_days',
      reply: 'Megnezem a kovetkezo szabadnapjaidat.',
    },
    {
      key: 'list_employees',
      confidence: 0.95,
      pattern: /((listazd?|sorold|mutasd).*(dolgozoim|dolgozok|alkalmazottaim|alkalmazottak|munkatarsak|csapatom)|(dolgozoim|dolgozok|alkalmazottaim|alkalmazottak).*(listazd?|sorold|mutasd))/, 
      action: 'list_employees',
      reply: 'Rendben, listazom az alkalmazottaidat.',
    },
    {
      key: 'show_vacation_requests',
      confidence: 0.93,
      pattern: /(ki megy szabira|kik mennek szabira|szabadsag igenyek|szabadsagigenyek|kik vannak szabin|szabi igenyek)/,
      action: 'show_vacation_requests',
      reply: 'Rendben, megmutatom a szabadsag igenyeket.',
    },
    {
      key: 'missing_drafts',
      confidence: 0.93,
      pattern: /(ki nem irta meg.*(tervezet|draft)|hianyzik.*(tervezet|draft)|nincs.*(tervezet|draft)|ki nem kuldte be.*(tervezet|draft))/, 
      action: 'missing_drafts',
      reply: 'Rendben, ellenorizzem ki nem irta meg a tervezetet.',
    },
    {
      key: 'write_schedule_plan',
      confidence: 0.93,
      pattern: /(beosztast szeretnek irni|beosztast akarok irni|beosztastervet irnek|tervezetet szeretnek)/,
      action: 'write_schedule_plan',
      reply: 'Rendben, segitek beosztas-tervezetet irni.',
    },
    {
      key: 'report_overtime',
      confidence: 0.95,
      pattern: /(tulora|tuloras|mutasd.*tulora|van.*tulora|ki van tuloraban|tuloraban van|muti.*tulora)/,
      action: 'show_overtime',
      reply: 'Rendben, megmutatom kik vannak tulora kozeleben vagy tuloraban.',
    },
    {
      key: 'generic_show',
      confidence: 0.78,
      pattern: /^(mutasd|muti|mutass|mutas(d)?|mutasdmar|mutasd\s+mar|mutad|mutas|megmutatod|megmutatnad|megmutatna(d)?|megneznem|megneznen|nezzuk|nezd|nezz|nezuk|mutatnad|mutatna|kerlek\s+mutasd|pls\s+mutasd|show|show\s+me|nezzuk\s+meg|kene|kene\s+latni|kellene|jo\s+lenne|adnad|add\s+ide|dobd\s+fel|valamit\s+mutass|valamit\s+keresek)\b/,
      action: 'clarify_with_options',
      reply: 'Mit mutassak pontosan? Valaszthatsz a gyors opciok kozul.',
    },
    {
      key: 'explain_assignment',
      confidence: 0.9,
      pattern: /(miert|miert.*kapta|mi alapjan kapta)/,
      action: 'explain_assignment',
      reply: 'Megnezem a dontesi okokat es emberi nyelven elmagyarazom.',
    },
    {
      key: 'replan_day',
      confidence: 0.92,
      pattern: /(tervezd ujra.*csak|csak.*tervezd ujra|holnapi.*ujra|holnap.*ujra|tervezd ujra a hetfot|tervezd ujra a keddet|tervezd ujra a szerdat|tervezd ujra a csutortokot|tervezd ujra a penteket|tervezd ujra a szombatot|tervezd ujra a vasarnapot|csak a hetfot|csak a keddet|csak a szerdat|csak a csutortokot|csak a penteket|csak a szombatot|csak a vasarnapot)/,
      action: 'replan_specific_day',
      reply: 'Rendben, csak az erintett nap(oka)t tervezem ujra.',
    },
    {
      key: 'replan_absence',
      confidence: 0.9,
      pattern: /(szabadsagon|beteg|kiesik|nem jon)/,
      action: 'replan_for_absence',
      reply: 'Ertettem, az erintett dolgozo kiesesevel ujratervezek.',
    },
    {
      key: 'fill_missing_shift',
      confidence: 0.87,
      pattern: /(ki tudna atvenni|atvenni.*muszak|hiany potlasa|helyettesits|helyettesites)/,
      action: 'find_replacement',
      reply: 'Keresek megfelelo helyettesitot a muszakra.',
    },
    {
      key: 'make_fairer',
      confidence: 0.9,
      pattern: /(igazsagosabb|egyenletesebb|fair)/,
      action: 'optimize_fairness',
      reply: 'Rendben, egy igazsagosabb elosztasu variansra optimalizalok.',
    },
    {
      key: 'reduce_overtime',
      confidence: 0.9,
      pattern: /(kevesebb tulora|csokkentsd a tulorat|tulora csokkentes)/,
      action: 'optimize_overtime',
      reply: 'Rendben, a tulora minimalizalasa lesz az elso cel.',
    },
    {
      key: 'lock_shift',
      confidence: 0.86,
      pattern: /(fix beosztas|lock|ne valtoztasd|rogzitett muszak)/,
      action: 'lock_shift',
      reply: 'Rendben, ezt a muszakot rogzitettnek tekinjuk.',
    },
    {
      key: 'minimal_change',
      confidence: 0.84,
      pattern: /(legkisebb valtoztatas|minimalis valtoztatas|minel kevesebbet valtoztass)/,
      action: 'minimal_change_replan',
      reply: 'Rendben, a lehetoseg szerint a legkisebb modositasra torekszem.',
    },
    {
      key: 'full_replan',
      confidence: 0.8,
      pattern: /(ujratervezes|tervezd ujra|uj terv|generalj uj beosztast|keszits uj beosztast)/,
      action: 'replan_all',
      reply: 'Rendben, keszitek egy uj teljes havi tervet.',
    },
  ];

  const regexMatches = intents
    .filter((intent) => intent.pattern.test(text))
    .map((intent) => ({
      intent: intent.key,
      action: intent.action,
      confidence: intent.confidence,
      reply: intent.reply,
      matchType: 'regex',
      score: intent.confidence,
    }));

  const hit = regexMatches[0];
  if (!hit) {
    const semanticHit = semanticIntentFallback(text);
    if (semanticHit) {
      return {
        intent: semanticHit.intent,
        confidence: semanticHit.confidence,
        action: semanticHit.action,
        entities: { weekday: day, person },
        reply: semanticHit.reply,
        topCandidates: semanticHit.topCandidates,
        reasoning: semanticHit.reasoning,
      };
    }

    return {
      intent: 'unknown',
      confidence: 0.35,
      action: 'clarify',
      entities: { weekday: day, person },
      reply: 'Ezt nem ertettem teljesen. Probald igy: "Mi a beosztasom?", "Mikor vagyok szabin?", "Mutasd a tulorasokat", vagy "Tervezd ujra csak a hetfot".',
      topCandidates: [],
      reasoning: buildReasoning('unknown', { intent: 'unknown', action: 'clarify', confidence: 0.35 }),
    };
  }

  return {
    intent: hit.intent,
    confidence: hit.confidence,
    action: hit.action,
    entities: { weekday: day, person },
    reply: hit.reply,
    topCandidates: regexMatches.slice(0, 3),
    reasoning: buildReasoning('regex', hit, {
      candidateCount: regexMatches.length,
    }),
  };
}
