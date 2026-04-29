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

  const blocked = new Set(['mutasd', 'miert', 'tervezd', 'csinalj', 'ki', 'betti']);
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
  const day = extractWeekday(text);
  const person = extractPersonName(raw);

  // CHECK LEARNED PATTERNS FIRST
  if (Array.isArray(learnedPatterns) && learnedPatterns.length > 0) {
    for (const pattern of learnedPatterns) {
      if (!pattern.pattern) continue;
      
      // Simple word matching against learned patterns
      const patternWords = pattern.pattern.split('|').filter(w => w);
      const matches = patternWords.filter(word => text.includes(word));
      
      if (matches.length > 0) {
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
        };
      }
    }
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
      confidence: 0.99,
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
      pattern: /(koszi+|koszonom|kossz|szuper|rendben|ok(\b|e)|thx)/,
      action: 'ack',
      reply: 'Nagyon szivesen! Ha szeretned, maris mutatom a kovetkezo muszakjaidat vagy szabadnapjaidat.',
    },
    {
      key: 'my_schedule',
      confidence: 0.96,
      pattern: /(mi a beosztasom|mutasd a beosztasom|beosztasom|muszakjaim|muszakom|mikor dolgozom|mikor dolgozok|mikor vagyok muszakban|be vagyok osztva|sajat muszakjaim)/,
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
      pattern: /(tervezd ujra.*csak|csak.*tervezd ujra|holnapi.*ujra|holnap.*ujra|csak a hetfot|csak a keddet|csak a szerdat|csak a csutortokot|csak a penteket|csak a szombatot|csak a vasarnapot)/,
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

  const hit = intents.find((intent) => intent.pattern.test(text));
  if (!hit) {
    return {
      intent: 'unknown',
      confidence: 0.35,
      action: 'clarify',
      entities: { weekday: day, person },
      reply: 'Ezt nem ertettem teljesen. Probald igy: "Mi a beosztasom?", "Mikor vagyok szabin?", "Mutasd a tulorasokat", vagy "Tervezd ujra csak a hetfot".',
    };
  }

  return {
    intent: hit.key,
    confidence: hit.confidence,
    action: hit.action,
    entities: { weekday: day, person },
    reply: hit.reply,
  };
}
