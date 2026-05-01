import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { parseBettiIntent } from '@/lib/intentParserV6';
import { normalizeHungarianChatInput } from '@/lib/huDictionary';
import { explainAssignmentDecision } from '@/lib/explanationEngine';
import { buildProactiveWarnings } from '@/lib/suggestionEngine';
import { callBettiLLM, classifyBettiDomain } from '@/lib/bettiLLM';
import { callBettiLLMRouter } from '@/lib/bettiLLMRouter';
import {
  detectTrainingInput,
  loadBettiLongTermMemory,
  loadTrainingPatterns,
  recordTrainingPatternUsage,
  saveBettiLongTermMemory,
  saveTrainingPattern,
  buildTrainingPattern,
} from '@/lib/bettiTraining';
import {
  runBettiPipeline,
  buildDefaultConversationState,
  normalizeChatRole,
  detectConversationalMood,
} from '@/lib/bettiPipeline';

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

const DECISION_WEIGHTS = {
  intent: 0.35,
  context: 0.25,
  role: 0.2,
  mood: 0.1,
  risk: 0.1,
};

const AUTO_TUNE_MIN_SUGGESTIONS = 5;
const AUTO_TUNE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_TUNE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTO_TUNE_MAX_STEP = 0.03;
const DRIFT_FREEZE_THRESHOLD = 0.25;
const DRIFT_ROLLBACK_THRESHOLD = 0.4;
const PERFORMANCE_GOLDEN_IMPROVEMENT = 0.05;
const MIN_FEEDBACK_WEIGHT_FOR_TUNING = 0.6;
const MIN_PATTERN_FREQUENCY = 0.05;
const MIN_CLUSTER_SIZE = 3;
const STABILITY_INDEX_THRESHOLD = 0.35;
const SAFETY_OVERRIDE_DRIFT_SPIKE = 0.5;
const SAFETY_OVERRIDE_PERF_DROP = 0.1;
const CONTEXT_DECAY_LAMBDA = 0.08;
const STABILITY_GUARD_THRESHOLD = 0.7;
const BASELINE_LOOKBACK_DAYS = 14;
const TUNING_MIN_PERFORMANCE_DELTA = 0.02;
const STRATEGY_LATENCY_BAD_MS = 1800;
const POLICY_EVOLUTION_MIN_SCORE = 0;

const STRATEGY_KEYS = [
  'direct_answer',
  'clarify',
  'safe_clarify',
  'empathetic_support',
  'empathetic_clarify',
  'role_redirect',
];

function normalizeDecisionWeights(candidate) {
  const base = { ...DECISION_WEIGHTS };
  if (!candidate || typeof candidate !== 'object') return base;

  const keys = Object.keys(base);
  const raw = {};
  let total = 0;
  keys.forEach((k) => {
    const v = Number(candidate[k]);
    raw[k] = Number.isFinite(v) && v >= 0 ? v : base[k];
    total += raw[k];
  });

  if (total <= 0) return base;
  const normalized = {};
  keys.forEach((k) => {
    normalized[k] = Number((raw[k] / total).toFixed(4));
  });
  return normalized;
}

function normalizeByImpactHistory(memory, baseWeights) {
  const weights = normalizeDecisionWeights(baseWeights || DECISION_WEIGHTS);
  const taxonomy = memory?.stats?.errorTaxonomy || {};

  const adjusted = {
    ...weights,
    intent: weights.intent + (Number(taxonomy.intent_miss || 0) > 5 ? 0.03 : 0),
    context: weights.context + (Number(taxonomy.context_miss || 0) > 5 ? 0.03 : 0),
    role: weights.role + (Number(taxonomy.role_violation || 0) > 3 ? 0.04 : 0),
    mood: weights.mood + (Number(taxonomy.tone_mismatch || 0) > 5 ? 0.03 : 0),
    risk: weights.risk + (Number(taxonomy.strategy_miss || 0) > 5 ? 0.02 : 0),
  };

  return normalizeDecisionWeights(adjusted);
}

function validatePolicyConsistency(policyVersion) {
  if (!policyVersion) return { valid: false, reasons: ['missing_policy'] };
  const reasons = [];
  const weights = normalizeDecisionWeights(policyVersion.weights || {});
  const sum = Object.values(weights).reduce((a, b) => a + Number(b || 0), 0);
  if (Math.abs(sum - 1) > 0.01) reasons.push('weight_sum_invalid');
  if (Object.values(weights).some((w) => Number(w) < 0)) reasons.push('negative_weight_detected');

  const mapping = policyVersion.strategyMapping || {};
  const scores = mapping.scores || {};
  const coverage = STRATEGY_KEYS.every((k) => Object.prototype.hasOwnProperty.call(scores, k));
  if (!coverage) reasons.push('strategy_mapping_coverage_incomplete');

  const unreachable = STRATEGY_KEYS.filter((k) => Number(scores[k] || 0) <= 0);
  if (unreachable.length === STRATEGY_KEYS.length) reasons.push('all_strategies_unreachable');

  const intentRouting = mapping.intentRouting || {};
  const knownIntents = new Set([
    'my_schedule', 'my_schedule_presence', 'my_vacation', 'my_free_days', 'report_overtime',
    'list_employees', 'show_vacation_requests', 'missing_drafts', 'add_employee', 'remove_employee',
    'greeting', 'identity', 'thanks', 'ack', 'affirmative', 'negative', 'hesitation', 'unknown',
  ]);
  const orphanIntents = Object.keys(intentRouting).filter((intent) => !knownIntents.has(intent));
  if (orphanIntents.length > 0) reasons.push('orphan_intents_detected');

  return {
    valid: reasons.length === 0,
    reasons,
    unreachableStrategies: unreachable,
    orphanIntents,
  };
}

function resolveStrategyConflict({ weightedSuggested, strategySuggested, intentConfidence, contextUncertainty }) {
  if (!weightedSuggested || !strategySuggested || weightedSuggested === strategySuggested) {
    return { resolved: strategySuggested || weightedSuggested || 'clarify', hadConflict: false, confidenceGap: 0 };
  }

  const conflictPair = new Set([weightedSuggested, strategySuggested]);
  const directVsClarify = conflictPair.has('direct_answer') && conflictPair.has('clarify');
  if (!directVsClarify) {
    return { resolved: strategySuggested, hadConflict: true, confidenceGap: 0, reason: 'fallback_strategy_engine' };
  }

  const gap = Number((Number(intentConfidence || 0) - Number(contextUncertainty || 0)).toFixed(4));
  return {
    resolved: gap > 0.2 ? 'direct_answer' : 'clarify',
    hadConflict: true,
    confidenceGap: gap,
    reason: 'direct_vs_clarify_gap_rule',
  };
}

function predictDriftNextN(policies = [], n = 10) {
  const items = Array.isArray(policies) ? policies.slice(-Math.max(2, n)) : [];
  if (items.length < 2) {
    return { expectedDriftTrend: 0, riskSlope: 0, stabilityForecast: 0.5, shouldPreventUpdate: false };
  }

  const drifts = [];
  for (let i = 1; i < items.length; i += 1) {
    drifts.push(calculateWeightDistance(items[i - 1]?.weights, items[i]?.weights));
  }

  const xMean = (drifts.length - 1) / 2;
  const yMean = drifts.reduce((a, b) => a + b, 0) / drifts.length;
  let num = 0;
  let den = 0;
  drifts.forEach((y, idx) => {
    const x = idx;
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const expectedDriftTrend = yMean + slope * Math.min(n, 10);
  const stabilityForecast = clamp01(1 - expectedDriftTrend);

  return {
    expectedDriftTrend: Number(expectedDriftTrend.toFixed(4)),
    riskSlope: Number(slope.toFixed(4)),
    stabilityForecast: Number(stabilityForecast.toFixed(4)),
    shouldPreventUpdate: slope > 0,
  };
}

function compressPolicies(policies = []) {
  const source = Array.isArray(policies) ? policies : [];
  if (source.length <= 3) return source;

  const compressed = [source[0]];
  for (let i = 1; i < source.length; i += 1) {
    const prev = compressed[compressed.length - 1];
    const curr = source[i];
    const wDist = calculateWeightDistance(prev?.weights, curr?.weights);
    const pDist = Math.abs(Number(prev?.performanceScore || 0) - Number(curr?.performanceScore || 0));
    if (wDist < 0.02 && pDist < 0.01) {
      continue;
    }
    compressed.push(curr);
  }

  return compressed.slice(-50);
}

function getTimeMillis(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function averageSuggestedWeights(suggestions = [], nowTs = Date.now()) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  const sum = { intent: 0, context: 0, role: 0, mood: 0, risk: 0 };
  let totalWeight = 0;
  suggestions.forEach((item) => {
    const sw = normalizeDecisionWeights(item?.suggestedWeights || {});
    const ageDays = Math.max(0, (nowTs - getTimeMillis(item?.createdAt)) / (24 * 60 * 60 * 1000));
    const feedbackTimeWeight = Math.exp(-0.15 * ageDays);
    totalWeight += feedbackTimeWeight;
    Object.keys(sum).forEach((k) => { sum[k] += Number(sw[k] || 0) * feedbackTimeWeight; });
  });

  const avg = {};
  Object.keys(sum).forEach((k) => { avg[k] = sum[k] / Math.max(0.0001, totalWeight); });
  return normalizeDecisionWeights(avg);
}

function blendWeightsWithGuardrail(currentWeights, targetWeights, maxStep = AUTO_TUNE_MAX_STEP) {
  const current = normalizeDecisionWeights(currentWeights || DECISION_WEIGHTS);
  const target = normalizeDecisionWeights(targetWeights || current);

  const blended = {};
  Object.keys(current).forEach((k) => {
    const diff = Number(target[k] || 0) - Number(current[k] || 0);
    const clipped = Math.max(-maxStep, Math.min(maxStep, diff));
    blended[k] = Number((current[k] + clipped).toFixed(4));
  });

  return normalizeDecisionWeights(blended);
}

function evaluateAutoWeightApply(memory, nowTs = Date.now()) {
  const prefs = memory?.userPreferences || {};
  const stats = memory?.stats || {};
  const suggestions = Array.isArray(memory?.weightSuggestions) ? memory.weightSuggestions : [];

  const recent = suggestions.filter((s) => {
    const created = getTimeMillis(s?.createdAt);
    return created > 0 && nowTs - created <= AUTO_TUNE_LOOKBACK_MS;
  });

  if (recent.length < AUTO_TUNE_MIN_SUGGESTIONS) {
    return { shouldApply: false, reason: 'not_enough_recent_suggestions' };
  }

  const lastAppliedTs = getTimeMillis(stats.lastAutoWeightApplyAt);
  if (lastAppliedTs > 0 && nowTs - lastAppliedTs < AUTO_TUNE_COOLDOWN_MS) {
    return { shouldApply: false, reason: 'cooldown_active' };
  }

  const avgSuggested = averageSuggestedWeights(recent, nowTs);
  if (!avgSuggested) {
    return { shouldApply: false, reason: 'no_average_weight' };
  }

  const current = normalizeDecisionWeights(prefs.decisionWeights || DECISION_WEIGHTS);
  const nextWeights = blendWeightsWithGuardrail(current, avgSuggested, AUTO_TUNE_MAX_STEP);

  const totalShift = Object.keys(current)
    .reduce((acc, key) => acc + Math.abs((nextWeights[key] || 0) - (current[key] || 0)), 0);

  if (totalShift < 0.01) {
    return { shouldApply: false, reason: 'shift_too_small' };
  }

  return {
    shouldApply: true,
    reason: 'guardrail_pass',
    previousWeights: current,
    averagedSuggestedWeights: avgSuggested,
    nextWeights,
    recentSuggestionCount: recent.length,
  };
}

function getLatestGoldenSnapshot(memory) {
  const snapshots = Array.isArray(memory?.goldenSnapshots) ? memory.goldenSnapshots : [];
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

function getLatestStableGoldenSnapshot(memory) {
  const snapshots = Array.isArray(memory?.goldenSnapshots) ? memory.goldenSnapshots : [];
  if (snapshots.length === 0) return null;
  return [...snapshots]
    .filter((s) => s?.stable !== false)
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

function calculateWeightDistance(currentWeights, goldenWeights) {
  const current = normalizeDecisionWeights(currentWeights || DECISION_WEIGHTS);
  const golden = normalizeDecisionWeights(goldenWeights || DECISION_WEIGHTS);
  const dist = Object.keys(current).reduce((acc, key) => acc + Math.abs((current[key] || 0) - (golden[key] || 0)), 0);
  return clamp01(dist / 2);
}

function calculateConfidenceVariance(values = []) {
  if (!Array.isArray(values) || values.length <= 1) return 0;
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (nums.length <= 1) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((acc, x) => acc + ((x - mean) ** 2), 0) / nums.length;
  return clamp01(Math.sqrt(variance));
}

function computePerformanceScore(stats = {}, previous = null) {
  const satTotal = Number(stats.satisfactionTotalCount || 0);
  const satPos = Number(stats.satisfactionPositiveCount || 0);
  const userSatisfactionRate = satTotal > 0 ? clamp01(satPos / satTotal) : (Number(previous?.baselineScore || 0.62) || 0.62);

  const total = Number(stats.totalMessages || 0);
  const success = Number(stats.successfulTaskCount || 0);
  const taskSuccessRate = total > 0 ? clamp01(success / total) : 0.6;

  const followUps = Number(stats.followUpCount || 0);
  const reducedFollowUps = Number(stats.reducedFollowUpCount || 0);
  const followUpReduction = followUps > 0 ? clamp01(reducedFollowUps / followUps) : 0.5;

  const corrections = Number(stats.correctionCount || 0);
  const correctionRate = total > 0 ? clamp01(corrections / total) : 0.2;

  const score = (
    0.4 * userSatisfactionRate
    + 0.3 * taskSuccessRate
    + 0.2 * followUpReduction
    + 0.1 * (1 - correctionRate)
  );

  return Number(clamp01(score).toFixed(4));
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableSerialize(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(value[k])}`).join(',')}}`;
}

function hashString(input) {
  const text = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function computeSystemIntegrityHash({ activePolicyVersion, weights, strategyMapping, featureWeights }) {
  return hashString(stableSerialize({
    activePolicyVersion: activePolicyVersion || 'none',
    weights: normalizeDecisionWeights(weights || DECISION_WEIGHTS),
    strategyMapping: strategyMapping || {},
    featureWeights: featureWeights || DECISION_WEIGHTS,
  }));
}

function computeRollingBaseline(memory, lookbackDays = BASELINE_LOOKBACK_DAYS, nowTs = Date.now()) {
  const history = Array.isArray(memory?.performance?.recentScoreHistory) ? memory.performance.recentScoreHistory : [];
  const minTs = nowTs - (lookbackDays * 24 * 60 * 60 * 1000);
  const window = history.filter((item) => getTimeMillis(item?.at) >= minTs);
  const points = window.length > 0
    ? window.map((item) => Number(item?.score || 0))
    : (Array.isArray(memory?.performance?.recentScores) ? memory.performance.recentScores.slice(-30) : []);

  if (points.length === 0) return 0;
  const baseline = points.reduce((a, b) => a + Number(b || 0), 0) / points.length;
  return Number(clamp01(baseline).toFixed(4));
}

function computePerformanceDelta(current, baseline) {
  const safeBaseline = Math.max(0.0001, Number(baseline || 0));
  return Number((((Number(current || 0) - safeBaseline) / safeBaseline)).toFixed(4));
}

function computeCausalImpactScore({ learningFeedback, feedbackQuality, clusterGate, behaviorAligned }) {
  const hasAB = Boolean(learningFeedback?.abGroup || learningFeedback?.experimentId || learningFeedback?.abTest);
  const repeatedPattern = Number(clusterGate?.clusterSize || 0) >= Number(clusterGate?.minClusterSize || 3);
  const feedbackAligned = Number(feedbackQuality?.feedbackWeight || 0) >= MIN_FEEDBACK_WEIGHT_FOR_TUNING;
  const allow = (hasAB || repeatedPattern) && feedbackAligned && behaviorAligned;
  const score = clamp01((hasAB ? 0.5 : 0) + (repeatedPattern ? 0.3 : 0) + (feedbackAligned ? 0.2 : 0));
  return {
    allow,
    score: Number(score.toFixed(4)),
    hasAB,
    repeatedPattern,
    feedbackAligned,
    behaviorAligned,
  };
}

function classifyFailureMode({ feedbackQuality, parsed, chatRole, decisionPipeline }) {
  if (decisionPipeline?.scores?.role < 0.45 || (chatRole === 'manager' && parsed?.intent === 'unknown')) return 'role_violation';
  if (feedbackQuality?.sentimentShift) return 'wrong_tone';
  if (feedbackQuality?.followUpBehavior) return 'missing_context';
  if (feedbackQuality?.quickActionReject) return 'wrong_action';
  return 'misunderstanding';
}

function evaluateCircuitBreaker(memory, driftStatus, rollbackApplied, perfDrop) {
  const existing = Array.isArray(memory?.autoTuning?.safetyEvents) ? memory.autoTuning.safetyEvents : [];
  const hazard = rollbackApplied || Number(driftStatus?.driftScore || 0) > DRIFT_FREEZE_THRESHOLD || Number(perfDrop || 0) > SAFETY_OVERRIDE_PERF_DROP;
  const next = [...existing.slice(-2), hazard ? 1 : 0];
  const shouldLock = next.length >= 3 && next.every((v) => v === 1);
  return {
    hazard,
    events: next,
    shouldLock,
  };
}

function computePolicyEvolutionScore({ improvementRate, instabilityRate, rollbackFrequency, externalValidationScore }) {
  const score = Number(improvementRate || 0)
    - Number(instabilityRate || 0)
    - Number(rollbackFrequency || 0)
    + Number(externalValidationScore || 0);
  return Number(score.toFixed(4));
}

function computeDriftStatus({ currentWeights, goldenWeights, performanceScore, baselinePerformanceScore, confidenceVariance }) {
  const weightDistance = calculateWeightDistance(currentWeights, goldenWeights);
  const perfDropRaw = Math.max(0, Number(baselinePerformanceScore || 0) - Number(performanceScore || 0));
  const performanceDrop = clamp01(perfDropRaw);
  const confVar = clamp01(confidenceVariance || 0);
  const driftScore = clamp01(weightDistance + performanceDrop + confVar);
  const modelDrift = clamp01(weightDistance * 0.7 + performanceDrop * 0.3);
  const dataDrift = clamp01(confVar * 0.7 + performanceDrop * 0.3);
  const driftType = modelDrift >= dataDrift ? 'modelDrift' : 'dataDrift';

  return {
    driftScore: Number(driftScore.toFixed(4)),
    weightDistance: Number(weightDistance.toFixed(4)),
    performanceDrop: Number(performanceDrop.toFixed(4)),
    confidenceVariance: Number(confVar.toFixed(4)),
    modelDrift: Number(modelDrift.toFixed(4)),
    dataDrift: Number(dataDrift.toFixed(4)),
    driftType,
    shouldFreeze: driftScore > DRIFT_FREEZE_THRESHOLD,
    shouldRollback: driftScore > DRIFT_ROLLBACK_THRESHOLD,
  };
}

function scoreFeedbackQuality({ learningFeedback, mood, parsed, previousMessageIntent }) {
  const hasExplicitCorrection = learningFeedback?.type === 'intent_selection';
  const quickActionReject = hasExplicitCorrection ? 1 : 0;
  const followUpBehavior = parsed?.inferredFromContext || isContinuationPrompt(learningFeedback?.originalMessage || '') || previousMessageIntent === 'ack' ? 1 : 0;
  const sentimentShift = ['frustrated', 'sad'].includes(mood?.label) ? 1 : 0;

  const feedbackWeight = Number((
    (hasExplicitCorrection ? 1.0 : 0)
    + (quickActionReject ? 0.8 : 0)
    + (followUpBehavior ? 0.5 : 0)
    + (sentimentShift ? 0.3 : 0)
  ).toFixed(3));

  return {
    feedbackWeight,
    hasExplicitCorrection,
    quickActionReject,
    followUpBehavior,
    sentimentShift,
  };
}

function causalValidationGate({ parsed, decisionPipeline, feedbackQuality, stats }) {
  const intentCorrect = Number(decisionPipeline?.scores?.intent || 0) >= 0.7 && parsed?.intent !== 'unknown';
  const strategyLikelyWrong = ['clarify', 'safe_clarify', 'role_redirect'].includes(decisionPipeline?.bestStrategy);
  const explicitOrRepeated = feedbackQuality?.hasExplicitCorrection || Number(stats?.correctedByQuickActionCount || 0) >= 3;
  const behaviorAligned = Number(stats?.followUpCorrectionCount || 0) > 0 || Number(stats?.explicitCorrectionCount || 0) > 0;

  const allow = intentCorrect && strategyLikelyWrong && explicitOrRepeated && behaviorAligned;
  return {
    allow,
    intentCorrect,
    strategyLikelyWrong,
    explicitOrRepeated,
    behaviorAligned,
  };
}

function evaluateAutoTuningMode({ memory, driftStatus, feedbackQuality, performanceScore, policyEvolutionScore }) {
  const currentMode = memory?.autoTuning?.mode || 'LEARNING_ONLY';

  if (driftStatus?.shouldRollback || driftStatus?.shouldFreeze) {
    return { nextMode: 'FULL_LOCK', reason: driftStatus.shouldRollback ? 'drift_rollback' : 'drift_freeze' };
  }

  if (Number(policyEvolutionScore || 0) < POLICY_EVOLUTION_MIN_SCORE) {
    return { nextMode: 'OFF', reason: 'negative_policy_evolution_score' };
  }

  if (currentMode === 'OFF' || currentMode === 'FULL_LOCK' || currentMode === 'SAFE_MODE') {
    return { nextMode: currentMode, reason: 'manual_or_locked' };
  }

  const stablePerf = performanceScore >= Number(memory?.autoTuning?.lastPerformanceScore || 0);
  const goodFeedback = Number(feedbackQuality?.feedbackWeight || 0) >= 0.8;
  if (stablePerf && goodFeedback) {
    return { nextMode: 'CONTROLLED_APPLY', reason: 'stable_and_good_feedback' };
  }

  return { nextMode: 'LEARNING_ONLY', reason: 'collecting' };
}

function evaluateSafetyOverride({ memory, driftStatus, performanceScore, baselinePerformanceScore, contradictoryFeedback }) {
  const perfDrop = Math.max(0, Number(baselinePerformanceScore || 0) - Number(performanceScore || 0));
  const driftSpike = Number(driftStatus?.driftScore || 0);

  if (driftSpike > SAFETY_OVERRIDE_DRIFT_SPIKE) {
    return {
      active: true,
      forceMode: 'FULL_LOCK',
      reason: 'drift anomaly',
      perfDrop: Number(perfDrop.toFixed(4)),
      driftSpike: Number(driftSpike.toFixed(4)),
    };
  }
  if (perfDrop > SAFETY_OVERRIDE_PERF_DROP) {
    return {
      active: true,
      forceMode: 'FULL_LOCK',
      reason: 'risk spike / performance drop',
      perfDrop: Number(perfDrop.toFixed(4)),
      driftSpike: Number(driftSpike.toFixed(4)),
    };
  }
  if (contradictoryFeedback) {
    return {
      active: true,
      forceMode: 'FULL_LOCK',
      reason: 'inconsistent feedback cluster',
      perfDrop: Number(perfDrop.toFixed(4)),
      driftSpike: Number(driftSpike.toFixed(4)),
    };
  }

  return {
    active: false,
    forceMode: null,
    reason: null,
    perfDrop: Number(perfDrop.toFixed(4)),
    driftSpike: Number(driftSpike.toFixed(4)),
  };
}

function computePopulationNormalizedImpact(rawImpact, memory) {
  const totalUsersAffected = Number(memory?.stats?.totalUsersAffected || 1);
  const userWeight = 1 / Math.log(totalUsersAffected + 2);
  const userPopulationWeight = userWeight > 0 ? (1 / userWeight) : 1;
  return {
    totalUsersAffected,
    userWeight: Number(userWeight.toFixed(4)),
    userPopulationWeight: Number(userPopulationWeight.toFixed(4)),
    normalizedImpact: Number((Number(rawImpact || 0) / Math.max(0.0001, userPopulationWeight)).toFixed(4)),
  };
}

function maybeCreateGoldenSnapshot(memory, currentWeights, performanceScore) {
  const snapshots = Array.isArray(memory?.goldenSnapshots) ? memory.goldenSnapshots : [];
  const latest = getLatestGoldenSnapshot(memory);

  if (!latest) {
    return {
      shouldCreate: true,
      snapshot: {
        version: 1,
        weights: normalizeDecisionWeights(currentWeights),
        performanceScore: Number(performanceScore || 0),
        stable: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const improved = Number(performanceScore || 0) >= Number(latest.performanceScore || 0) * (1 + PERFORMANCE_GOLDEN_IMPROVEMENT);
  if (!improved) return { shouldCreate: false, snapshot: null };

  return {
    shouldCreate: true,
    snapshot: {
      version: Number(latest.version || snapshots.length || 0) + 1,
      weights: normalizeDecisionWeights(currentWeights),
      performanceScore: Number(performanceScore || 0),
      stable: true,
      createdAt: new Date().toISOString(),
    },
  };
}

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

function buildChatUiCommands({ action, chatRole, entities = {} }) {
  const commands = [];
  const hasMonth = Number.isInteger(entities?.monthOffset) || Number.isInteger(entities?.monthNumber);

  if (action === 'show_my_schedule' || action === 'show_my_vacations' || action === 'show_my_free_days') {
    commands.push(
      { id: 'refresh_data', type: 'rerun_action', label: 'Frissites' },
      { id: 'month_current', type: 'send_message', label: 'Aktualis honap', utterance: 'Aktualis honap' },
      { id: 'month_next', type: 'send_message', label: 'Kovetkezo honap', utterance: 'Kovetkezo honap' }
    );
  }

  if (action === 'list_employees') {
    commands.push(
      { id: 'go_workers', type: 'set_main_tab', label: 'Dolgozok fule', tab: 'workers' },
      { id: 'refresh_data', type: 'rerun_action', label: 'Frissites' }
    );
  }

  if (action === 'show_vacation_requests' || action === 'missing_drafts') {
    commands.push(
      { id: 'go_schedule_tab', type: 'set_main_tab', label: 'Beosztas fule', tab: 'schedule' },
      { id: 'refresh_data', type: 'rerun_action', label: 'Frissites' }
    );
    if (!hasMonth) {
      commands.push({ id: 'month_current', type: 'send_message', label: 'Erre a honapra', utterance: 'Aktualis honap' });
    }
  }

  if (action === 'find_replacement') {
    if (chatRole === 'pharmacy') {
      commands.push(
        { id: 'open_replacement_calendar', type: 'navigate_url', label: 'Igeny feladasa', url: '/pharmagister?tab=calendar' },
        { id: 'open_replacement_dashboard', type: 'navigate_url', label: 'Jelentkezok a dashboardon', url: '/pharmagister?tab=dashboard' },
        { id: 'list_my_demands', type: 'local_list_my_demands', label: 'Sajat igenyeim listazasa' },
        { id: 'create_demand_wizard', type: 'local_create_demand_wizard_start', label: 'Uj igeny chatbol' }
      );
    } else {
      commands.push(
        { id: 'open_replacement_calendar', type: 'navigate_url', label: 'Nyitott igenyek', url: '/pharmagister?tab=calendar' },
        { id: 'open_replacement_dashboard', type: 'navigate_url', label: 'Sajat jelentkezeseim', url: '/pharmagister?tab=dashboard' },
        { id: 'list_open_demands', type: 'local_list_open_demands', label: 'Nyitott igenyek listazasa' }
      );
    }
    commands.push({ id: 'show_my_schedule_again', type: 'send_message', label: 'Mely napokon dolgozom?', utterance: 'Listazd ki mely napokra vagyok beosztva' });
  }

  if (chatRole === 'pharmacy' && (
    action === 'list_employees'
    || action === 'show_vacation_requests'
    || action === 'missing_drafts'
    || action === 'find_replacement'
  )) {
    commands.push({ id: 'list_pending_apps', type: 'local_list_pending_applications', label: 'Fuggo jelentkezesek' });
  }

  if (action === 'write_schedule_plan') {
    commands.push({ id: 'go_planner_tab', type: 'set_main_tab', label: 'Tervezo fule', tab: 'planner' });
  }

  if (action === 'add_employee' || action === 'remove_employee') {
    commands.push(
      { id: 'go_workers_tab', type: 'set_main_tab', label: 'Dolgozok fule', tab: 'workers' },
      { id: 'go_workers_add', type: 'set_worker_tab', label: 'Hozzaadas', tab: 'add' },
      { id: 'go_workers_remove', type: 'set_worker_tab', label: 'Eltavolitas', tab: 'remove' }
    );
  }

  if (commands.length === 0 && action) {
    commands.push({ id: 'refresh_data', type: 'rerun_action', label: 'Frissites' });
  }

  return commands.slice(0, 4);
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

function polishBettiReply({ reply, action, chatRole, entities, seed, allowFlowProposal = true }) {
  if (!reply) return reply;
  const bridge = allowFlowProposal ? buildReplyBridge({ action, chatRole, entities, seed }) : '';
  return bridge ? `${reply} ${bridge}` : reply;
}

function isLikelyTruncatedReply(reply) {
  const text = String(reply || '').trim();
  if (!text) return true;
  if (/[,:;\-]$/.test(text)) return true;
  if (/\b(es|vagy|hogy|mert|ha|de|valamint|illetve|majd)\.?$/i.test(text)) return true;
  if (!/[.!?]$/.test(text) && text.length < 22) return true;
  return false;
}

function isOffTopicMessage(message) {
  const text = String(message || '').toLowerCase().trim();
  if (!text) return true;

  // Allowlist: ha tartalmaz szakmai kulcsszót, ENGEDÉLYEZETT → nem off-topic
  const workKeywords = [
    'műszak', 'muszak', 'beosztás', 'beosztas', 'beosztásod', 'beosztásom',
    'szabadság', 'szabadsag', 'szabadnap', 'szabadnapon',
    'túlóra', 'tulora', 'helyettesít', 'helyettesit', 'helyettesítés',
    'dolgoz', 'dolgozó', 'dolgozom', 'alkalmazott',
    'gyógyszerész', 'gyogyszeresz', 'asszisztens',
    'naptár', 'naptar', 'munka', 'munkaidő', 'munkabeosztás',
    'shift', 'szolgálat', 'szolgalat', 'ügyelet', 'ugyelet',
    'ünnep', 'unnep', 'betegszabadság', 'betegszabadsag',
    'pótlék', 'potlek', 'vezető', 'vezeto', 'főnök', 'fonok',
    'kolléga', 'kollega', 'csapat',
    'hétfő', 'hetfo', 'kedd', 'szerda', 'csütörtök', 'csutortok',
    'péntek', 'pentek', 'szombat', 'vasárnap', 'vasarnap',
    'január', 'februar', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
    'hónap', 'honapban', 'héten', 'heten', 'jövő hét', 'jövő hónap',
    'mikor', 'mettől', 'meddig', 'hány', 'hanykor', 'hanyan',
    'kik', 'ki megy', 'ki van', 'ki nem', 'ki hiányzik',
    'listá', 'lista', 'mutat', 'megmutat', 'lát', 'látom', 'nézem',
  ];

  if (workKeywords.some((kw) => text.includes(kw))) return false;

  // Rövid, kontextusfüggő üzenetek (pl. "igen", "nem", "ok", "köszi", "értem")
  // ezek valószínűleg egy folyamatban lévő beosztásos beszélgetés részei → engedjük
  if (text.length < 30 && /^(igen|nem|ok|okay|köszön|köszi|értem|rendben|szia|hello|hali|helló|segíts|segits|miben|hogyan|miért|miert|mikor|melyik|melyiket|hol|mennyi|mi van|mi lesz|mi volt|mit|miket|kérlek|kérem|kérsz|ja|aha|persze|naná|talán|lehet|tudsz|tudok|tud betti|betti|neked|nekem|ezt|azt|ilyet|olyat|ugyanez|ugyanaz|hasonló|más|másik|tovabb|tovább|folytass|folytasd)/.test(text)) {
    return false;
  }

  // Minden más → off-topic, nem hívjuk Geminit
  return true;
}

function stabilizeReplyText(reply, chatRole) {
  const text = String(reply || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return chatRole === 'pharmacy'
      ? 'Rendben, segitek. Mondd el, a dolgozokrol, szabadsagokrol, tervezetekrol vagy tulorarol kerdezel.'
      : 'Rendben, segitek. Mondd el, a beosztasodrol, szabadsagrol vagy szabadnapokrol kerdezel.';
  }

  if (isLikelyTruncatedReply(text)) {
    return chatRole === 'pharmacy'
      ? 'Rendben, segitek. Mondd el, melyikben kered a segitseget: dolgozok, szabadsagok, tervezetek vagy tulora.'
      : 'Rendben, segitek. Mondd el, a beosztasodrol, szabadsagrol vagy szabadnapokrol kerdezel.';
  }

  // If text doesn't end with sentence-ending punctuation but is reasonably long
  // (at least 2 complete-looking words), add a period rather than treating as truncated.
  // But if it looks like it trails off mid-list (ends with comma, dash, or Hungarian conjunction), use fallback.
  if (/[.!?]$/.test(text)) return text;

  // Ends without punctuation — only safe to add period if the last word looks like a noun/verb,
  // not a conjunction/preposition indicating something was cut.
  return `${text}.`;
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

function applyMoodTone({ reply, mood, intent, action }) {
  if (!reply || !mood?.label) return reply;

  // Keep transactional/action-heavy replies short and deterministic.
  const strictActions = ['show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'list_employees', 'show_vacation_requests', 'missing_drafts'];
  if (strictActions.includes(action)) return reply;

  if (mood.label === 'tired') {
    if (intent === 'greeting' || action === 'clarify_with_options' || intent === 'unknown' || intent === 'help') {
      return `Ertem, hogy faradt vagy. ${reply}`;
    }
  }

  if (mood.label === 'frustrated' || mood.label === 'sad') {
    if (intent === 'unknown' || action === 'clarify_with_options' || intent === 'help' || intent === 'capabilities') {
      return `Sajnalom, hogy ez most nehez. ${reply}`;
    }
  }

  if (mood.label === 'positive' && (intent === 'greeting' || intent === 'thanks')) {
    return `Jo ezt hallani. ${reply}`;
  }

  return reply;
}

function applyUserPreferences({ reply, preferences, action, userModel }) {
  if (!reply || !preferences) return reply;

  let next = reply;
  const tone = preferences.tone || 'balanced';
  const detail = preferences.detailLevel || 'medium';

  if (tone === 'short') {
    const firstSentence = next.split(/[.!?]\s+/)[0];
    next = firstSentence ? firstSentence.trim() : next;
  }

  if (tone === 'formal') {
    next = next
      .replace(/^Szia!/i, 'Udvozollek!')
      .replace(/Szuper/i, 'Rendben');
  }

  if (detail === 'low' && action === 'clarify_with_options') {
    next = `${next.split('\n')[0]} Valassz egy opciot lent.`;
  }

  if (detail === 'high' && action !== 'clarify_with_options') {
    if (!next.includes('Ha szeretned')) {
      next = `${next} Ha szeretned, adok rovid magyarazatot is.`;
    }
  }

  const directness = Number(userModel?.communicationStyle?.directnessPreference || 0);
  if (directness > 0.8) {
    next = next.split(/[.!?]\s+/)[0]?.trim() || next;
  }

  if ((userModel?.communicationStyle?.emotionalTonePreference || 'medium') === 'high' && !/^Ertem|^Sajnalom|^Jo ezt hallani/i.test(next)) {
    next = `Ertem. ${next}`;
  }

  return next;
}

function createConversationId({ uid, conversationId }) {
  return conversationId || `conv_${uid}`;
}

function getRequiredSlotsForAction(action) {
  const map = {
    show_my_schedule: ['month'],
    show_my_vacations: ['month'],
    show_my_free_days: ['month'],
    show_vacation_requests: ['month'],
    missing_drafts: ['month'],
    add_employee: ['email'],
    remove_employee: ['person'],
  };
  return map[action] || [];
}

function getFilledSlots({ entities, message }) {
  const norm = normalizeText(message);
  const filled = [];
  if (Number.isInteger(entities?.monthOffset) || Number.isInteger(entities?.monthNumber) || entities?.monthLabel) filled.push('month');
  if (entities?.person) filled.push('person');
  if (entities?.email || /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(norm)) filled.push('email');
  return filled;
}

function loadConversationBrainState({ uid, conversationId, memory, parsed, historyState }) {
  const stored = memory?.conversationState;
  return stored && typeof stored === 'object'
    ? {
        ...buildDefaultConversationState({ uid, conversationId, parsed, historyState }),
        ...stored,
        conversationId: createConversationId({ uid, conversationId }),
        userId: uid,
        activeTopic: {
          ...buildDefaultConversationState({ uid, conversationId, parsed, historyState }).activeTopic,
          ...(stored.activeTopic || {}),
        },
        openLoops: Array.isArray(stored.openLoops) ? stored.openLoops.slice(-6) : [],
      }
    : buildDefaultConversationState({ uid, conversationId, parsed, historyState });
}

function buildMemoryHierarchy({ memory, recentConversation, conversationState }) {
  return {
    L1: Array.isArray(recentConversation) ? recentConversation.slice(-6) : [],
    L2: memory?.topicMemory || conversationState?.activeTopic || null,
    L3: memory?.userModel || null,
    L4: Array.isArray(memory?.longTermFacts) ? memory.longTermFacts : (Array.isArray(memory?.stableFacts) ? memory.stableFacts : []),
  };
}

function computeContinuityScore({ conversationState, parsed, recentConversation, selectedAction }) {
  const activeIntent = conversationState?.activeTopic?.intent;
  const topicPersistence = activeIntent && activeIntent === parsed?.intent ? 0.4 : 0.15;
  const unansweredLoops = Array.isArray(conversationState?.openLoops)
    ? conversationState.openLoops.filter((loop) => loop?.awaitingAnswer).length
    : 0;
  const loopScore = unansweredLoops > 0 ? 0.25 : 0.1;
  const relevantFollowUp = selectedAction && selectedAction === conversationState?.activeTopic?.name ? 0.25 : 0.1;
  const recencyScore = Math.min(0.1, (Array.isArray(recentConversation) ? recentConversation.length : 0) * 0.02);
  return Number(clamp01(topicPersistence + loopScore + relevantFollowUp + recencyScore).toFixed(4));
}

function buildLoopQuestion(action) {
  if (['show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'show_vacation_requests', 'missing_drafts'].includes(action)) {
    return 'Melyik honapra?';
  }
  if (action === 'add_employee') return 'Mi az uj dolgozo email cime?';
  if (action === 'remove_employee') return 'Melyik dolgozot szeretned eltavolitani?';
  return 'Pontosits kerlek.';
}

function simplifyResponse(reply, action) {
  const text = String(reply || '').trim();
  if (!text) return text;
  const firstSentence = text.split(/[.!?]\s+/).filter(Boolean)[0] || text;
  if (action === 'clarify_with_options') return `${firstSentence}. Valassz egy opciot.`;
  return `${firstSentence}.`;
}

function isExplicitTopicShift(parsed, conversationState) {
  if (!parsed) return false;
  const currentIntent = conversationState?.activeTopic?.intent || null;
  if (!currentIntent) return true;
  if (['clarify_last_answer', 'challenge_previous_response', 'affirmative', 'negative', 'hesitation'].includes(parsed.intent)) return false;
  return Number(parsed.confidence || 0) > 0.85 && parsed.intent !== currentIntent;
}

function applyTopicLockToParsed(parsed, conversationState) {
  const activeTopic = conversationState?.activeTopic || {};
  const topicLocked = activeTopic.locked !== false;
  if (!topicLocked) return parsed;
  if (isExplicitTopicShift(parsed, conversationState)) return parsed;
  if (!activeTopic.intent || !activeTopic.name) return parsed;
  if (['clarify_last_answer', 'challenge_previous_response', 'affirmative', 'negative', 'hesitation'].includes(parsed.intent) || parsed.keepFlow) {
    return {
      ...parsed,
      relatesTo: parsed.relatesTo || activeTopic.intent,
      activeAction: activeTopic.name,
      lockedToTopic: true,
    };
  }
  if (Number(parsed.confidence || 0) <= 0.85 && parsed.intent !== activeTopic.intent) {
    return {
      ...parsed,
      intent: activeTopic.intent,
      action: activeTopic.name,
      reply: parsed.reply,
      relatesTo: activeTopic.intent,
      activeAction: activeTopic.name,
      lockedToTopic: true,
      keepFlow: true,
    };
  }
  return parsed;
}

function runFlowEngine({ conversationState, parsed, payload, message, recentConversation }) {
  const action = payload?.action || parsed?.action || 'clarify_with_options';
  const requiredSlots = getRequiredSlotsForAction(action);
  const filledSlots = getFilledSlots({ entities: payload?.entities || parsed?.entities || {}, message });
  const missingSlots = requiredSlots.filter((slot) => !filledSlots.includes(slot));
  const continuityScore = computeContinuityScore({
    conversationState,
    parsed,
    recentConversation,
    selectedAction: action,
  });
  const confusionIntent = ['clarify_last_answer', 'challenge_previous_response'].includes(parsed?.intent);
  const shouldClarify = missingSlots.length > 0 || confusionIntent;
  const phase = confusionIntent ? 'clarifying' : (shouldClarify ? 'waiting_user' : (continuityScore < 0.45 ? 'resolving' : 'active'));

  return {
    stepOrder: ['loadState', 'resolveIntent', 'mergeContext', 'evaluateSlots', shouldClarify ? 'clarify' : 'answer', 'updateState'],
    action,
    requiredSlots,
    filledSlots,
    missingSlots,
    shouldClarify,
    phase,
    continuityScore,
    shouldReanchor: continuityScore < 0.45,
    loopQuestion: shouldClarify ? (confusionIntent ? 'Elmondjam egyszerubben ugyanazt?' : buildLoopQuestion(action)) : null,
  };
}

function reanchorTopicReply({ conversationState, chatRole }) {
  const topic = conversationState?.activeTopic?.name || (chatRole === 'pharmacy' ? 'list_employees' : 'show_my_schedule');
  if (topic === 'show_my_schedule') return 'Visszakotnek az elozo temahoz: a beosztasodra gondoltal, vagy masra?';
  if (topic === 'show_vacation_requests') return 'Visszakotnek az elozo kerdeshez: a szabadsagigenyeket nezzuk tovabb?';
  if (topic === 'missing_drafts') return 'Visszakotnek: a hianyzo tervezetekrol volt szo, ezt folytassuk?';
  return 'Visszakotnek az elozo temahoz, hogy ne essen szet a beszelgetes.';
}

function rankResponseCandidate({ reply, action, mood, userModel, flowResult, decisionPipeline }) {
  const text = String(reply || '').trim();
  const sentenceCount = text.split(/[.!?]/).filter(Boolean).length || 1;
  const naturalness = clamp01(0.55 + (text.length >= 20 ? 0.1 : 0) + (sentenceCount <= 3 ? 0.1 : 0));
  const clarity = clamp01(0.85 - (flowResult?.missingSlots?.length ? 0.25 : 0) - (text.length > 260 ? 0.1 : 0));
  const tonePref = userModel?.communicationStyle?.emotionalTonePreference || 'medium';
  const toneMatch = clamp01(
    tonePref === 'high'
      ? (['tired', 'frustrated', 'sad', 'positive'].includes(mood?.label) ? 0.9 : 0.7)
      : (tonePref === 'low' ? 0.75 : 0.82)
  );
  const taskCorrectness = clamp01(0.9 - (flowResult?.missingSlots?.length ? 0.35 : 0) - (decisionPipeline?.scores?.role < 0.45 ? 0.3 : 0));
  const score = Number((naturalness * 0.2 + clarity * 0.3 + toneMatch * 0.2 + taskCorrectness * 0.3).toFixed(4));
  return {
    reply: text,
    score,
    metrics: {
      naturalness: Number(naturalness.toFixed(4)),
      clarity: Number(clarity.toFixed(4)),
      toneMatch: Number(toneMatch.toFixed(4)),
      taskCorrectness: Number(taskCorrectness.toFixed(4)),
    },
  };
}

function selectBestResponse(candidates = []) {
  return [...candidates].sort((a, b) => b.score - a.score)[0] || null;
}

function evaluateResponseQuality({ reply, flowResult, decisionPipeline, mood }) {
  const clarityScore = Number(clamp01(0.88 - (flowResult?.missingSlots?.length ? 0.3 : 0) - (String(reply || '').length > 260 ? 0.1 : 0)).toFixed(4));
  const correctnessScore = Number(clamp01(0.9 - (decisionPipeline?.scores?.role < 0.45 ? 0.35 : 0) - (flowResult?.missingSlots?.length ? 0.3 : 0)).toFixed(4));
  const userSatisfactionPrediction = Number(clamp01((clarityScore * 0.45) + (correctnessScore * 0.45) + (mood?.label === 'positive' ? 0.1 : 0)).toFixed(4));
  const followUpNeedProbability = Number(clamp01((flowResult?.missingSlots?.length ? 0.6 : 0.2) + (flowResult?.shouldReanchor ? 0.15 : 0)).toFixed(4));
  const learningMarks = [];
  if (clarityScore < 0.7) learningMarks.push('clarity_issue');
  return {
    clarityScore,
    correctnessScore,
    userSatisfactionPrediction,
    followUpNeedProbability,
    learningMarks,
  };
}

function applySafetyConsistencyGate({ reply, decisionPipeline, flowResult, effectiveMode, integrityMismatch, userModel }) {
  if (decisionPipeline?.scores?.role < 0.45) {
    return { blocked: true, reason: 'role_violation', safeReply: 'Ebben a helyzetben inkabb pontositok, hogy szerepkor szerint biztosan helyes valaszt adjak.' };
  }
  if (flowResult?.missingSlots?.length > 0) {
    return { blocked: true, reason: 'missing_critical_slot', safeReply: buildLoopQuestion(flowResult.action) };
  }
  if (integrityMismatch || ['SAFE_MODE', 'FULL_SYSTEM_LOCK'].includes(effectiveMode)) {
    return { blocked: true, reason: 'unstable_policy_state', safeReply: 'Most inkabb biztonsagos modban maradok. Pontositsd kerlek egy rovid kovetkezo lepessel.' };
  }
  if ((userModel?.communicationStyle?.directnessPreference || 0) > 0.8 && String(reply || '').length > 280) {
    return { blocked: false, reason: null, safeReply: String(reply || '').split(/[.!?]\s+/)[0] };
  }
  return { blocked: false, reason: null, safeReply: reply };
}

function inferUserModel(memory, stats, parsed, feedbackQuality) {
  const existing = memory?.userModel || {};
  const total = Math.max(1, Number(stats?.totalMessages || 1));
  const correctionRate = Number((Number(stats?.correctionCount || 0) / total).toFixed(4));
  const frequentIntent = memory?.userPreferences?.frequentIntent || parsed?.intent || null;
  const verbosity = Number(clamp01(existing?.communicationStyle?.verbosity ?? (Number(memory?.userPreferences?.detailLevel === 'high') ? 0.8 : 0.45)).toFixed(4));
  const directnessPreference = Number(clamp01(existing?.communicationStyle?.directnessPreference ?? (memory?.userPreferences?.tone === 'short' ? 0.9 : 0.55)).toFixed(4));
  const toleranceForClarification = Number(clamp01(1 - correctionRate - (feedbackQuality?.quickActionReject ? 0.1 : 0)).toFixed(4));
  return {
    communicationStyle: {
      verbosity,
      directnessPreference,
      emotionalTonePreference: existing?.communicationStyle?.emotionalTonePreference || (feedbackQuality?.sentimentShift ? 'high' : 'medium'),
    },
    behaviorPatterns: {
      frequentIntents: [frequentIntent].filter(Boolean),
      rareIntents: parsed?.intent === 'unknown' ? ['unknown'] : [],
      correctionRate,
    },
    stabilityProfile: {
      prefersConsistency: toleranceForClarification < 0.6,
      toleranceForClarification,
    },
  };
}

function updateConversationState({ currentState, parsed, payload, flowResult, reply }) {
  const existingLoops = Array.isArray(currentState?.openLoops) ? currentState.openLoops : [];
  const normalizedQuestion = String(flowResult.loopQuestion || '').trim();
  const hasSameOpenLoop = normalizedQuestion
    ? existingLoops.some((loop) => loop?.status === 'open' && String(loop?.question || '').trim() === normalizedQuestion)
    : false;
  const nextPhase = flowResult.phase || (flowResult.shouldClarify ? 'waiting_user' : (flowResult.shouldReanchor ? 'resolving' : 'active'));
  const resolvedLoops = flowResult.shouldClarify
    ? existingLoops.map((loop) => ({ ...loop, age: Number(loop?.age || 0) + 1 }))
    : existingLoops.map((loop) => ({ ...loop, awaiting: false, status: 'resolved', age: Number(loop?.age || 0) + 1 }));
  const nextLoops = flowResult.shouldClarify
    ? (hasSameOpenLoop
        ? resolvedLoops
        : [{ question: flowResult.loopQuestion, expectedAnswer: flowResult.missingSlots[0] || parsed?.intent || 'clarification', awaiting: true, status: 'open', age: 0 }, ...resolvedLoops].slice(0, 6))
    : resolvedLoops;
  const currentStack = Array.isArray(currentState?.intentStack) ? currentState.intentStack : [];
  const nextIntentNode = {
    intent: parsed?.intent || currentState?.activeTopic?.intent || 'unknown',
    intentParent: parsed?.intentParent || null,
    confidence: Number(parsed?.confidence || 0),
    timestamp: new Date().toISOString(),
    relatesTo: parsed?.relatesTo || null,
  };
  const nextIntentStack = [
    ...currentStack.filter((item) => item?.intent !== nextIntentNode.intent || item?.relatesTo !== nextIntentNode.relatesTo),
    nextIntentNode,
  ].slice(-8);
  return {
    ...(currentState || {}),
    phase: nextPhase,
    activeTopic: {
      name: payload?.action || parsed?.action || currentState?.activeTopic?.name || 'general',
      intent: (parsed?.keepFlow || ['clarify_last_answer', 'challenge_previous_response'].includes(parsed?.intent))
        ? (currentState?.activeTopic?.intent || parsed?.intent || 'unknown')
        : (parsed?.intent || currentState?.activeTopic?.intent || 'unknown'),
      status: flowResult.shouldClarify ? 'partial' : 'resolved',
      locked: !isExplicitTopicShift(parsed, currentState),
      requiredSlots: flowResult.requiredSlots,
      filledSlots: flowResult.filledSlots,
    },
    openLoops: nextLoops,
    intentStack: nextIntentStack,
    lastGoal: parsed?.intent || currentState?.lastGoal || '',
    continuityScore: flowResult.continuityScore,
    lastReplyPreview: String(reply || '').slice(0, 160),
  };
}

function getIntentParent(intent, action) {
  const byAction = {
    show_my_schedule: 'schedule_help',
    show_my_vacations: 'schedule_help',
    show_my_free_days: 'schedule_help',
    replan_specific_day: 'schedule_help',
    replan_all: 'schedule_help',
    write_schedule_plan: 'schedule_help',
    challenge_previous_response: 'challenge_schedule_help',
    clarify_last_answer: 'clarity_help',
  };
  const byIntent = {
    my_schedule: 'schedule_help',
    my_schedule_presence: 'schedule_help',
    my_vacation: 'schedule_help',
    my_free_days: 'schedule_help',
    replan_day: 'modify_schedule',
    full_replan: 'modify_schedule',
    challenge_previous_response: 'challenge_schedule_help',
    clarify_last_answer: 'clarity_help',
  };
  return byAction[action] || byIntent[intent] || 'general_help';
}

function linkParsedIntentToState({ parsed, conversationState, lastAssistantAction, previousMessageIntent }) {
  const activeIntent = conversationState?.activeTopic?.intent || previousMessageIntent || null;
  const activeAction = conversationState?.activeTopic?.name || lastAssistantAction || null;
  const isFollowUp = Boolean(parsed?.inferredFromContext || ['affirmative', 'negative', 'hesitation', 'challenge_previous_response', 'clarify_last_answer'].includes(parsed?.intent));
  return {
    ...parsed,
    intentParent: getIntentParent(parsed?.intent, parsed?.action),
    relatesTo: isFollowUp ? (activeIntent || mapActionToIntent(activeAction)) : null,
    keepFlow: isFollowUp,
    activeAction,
  };
}

function preserveFollowUpStrategy(decisionPipeline, conversationState, parsed) {
  if (!parsed?.keepFlow) return decisionPipeline;
  const currentStrategy = conversationState?.activeStrategy || null;
  if (!currentStrategy) return decisionPipeline;
  return {
    ...decisionPipeline,
    bestStrategy: currentStrategy,
    conflictResolution: {
      ...(decisionPipeline?.conflictResolution || {}),
      preservedFromState: true,
      resolved: currentStrategy,
    },
  };
}

function tokenizeSimilarity(text) {
  return new Set(normalizeText(text).split(/\s+/).filter(Boolean));
}

function computeResponseSimilarity(a, b) {
  const setA = tokenizeSimilarity(a);
  const setB = tokenizeSimilarity(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const overlap = [...setA].filter((item) => setB.has(item)).length;
  return overlap / Math.max(setA.size, setB.size);
}

function dedupeResponse(reply, conversationState) {
  const lastReply = conversationState?.lastReplyPreview || '';
  const similarity = computeResponseSimilarity(reply, lastReply);
  if (similarity <= 0.8) return { reply, similarity, changed: false };
  const shortened = String(reply || '').split(/[.!?]\s+/)[0]?.trim() || reply;
  return { reply: shortened, similarity, changed: shortened !== reply };
}

function shouldAllowFlowProposal({ parsed, mood }) {
  const positiveOrNeutral = ['positive', 'neutral'].includes(mood?.label);
  const noRejection = !['negative', 'hesitation', 'challenge_previous_response', 'clarify_last_answer'].includes(parsed?.intent);
  return Number(parsed?.confidence || 0) > 0.85 && positiveOrNeutral && noRejection;
}

function isActionConfirmationSatisfied(parsed) {
  if (!parsed) return false;
  if (parsed.intent === 'identity_check') return false;
  if (['list_employees', 'show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'show_vacation_requests', 'missing_drafts'].includes(parsed.intent)) {
    return Number(parsed.confidence || 0) > 0.85 && parsed.confirmed === true;
  }
  return true;
}

function clamp01(value) {
  if (Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function getActionScopes(selectedAction) {
  const employeeOnlyActions = new Set([
    'show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'check_my_schedule_exists',
  ]);
  const pharmacyOnlyActions = new Set([
    'list_employees', 'show_vacation_requests', 'missing_drafts', 'add_employee', 'remove_employee',
  ]);

  return { employeeOnlyActions, pharmacyOnlyActions };
}

function computeRoleScore({ chatRole, selectedAction }) {
  const { employeeOnlyActions, pharmacyOnlyActions } = getActionScopes(selectedAction);

  if (!selectedAction) return 0.65;
  if (chatRole === 'pharmacy') {
    if (employeeOnlyActions.has(selectedAction)) return 0.2;
    if (pharmacyOnlyActions.has(selectedAction)) return 0.95;
    return 0.75;
  }
  if (chatRole === 'employee') {
    if (pharmacyOnlyActions.has(selectedAction)) return 0.2;
    if (employeeOnlyActions.has(selectedAction)) return 0.95;
    return 0.75;
  }

  return 0.7;
}

function computeDecayedContextEvidence(recentConversation = [], nowTs = Date.now()) {
  if (!Array.isArray(recentConversation) || recentConversation.length === 0) return 0;

  const total = recentConversation.reduce((acc, item, idx) => {
    const explicitTs = getTimeMillis(item?.timestamp || item?.createdAt || item?.ts);
    const syntheticTs = nowTs - ((recentConversation.length - idx) * 60 * 1000);
    const sourceTs = explicitTs > 0 ? explicitTs : syntheticTs;
    const minutes = Math.max(0, (nowTs - sourceTs) / 60000);
    const decay = Math.exp(-CONTEXT_DECAY_LAMBDA * minutes);

    const relevance = (() => {
      const norm = normalizeText(item?.text || '');
      let rel = 0.2;
      if (item?.action) rel += 0.35;
      if (item?.intent) rel += 0.2;
      if (hasMonthEntities(item?.entities)) rel += 0.15;
      if (containsAny(norm, ['beoszt', 'szabad', 'tervezet', 'dolgozo', 'tulora'])) rel += 0.1;
      return clamp01(rel);
    })();

    return acc + (decay * relevance);
  }, 0);

  return clamp01(total / Math.max(1, recentConversation.length));
}

function computeContextScore({ message, parsed, recentConversation = [], lastAssistantAction, lastAssistantEntities, selectedAction }) {
  const decayedEvidence = computeDecayedContextEvidence(recentConversation);
  let score = recentConversation.length > 0 ? (0.25 + decayedEvidence * 0.35) : 0.2;

  if (parsed?.inferredFromContext) score += 0.2;
  if (isContinuationPrompt(message)) score += 0.15;
  if (lastAssistantAction && selectedAction && (lastAssistantAction === selectedAction || selectedAction === 'clarify_with_options')) score += 0.15;
  if (hasMonthEntities(lastAssistantEntities) && hasMonthEntities(parsed?.entities)) score += 0.1;

  return clamp01(score);
}

function classifyFeedbackCluster({ parsed, selectedAction, chatRole, mood }) {
  if (chatRole === 'pharmacy' && ['show_my_schedule', 'show_my_vacations', 'show_my_free_days', 'check_my_schedule_exists'].includes(selectedAction)) {
    return 'role_confusion';
  }
  if (['show_my_schedule', 'check_my_schedule_exists', 'show_vacation_requests', 'missing_drafts'].includes(selectedAction)) {
    return 'schedule_accuracy_issue';
  }
  if (['frustrated', 'sad', 'tired'].includes(mood?.label) || parsed?.intent === 'negative') {
    return 'tone_mismatch';
  }
  return 'schedule_accuracy_issue';
}

function detectContradictoryFeedback(windowItems = []) {
  if (!Array.isArray(windowItems) || windowItems.length < 2) return false;
  const lastFew = windowItems.slice(-6);
  const pos = lastFew.filter((i) => Number(i?.feedbackWeight || 0) >= 0.8).length;
  const neg = lastFew.filter((i) => Number(i?.feedbackWeight || 0) < 0.4).length;
  return pos > 0 && neg > 0;
}

function evaluateLearningBoundary({ message, feedbackQuality, recentFeedbackWindow }) {
  const norm = normalizeText(message);
  const blockedSignals = [];

  if (containsAny(norm, ['hulye', 'idiota', 'szar vagy', 'utallak', 'bazd'])) blockedSignals.push('rage_messages');
  if (/([!?])\1{3,}/.test(String(message || '')) || /(.)\1{7,}/.test(norm)) blockedSignals.push('spam_like_corrections');
  if (Number(feedbackQuality?.feedbackWeight || 0) < 0.2) blockedSignals.push('single_interaction_anomalies');
  if (detectContradictoryFeedback(recentFeedbackWindow)) blockedSignals.push('contradictory_feedback_within_short_window');

  return {
    blockedSignals,
    allow: blockedSignals.length === 0,
  };
}

function simulateUpdateImpact({ currentWeights, newWeights, currentScores, driftStatus }) {
  const before = normalizeDecisionWeights(currentWeights || DECISION_WEIGHTS);
  const after = normalizeDecisionWeights(newWeights || before);

  const intentBoost = (after.intent - before.intent) * 0.6;
  const contextBoost = (after.context - before.context) * 0.35;
  const riskBoost = (before.risk - after.risk) * 0.3;
  const predictedPerformanceDelta = Number((intentBoost + contextBoost + riskBoost).toFixed(4));

  const roleConflictChange = Number(((after.role - before.role) * -0.05).toFixed(4));
  const expectedClarificationRate = Number((-(predictedPerformanceDelta * 100) * 0.8).toFixed(2));
  const driftDelta = calculateWeightDistance(after, before);
  const riskOfDrift = clamp01((driftStatus?.driftScore || 0) * 0.7 + driftDelta * 0.6);

  return {
    predictedPerformanceDelta,
    riskOfDrift: Number(riskOfDrift.toFixed(4)),
    roleConflictChange,
    expectedClarificationRate,
    blocked: riskOfDrift > 0.2,
  };
}

function buildWeightChangeLog({ before, after, triggerSources = [], justification = [] }) {
  const normalizedBefore = normalizeDecisionWeights(before || DECISION_WEIGHTS);
  const normalizedAfter = normalizeDecisionWeights(after || normalizedBefore);
  const delta = Object.keys(normalizedBefore).reduce((acc, key) => {
    acc[key] = Number((normalizedAfter[key] - normalizedBefore[key]).toFixed(4));
    return acc;
  }, {});

  return {
    id: `wcl_${Date.now()}`,
    createdAt: new Date().toISOString(),
    before: normalizedBefore,
    after: normalizedAfter,
    delta,
    triggerSources,
    justification,
  };
}

function isWeightChangeLogValid(log) {
  if (!log) return false;
  return Array.isArray(log.triggerSources)
    && log.triggerSources.length > 0
    && Array.isArray(log.justification)
    && log.justification.length > 0;
}

function computeStabilityIndex({ memory, driftStatus, performanceScore }) {
  const auto = memory?.autoTuning || {};
  const stats = memory?.stats || {};
  const currentWeights = normalizeDecisionWeights(memory?.userPreferences?.decisionWeights || DECISION_WEIGHTS);
  const golden = getLatestStableGoldenSnapshot(memory) || getLatestGoldenSnapshot(memory);
  const weightVolatility = calculateWeightDistance(currentWeights, golden?.weights || DECISION_WEIGHTS);
  const driftFrequency = clamp01(Number(auto.driftFrequency || 0));
  const rollbackRate = clamp01(Number(stats.autoWeightApplyCount || 0) > 0
    ? Number((stats.lastRollbackAt ? 1 : 0)) / Number(stats.autoWeightApplyCount || 1)
    : 0);
  const perfScores = Array.isArray(memory?.performance?.recentScores) ? memory.performance.recentScores.slice(-20) : [];
  const performanceVariance = calculateConfidenceVariance(perfScores.map((v) => Number(v || 0)));

  const stabilityIndex = clamp01(
    weightVolatility * 0.4
    + driftFrequency * 0.3
    + rollbackRate * 0.2
    + performanceVariance * 0.1
  );

  return {
    stabilityIndex: Number(stabilityIndex.toFixed(4)),
    weightVolatility: Number(weightVolatility.toFixed(4)),
    driftFrequency: Number(driftFrequency.toFixed(4)),
    rollbackRate: Number(rollbackRate.toFixed(4)),
    performanceVariance: Number(performanceVariance.toFixed(4)),
    shouldDowngrade: stabilityIndex > STABILITY_INDEX_THRESHOLD,
    driftScore: Number(driftStatus?.driftScore || 0),
    performanceScore: Number(performanceScore || 0),
  };
}

function buildPolicyVersion({ memory, weights, strategyMapping, performanceScore, stabilityIndex }) {
  const existing = Array.isArray(memory?.policyVersions) ? memory.policyVersions : [];
  const latest = existing[existing.length - 1];
  const nextPatch = Number((latest?.id || 'v0.0.0').split('.').pop() || 0) + 1;

  return {
    id: `v1.0.${nextPatch}`,
    createdAt: new Date().toISOString(),
    weights: normalizeDecisionWeights(weights || DECISION_WEIGHTS),
    strategyMapping: strategyMapping || {
      direct_answer: 'default',
      clarify: 'default',
      safe_clarify: 'default',
      empathetic_support: 'default',
      empathetic_clarify: 'default',
      role_redirect: 'default',
    },
    performanceScore: Number(performanceScore || 0),
    stabilityIndex: Number(stabilityIndex || 0),
  };
}

function computeRiskSignals({ parsed, mood, intentScore, roleScore, selectedAction }) {
  const { employeeOnlyActions, pharmacyOnlyActions } = getActionScopes(selectedAction);
  const uncertainIntent = clamp01(1 - intentScore);
  const roleMismatch = clamp01(1 - roleScore);

  const sensitiveAction = ['add_employee', 'remove_employee', 'replan_all'].includes(selectedAction)
    || employeeOnlyActions.has(selectedAction)
    || pharmacyOnlyActions.has(selectedAction);
  const dataSensitivity = sensitiveAction ? 0.75 : 0.25;

  const emotionalInstability = ['frustrated', 'sad'].includes(mood?.label)
    ? 0.8
    : (mood?.label === 'tired' ? 0.45 : 0.2);

  return {
    intentUncertainty: uncertainIntent,
    roleMismatch,
    dataSensitivity,
    emotionalInstability,
    isSensitiveAction: sensitiveAction,
  };
}

function computeRiskScore(signals) {
  const score = (
    signals.intentUncertainty * 0.4
    + signals.roleMismatch * 0.3
    + signals.dataSensitivity * 0.2
    + signals.emotionalInstability * 0.1
  );
  return clamp01(score);
}

function buildFeatureLayer({ message, parsed, mood, chatRole, recentConversation, lastAssistantAction, lastAssistantEntities, selectedAction, scores, riskSignals }) {
  const isRoleMismatch = scores.role < 0.45;
  const isNegativeMood = ['frustrated', 'sad', 'tired'].includes(mood?.label);
  const isLowConfidence = scores.intent < LOW_CONFIDENCE_THRESHOLD;
  const isFollowUp = Boolean(parsed?.inferredFromContext || isContinuationPrompt(message));
  const hasContext = recentConversation.length > 0 || Boolean(lastAssistantAction);
  const isRiskyIntent = riskSignals.isSensitiveAction || scores.risk >= 0.65;

  return {
    hasContext,
    isFollowUp,
    isNegativeMood,
    isLowConfidence,
    isRoleMismatch,
    isRiskyIntent,
    isUnknownIntent: parsed?.intent === 'unknown',
    isClarifyAction: selectedAction === 'clarify_with_options',
    hasMonthMemory: hasMonthEntities(lastAssistantEntities),
    role: chatRole,
  };
}

function computeWeightedDecisionScore({ scores, weights = DECISION_WEIGHTS }) {
  return clamp01(
    scores.intent * weights.intent
    + scores.context * weights.context
    + scores.role * weights.role
    + scores.mood * weights.mood
    + (1 - scores.risk) * weights.risk
  );
}

function scoreStrategies({ weightedScore, scores, features }) {
  const strategyScores = {
    direct_answer: weightedScore + (features.isLowConfidence ? -0.25 : 0.1) + (features.isRoleMismatch ? -0.5 : 0.05),
    clarify: (1 - scores.intent) * 0.5 + (features.isFollowUp ? 0.1 : 0) + (features.isLowConfidence ? 0.2 : 0),
    safe_clarify: scores.risk * 0.7 + (features.isRiskyIntent ? 0.2 : 0),
    empathetic_support: (features.isNegativeMood ? 0.45 : 0.05) + (features.isLowConfidence ? 0.2 : 0) + (features.isUnknownIntent ? 0.2 : 0),
    empathetic_clarify: (features.isNegativeMood ? 0.35 : 0.05) + (1 - scores.intent) * 0.35 + scores.risk * 0.2,
    role_redirect: (features.isRoleMismatch ? 0.9 : 0.02) + scores.risk * 0.1,
  };

  return Object.fromEntries(
    Object.entries(strategyScores).map(([k, v]) => [k, Number(clamp01(v).toFixed(3))])
  );
}

function applyStrategyPenaltyFromMetrics(strategyScores, strategyMetrics = {}) {
  const next = { ...(strategyScores || {}) };
  Object.keys(next).forEach((strategy) => {
    const metric = strategyMetrics?.[strategy] || {};
    const avgLatencyMs = Number(metric?.avgLatencyMs || 0);
    const successRate = Number(metric?.successRate || 0.7);
    const latencyPenalty = avgLatencyMs > STRATEGY_LATENCY_BAD_MS ? 0.12 : 0;
    const successPenalty = successRate < 0.45 ? 0.18 : 0;
    next[strategy] = Number(clamp01(next[strategy] - latencyPenalty - successPenalty).toFixed(3));
  });
  return next;
}

function applyStrategyMemoryAdjustment(strategyScores, strategyMemory = {}) {
  const next = { ...(strategyScores || {}) };
  Object.keys(next).forEach((strategy) => {
    const memory = strategyMemory?.[strategy] || {};
    const successTrend = Number(memory?.successTrend || 0);
    const failureTrend = Number(memory?.failureTrend || 0);
    const contextSensitivity = Number(memory?.contextSensitivity || 0);
    const adjustment = (successTrend * 0.12) - (failureTrend * 0.15) + (contextSensitivity * 0.08);
    next[strategy] = Number(clamp01(next[strategy] + adjustment).toFixed(3));
  });
  return next;
}

function pickMaxStrategy(strategyScores) {
  return Object.entries(strategyScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'clarify';
}

function buildDecisionReasoning({ parsed, scores, features, strategyScores, bestStrategy }) {
  const lines = [];
  lines.push(`intent confidence ${scores.intent >= LOW_CONFIDENCE_THRESHOLD ? 'high' : 'low'} (${scores.intent.toFixed(2)})`);
  lines.push(features.isFollowUp ? 'context continuation detected' : 'no strong continuation context');
  lines.push(features.isRoleMismatch ? 'role mismatch detected' : `role match strong (${scores.role.toFixed(2)})`);
  lines.push(`risk ${scores.risk >= 0.65 ? 'elevated' : 'low'} (${scores.risk.toFixed(2)})`);
  lines.push(`selected ${bestStrategy} due to max score (${strategyScores[bestStrategy]?.toFixed(3) || 'n/a'})`);
  if (parsed?.reasoning?.source) lines.push(`parser source: ${parsed.reasoning.source}`);
  return lines;
}

function buildDecisionPipeline({ message, parsed, mood, chatRole, recentConversation, lastAssistantAction, lastAssistantEntities, selectedAction, weights, memory }) {
  const intentScore = clamp01(parsed?.confidence || 0);
  const moodScore = clamp01(mood?.confidence || 0);
  const contextScore = computeContextScore({
    message,
    parsed,
    recentConversation,
    lastAssistantAction,
    lastAssistantEntities,
    selectedAction,
  });
  const roleScore = computeRoleScore({ chatRole, selectedAction });
  const riskSignals = computeRiskSignals({ parsed, mood, intentScore, roleScore, selectedAction });
  const riskScore = computeRiskScore(riskSignals);

  const scores = {
    intent: Number(intentScore.toFixed(3)),
    mood: Number(moodScore.toFixed(3)),
    context: Number(contextScore.toFixed(3)),
    role: Number(roleScore.toFixed(3)),
    risk: Number(riskScore.toFixed(3)),
  };

  const features = buildFeatureLayer({
    message,
    parsed,
    mood,
    chatRole,
    recentConversation,
    lastAssistantAction,
    lastAssistantEntities,
    selectedAction,
    scores,
    riskSignals,
  });

  const effectiveWeights = normalizeByImpactHistory(memory, normalizeDecisionWeights(weights || DECISION_WEIGHTS));
  const weightedScore = Number(computeWeightedDecisionScore({ scores, weights: effectiveWeights }).toFixed(3));
  const baseStrategyScores = scoreStrategies({ weightedScore, scores, features });
  const withLatencyPenalty = applyStrategyPenaltyFromMetrics(baseStrategyScores, memory?.strategyMetrics || {});
  const strategyScores = applyStrategyMemoryAdjustment(withLatencyPenalty, memory?.strategyMemory || {});
  const weightedSuggested = weightedScore > 0.55 ? 'direct_answer' : 'clarify';
  const strategySuggested = pickMaxStrategy(strategyScores);
  const conflictResolution = resolveStrategyConflict({
    weightedSuggested,
    strategySuggested,
    intentConfidence: scores.intent,
    contextUncertainty: 1 - scores.context,
  });
  const bestStrategy = conflictResolution.resolved;
  const reasoning = buildDecisionReasoning({ parsed, scores, features, strategyScores, bestStrategy });

  return {
    input: {
      intent: parsed?.intent || 'unknown',
      action: selectedAction || parsed?.action || 'unknown',
      mood: mood?.label || 'neutral',
      role: chatRole || 'default',
    },
    features,
    scores,
    weights: effectiveWeights,
    weightedScore,
    strategyScores,
    weightedSuggested,
    strategySuggested,
    conflictResolution,
    bestStrategy,
    reasoning,
  };
}

function applyDecisionStrategy({ reply, bestStrategy }) {
  if (!reply || !bestStrategy) return reply;

  if (bestStrategy === 'safe_clarify') {
    return `Hogy pontos maradjak: ${reply}`;
  }
  if (bestStrategy === 'empathetic_clarify') {
    return `Ertem, es segitek vegig menni rajta. ${reply}`;
  }
  if (bestStrategy === 'role_redirect') {
    return `Ebben a szerepkorben egy biztonsagosabb iranyt valasztok. ${reply}`;
  }

  return reply;
}

function buildActionPlan(action, entities = {}) {
  const actionMap = {
    show_my_schedule: 'fetch_schedule',
    check_my_schedule_exists: 'check_schedule_presence',
    show_my_vacations: 'fetch_vacations',
    show_my_free_days: 'fetch_free_days',
    list_employees: 'fetch_employees',
    show_vacation_requests: 'fetch_vacation_requests',
    missing_drafts: 'check_missing_drafts',
    show_overtime: 'fetch_overtime',
    replan_specific_day: 'replan_day',
    find_replacement: 'find_replacement',
    replan_all: 'replan_all',
    clarify_with_options: 'clarify',
    add_employee: 'prepare_add_employee',
    remove_employee: 'prepare_remove_employee',
  };

  return {
    type: actionMap[action] || 'conversation',
    params: {
      ...(entities || {}),
    },
  };
}

function mapActionToIntent(action) {
  const actionToIntent = {
    check_my_schedule_exists: 'my_schedule_presence',
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
    check_my_schedule_exists: 'Rendben, megnezem, van-e beosztasod.',
    show_my_schedule: 'Rendben, megmutatom a sajat muszakjaidat. Ha dolgozoi nezetben vagy, pontos listat is kapsz.',
    show_my_vacations: 'Rendben, megnezem a szabadsag napjaidat.',
    show_my_free_days: 'Rendben, kilistazom a kovetkezo szabadnapjaidat.',
    follow_up_decline: 'Rendben. Pontosits kerlek, mire koncentráljak inkabb ugyanebben a temaban.',
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
    const conversationId = body?.conversationId || context?.conversationId || null;
    const chatRole = normalizeChatRole(context?.chatRole);
    const userName = typeof context?.userName === 'string' ? context.userName.trim().split(/\s+/)[0] : null; // csak keresztnév
    const recentConversation = Array.isArray(context?.recentConversation) ? context.recentConversation.slice(-6) : [];
    const uid = authUser.uid;
    const previousMessageIntent = body?.previousMessageIntent;
    const lastAssistantMessage = context?.lastAssistantMessage || '';
    const lastAssistantAction = context?.lastAssistantAction || '';
    const lastAssistantEntities = context?.lastAssistantEntities || null;
    const learningFeedback = body?.learningFeedback || null;

    const mood = detectConversationalMood({ message, recentConversation });
    let longTermMemory = await loadBettiLongTermMemory(uid);

    // Load stored conversation state
    const storedState = longTermMemory?.conversationState || null;
    const conversationState = storedState && typeof storedState === 'object'
      ? { ...buildDefaultConversationState(), ...storedState, openLoops: Array.isArray(storedState.openLoops) ? storedState.openLoops.slice(-6) : [] }
      : buildDefaultConversationState();

    // ── TRAINING INPUT (xx <response>) ──────────────────────────────────────
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
      const pattern = buildTrainingPattern(intentForTraining, originalQuestion, training.trainingResponse);
      if (!pattern.pattern) {
        return NextResponse.json({
          success: false,
          error: 'Nem talaltam tanithato kerdesmintat. Elobb kerdezz valamit, aztan ird: "xx ..."',
        }, { status: 400 });
      }
      const saveResult = await saveTrainingPattern(uid, pattern);
      if (saveResult.success) {
        const stats = longTermMemory?.stats || {};
        await saveBettiLongTermMemory(uid, {
          stats: { ...stats, trainingCount: Number(stats.trainingCount || 0) + 1, totalMessages: Number(stats.totalMessages || 0) + 1, lastSeenIntent: 'training_saved', lastSeenAt: new Date().toISOString() },
        });
        return NextResponse.json({
          success: true,
          isTraining: true,
          intent: 'training_saved',
          reply: `✓ Megtanultam! Legkozelebb ha azt kerdezed: "${originalQuestion}" erre valaszolok: "${training.trainingResponse}"`,
          payload: { action: 'training_saved', pattern },
          quickActions: [],
        });
      }
      return NextResponse.json({ success: false, error: `Tanitas sikertelen: ${saveResult.error || 'Ismeretlen hiba'}` }, { status: 500 });
    }

    // ── LOAD PATTERNS ────────────────────────────────────────────────────────
    const learnedPatterns = await loadTrainingPatterns(uid);

    // ── ACTIVE LEARNING: quick action selection → auto-save pattern ──────────
    if (
      learningFeedback?.type === 'intent_selection'
      && learningFeedback?.originalMessage
      && learningFeedback?.selectedPrompt
    ) {
      const selectedParsed = parseBettiIntent(learningFeedback.selectedPrompt, learnedPatterns);
      if (selectedParsed.intent !== 'unknown') {
        const autoPattern = buildTrainingPattern(selectedParsed.intent, learningFeedback.originalMessage, selectedParsed.reply);
        autoPattern.action = selectedParsed.action;
        autoPattern.source = 'quick_action_selection';
        await saveTrainingPattern(uid, autoPattern);
      }
    }

    // ── PARSE INTENT ─────────────────────────────────────────────────────────
    // ── LEARNED PATTERNS (user-trained) → first check ────────────────────────
    const parsedForLearned = parseBettiIntent(message, learnedPatterns);
    if (parsedForLearned.isLearned && (parsedForLearned.learnedPatternId || parsedForLearned.learnedPatternFingerprint)) {
      await recordTrainingPatternUsage(uid, parsedForLearned.learnedPatternId || parsedForLearned.learnedPatternFingerprint);
    }

    // ── LLM-FIRST ROUTING ────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const LLM_DAILY_LIMIT = 50;
    const llmRateStats = longTermMemory?.stats?.llm || {};
    const llmCallsToday = llmRateStats.date === today ? (llmRateStats.callsToday || 0) : 0;
    const rateLimitExceeded = llmCallsToday >= LLM_DAILY_LIMIT;

    let parsed = parsedForLearned;
    let action, finalReply, pipelinePayload = {}, quickActions = [], nextConversationState = conversationState;
    let usedLLM = false, responseRoute = 'LLM';

    if (parsedForLearned.isLearned && parsedForLearned.reply) {
      // User-trained response → direct use, no LLM needed
      action = parsedForLearned.action || parsedForLearned.intent || 'clarify';
      finalReply = parsedForLearned.reply;
      pipelinePayload = { action, entities: parsedForLearned.entities || {}, suggestedAction: action };
      quickActions = buildSuccessQuickActions({ action, chatRole, entities: parsedForLearned.entities || {} });
      responseRoute = 'LEARNED';
    } else if (rateLimitExceeded) {
      responseRoute = 'RATE_LIMIT';
      action = 'clarify';
      parsed = { intent: 'clarify', confidence: 0 };
      finalReply = chatRole === 'pharmacy'
        ? 'Ma már elértem a napi segítési limitemet. Holnaptól újra tudok segíteni beosztással kapcsolatban!'
        : 'Ma már elértem a napi segítési limitemet. Holnaptól újra tudok segíteni a beosztásoddal kapcsolatban!';
      quickActions = getSuggestionPool(chatRole).slice(0, 3);
    } else {
      const routerResult = await callBettiLLMRouter({
        message,
        chatRole,
        userName,
        recentConversation,
        stats: context.stats || null,
      });

      if (routerResult.error) {
        console.warn('[Betti LLM Router] Fallback to rule pipeline:', routerResult.error);
        // Fallback: rule-based pipeline if LLM fails
        const pipelineResult = runBettiPipeline({
          message,
          parsed: parsedForLearned,
          conversationState,
          chatRole,
          context: { ...context, _handlers: { explainAssignmentDecision } },
          mood,
          lastAssistantAction,
          lastAssistantEntities,
          lastAssistantMessage,
          previousMessageIntent,
        });
        action = pipelineResult.action;
        finalReply = pipelineResult.reply;
        pipelinePayload = pipelineResult.payload || {};
        quickActions = pipelineResult.quickActions || [];
        nextConversationState = pipelineResult.nextConversationState || conversationState;
        parsed = parsedForLearned;
        responseRoute = 'RULE_FALLBACK';
      } else {
        action = routerResult.action;
        finalReply = routerResult.reply;
        const routerEntities = routerResult.entities || {};
        pipelinePayload = { action, entities: routerEntities, suggestedAction: action };
        quickActions = buildSuccessQuickActions({ action, chatRole, entities: routerEntities });
        parsed = { intent: action, confidence: 1.0, entities: routerEntities };
        usedLLM = true;
        responseRoute = 'LLM';
      }
    }

    finalReply = stabilizeReplyText(finalReply, chatRole);

    // ── PROACTIVE WARNINGS ───────────────────────────────────────────────────
    const proactiveWarnings = buildProactiveWarnings({
      stats: context.stats || null,
      conflicts: Array.isArray(context.conflicts) ? context.conflicts : [],
    });

    // ── SAVE STATE ───────────────────────────────────────────────────────────
    const stats = longTermMemory?.stats || {};
    const prevLlm = stats.llm || {};
    const updatedStats = {
      ...stats,
      totalMessages: Number(stats.totalMessages || 0) + 1,
      unknownCount: Number(stats.unknownCount || 0) + (parsed.intent === 'unknown' ? 1 : 0),
      lastSeenIntent: parsed.intent,
      lastSeenAt: new Date().toISOString(),
      llm: {
        date: today,
        callsToday: (prevLlm.date === today ? (prevLlm.callsToday || 0) : 0) + (usedLLM ? 1 : 0),
        totalCalls: Number(prevLlm.totalCalls || 0) + (usedLLM ? 1 : 0),
      },
    };

    const uiCommands = buildChatUiCommands({
      action,
      chatRole,
      entities: pipelinePayload?.entities || {},
    });

    const nextSessionMemory = [
      ...(Array.isArray(longTermMemory?.sessionMemory) ? longTermMemory.sessionMemory.slice(-11) : []),
      { text: message, intent: parsed.intent, action, entities: pipelinePayload?.entities || {}, at: new Date().toISOString() },
    ];

    await saveBettiLongTermMemory(uid, {
      conversationState: nextConversationState,
      sessionMemory: nextSessionMemory,
      stats: updatedStats,
    });

    // ── RESPOND ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      intent: parsed.intent,
      action,
      reply: finalReply,
      usedLLM,
      debug: {
        responseRoute,
      },
      payload: {
        ...pipelinePayload,
        uiCommands,
        conversationState: nextConversationState,
      },
      quickActions: quickActions || [],
      proactiveWarnings,
      analysis: {
        mood,
        confidence: Number(parsed.confidence || 0),
        topCandidates: parsed.topCandidates || [],
      },
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
