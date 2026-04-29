// Betti training system: save/load learned patterns from Firestore
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

/**
 * Detect if message is a training input (starts with "xx ")
 * Returns: { isTraining: boolean, originalMessage: string }
 */
export function detectTrainingInput(message) {
  const text = String(message || '').trim();
  const isTraining = text.startsWith('xx ') || text.startsWith('XX ');
  
  if (isTraining) {
    return {
      isTraining: true,
      trainingResponse: text.slice(3).trim(), // Remove "xx " prefix
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
    
    const trainingRef = db
      .collection('users')
      .doc(uid)
      .collection('bettiTraining')
      .doc();
    
    await trainingRef.set({
      ...pattern,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return {
      success: true,
      id: trainingRef.id,
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
    
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('bettiTraining')
      .orderBy('savedAt', 'desc')
      .get();
    
    const patterns = [];
    snapshot.forEach((doc) => {
      patterns.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    return patterns;
  } catch (error) {
    console.error('[bettiTraining] Load failed:', error);
    return [];
  }
}

/**
 * Get current time in Hungarian format
 * Returns: "11:30 perc van" or similar
 */
export function getCurrentTimeHungarian() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} perc van`;
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
  
  return {
    intent,
    originalQuestion: String(originalQuestion || '').trim(),
    response: String(response || '').trim(),
    isTimeAware,
    // Pattern can be a simple keyword-based trigger
    pattern: generatePatternFromQuestion(originalQuestion),
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
