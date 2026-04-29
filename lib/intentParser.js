const WEEKDAY_MAP = {
  vasarnap: 0,
  hetfo: 1,
  kedd: 2,
  szerda: 3,
  csutortok: 4,
  pentek: 5,
  szombat: 6,
};

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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

export function parseBettiIntent(message) {
  const raw = String(message || '').trim();
  const text = normalizeText(raw);
  const day = extractWeekday(text);
  const person = extractPersonName(raw);

  const intents = [
    {
      key: 'report_overtime',
      confidence: 0.95,
      pattern: /(tulora|tuloras|mutasd.*tulora)/,
      action: 'show_overtime',
      reply: 'Rendben, megmutatom kik vannak tulora kozeleben vagy tuloraban.',
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
      pattern: /(tervezd ujra.*csak|csak.*tervezd ujra|holnapi|holnap)/,
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
      pattern: /(ki tudna atvenni|atvenni.*muszak|hiany potlasa)/,
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
      pattern: /(ujratervezes|tervezd ujra|uj terv)/,
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
      reply: 'Ezt nem ertettem teljesen. Kerlek irj olyat, mint: Mutasd a tulorasokat, vagy Tervezd ujra csak a hetfot.',
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
