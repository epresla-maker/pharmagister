// Betti training system: save/load learned patterns from Firestore
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

const MAX_LOADED_PATTERNS = 120;
const MAX_STORED_PATTERNS = 250;
const MAX_WEIGHT_SUGGESTIONS = 30;

const DEFAULT_LONG_TERM_MEMORY = {
  userPreferences: {
    tone: 'balanced',
    detailLevel: 'medium',
    frequentIntent: null,
    decisionWeights: null,
  },
  stableFacts: [],
  learnedPatterns: [],
  stats: {
    totalMessages: 0,
    unknownCount: 0,
    trainingCount: 0,
    correctedByQuickActionCount: 0,
    explicitCorrectionCount: 0,
    quickActionRejectCount: 0,
    followUpCorrectionCount: 0,
    sentimentShiftCorrectionCount: 0,
    successfulTaskCount: 0,
    followUpCount: 0,
    reducedFollowUpCount: 0,
    correctionCount: 0,
    satisfactionPositiveCount: 0,
    satisfactionTotalCount: 0,
    recentIntentConfidences: [],
    feedbackQualityAvg: 0,
    autoWeightApplyCount: 0,
    lastAutoWeightApplyAt: null,
    lastSeenIntent: null,
    lastSeenAt: null,
  },
  autoTuning: {
    mode: 'LEARNING_ONLY',
    freezeReason: null,
    lastModeChangeAt: null,
    lastDriftScore: 0,
    lastPerformanceScore: 0,
    lastConfidenceVariance: 0,
    lastRollbackAt: null,
  },
  goldenSnapshots: [],
  performance: {
    baselineScore: 0,
    recentScores: [],
  },
  weightSuggestions: [],
};

function normalizeTrainingText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function createTrainingFingerprint(pattern) {
  const source = [
    normalizeTrainingText(pattern?.intent),
    normalizeTrainingText(pattern?.pattern),
    normalizeTrainingText(pattern?.response),
  ].join('||');

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return `tp_${Math.abs(hash).toString(36)}`;
}

function getTrainingCollection(db, uid) {
  return db.collection('users').doc(uid).collection('bettiTraining');
}

function getLongTermMemoryDoc(db, uid) {
  return db.collection('users').doc(uid).collection('bettiMemory').doc('profile');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeLongTermMemory(stored = {}) {
  return {
    ...DEFAULT_LONG_TERM_MEMORY,
    ...stored,
    userPreferences: {
      ...DEFAULT_LONG_TERM_MEMORY.userPreferences,
      ...(stored.userPreferences || {}),
    },
    stableFacts: toArray(stored.stableFacts),
    learnedPatterns: toArray(stored.learnedPatterns),
    stats: {
      ...DEFAULT_LONG_TERM_MEMORY.stats,
      ...(stored.stats || {}),
      recentIntentConfidences: toArray(stored?.stats?.recentIntentConfidences).slice(-50),
    },
    autoTuning: {
      ...DEFAULT_LONG_TERM_MEMORY.autoTuning,
      ...(stored.autoTuning || {}),
    },
    goldenSnapshots: toArray(stored.goldenSnapshots).slice(-20),
    performance: {
      ...DEFAULT_LONG_TERM_MEMORY.performance,
      ...(stored.performance || {}),
      recentScores: toArray(stored?.performance?.recentScores).slice(-60),
    },
    weightSuggestions: toArray(stored.weightSuggestions).slice(-MAX_WEIGHT_SUGGESTIONS),
  };
}

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function pruneTrainingPatterns(collectionRef, db, admin) {
  const snapshot = await collectionRef.orderBy('savedAt', 'desc').get();
  if (snapshot.size <= MAX_STORED_PATTERNS) return;

  const docs = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const useDiff = Number(b.useCount || 0) - Number(a.useCount || 0);
      if (useDiff !== 0) return useDiff;

      const lastUsedDiff = getTimestampMillis(b.lastUsedAt) - getTimestampMillis(a.lastUsedAt);
      if (lastUsedDiff !== 0) return lastUsedDiff;

      return getTimestampMillis(b.savedAt) - getTimestampMillis(a.savedAt);
    });

  const toDelete = docs.slice(MAX_STORED_PATTERNS);
  if (toDelete.length === 0) return;

  const batch = db.batch();
  toDelete.forEach((item) => {
    batch.delete(collectionRef.doc(item.id));
  });
  await batch.commit();
}

/**
 * Detect if message is a training input (starts with "xx ")
 * Returns: { isTraining: boolean, originalMessage: string }
 */
export function detectTrainingInput(message) {
  const text = String(message || '').trim();
  const isTraining = /^xx([\s:;,.\-]|$)/i.test(text);
  
  if (isTraining) {
    const trainingResponse = text.replace(/^xx([\s:;,.\-])*/i, '').trim();
    return {
      isTraining: true,
      trainingResponse,
    };
  }
  
  return {
    isTraining: false,
    trainingResponse: null,
  };
}

/**
 * Save a learned pattern to Firestore
 * Structure: users/{uid}/bettiTraining/{id}
 */
export async function saveTrainingPattern(uid, pattern) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionRef = getTrainingCollection(db, uid);
    const fingerprint = createTrainingFingerprint(pattern);
    const trainingRef = collectionRef.doc(fingerprint);
    const existingDoc = await trainingRef.get();

    const basePayload = {
      ...pattern,
      fingerprint,
      normalizedPattern: normalizeTrainingText(pattern?.pattern),
      normalizedResponse: normalizeTrainingText(pattern?.response),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (existingDoc.exists) {
      const existingData = existingDoc.data() || {};
      await trainingRef.set({
        ...basePayload,
        savedAt: existingData.savedAt || admin.firestore.FieldValue.serverTimestamp(),
        useCount: Number(existingData.useCount || 0),
        lastUsedAt: existingData.lastUsedAt || null,
        reinforcedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      await trainingRef.set({
        ...basePayload,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
        useCount: 0,
        lastUsedAt: null,
      });
    }

    await pruneTrainingPatterns(collectionRef, db, admin);
    
    return {
      success: true,
      id: trainingRef.id,
      fingerprint,
      deduplicated: existingDoc.exists,
    };
  } catch (error) {
    console.error('[bettiTraining] Save failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Load all learned patterns for a user
 * Returns array of pattern objects
 */
export async function loadTrainingPatterns(uid) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionRef = getTrainingCollection(db, uid);

    const snapshot = await collectionRef
      .orderBy('savedAt', 'desc')
      .limit(MAX_STORED_PATTERNS)
      .get();

    const dedupedPatterns = new Map();
    snapshot.forEach((doc) => {
      const data = {
        id: doc.id,
        ...doc.data(),
      };

      const key = data.fingerprint || createTrainingFingerprint(data);
      const previous = dedupedPatterns.get(key);
      if (!previous) {
        dedupedPatterns.set(key, data);
        return;
      }

      const previousScore = Number(previous.useCount || 0) * 1000000 + getTimestampMillis(previous.lastUsedAt) + getTimestampMillis(previous.savedAt);
      const nextScore = Number(data.useCount || 0) * 1000000 + getTimestampMillis(data.lastUsedAt) + getTimestampMillis(data.savedAt);
      if (nextScore > previousScore) {
        dedupedPatterns.set(key, data);
      }
    });

    return [...dedupedPatterns.values()]
      .sort((a, b) => {
        const useDiff = Number(b.useCount || 0) - Number(a.useCount || 0);
        if (useDiff !== 0) return useDiff;

        const lastUsedDiff = getTimestampMillis(b.lastUsedAt) - getTimestampMillis(a.lastUsedAt);
        if (lastUsedDiff !== 0) return lastUsedDiff;

        return getTimestampMillis(b.savedAt) - getTimestampMillis(a.savedAt);
      })
      .slice(0, MAX_LOADED_PATTERNS);
  } catch (error) {
    console.error('[bettiTraining] Load failed:', error);
    return [];
  }
}

export async function recordTrainingPatternUsage(uid, patternRef) {
  try {
    if (!uid || !patternRef) return { success: false, skipped: true };

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionRef = getTrainingCollection(db, uid);

    const ref = typeof patternRef === 'string'
      ? collectionRef.doc(patternRef)
      : collectionRef.doc(patternRef.id || patternRef.fingerprint || '');

    if (!ref.id) return { success: false, skipped: true };

    await ref.set({
      useCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('[bettiTraining] Usage update failed:', error);
    return { success: false, error: error.message };
  }
}

export async function loadBettiLongTermMemory(uid) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = getLongTermMemoryDoc(db, uid);
    const snap = await ref.get();
    if (!snap.exists) return mergeLongTermMemory();
    return mergeLongTermMemory(snap.data() || {});
  } catch (error) {
    console.error('[bettiMemory] Load failed:', error);
    return mergeLongTermMemory();
  }
}

export async function saveBettiLongTermMemory(uid, patch = {}) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = getLongTermMemoryDoc(db, uid);
    const existing = await loadBettiLongTermMemory(uid);

    const merged = mergeLongTermMemory({
      ...existing,
      ...patch,
      userPreferences: {
        ...(existing.userPreferences || {}),
        ...(patch.userPreferences || {}),
      },
      stats: {
        ...(existing.stats || {}),
        ...(patch.stats || {}),
      },
      stableFacts: toArray(patch.stableFacts || existing.stableFacts),
      learnedPatterns: toArray(patch.learnedPatterns || existing.learnedPatterns),
      weightSuggestions: toArray(patch.weightSuggestions || existing.weightSuggestions).slice(-MAX_WEIGHT_SUGGESTIONS),
    });

    await ref.set({
      ...merged,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, memory: merged };
  } catch (error) {
    console.error('[bettiMemory] Save failed:', error);
    return { success: false, error: error.message };
  }
}

export async function appendBettiWeightSuggestion(uid, suggestion) {
  try {
    if (!uid || !suggestion) return { success: false, skipped: true };

    const existing = await loadBettiLongTermMemory(uid);
    const nextSuggestions = [
      ...toArray(existing.weightSuggestions),
      {
        id: `ws_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...suggestion,
      },
    ].slice(-MAX_WEIGHT_SUGGESTIONS);

    const saveRes = await saveBettiLongTermMemory(uid, {
      weightSuggestions: nextSuggestions,
    });

    return { success: saveRes.success, count: nextSuggestions.length };
  } catch (error) {
    console.error('[bettiMemory] Append suggestion failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current time in Hungarian format
 * Returns: "11:30 perc van" or similar
 */
export function getCurrentTimeHungarian() {
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
 * Build a learned pattern object from training input
 * - intent: the intent of the previous message that failed
 * - originalQuestion: what the user asked
 * - response: what Betti should have answered
 */
export function buildTrainingPattern(intent, originalQuestion, response) {
  // If response mentions "jelenleg" or "most", mark it as time-aware
  const isTimeAware = /jelenleg|most|perc|ora|ido|mennyi.*ido/.test(response.toLowerCase());
  const pattern = generatePatternFromQuestion(originalQuestion);
  const patternWords = pattern ? pattern.split('|').filter(Boolean) : [];
  
  return {
    intent,
    originalQuestion: String(originalQuestion || '').trim(),
    response: String(response || '').trim(),
    isTimeAware,
    minMatchWords: patternWords.length <= 1 ? 1 : 2,
    strictSingleWord: patternWords.length <= 1,
    // Pattern can be a simple keyword-based trigger
    pattern,
  };
}

/**
 * Simple pattern generator from original question
 * Extract key words to match future queries
 */
function generatePatternFromQuestion(question) {
  const words = String(question || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[.,!?;:()]/g, '')      // Remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 2); // Skip short words (a, az, és, etc)
  
  return words.join('|');
}

/**
 * Check if a new message matches any learned pattern
 * Returns: { matched: boolean, matchedPattern: object | null }
 */
export function checkLearnedPatterns(message, patterns) {
  const text = String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return {
      matched: false,
      matchedPattern: null,
    };
  }
  
  // Find first pattern that matches
  for (const pattern of patterns) {
    if (!pattern.pattern) continue;
    
    // Simple word matching: if any keywords from pattern appear in message
    const patternWords = pattern.pattern.split('|');
    const hasMatch = patternWords.some((word) => text.includes(word));
    
    if (hasMatch) {
      return {
        matched: true,
        matchedPattern: pattern,
      };
    }
  }
  
  return {
    matched: false,
    matchedPattern: null,
  };
}

/**
 * Inject dynamic context into response
 * - If response has "isTimeAware" flag, inject current time
 */
export function injectDynamicContext(response, context = {}) {
  let result = String(response || '');
  
  // Inject current time if needed
  if (context.isTimeAware) {
    const currentTime = getCurrentTimeHungarian();
    // Replace common time placeholders
    result = result
      .replace(/\[ido\]/gi, currentTime)
      .replace(/\[current_time\]/gi, currentTime)
      .replace(/\[time\]/gi, currentTime);
  }
  
  return result;
}
