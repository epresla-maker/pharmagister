import dictHu from 'dictionary-hu';

const DOMAIN_TERMS = [
  'beosztas',
  'szabadsag',
  'szabadnap',
  'tulora',
  'helyettesites',
  'ujratervezes',
  'muszak',
];

const DOMAIN_SET = new Set(DOMAIN_TERMS);

let dictionarySetPromise = null;

function normalizeWord(word) {
  return String(word || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function levenshtein(a, b, maxDistance = 3) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
  }

  return dp[a.length][b.length];
}

async function getHungarianDictionarySet() {
  if (!dictionarySetPromise) {
    dictionarySetPromise = Promise.resolve().then(() => {
      const set = new Set();
      const dicBuffer = dictHu?.dic;
      if (!dicBuffer) return set;

      const lines = dicBuffer.toString('utf8').split('\n');
      // Hunspell .dic first line is word count.
      for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line) continue;
        const stem = line.split(/[\s/]/)[0];
        const normalized = normalizeWord(stem);
        if (normalized.length > 1) set.add(normalized);
      }

      return set;
    });
  }
  return dictionarySetPromise;
}

function correctDomainWord(tokenNormalized) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of DOMAIN_TERMS) {
    const dist = levenshtein(tokenNormalized, candidate, 2);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = candidate;
    }
  }

  if (!best) return null;
  if (bestDistance > 1) return null;
  return best;
}

export async function normalizeHungarianChatInput(input) {
  const text = String(input || '');
  if (!text.trim()) return text;

  const dictionarySet = await getHungarianDictionarySet();
  const parts = text.split(/(\s+)/);

  const corrected = parts.map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    if (!/^[\p{L}0-9_-]+$/u.test(part)) return part;

    const normalized = normalizeWord(part);
    if (!normalized || normalized.length <= 2) return part;

    if (dictionarySet.has(normalized)) return part;
    if (DOMAIN_SET.has(normalized)) return part;

    const correctedDomain = correctDomainWord(normalized);
    return correctedDomain || part;
  });

  return corrected.join('');
}
